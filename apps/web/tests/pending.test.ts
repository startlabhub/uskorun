import test from 'node:test';
import assert from 'node:assert/strict';
import {newPendingRun,withStartedId,withPause,withResume,withFix,withPendingFinish,finalizeAfterResponse,readPendingRun,writePendingRun,clearPendingRun} from '../src/domain/pending.ts';
const loc={lat:38.58,lon:-121.49,accuracy:4,t:100000};
test('pause/resume increments GPS segment even for 2s pause',()=>{
 let x=withStartedId(newPendingRun('abc','run',100000),'server-id');x=withFix(x,loc);
 x=withPause(x);assert.equal(x.segment,1);
 assert.equal(withFix(x,{...loc,t:102000}).points.length,1);
 x=withResume(x);x=withFix(x,{...loc,t:102000});assert.equal(x.points[1].segment,1);
});
test('failed finish preserves activityId, same gps and pending phase',()=>{
 const before=withPendingFinish(withFix(withStartedId(newPendingRun('stable-client','walk'), 'stable-server'),loc));
 assert.deepEqual(finalizeAfterResponse(before,null),before);
 assert.deepEqual(finalizeAfterResponse(before,{ok:false}),before);
});
test('lost response after commit is safely resolved by same idempotent retry',()=>{
 const before=withPendingFinish(withStartedId(newPendingRun('stable-client','run'),'server-1'));
 assert.deepEqual(finalizeAfterResponse(before,null),before);
 assert.equal(finalizeAfterResponse(before,{ok:true,status:'accepted'}),null);
});
test('recover draft from session storage without prematurely erasing points',()=>{
 const m=new Map<string,string>();const storage={getItem:(k:string)=>m.get(k)||null,setItem:(k:string,v:string)=>{m.set(k,v)},removeItem:(k:string)=>{m.delete(k)}};
 const before=withPendingFinish(withFix(withStartedId(newPendingRun('client','walk'), 'server'),loc));
 writePendingRun(storage,before);assert.deepEqual(readPendingRun(storage),before);
 clearPendingRun(storage);assert.equal(readPendingRun(storage),null);
});
test('recording cannot add GPS samples while pending finish',()=>{
 const x=withPendingFinish(withStartedId(newPendingRun('client','run'), 'server'));
 assert.deepEqual(withFix(x,loc),x);
});
