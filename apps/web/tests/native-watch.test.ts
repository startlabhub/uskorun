import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeGPSWatch} from '../src/domain/native-watch.ts';
import type {NativeFix,NativeError} from '../src/domain/native-watch.ts';
import {newPendingRun,withStartedId,withFix,withPause,withResume,withPendingFinish,finalizeAfterResponse} from '../src/domain/pending.ts';
import {assessGPS} from '../src/domain/gps.ts';

class Plugin {
 next=0;callbacks=new Map<string,(p:NativeFix|undefined,e:NativeError|undefined)=>void>();
 removed:string[]=[];options:unknown[]=[];
 async addWatcher(options:unknown,callback:(p:NativeFix|undefined,e:NativeError|undefined)=>void){
  const id=String(++this.next);this.options.push(options);this.callbacks.set(id,callback);return id
 }
 async removeWatcher({id}:{id:string}){this.removed.push(id)}
 fix(id:string,time:number,lon=-121.49,simulated=false){
  this.callbacks.get(id)?.({latitude:38.58,longitude:lon,accuracy:4,time,simulated},undefined)
 }
 error(id:string,code:string){this.callbacks.get(id)?.(undefined,{code,message:code})}
}
function sample(time:number,lon=-121.49){return {latitude:38.58,longitude:lon,accuracy:4,time,simulated:false}}
function fixture(){
 let now=100_000,reason='';
 const p=new Plugin();
 let run=withStartedId(newPendingRun('stable-client','walk',now),'stable-activity');
 const watcher=new NativeGPSWatch(p,
  x=>{run=withFix(run,{lat:x.coords.latitude,lon:x.coords.longitude,accuracy:x.coords.accuracy,t:x.timestamp})},
  x=>{reason=x;run=withPause(run)},()=>now
 );
 return {p,watcher,get run(){return run},get reason(){return reason},now(t:number){now=t},
 pause(){watcher.stop();run=withPause(run)},
 resume(){run=withResume(run);return watcher.start()},
 finish(){watcher.stop();run=withPendingFinish(run)}
 };
}
test('native watcher remains active across lock/call without visibility dependency',async()=>{
 const h=fixture();
 assert.equal(await h.watcher.start(),true);
 h.p.fix('1',100000);
 // Background mode deliberately has no visibilitychange handler.
 h.now(101000);h.p.fix('1',101000,-121.48998);
 assert.equal(h.watcher.isRunning,true);
 assert.equal(h.run.points.length,2);
 assert.match(JSON.stringify(h.p.options[0]),/backgroundMessage/);
 assert.match(JSON.stringify(h.p.options[0]),/requestPermissions/);
});
test('Pause/Resume removes first watch, increments segment, retains session IDs',async()=>{
 const h=fixture();await h.watcher.start();h.p.fix('1',100000);
 h.pause();assert.deepEqual(h.p.removed,['1']);
 assert.equal(h.run.segment,1);
 assert.equal(await h.resume(),true);
 h.now(102000);h.p.fix('2',102000,-121.488);
 assert.equal(h.run.points[1].segment,1);
 assert.equal(h.run.activityId,'stable-activity');assert.equal(h.run.clientId,'stable-client');
 assert.equal(assessGPS(h.run.points,'walk',99_000,200_000).miles,0);
});
test('reject simulated and stale native positions without adding fixes',async()=>{
 const h=fixture();await h.watcher.start();h.p.fix('1',100000,-121.49,true);
 h.p.fix('1',100000);
 h.p.fix('1',100000);
 h.p.callbacks.get('1')?.({...sample(100001),accuracy:100},undefined);
 h.p.callbacks.get('1')?.({...sample(99999),latitude:91},undefined);
 assert.equal(h.run.points.length,1);
});
test('location permission denial pauses once, no auto-restart',async()=>{
 const h=fixture();await h.watcher.start();h.p.error('1','NOT_AUTHORIZED');
 assert.equal(h.watcher.isRunning,false);assert.equal(h.run.phase,'paused');
 assert.match(h.reason,/permission denied/i);
 h.p.error('1','NOT_AUTHORIZED');
 assert.equal(h.run.segment,1);assert.equal(h.p.next,1);
});
test('Finish disables old native callbacks; failed server Finish retains draft unchanged',async()=>{
 const h=fixture();await h.watcher.start();h.p.fix('1',100000);h.finish();
 h.p.fix('1',101000,-121.488);
 assert.equal(h.run.points.length,1);
 assert.equal(h.run.phase,'pending_finish');
 assert.deepEqual(finalizeAfterResponse(h.run,null),h.run);
 assert.deepEqual(finalizeAfterResponse(h.run,{ok:false}),h.run);
 assert.equal(finalizeAfterResponse(h.run,{ok:true,status:'rejected'}),null);
});
test('one native watch only for concurrent starts',async()=>{
 const h=fixture();
 const [a,b]=await Promise.all([h.watcher.start(),h.watcher.start()]);
 assert.equal(a,true);assert.equal(b,false);assert.equal(h.p.next,1);
});
test('callback created before Pause cannot append after Resume',async()=>{
 const h=fixture();await h.watcher.start();h.pause();await h.resume();
 h.p.fix('1',101000,-121.488);
 assert.equal(h.run.points.length,0);
 h.now(102000);h.p.fix('2',102000,-121.487);
 assert.equal(h.run.points.length,1);
});
