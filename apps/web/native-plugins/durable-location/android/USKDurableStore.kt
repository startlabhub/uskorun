// USKORUN-owned durable GPS log; MIT LICENSE.
// Android app-private JSONL, FileDescriptor.sync() per real OS fix.
// JS drain is non-destructive; ACK only after durable PendingRun save.
package com.uskorun.app

import android.content.Context
import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

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
                if(!m.isNull("run")){
                    val r=m.getJSONObject("run")
                    activeRun=USKRun(r.getString("clientId"),r.getString("activityId"),
                        r.getString("kind"),r.getInt("segment"),r.getBoolean("active"))
                }
            }
            lastSeq=maxOf(lastSeq,readAll().lastOrNull()?.seq?:0)
            writeMeta()
        } catch(e:Exception){startupError=e.message?:"damaged on-disk GPS"}
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
        val out=lines.map{USKRecord.fromJson(JSONObject(it))}
        out.zipWithNext().forEach{(a,b)->
            require(b.seq==a.seq+1){"Native GPS sequence gap/corruption"}
        }
        return out
    }
    @Synchronized fun begin(clientId:String,activityId:String,kind:String,segment:Int){
        ensureHealthy()
        require(clientId.isNotEmpty()&&activityId.isNotEmpty()&&(kind=="run"||kind=="walk")&&segment in 0..10000)
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
        FileOutputStream(logFile,true).use{
            it.write((next.toJson().toString()+"\n").toByteArray(Charsets.UTF_8))
            it.fd.sync()
        }
        lastSeq=next.seq
        writeMeta()
    }
    @Synchronized fun drain(limit:Int):Triple<List<USKRecord>,Boolean,Boolean>{
        ensureHealthy()
        require(limit in 1..500){"Drain limit must be 1..500"}
        return Triple(readAll().filter{it.seq>ackThrough}.take(limit),isActive(),overflow)
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
        val run=activeRun?:throw IllegalStateException("No session")
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
