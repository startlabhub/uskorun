import type {GPSPoint} from './gps.ts';
export type RunPhase = 'starting'|'recording'|'paused'|'pending_finish';
export type PendingRun = {
 version:1;clientId:string;activityId:string|null;kind:'run'|'walk';
 phase:RunPhase;segment:number;points:GPSPoint[];createdAt:number;
};
export const DRAFT_KEY='uskorun_pending_run_v1';
export function newPendingRun(clientId:string,kind:'run'|'walk',now=Date.now()):PendingRun {
 return {version:1,clientId,activityId:null,kind,phase:'starting',segment:0,points:[],createdAt:now};
}
export function withStartedId(run:PendingRun,id:string):PendingRun {
 return {...run,activityId:id,phase:'recording'};
}
export function withPause(run:PendingRun):PendingRun {
 if(run.phase==='pending_finish')return run;
 return {...run,phase:'paused',segment:run.segment+1};
}
export function withResume(run:PendingRun):PendingRun {
 if(run.phase!=='paused')return run;
 return {...run,phase:'recording'};
}
export function withFix(run:PendingRun,fix:Omit<GPSPoint,'segment'>):PendingRun {
 if(run.phase!=='recording')return run;
 const points=[...run.points,{...fix,segment:run.segment}];
 if(points.length>10000)throw new Error('GPS sample limit reached; finish the session');
 return {...run,points};
}
export function withPendingFinish(run:PendingRun):PendingRun {
 return {...run,phase:'pending_finish'};
}
export function finalizeAfterResponse(run:PendingRun,serverResponse:{ok?:boolean;status?:string}|null):PendingRun|null {
 // Do not delete activityId or GPS payload when the request times out or returns an error.
 if(!serverResponse?.ok)return run;
 if(['accepted','review','rejected','abandoned'].includes(serverResponse.status||''))return null;
 return run;
}
export function readPendingRun(storage:Pick<Storage,'getItem'>):PendingRun|null {
 try{
  const json=storage.getItem(DRAFT_KEY);if(!json)return null;
  const x=JSON.parse(json) as PendingRun;
  if(x?.version!==1||typeof x.clientId!=='string'||!['run','walk'].includes(x.kind)||
   !['starting','recording','paused','pending_finish'].includes(x.phase)||
   !Number.isSafeInteger(x.segment)||!Array.isArray(x.points)||x.points.length>10000||
   typeof x.createdAt!=='number')return null;
  return x;
 }catch{return null}
}
export function writePendingRun(storage:Pick<Storage,'setItem'>,run:PendingRun):void {
 storage.setItem(DRAFT_KEY,JSON.stringify(run));
}
export function clearPendingRun(storage:Pick<Storage,'removeItem'>):void {storage.removeItem(DRAFT_KEY);}
