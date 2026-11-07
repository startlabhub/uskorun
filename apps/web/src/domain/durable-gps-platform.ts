import {Capacitor,registerPlugin} from '@capacitor/core';
import type {NativeDiskPort} from './native-disk-queue.ts';

/**
 * Own, zero-license-fee Capacitor plugin implemented in native-plugins/.
 * If it is not linked into the Android/iOS app, begin()/drain() rejects;
 * no silent fallback to the older JS-only callback path is allowed.
 */
let bridge:NativeDiskPort|null=null;
export function ownedNativeGPSAvailable():boolean{
 return Capacitor.isNativePlatform()&&
  (Capacitor.getPlatform()==='ios'||Capacitor.getPlatform()==='android');
}
export function durableGPSPort():NativeDiskPort{
 if(!ownedNativeGPSAvailable())throw new Error('Durable GPS requires native Capacitor');
 if(!bridge)bridge=registerPlugin<NativeDiskPort>('USKDurableLocation');
 return bridge;
}
