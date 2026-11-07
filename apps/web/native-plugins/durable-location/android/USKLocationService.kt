// User-started Android foreground service, app-owned, MIT LICENSE.
// No Play Services, subscriptions or paid libraries.
package com.uskorun.app

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.*
import android.util.Log

class USKLocationService:Service(),LocationListener {
    companion object {
        const val ACTION_START="com.uskorun.app.USK_LOCATION_START"
        const val ACTION_STOP="com.uskorun.app.USK_LOCATION_STOP"
        const val CHANNEL="uskorun_location_v1"
        const val NOTIFICATION_ID=19071
        fun start(context:Context){
            val i=Intent(context,USKLocationService::class.java).setAction(ACTION_START)
            if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)
                context.startForegroundService(i)
            else context.startService(i)
        }
        fun stop(context:Context){
            context.startService(Intent(context,USKLocationService::class.java).setAction(ACTION_STOP))
        }
    }
    private lateinit var manager:LocationManager
    private lateinit var store:USKDurableStore
    private var subscribed=false
    override fun onBind(intent:Intent?) : IBinder?=null

    override fun onCreate(){
        super.onCreate()
        store=USKDurableStore.get(applicationContext)
        manager=getSystemService(LOCATION_SERVICE) as LocationManager
        val channels=getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O){
            channels.createNotificationChannel(NotificationChannel(CHANNEL,
                "USKORUN route recording",NotificationManager.IMPORTANCE_LOW))
        }
    }
    override fun onStartCommand(intent:Intent?,flags:Int,startId:Int):Int{
        if(intent?.action==ACTION_STOP||!store.isActive()){
            shutdown()
            return START_NOT_STICKY
        }
        // START_STICKY is only an OS hint; force-stop and battery restrictions
        // may prevent restart. Never create a new session automatically.
        try{
            val open=packageManager.getLaunchIntentForPackage(packageName)
            val pending=PendingIntent.getActivity(this,0,open ?: Intent(this, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            val notification=Notification.Builder(this,CHANNEL)
                .setContentTitle("USKORUN is recording location")
                .setContentText("Walking/running route active; tap to Pause or Finish.")
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setOngoing(true).setContentIntent(pending).build()
            if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.Q){
                startForeground(NOTIFICATION_ID,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            }else startForeground(NOTIFICATION_ID,notification)
            subscribe()
        }catch(e:Exception){
            Log.e("USKDurableLocation","Foreground GPS could not start",e)
            try{store.pause()}catch(_:Exception){}
            shutdown()
            return START_NOT_STICKY
        }
        return START_STICKY
    }
    private fun subscribe(){
        val fine=checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
        val coarse=checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED
        if(!fine&&!coarse)throw SecurityException("Location permission missing")
        if(!subscribed){
            // Each delivered OS fix is stored durably before the UI can drain it.
            if(fine && manager.isProviderEnabled(LocationManager.GPS_PROVIDER))
                manager.requestLocationUpdates(LocationManager.GPS_PROVIDER,1000L,0f,this,Looper.getMainLooper())
            if(manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
                manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,1000L,0f,this,Looper.getMainLooper())
            subscribed=true
        }
    }
    override fun onLocationChanged(location:Location){
        if(!store.isActive())return
        // App-level quality gate matches existing server accuracy bound.
        if(!location.hasAccuracy()||location.accuracy>50f||location.accuracy<0f)return
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.S && location.isMock)return
        val t=location.time.toDouble()
        val now=System.currentTimeMillis().toDouble()
        if(t<=0||t>now+10000||t<now-120000)return
        try{
            store.append(location.latitude,location.longitude,location.accuracy.toDouble(),t)
        }catch(e:Exception){
            Log.e("USKDurableLocation","Disk commit failed; stopping, no unpersisted point credit",e)
            try{store.pause()}catch(_:Exception){}
            shutdown()
        }
    }
    override fun onProviderDisabled(provider:String){}
    override fun onProviderEnabled(provider:String){}
    private fun shutdown(){
        if(subscribed){manager.removeUpdates(this);subscribed=false}
        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.N)
            stopForeground(STOP_FOREGROUND_REMOVE)
        else stopForeground(true)
        stopSelf()
    }
    override fun onDestroy(){
        if(subscribed){manager.removeUpdates(this);subscribed=false}
        super.onDestroy()
    }
}
