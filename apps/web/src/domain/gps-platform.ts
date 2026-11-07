import {Capacitor,registerPlugin} from '@capacitor/core';
import {LocalNotifications} from '@capacitor/local-notifications';
import type {BackgroundGeolocationPlugin} from '@capacitor-community/background-geolocation';
import {NativeGPSWatch} from './native-watch.ts';
import type {NativeGPSPlugin} from './native-watch.ts';
import type {PositionSample} from './foreground-watch.ts';

/** Native plugin only on iOS/Android Capacitor; ordinary browsers use watchPosition. */
export function nativeGPSAvailable():boolean{
 return Capacitor.isNativePlatform()&&['ios','android'].includes(Capacitor.getPlatform());
}
export function createNativeGPSWatch(
  onFix:(p:PositionSample)=>void,
  onInterrupted:(reason:string)=>void
):NativeGPSWatch{
 if(!nativeGPSAvailable())throw new Error('Native GPS is only available inside an iOS/Android Capacitor app');
 const p=registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
 // Plugin API returns watcher IDs which are removed on Pause/Finish/Abandon.
 return new NativeGPSWatch(p as unknown as NativeGPSPlugin,onFix,onInterrupted);
}

/** Android 13+ requires notification permission for an ongoing location notice. */
export async function ensureNativeBackgroundPrerequisites():Promise<void>{
 if(!nativeGPSAvailable()||Capacitor.getPlatform()!=='android')return;
 const result=await LocalNotifications.requestPermissions();
 if(result.display!=='granted')
  throw new Error('Background tracking requires permission for the ongoing Android location notification. Tracking not started.');
}
