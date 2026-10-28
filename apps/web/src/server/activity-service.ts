import {transaction, database} from './db';
import {assessGPS,activityPoints} from '../domain/gps';
import type {GPSPoint} from '../domain/gps';
export class ActivityError extends Error {constructor(message:string,public status=400){super(message)}}
export async function startRecording(userId:string,clientId:string,kind:'run'|'walk'){
 return transaction(async c=>{
  // Serialize ALL starts and daily earning for this user before checking state.
  await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  const old=await c.query('SELECT id,status FROM activities WHERE user_id=$1 AND client_id=$2',[userId,clientId]);
  if(old.rows[0])return {activityId:old.rows[0].id,status:old.rows[0].status};
  const active=await c.query("SELECT id FROM activities WHERE user_id=$1 AND status='recording'",[userId]);
  if(active.rowCount)throw new ActivityError('Finish or abandon existing recording',409);
  try {
   const added=await c.query('INSERT INTO activities(user_id,client_id,kind) VALUES($1,$2,$3) RETURNING id',[userId,clientId,kind]);
   return {activityId:added.rows[0].id,status:'recording'};
  }catch(e:any){if(e.code==='23505')throw new ActivityError('Existing recording or repeated start',409);throw e}
 });
}
export async function abandonRecording(userId:string,id:string){
 return transaction(async c=>{
  const r=await c.query('SELECT id,status FROM activities WHERE user_id=$1 AND id=$2 FOR UPDATE',[userId,id]);
  if(!r.rows[0])throw new ActivityError('Activity not found',404);
  if(r.rows[0].status==='recording'){
   await c.query("UPDATE activities SET status='abandoned',reason='Abandoned by runner',completed_at=NOW() WHERE id=$1",[id]);
   return {status:'abandoned'};
  }
  return {status:r.rows[0].status};
 });
}
export async function recordingStatus(userId:string){
 const r=await database().query("SELECT id,client_id,kind,started_at FROM activities WHERE user_id=$1 AND status='recording' ORDER BY started_at DESC LIMIT 1",[userId]);
 return {recording:r.rows[0]||null};
}
export async function finishRecording(userId:string,activityId:string,points:GPSPoint[]){
 if(!Array.isArray(points)||points.length>10000)throw new ActivityError('Too many GPS samples');
 return transaction(async c=>{
  const x=await c.query('SELECT * FROM activities WHERE id=$1 AND user_id=$2 FOR UPDATE',[activityId,userId]);
  const a=x.rows[0];if(!a)throw new ActivityError('Activity missing',404);
  // Response-lost-after-commit retry: terminal result is returned, no scoring repeated.
  if(a.status!=='recording')return {status:a.status,miles:Number(a.distance_miles),reason:a.reason};
  const start=new Date(a.started_at).getTime(),now=Date.now();
  const track=assessGPS(points,a.kind,start,now);
  const status=track.reason==='accepted'?'accepted':'rejected';
  await c.query('UPDATE activities SET status=$1,completed_at=NOW(),duration_seconds=$2,distance_miles=$3,reason=$4 WHERE id=$5',
   [status,track.durationSeconds,track.miles,track.reason,a.id]);
  if(status==='accepted'){
   await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
   const daily=await c.query(`SELECT COALESCE(SUM(delta),0)::int AS total FROM points_ledger
     WHERE user_id=$1 AND source_type='activity' AND created_at>=date_trunc('day',NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles'`,[userId]);
   const award=Math.max(0,Math.min(activityPoints(a.kind,track.miles),150-Number(daily.rows[0].total)));
   if(award>0)await c.query("INSERT INTO points_ledger(user_id,source_type,source_id,delta) VALUES($1,'activity',$2,$3) ON CONFLICT DO NOTHING",[userId,a.id,award]);
   await c.query(`INSERT INTO challenge_contributions(challenge_id,activity_id,user_id,miles)
     SELECT cm.challenge_id,$1,$2,$3 FROM challenge_members cm JOIN challenges ch ON ch.id=cm.challenge_id
     WHERE cm.user_id=$2 AND cm.joined_at<= $4 AND ch.ends_at>$4 AND ch.state='active' ON CONFLICT DO NOTHING`,
     [a.id,userId,track.miles,a.started_at]);
   await c.query(`INSERT INTO team_contributions(team_id,activity_id,user_id,miles)
     SELECT tm.team_id,$1,$2,$3 FROM team_members tm WHERE tm.user_id=$2 AND tm.joined_at<=$4 ON CONFLICT DO NOTHING`,
     [a.id,userId,track.miles,a.started_at]);
  }
  return {status,miles:track.miles,reason:track.reason,quality:{used:track.acceptedPoints,discarded:track.discardedPoints}};
 });
}
