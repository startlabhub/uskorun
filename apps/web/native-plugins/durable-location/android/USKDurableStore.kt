// USKORUN-owned durable GPS log; MIT LICENSE.
// Android app-private JSONL, FileDescriptor.sync() per real OS fix.
// JS drain is non-destructive; ACK only after durable PendingRun save.
package com.uskorun.app

import android.content.Context
import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

data class USKRun(
    val clientId: String, val activityId: String, val kind: String,
    val segment: Int, val active: Boolean
)
data class USKRecord(
    val seq: Int, val clientId: String, val activityId: String,
    val segment: Int, val lat: Double, val lon: Double,
    val accuracy: Double, val t: Double
) {
    fun toJson() = JSONObject()
        .put("seq",seq).put("clientId",clientId).put("activityId",activityId)
        .put("segment",segment).put("lat",lat).put("lon",lon)
        .put("accuracy",accuracy).put("t",t)
    companion object {
        fun fromJson(o: JSONObject) = USKRecord(
            o.getInt("seq"),o.getString("clientId"),o.getString("activityId"),
            o.getInt("segment"),o.getDouble("lat"),o.getDouble("lon"),
            o.getDouble("accuracy"),o.getDouble("t")
        )
    }
}
data class USKDrainResult(
    val records:List<USKRecord>,val active:Boolean,val overflow:Boolean,
    val loss:String?
)
class USKDurableStore private constructor(context: Context) {
    companion object {
        @Volatile private var instance: USKDurableStore? = null
        fun get(context: Context): USKDurableStore =
            instance ?: synchronized(this) {
                instance ?: USKDurableStore(context.applicationContext).also {instance=it}
            }
    }
    private val folder=File(context.filesDir,"uskorun-native-gps")
    private val metaFile:AtomicFile
    private val logFile:File
    private val crypto=USKQueueCrypto()
    private var lostReason:String?=null
    private var lostRun:USKRun?=null
    private var activeRun:USKRun?=null
    private var ackThrough=0
    private var lastSeq=0
    private var overflow=false
    private var startupError:String?=null
    init {
        folder.mkdirs()
        metaFile=AtomicFile(File(folder,"state-v1.json"))
        logFile=File(folder,"fixes-v1.jsonl")
        try {
            if(metaFile.baseFile.exists()){
                val m=JSONObject(String(metaFile.openRead().use{it.readBytes()},Charsets.UTF_8))
                require(m.getInt("version")==1){"GPS queue schema mismatch"}
                ackThrough=m.getInt("ackThrough")
                lastSeq=m.getInt("lastSeq")
                overflow=m.optBoolean("overflow",false)
                lostReason=m.optString("loss").takeIf{it.isNotEmpty() && it!="null"}
                if(!m.isNull("lostRun")){
                    val old=m.getJSONObject("lostRun")
                    lostRun=USKRun(old.getString("clientId"),old.getString("activityId"),
                        old.getString("kind"),old.getInt("segment"),false)
                }
                if(!m.isNull("run")){
                    val r=m.getJSONObject("run")
                    activeRun=USKRun(r.getString("clientId"),r.getString("activityId"),
                        r.getString("kind"),r.getInt("segment"),r.getBoolean("active"))
                }
            }
            // A crashed legacy migration must not masquerade as an empty route.
            if(!logFile.exists()&&folder.listFiles()?.any{it.name.startsWith("fixes-v1.legacy-")}==true)
                throw IOException("Legacy GPS migration interrupted; inspect preserved backup")
            val decoded=readAll()
            lastSeq=maxOf(lastSeq,decoded.lastOrNull()?.seq?:0)
            // Existing unencrypted NATIVE-03 queue: convert before continuing.
            if(logFile.exists()&&logFile.useLines{lines->lines.any{it.startsWith("{")}})
                migrateLegacy(decoded)
            writeMeta()
        }catch(e:Exception){
            // Corrupt / undecryptable queue or Keystore reset is NOT fatal to
            // the Android process. Preserve both files and start a fresh queue,
            // with a persistent loss warning exposed by drain() to JS.
            try{recoverUnreadableQueue(e)}catch(recovery:Exception){
                startupError="GPS queue recovery failed; original files kept: "+recovery.message
            }
        }
    }
    private fun recoverUnreadableQueue(cause:Exception){
        val stamp=System.currentTimeMillis()
        val name="unreadable-$stamp"
        // Keep original bytes for owner-approved diagnostics. Never log
        // plaintext coordinates or cryptographic key material.
        if(metaFile.baseFile.exists()){
            metaFile.baseFile.copyTo(File(folder,"state-$name.json"),overwrite=false)
        }
        if(logFile.exists()&&!logFile.renameTo(File(folder,"fixes-$name.jsonl")))
            throw IOException("Cannot preserve unreadable GPS log")
        activeRun?.let{lostRun=it.copy(active=false)}
        activeRun=null;ackThrough=0;lastSeq=0;overflow=false
        lostReason="Previous GPS queue unreadable (key lost/corruption). " +
            "Old file preserved as fixes-$name.jsonl; those samples were NOT recovered. " +
            "Abandon the prior session before starting again."
        writeMeta()
    }
    private fun migrateLegacy(rows:List<USKRecord>){
        // Keep old log untouched until every record has been encrypted+fsynced.
        val stage=File(folder,"fixes-v1.encrypted.tmp")
        FileOutputStream(stage,false).use{out->
            rows.forEach{r->
                val encrypted=crypto.seal(r.toJson().toString().toByteArray(Charsets.UTF_8))
                out.write((encrypted+"\n").toByteArray(Charsets.UTF_8))
            }
            out.fd.sync()
        }
        val backup=File(folder,"fixes-v1.legacy-"+System.currentTimeMillis()+".jsonl")
        if(!logFile.renameTo(backup))throw IOException("Cannot stage legacy queue backup")
        if(!stage.renameTo(logFile)){
            backup.renameTo(logFile)
            throw IOException("Cannot install encrypted queue; legacy file retained")
        }
        // Deletion cannot guarantee secure erase on flash; document this.
        if(!backup.delete())throw IOException("Legacy plaintext backup could not be removed")
    }
    @Synchronized private fun ensureHealthy(){
        startupError?.let{throw IllegalStateException("GPS queue unavailable: $it")}
    }
    @Synchronized fun current():USKRun?=activeRun
    @Synchronized fun isActive()=activeRun?.active==true
    private fun writeMeta(){
        val run=activeRun?.let{JSONObject().put("clientId",it.clientId)
            .put("activityId",it.activityId).put("kind",it.kind)
            .put("segment",it.segment).put("active",it.active)}?:JSONObject.NULL
        val json=JSONObject().put("version",1).put("run",run)
            .put("ackThrough",ackThrough).put("lastSeq",lastSeq).put("overflow",overflow)
            .put("loss",lostReason?:JSONObject.NULL)
            .put("lostRun",lostRun?.let{JSONObject().put("clientId",it.clientId)
                .put("activityId",it.activityId).put("kind",it.kind)
                .put("segment",it.segment).put("active",false)}?:JSONObject.NULL)
        val stream=metaFile.startWrite()
        try {
            stream.write(json.toString().toByteArray(Charsets.UTF_8))
            stream.fd.sync()
            metaFile.finishWrite(stream)
        }catch(e:Exception){metaFile.failWrite(stream);throw e}
    }
    @Synchronized private fun readAll():List<USKRecord>{
        if(!logFile.exists())return emptyList()
        val bytes=logFile.readBytes()
        if(bytes.isNotEmpty() && bytes.last()!=10.toByte())
            throw IllegalStateException("Incomplete on-disk GPS log tail; stop and inspect")
        val lines=String(bytes,Charsets.UTF_8).split('\n').filter{it.isNotBlank()}
        val out=lines.map{line->
            val bytes=if(line.startsWith(USKQueueCrypto.PREFIX))crypto.open(line)
                else if(line.startsWith("{"))line.toByteArray(Charsets.UTF_8) // legacy migration only
                else throw IllegalStateException("Unknown GPS queue record encoding")
            USKRecord.fromJson(JSONObject(String(bytes,Charsets.UTF_8)))
        }
        out.zipWithNext().forEach{(a,b)->
            require(b.seq==a.seq+1){"Native GPS sequence gap/corruption"}
        }
        return out
    }
    @Synchronized fun begin(clientId:String,activityId:String,kind:String,segment:Int){
        ensureHealthy()
        require(clientId.isNotEmpty()&&activityId.isNotEmpty()&&(kind=="run"||kind=="walk")&&segment in 0..10000)
        require(lostRun==null){"Previous GPS queue lost: Abandon its pending session before starting"}
        activeRun?.let{
            require(it.clientId==clientId&&it.activityId==activityId&&it.kind==kind){
                "Previous native session must be drained and reset first"
            }
            require(segment>=it.segment){"Segment moved backwards"}
        }?:run{
            require(readAll().all{it.seq<=ackThrough}){"Previous GPS fixes unacknowledged"}
        }
        activeRun=USKRun(clientId,activityId,kind,segment,true)
        writeMeta()
    }
    @Synchronized fun pause(){
        ensureHealthy()
        activeRun=activeRun?.copy(active=false)
        writeMeta()
    }
    @Synchronized fun append(lat:Double,lon:Double,accuracy:Double,t:Double){
        ensureHealthy()
        val run=activeRun?:return
        if(!run.active)return
        if(!listOf(lat,lon,accuracy,t).all{it.isFinite()}||
           kotlin.math.abs(lat)>90||kotlin.math.abs(lon)>180||
           accuracy<0||accuracy>50||t<=0)return
        if(lastSeq-ackThrough>=10000){
            overflow=true;writeMeta()
            throw IllegalStateException("Native GPS queue full; Finish or Abandon")
        }
        val next=USKRecord(lastSeq+1,run.clientId,run.activityId,run.segment,
            lat,lon,accuracy,t)
        // Encrypt/authenticate BEFORE append. Each line holds only
        // gcm1:Base64(12-byte IV || ciphertext || 16-byte tag), never raw GPS.
        val line=crypto.seal(next.toJson().toString().toByteArray(Charsets.UTF_8))
        FileOutputStream(logFile,true).use{
            it.write((line+"\n").toByteArray(Charsets.UTF_8))
            it.fd.sync()
        }
        lastSeq=next.seq
        writeMeta()
    }
    @Synchronized fun drain(limit:Int):USKDrainResult{
        ensureHealthy()
        require(limit in 1..500){"Drain limit must be 1..500"}
        return USKDrainResult(readAll().filter{it.seq>ackThrough}.take(limit),
            isActive(),overflow,lostReason)
    }
    @Synchronized fun ack(clientId:String,activityId:String,seqs:List<Int>):Int{
        ensureHealthy()
        val run=activeRun?:throw IllegalStateException("No native session")
        require(run.clientId==clientId&&run.activityId==activityId){"ACK session mismatch"}
        val pending=readAll().filter{it.seq>ackThrough}
        require(pending.take(seqs.size).map{it.seq}==seqs){"ACK must be contiguous prefix"}
        if(seqs.isNotEmpty()){
            ackThrough=seqs.last()
            writeMeta()
        }
        return seqs.size
    }
    @Synchronized fun reset(clientId:String,activityId:String){
        ensureHealthy()
        val run=activeRun
        if(run==null&&lostRun?.clientId==clientId&&lostRun?.activityId==activityId){
            // Explicit Abandon after key loss; original encrypted file remains
            // quarantined for diagnostics, with no GPS points fabricated.
            lostRun=null;lostReason=null;writeMeta()
            return
        }
        require(run!=null){"No session"}
        require(run.clientId==clientId&&run.activityId==activityId){"Reset session mismatch"}
        require(!run.active){"Stop tracking before resetting"}
        require(readAll().all{it.seq<=ackThrough}){"Unacknowledged GPS fixes; refuse reset"}
        // All fixes already acknowledged to JS; no unaccepted data to discard.
        val original=activeRun
        activeRun=null
        try {
            File(folder,"fixes-v1.jsonl").writeBytes(byteArrayOf())
            ackThrough=0;lastSeq=0;overflow=false
            writeMeta()
        }catch(e:Exception){
            activeRun=original
            startupError=e.message
            throw e
        }
    }
}
