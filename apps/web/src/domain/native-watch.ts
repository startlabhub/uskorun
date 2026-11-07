import type {PositionSample} from './foreground-watch.ts';

export type NativeFix={
  latitude:number;longitude:number;accuracy:number;time:number;simulated?:boolean
};
export type NativeError={code?:string;message?:string};
export type NativeGPSPlugin={
  addWatcher:(options:{
    backgroundTitle:string;backgroundMessage:string;requestPermissions:boolean;
    stale:boolean;distanceFilter:number
  },callback:(location:NativeFix|undefined,error:NativeError|undefined)=>void)=>Promise<string>;
  removeWatcher:(options:{id:string})=>Promise<void>;
};
export const NATIVE_NOTICE_TITLE='USKORUN is recording your walk or run';
export const NATIVE_NOTICE_MESSAGE='Location recording is active. Return to USKORUN to Pause or Finish.';
/**
 * A single active native watcher. Unlike web watchPosition, it is NOT paused
 * on visibilitychange/pagehide. The plugin owns the OS foreground service on
 * Android and CLLocationManager background mode on iOS.
 *
 * Limitations: JavaScript callbacks are best-effort while the WebView is
 * suspended and this plugin supplies no durable native on-disk fix queue.
 * Never interpolate gaps or award distance not present in PendingRun.points.
 */
export class NativeGPSWatch{
  private id:string|null=null;
  private active=false;
  private adding=false;
  private generation=0;
  private latestTimestamp=-Infinity;
  private readonly plugin:NativeGPSPlugin;
  private readonly onFix:(p:PositionSample)=>void;
  private readonly onInterrupted:(reason:string)=>void;
  private readonly clock:()=>number;
  constructor(
    plugin:NativeGPSPlugin,
    onFix:(p:PositionSample)=>void,
    onInterrupted:(reason:string)=>void,
    clock:()=>number=()=>Date.now()
  ){
    this.plugin=plugin;this.onFix=onFix;this.onInterrupted=onInterrupted;this.clock=clock;
  }
  get isRunning(){return this.active}
  async start():Promise<boolean>{
    if(this.active||this.adding)return false;
    this.active=true;
    this.adding=true;
    this.latestTimestamp=-Infinity;
    const token=++this.generation;
    try{
      const id=await this.plugin.addWatcher({
        backgroundTitle:NATIVE_NOTICE_TITLE,
        backgroundMessage:NATIVE_NOTICE_MESSAGE,
        requestPermissions:true,
        stale:false,
        distanceFilter:0
      },(location,error)=>{
        if(!this.active||token!==this.generation)return;
        if(error){
          this.interrupt(error.code==='NOT_AUTHORIZED'
            ?'Location permission denied. Enable Always location access to record in the background, then tap Resume.'
            :'Native location interrupted: '+String(error.message||error.code||'unavailable')+'. Tap Resume.');
          return;
        }
        if(!location)return;
        // Both simulated fixes and stale/invalid samples fail closed.
        if(location.simulated===true||![location.latitude,location.longitude,location.accuracy,location.time].every(Number.isFinite))return;
        if(Math.abs(location.latitude)>90||Math.abs(location.longitude)>180||
          location.accuracy<0||location.accuracy>50||
          location.time>this.clock()+10_000||location.time<this.clock()-120_000||
          location.time<=this.latestTimestamp)return;
        this.latestTimestamp=location.time;
        this.onFix({timestamp:location.time,coords:{
          latitude:location.latitude,longitude:location.longitude,accuracy:location.accuracy
        }});
      });
      if(!this.active||token!==this.generation){
        await this.plugin.removeWatcher({id}).catch(()=>{});
        return false;
      }
      this.id=id;
      return true;
    }catch(e){
      if(this.active&&token===this.generation)this.interrupt('Native GPS could not start: '+String(e instanceof Error?e.message:'permission or service error')+'.');
      return false;
    }finally{this.adding=false}
  }
  interrupt(reason:string){
    if(!this.active)return;
    this.stop();
    this.onInterrupted(reason);
  }
  stop():void{
    this.active=false;
    this.generation++;
    const id=this.id;
    this.id=null;
    if(id!==null)void this.plugin.removeWatcher({id}).catch(()=>{});
  }
}
