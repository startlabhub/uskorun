import test from 'node:test';
import assert from 'node:assert/strict';
import {ForegroundWatch,NO_FIX_WARNING_MS} from '../src/domain/foreground-watch.ts';
import type {GeoPort,WatchClock,PositionSample} from '../src/domain/foreground-watch.ts';
import {newPendingRun,withStartedId,withFix,withPause,withResume,withPendingFinish,finalizeAfterResponse} from '../src/domain/pending.ts';
import type {PendingRun} from '../src/domain/pending.ts';
import {assessGPS} from '../src/domain/gps.ts';

class Clock implements WatchClock {
 time=100_000;
 private timers=new Map<number,()=>void>();
 private next=1;
 now=()=>this.time;
 setInterval=(callback:()=>void,_ms:number)=>{const id=this.next++;this.timers.set(id,callback);return id as unknown as ReturnType<typeof setInterval>};
 clearInterval=(id:ReturnType<typeof setInterval>)=>{this.timers.delete(id as unknown as number)};
 advance(ms:number){this.time+=ms;for(const f of [...this.timers.values()])f()}
 get count(){return this.timers.size}
}
class Geo implements GeoPort {
 count=0;cleared:number[]=[];
 callbacks=new Map<number,(p:PositionSample)=>void>();
 errors=new Map<number,(e:{message:string})=>void>();
 watchPosition=(yes:(p:PositionSample)=>void,no:(e:{message:string})=>void)=>{
  const id=++this.count;this.callbacks.set(id,yes);this.errors.set(id,no);return id;
 };
 clearWatch=(id:number)=>{this.cleared.push(id)};
 emit(id:number,time:number,lon=-121.49,accuracy=4){
  this.callbacks.get(id)?.({timestamp:time,coords:{latitude:38.58,longitude:lon,accuracy}});
 }
}
function harness(){
 const geo=new Geo(),clock=new Clock();
 let visible=true;
 let draft:PendingRun=withStartedId(newPendingRun('same-client-id','walk',clock.now()),'same-activity-id');
 let reason='';
 const watch=new ForegroundWatch({
  geo,clock,visible:()=>visible,
  onFix:({timestamp,coords})=>{
   draft=withFix(draft,{lat:coords.latitude,lon:coords.longitude,accuracy:coords.accuracy,t:timestamp});
  },
  onInterrupted:r=>{reason=r;draft=withPause(draft)}
 });
 return {geo,clock,watch,get draft(){return draft},get reason(){return reason},
  setVisible(v:boolean){visible=v},
  resume(){draft=withResume(draft);return watch.start()},
  finish(){watch.stop();draft=withPendingFinish(draft)},
  get ids(){return [draft.clientId,draft.activityId]}
 };
}
test('hidden pauses once; visible/focus never auto resumes; explicit Resume starts new watch and segment',()=>{
 const h=harness();assert.equal(h.watch.start(),true);
 h.geo.emit(1,h.clock.now(),-121.49);const before=h.draft.points.slice();
 h.setVisible(false);h.watch.visibilityChanged();assert.equal(h.watch.isRunning,false);
 assert.equal(h.draft.phase,'paused');assert.equal(h.draft.segment,1);
 h.watch.visibilityChanged();h.setVisible(true);h.watch.visibilityChanged();h.watch.focus();
 assert.equal(h.geo.count,1);assert.deepEqual(h.draft.points,before);
 assert.equal(h.resume(),true);assert.equal(h.geo.count,2);
 assert.deepEqual(h.ids,['same-client-id','same-activity-id']);
 h.geo.emit(2,h.clock.now()+1_000,-121.488);
 assert.equal(h.draft.points[1].segment,1);
 assert.equal(h.draft.points[0].segment,0);
 // One fix in each segment: zero distance, even if coordinates differ by >100 m.
 assert.equal(assessGPS(h.draft.points,'walk',99_000,150_000).miles,0);
});
test('pagehide-style interruption + repeated event does not add segments twice',()=>{
 const h=harness();h.watch.start();
 h.watch.interrupt('pagehide');h.watch.interrupt('pagehide');
 assert.equal(h.draft.segment,1);assert.equal(h.geo.cleared.length,1);
 h.setVisible(true);h.watch.focus();assert.equal(h.geo.count,1);
});
test('no fixes while visible interrupts after watchdog interval, not assumed stationary',()=>{
 const h=harness();h.watch.start();h.geo.emit(1,h.clock.now());h.clock.advance(NO_FIX_WARNING_MS-1);
 assert.equal(h.watch.isRunning,true);
 h.clock.advance(1);
 assert.equal(h.watch.isRunning,false);assert.equal(h.draft.phase,'paused');
 assert.match(h.reason,/No new GPS fixes/);
 assert.equal(h.draft.points.length,1);
 assert.equal(h.clock.count,0);
});
test('no first fix while visible also interrupts and retains identifiers',()=>{
 const h=harness();h.watch.start();h.clock.advance(NO_FIX_WARNING_MS);
 assert.equal(h.watch.isRunning,false);assert.deepEqual(h.ids,['same-client-id','same-activity-id']);
 assert.equal(h.draft.points.length,0);
});
test('repeated focus and visible events and repeated start never create concurrent watches',()=>{
 const h=harness();h.watch.start();
 for(let i=0;i<9;i++){h.watch.focus();h.watch.visibilityChanged();assert.equal(h.watch.start(),false)}
 assert.equal(h.geo.count,1);assert.equal(h.clock.count,1);
});
test('old generation callbacks ignored after pause, after resume, and after Finish',()=>{
 const h=harness();h.watch.start();
 h.geo.emit(1,h.clock.now());h.watch.interrupt('Call');h.resume();
 h.geo.emit(1,h.clock.now()+1_000,-121.488);
 assert.equal(h.draft.points.length,1);
 h.geo.emit(2,h.clock.now()+2_000,-121.489);
 assert.equal(h.draft.points.length,2);
 h.finish();h.geo.emit(2,h.clock.now()+3_000,-121.487);
 assert.equal(h.draft.phase,'pending_finish');assert.equal(h.draft.points.length,2);
});
test('repeated timestamp does not postpone stale-fix interruption',()=>{
 const h=harness();h.watch.start();h.geo.emit(1,h.clock.now());
 h.clock.advance(15_000);h.geo.emit(1,h.clock.now()-15_000);
 h.clock.advance(15_000);
 assert.equal(h.watch.isRunning,false);assert.equal(h.draft.points.length,1);
});
test('GPS error interrupts without resetting ID/points; new watch from manual Resume',()=>{
 const h=harness();h.watch.start();h.geo.emit(1,h.clock.now());
 h.geo.errors.get(1)?.({message:'position unavailable'});
 assert.equal(h.draft.phase,'paused');
 assert.match(h.reason,/GPS interrupted/);
 assert.deepEqual(h.ids,['same-client-id','same-activity-id']);
 assert.equal(h.resume(),true);assert.equal(h.geo.count,2);
});
test('Finish, failed network, retry and terminal cleanup are unaffected',()=>{
 const h=harness();h.watch.start();h.geo.emit(1,h.clock.now());
 h.finish();const last=h.draft;
 assert.deepEqual(finalizeAfterResponse(last,null),last);
 assert.deepEqual(finalizeAfterResponse(last,{ok:false}),last);
 assert.equal(finalizeAfterResponse(last,{ok:true,status:'accepted'}),null);
 assert.equal(h.watch.isRunning,false);
 assert.equal(h.geo.count,1);
});
test('hidden before new watch start cannot record while invisible',()=>{
 const h=harness();h.setVisible(false);
 assert.equal(h.watch.start(),false);
 assert.equal(h.geo.count,0);
 assert.equal(h.draft.phase,'paused');
 assert.equal(h.resume(),false);assert.equal(h.geo.count,0);
});
