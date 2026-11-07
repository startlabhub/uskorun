// Local Capacitor 7 bridge. MIT, see LICENSE.
// Only JS-visible commands; durable collection happens in USKLocationService.
package com.uskorun.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray

@CapacitorPlugin(
    name="USKDurableLocation",
    permissions=[Permission(
        strings=[Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION],
        alias="location"
    )]
)
class USKDurableLocationPlugin:Plugin() {
    private val disk get()=USKDurableStore.get(context)

    @PluginMethod
    fun begin(call:PluginCall){
        if(getPermissionState("location")!=PermissionState.GRANTED){
            requestPermissionForAlias("location",call,"onLocationPermission")
            return
        }
        beginGranted(call)
    }
    @PermissionCallback
    private fun onLocationPermission(call:PluginCall) {
        if(getPermissionState("location")!=PermissionState.GRANTED){
            call.reject("Location permission denied; tracking not started")
            return
        }
        beginGranted(call)
    }
    private fun beginGranted(call:PluginCall) {
        val client=call.getString("clientId")
        val activity=call.getString("activityId")
        val kind=call.getString("kind")
        val segment=call.getInt("segment")
        if(client.isNullOrBlank()||activity.isNullOrBlank()||kind.isNullOrBlank()||segment==null){
            call.reject("Missing native GPS run identity");return
        }
        try {
            // Background permission is policy-gated separately on Android 10+.
            // A user-initiated foreground location service can continue after
            // backgrounding, but a background restart may require 'Allow all
            // the time', Android version exemptions, and Play approval.
            disk.begin(client,activity,kind,segment)
            USKLocationService.start(context)
            val ret=JSObject();ret.put("active",true);call.resolve(ret)
        }catch(e:Exception){call.reject(e.message?:"Cannot start native location")}
    }

    @PluginMethod fun pause(call:PluginCall){
        try{
            disk.pause()
            USKLocationService.stop(context)
            call.resolve()
        }catch(e:Exception){call.reject(e.message?:"Cannot pause GPS")}
    }
    @PluginMethod fun end(call:PluginCall){
        pause(call)
    }
    @PluginMethod fun drain(call:PluginCall){
        try{
            val (records,active,overflow)=disk.drain(call.getInt("limit")?:500)
            val arr=JSONArray()
            records.forEach{arr.put(it.toJson())}
            val r=JSObject();r.put("records",arr);r.put("active",active);r.put("overflow",overflow)
            call.resolve(r)
        }catch(e:Exception){call.reject(e.message?:"Cannot drain GPS")}
    }
    @PluginMethod fun ack(call:PluginCall){
        val client=call.getString("clientId");val activity=call.getString("activityId")
        val array=call.getArray("seqs")
        if(client==null||activity==null||array==null){call.reject("Invalid native ACK");return}
        try{
            val seqs=(0 until array.length()).map{array.getInt(it)}
            val n=disk.ack(client,activity,seqs)
            val r=JSObject();r.put("removed",n);call.resolve(r)
        }catch(e:Exception){call.reject(e.message?:"Native ACK failed")}
    }
    @PluginMethod fun reset(call:PluginCall){
        val client=call.getString("clientId");val activity=call.getString("activityId")
        if(client==null||activity==null){call.reject("Missing native reset ID");return}
        try{disk.reset(client,activity);call.resolve()}
        catch(e:Exception){call.reject(e.message?:"Native reset failed")}
    }
}
