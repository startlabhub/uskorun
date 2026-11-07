import test from 'node:test';
import assert from 'node:assert/strict';
import {newPendingRun,withStartedId,withPause,withResume,withPendingFinish} from '../src/domain/pending.ts';
import {mergeNativeFixes,syncNativeQueue,nativeResumeKind} from '../src/domain/native-disk-queue.ts';
import type {NativeQueuedFix,NativeDiskPort} from '../src/domain/native-disk-queue.ts';

const session=()=>withStartedId(newPendingRun('client-1','walk',1_000),'activity-1');
const fix=(seq:number,t:number,segment=0):NativeQueuedFix=>({
 seq,clientId:'client-1',activityId:'activity-1',segment,
 lat:38.58,lon:-121.49+seq/100000,accuracy:4,t
});
class Disk implements NativeDiskPort{
 records:NativeQueuedFix[]=[];acks:number[][]=[];active=true;overflow=false;
 async begin(){return {active:true}}
 async pause(){}
 async end(){}
 async reset(){}
 async drain({limit}:{limit:number}){return {records:this.records.slice(0,limit),active:this.active,overflow:this.overflow}}
 async ack({seqs}:{seqs:number[]}){this.acks.push(seqs);const set=new Set(seqs);this.records=this.records.filter(r=>!set.has(r.seq));return {removed:seqs.length}}
}
test('drain merges real native points and ACKS only after durable pending save',async()=>{
 const disk=new Disk();disk.records=[fix(1,1000),fix(2,2000)];
 let saved=session();let calls=0;
 const r=await syncNativeQueue(disk,saved,d=>{calls++;saved=d});
 assert.equal(r.accepted,2);assert.equal(saved.points.length,2);
 assert.equal(calls,1);assert.deepEqual(disk.acks,[[1,2]]);
 assert.equal(disk.records.length,0);
});
test('a failed JS storage write must never ACK native disk data',async()=>{
 const disk=new Disk();disk.records=[fix(1,1000)];
 await assert.rejects(syncNativeQueue(disk,session(),()=>{throw new Error('storage full')}),/storage full/);
 assert.deepEqual(disk.acks,[]);assert.equal(disk.records.length,1);
});
test('repeat drains after saved-but-lost ACK do not double-count',async()=>{
 const disk=new Disk(),original=session();disk.records=[fix(1,1000),fix(2,2000)];
 let saved=original;
 // Spread does not include class prototype methods. Supply the complete
 // NativeDiskPort contract in this failing-ACK mock (no unsafe type assertion).
 const failingAckPort:NativeDiskPort={
  begin:()=>disk.begin(),
  pause:()=>disk.pause(),
  end:()=>disk.end(),
  reset:()=>disk.reset(),
  drain:options=>disk.drain(options),
  ack:async()=>{throw new Error('lost ack')}
 };
 await assert.rejects(syncNativeQueue(failingAckPort,saved,d=>{saved=d}),/lost ack/);
 assert.equal(saved.points.length,2);assert.equal(disk.records.length,2);
 await syncNativeQueue(disk,saved,d=>{saved=d});
 assert.equal(saved.points.length,2);assert.deepEqual(disk.acks,[[1,2]]);
});
test('delayed old segment fixes cannot bridge new segment after Resume',()=>{
 let d=session();d=withPause(d);d=withResume(d);
 const r=mergeNativeFixes(d,[fix(1,1000,0),fix(2,2000,1)]);
 assert.deepEqual(r.draft.points.map(p=>p.segment),[0,1]);
 assert.equal(r.ackSeqs.length,2);
 assert.deepEqual(nativeResumeKind(d),{clientId:'client-1',activityId:'activity-1',kind:'walk',segment:1});
});
test('wrong activity/client/session is never acknowledged',()=>{
 const wrong={...fix(1,1000),activityId:'another'};
 assert.throws(()=>mergeNativeFixes(session(),[wrong]),/another session/);
 assert.throws(()=>mergeNativeFixes(session(),[{...fix(1,1000),clientId:'other'}]),/another session/);
});
test('reject invalid accuracy and future segment without ACK',()=>{
 assert.throws(()=>mergeNativeFixes(session(),[{...fix(1,1000),accuracy:100}]),/Invalid native/);
 assert.throws(()=>mergeNativeFixes(session(),[fix(1,1000,2)]),/Unexpected native segment/);
 assert.throws(()=>mergeNativeFixes(session(),[fix(1,1000),fix(1,1000)]),/duplicate native queue/);
});
test('queue overflow carries explicit status but never alters 5-mile server checks',async()=>{
 const disk=new Disk();disk.overflow=true;
 const r=await syncNativeQueue(disk,session(),()=>{});
 assert.equal(r.overflow,true);assert.equal(r.accepted,0);
});
test('saved pending_finish can ingest prior on-disk fixes, preserving idempotent ID',()=>{
 const d=withPendingFinish(session());
 const r=mergeNativeFixes(d,[fix(1,1000)]);
 assert.equal(r.draft.phase,'pending_finish');assert.equal(r.draft.activityId,'activity-1');
});
test('native points preserve original timestamps; no fabricated interpolation',()=>{
 const d=session(),r=mergeNativeFixes(d,[fix(1,1000),fix(2,300_000)]);
 assert.deepEqual(r.draft.points.map(p=>p.t),[1000,300000]);assert.equal(r.draft.points.length,2);
});
test('bad same-segment temporal order is rejected rather than sorted into fake path',()=>{
 assert.throws(()=>mergeNativeFixes(session(),[fix(1,2000),fix(2,1000)]),/ordering inconsistent/);
});

test('missing activityId leaves all native disk records unacknowledged',async()=>{
 const disk=new Disk();disk.records=[fix(1,1000)];
 const pending=newPendingRun('client-1','walk',1000); // starting, no activityId
 let persisted=false;
 await assert.rejects(syncNativeQueue(disk,pending,()=>{persisted=true}),/activityId missing/);
 assert.equal(persisted,false);
 assert.deepEqual(disk.acks,[]);
 assert.equal(disk.records.length,1);
});

test('quarantined Android GPS queue surfaces loss but never ACKs or changes saved route',async()=>{
 const disk=new Disk();
 disk.records=[fix(1,1000)];
 let wrote=false;
 const port:NativeDiskPort={
  begin:()=>disk.begin(),pause:()=>disk.pause(),end:()=>disk.end(),
  reset:()=>disk.reset(),
  ack:args=>disk.ack(args),
  drain:async({limit})=>({...await disk.drain({limit}),
   active:false,loss:'Keystore key missing; old GPS ciphertext preserved'})
 };
 const initial=session();
 const result=await syncNativeQueue(port,initial,()=>{wrote=true});
 assert.match(result.loss||'',/Keystore key missing/);
 assert.deepEqual(result.draft,initial);
 assert.equal(result.accepted,0);
 assert.equal(result.active,false);
 assert.equal(wrote,false);
 assert.equal(disk.acks.length,0);
 assert.equal(disk.records.length,1);
});

test('a normal legacy iOS/native drain without loss flag remains compatible',async()=>{
 const disk=new Disk();disk.records=[fix(1,1000)];
 const result=await syncNativeQueue(disk,session(),()=>{});
 assert.equal(result.loss,null);
 assert.equal(result.accepted,1);
 assert.equal(disk.records.length,0);
});
