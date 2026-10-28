import {database} from './db';
import {tokenHash} from './security';
import {AUTH_LIMITS,throttleBucket,mayAttempt} from '../domain/auth-guard';
// Database-backed, atomic, across replicas. Do not trust client-provided X-Forwarded-For IPs.
// Global + email HMAC keyed limits apply even when attackers rotate email targets.
export async function enforceAuthLimits(kind:'login'|'signup',email:string){
 const limits=AUTH_LIMITS[kind],windowBucket=throttleBucket(Date.now(),limits.windowSeconds);
 const db=database();
 for(const [scope,max] of [['global',kind==='login'?300:100],['identity',limits.identity]] as const){
  const key=scope==='global'?`auth:${kind}:global`:`auth:${kind}:identity:${tokenHash(email)}`;
  const x=await db.query(`INSERT INTO auth_rate_limits(bucket_key,window_id,attempts)
    VALUES($1,$2,1) ON CONFLICT(bucket_key,window_id)
    DO UPDATE SET attempts=auth_rate_limits.attempts+1 RETURNING attempts`,[key,windowBucket]);
  if(!mayAttempt(Number(x.rows[0].attempts),max)){
   const e=new Error('Too many attempts; try later') as Error&{status:number};e.status=429;throw e;
  }
 }
}
export async function enforceVoucherAttempts(userId:string){
 const db=database(),bucket=throttleBucket(Date.now(),600),key=`redeem:${tokenHash(userId)}`;
 const x=await db.query(`INSERT INTO auth_rate_limits(bucket_key,window_id,attempts) VALUES($1,$2,1)
   ON CONFLICT(bucket_key,window_id) DO UPDATE SET attempts=auth_rate_limits.attempts+1 RETURNING attempts`,[key,bucket]);
 if(Number(x.rows[0].attempts)>30){const e=new Error('Too many redemption attempts') as Error&{status:number};e.status=429;throw e;}
}
