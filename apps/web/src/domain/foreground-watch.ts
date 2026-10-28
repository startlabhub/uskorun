/**
 * Foreground-only geolocation watch lifecycle.
 * W3C Geolocation does not deliver fixes to hidden documents. No background
 * recording, interpolation, or automatic resume is provided here.
 */
export const NO_FIX_WARNING_MS=30_000;
export const CHECK_INTERVAL_MS=2_000;

export type PositionSample={
  timestamp:number;
  coords:{latitude:number;longitude:number;accuracy:number};
};
export type LocationError={message:string};
export type GeoPort={
  watchPosition:(success:(position:PositionSample)=>void,error:(error:LocationError)=>void,
    options:{enableHighAccuracy:boolean;maximumAge:number;timeout:number})=>number;
  clearWatch:(id:number)=>void;
};
export type WatchClock={
  now:()=>number;
  setInterval:(fn:()=>void,ms:number)=>ReturnType<typeof setInterval>;
  clearInterval:(id:ReturnType<typeof setInterval>)=>void;
};
export type WatchOptions={
  geo:GeoPort;
  clock:WatchClock;
  visible:()=>boolean;
  onFix:(p:PositionSample)=>void;
  onInterrupted:(reason:string)=>void;
};
export const browserWatchClock:WatchClock={
  now:()=>Date.now(),
  setInterval:(fn,ms)=>setInterval(fn,ms),
  clearInterval:(id)=>clearInterval(id)
};
export class ForegroundWatch {
  private active=false;
  private id:number|null=null;
  private generation=0;
  private timer:ReturnType<typeof setInterval>|null=null;
  private latestAt=0;
  private latestSampleTimestamp=-Infinity;
  constructor(private readonly opts:WatchOptions){}
  get isRunning(){return this.active}
  start():boolean {
    // Repeat focus/visibility and double-taps must never allocate a second watch.
    if(this.active)return false;
    if(!this.opts.visible()){
      this.opts.onInterrupted('Tracking interrupted while the app is hidden. Return and tap Resume.');
      return false;
    }
    this.active=true;
    const generation=++this.generation;
    this.latestAt=this.opts.clock.now();
    this.latestSampleTimestamp=-Infinity;
    this.timer=this.opts.clock.setInterval(()=>this.checkFreshness(),CHECK_INTERVAL_MS);
    try{
      const id=this.opts.geo.watchPosition(
        position=>{
          if(!this.active||generation!==this.generation)return;
          if(!this.opts.visible()){
            this.interrupt('App hidden: tracking paused. Return and tap Resume.');
            return;
          }
          // Ignore repeated/cached fixes without refreshing the no-fix watchdog.
          if(!Number.isFinite(position.timestamp)||position.timestamp<=this.latestSampleTimestamp)return;
          this.latestSampleTimestamp=position.timestamp;
          this.latestAt=this.opts.clock.now();
          this.opts.onFix(position);
        },
        e=>{
          if(this.active&&generation===this.generation)
            this.interrupt('GPS interrupted: '+String(e.message||'location unavailable')+'. Tap Resume to try again.');
        },
        {enableHighAccuracy:true,maximumAge:0,timeout:15_000}
      );
      if(this.active&&generation===this.generation)this.id=id;
      else this.opts.geo.clearWatch(id); // synchronous callback interrupted the watch
      return this.active;
    }catch{
      this.interrupt('GPS could not start. Tap Resume to try again.');
      return false;
    }
  }
  checkFreshness(){
    if(!this.active)return;
    if(!this.opts.visible()){
      this.interrupt('App hidden: tracking paused. Return and tap Resume.');
    }else if(this.opts.clock.now()-this.latestAt>=NO_FIX_WARNING_MS){
      this.interrupt('No new GPS fixes for 30 seconds. Tracking paused; this does not mean you stopped moving. Tap Resume to restart GPS.');
    }
  }
  // These never auto-start GPS; a fresh user action is required.
  visibilityChanged(){
    if(this.active)this.checkFreshness();
  }
  focus(){
    if(this.active)this.checkFreshness();
  }
  interrupt(reason:string){
    if(!this.active)return;
    this.stop();
    this.opts.onInterrupted(reason);
  }
  stop(){
    this.active=false;
    this.generation++;
    const timer=this.timer;this.timer=null;
    if(timer!==null)this.opts.clock.clearInterval(timer);
    const id=this.id;this.id=null;
    if(id!==null)this.opts.geo.clearWatch(id);
  }
}
/** Only release editing focus on deliberate product transitions; never block gestures globally. */
export function blurEditingFocus(active:Element|null):boolean{
  if(active instanceof HTMLInputElement||
     active instanceof HTMLTextAreaElement||
     (active instanceof HTMLElement&&active.isContentEditable)){
    active.blur();return true;
  }
  return false;
}
