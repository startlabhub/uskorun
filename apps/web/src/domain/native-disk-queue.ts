import type {PendingRun} from './pending.ts';
import type {GPSPoint} from './gps.ts';

/**
 * NATIVE-02 wire contract v1.
 * Native callbacks MUST append each real OS fix to the atomic disk queue
 * BEFORE notifying the WebView. A drain does not delete anything.
 * Only ack SEQ IDs after PendingRun has been durably saved by JavaScript.
 *
 * An OS cannot promise fresh samples while terminated. No interpolation.
 */
export type NativeQueuedFix={
 seq:number;clientId:string;activityId:string;segment:number;
 lat:number;lon:number;accuracy:number;t:number
};
export type NativeDrain={
 records:NativeQueuedFix[];active:boolean;overflow:boolean;
 // Persistent warning after Android Keystore key loss / unreadable queue.
 // iOS implementation may omit it; never treat it as a GPS fix.
 loss?:string|null
};
export type NativeBegin={clientId:string;activityId:string;kind:'run'|'walk';segment:number};
export type NativeDiskPort={
 begin:(options:NativeBegin)=>Promise<{active:boolean}>;
 pause:()=>Promise<void>;
 drain:(options:{limit:number})=>Promise<NativeDrain>;
 ack:(options:{clientId:string;activityId:string;seqs:number[]})=>Promise<{removed:number}>;
 end:()=>Promise<void>;
 reset:(options:{clientId:string;activityId:string})=>Promise<void>;
 addListener?:(event:string,callback:()=>void)=>Promise<{remove:()=>Promise<void>}>;
};
export const NATIVE_DRAIN_LIMIT=500;
export const MAX_NATIVE_FIXES=10_000;
export const NATIVE_QUEUE_VERSION=1;

export function queuedFixKey(p:Pick<NativeQueuedFix,'segment'|'t'>):string{
 return p.segment+':'+p.t;
}
export function mergeNativeFixes(
 run:PendingRun,rows:ReadonlyArray<NativeQueuedFix>
):{draft:PendingRun;ackSeqs:number[];inserted:number}{
 // A queued OS point without an accepted start ID must never mint a route.
 if(!run.activityId||run.phase==='starting')
  throw new Error('A server/local QA activity ID must exist before draining native fixes');
 const sorted=[...rows].sort((a,b)=>a.seq-b.seq);
 const points:GPSPoint[]=run.points.slice(),seen=new Set(points.map(queuedFixKey));
 const ackSeqs:number[]=[];let inserted=0;
 let prevSeq=-1;
 for(const r of sorted){
  if(!Number.isSafeInteger(r.seq)||r.seq<=0||r.seq===prevSeq)
   throw new Error('Malformed/duplicate native queue sequence; do not ack');
  prevSeq=r.seq;
  if(r.clientId!==run.clientId||r.activityId!==run.activityId)
   throw new Error('Native queue belongs to another session; do not ack');
  if(!Number.isSafeInteger(r.segment)||r.segment<0||r.segment>run.segment)
   throw new Error('Unexpected native segment; do not ack');
  if(![r.lat,r.lon,r.accuracy,r.t].every(Number.isFinite)||
    Math.abs(r.lat)>90||Math.abs(r.lon)>180||
    r.accuracy<0||r.accuracy>50||r.t<=0)
   throw new Error('Invalid native location fix; do not ack until inspected');
  const key=queuedFixKey(r);
  if(!seen.has(key)){
   if(points.length>=MAX_NATIVE_FIXES)
    throw new Error('10,000 GPS samples reached; Finish or abandon before more points');
   points.push({lat:r.lat,lon:r.lon,accuracy:r.accuracy,t:r.t,segment:r.segment});
   seen.add(key);inserted++;
  }
  // Duplicate persisted fix is safe to ack: same session, time, segment.
  ackSeqs.push(r.seq);
 }
 // Do not silently reorder GPS points across segments; native producer
 // generates monotonic segment/time. Reject anomalous queue ordering.
 for(let i=1;i<points.length;i++){
  const prev=points[i-1],curr=points[i];
  if(curr.segment<prev.segment||
    (curr.segment===prev.segment&&curr.t<=prev.t))
   throw new Error('Native GPS ordering inconsistent; do not ack');
 }
 return {draft:{...run,points},ackSeqs,inserted};
}

export function nativeResumeKind(run:PendingRun):NativeBegin{
 if(!run.activityId)throw new Error('Cannot start native location until activity ID is confirmed');
 if(run.phase!=='recording')throw new Error('Native start requires an explicit recording phase');
 return {clientId:run.clientId,activityId:run.activityId,kind:run.kind,segment:run.segment};
}

export type NativeDiskSyncResult={
 draft:PendingRun;accepted:number;remaining:boolean;overflow:boolean;active:boolean;
 loss:string|null
};
export async function syncNativeQueue(
 port:NativeDiskPort,draft:PendingRun,
 persist:(updated:PendingRun)=>void
):Promise<NativeDiskSyncResult>{
 let current=draft,total=0,remaining=false,overflow=false,active=false,loss:string|null=null;
 // Drain bounded pages. Infinite loops are forbidden on malformed native ports.
 for(let page=0;page<25;page++){
  const result=await port.drain({limit:NATIVE_DRAIN_LIMIT});
  overflow ||= result.overflow;
  active=result.active;
  if(result.loss){
   // Quarantined/cannot decrypt: do not merge or ACK an unknown partial
   // route. JS must surface the loss and require explicit Abandon/restart.
   loss=result.loss;
   return {draft:current,accepted:total,remaining:false,overflow,active,loss};
  }
  if(result.records.length===0)return {draft:current,accepted:total,remaining:false,overflow,active,loss};
  if(result.records.length>NATIVE_DRAIN_LIMIT)throw new Error('Native drain exceeded limit');
  // An absent ID must never acknowledge or discard native-disk records.
  // Throwing before persist/ACK keeps the same records for a later retry.
  const activityId=current.activityId;
  if(!activityId)
   throw new Error('Native GPS activityId missing; disk fixes retained without ACK');
  const merged=mergeNativeFixes(current,result.records);
  // Critical durability boundary: ACK only after successful JS persisted write.
  persist(merged.draft);
  await port.ack({clientId:current.clientId,activityId,seqs:merged.ackSeqs});
  current=merged.draft;total+=merged.inserted;
  if(result.records.length<NATIVE_DRAIN_LIMIT)return {draft:current,accepted:total,remaining:false,overflow,active,loss};
  remaining=true;
 }
 return {draft:current,accepted:total,remaining,overflow,active,loss};
}
