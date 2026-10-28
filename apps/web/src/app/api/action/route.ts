import {NextRequest,NextResponse} from "next/server";
import {randomBytes} from "node:crypto";
import {database,transaction} from "@/server/db";
import type {GPSPoint} from "@/domain/gps";
import {startRecording,finishRecording,abandonRecording,recordingStatus} from "@/server/activity-service";
import {claimOffer,redeemVoucher} from "@/server/reward-service";
import {validateAuthInput} from "@/domain/auth-guard";
import {enforceAuthLimits,enforceVoucherAttempts} from "@/server/auth-rate";
import {currentUser,hashPassword,validPassword,tokenHash,sameOrigin,establishSession} from "@/server/security";
export const runtime="nodejs";
const ok=(payload:object={})=>NextResponse.json({ok:true,...payload});
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
type ActionError=Error&{status?:number};
function error(message:string,status=400):never{const e:ActionError=new Error(message);e.status=status;throw e}
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return fail("Invalid request origin",403);
 if(Number(req.headers.get("content-length")||0)>1200000)return fail("Payload too large",413);
 let b:any;
 try{b=await req.json()}catch{return fail("Malformed JSON")}
 if(!b||typeof b.action!=="string")return fail("Unknown action");
 try{
  const db=database();
  if(b.action==="signup"||b.action==="login"){
   const mode=b.action as 'signup'|'login';
   const input=validateAuthInput(b.email,b.password,mode);
   if(!input)error('Invalid email/password length or format');
   // The global + per-identity DB throttle runs before CPU-intensive scrypt.
   await enforceAuthLimits(mode,input.email);
   if(mode==='signup'){
    if(b.ageConfirmed!==true||b.consent!==true)error('Adults 18+ and beta terms required');
    let id:string;
    try{const r=await db.query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id',
      [input.email,await hashPassword(input.password)]);id=r.rows[0].id;}
    catch(e:any){if(e.code==='23505')error('Email already registered',409);throw e}
    const res=ok({registered:true});await establishSession(res,id);return res;
   }
   const r=await db.query('SELECT id,password_hash FROM users WHERE email=$1',[input.email]);
   if(!r.rows[0]||!await validPassword(input.password,r.rows[0].password_hash))error('Invalid credentials',401);
   const res=ok();await establishSession(res,r.rows[0].id);return res;
  }
  const user=await currentUser(req);if(!user)error("Sign in required",401);
  if(b.action==="logout"){
   const token=req.cookies.get("uskorun_session")?.value;
   if(token)await db.query("DELETE FROM auth_sessions WHERE token_hash=$1",[tokenHash(token)]);
   const res=ok();res.cookies.delete("uskorun_session");return res;
  }
  if(b.action==="joinChallenge"){
   await db.query(`INSERT INTO challenge_members(user_id,challenge_id) SELECT $1,id FROM challenges
     WHERE id=$2 AND state='active' AND ends_at>NOW() ON CONFLICT DO NOTHING`,[user.id,b.id]);
   return ok();
  }
  if(b.action==="start"){
   if(!["run","walk"].includes(b.kind))error('Select run or walk');
   if(typeof b.clientId!=='string'||b.clientId.length<16||b.clientId.length>100)error('Invalid tracking ID');
   return ok(await startRecording(user.id,b.clientId,b.kind));
  }
  if(b.action==="recover")return ok(await recordingStatus(user.id));
  if(b.action==="abandon"){
   if(typeof b.activityId!=='string')error('Activity ID required');
   return ok(await abandonRecording(user.id,b.activityId));
  }
  if(b.action==="finish"){
   if(typeof b.activityId!=='string'||!Array.isArray(b.points)||b.points.length>10000)error('Invalid finish payload');
   return ok(await finishRecording(user.id,b.activityId,b.points as GPSPoint[]));
  }
  if(b.action==="createTeam"){
   const name=String(b.name||"").trim(),city=String(b.city||"Sacramento").slice(0,80);
   if(name.length<3||name.length>60)error("Team name must be 3–60 characters");
   const result=await transaction(async c=>{
    const code=randomBytes(6).toString("hex");
    const r=await c.query("INSERT INTO teams(name,city,invite_code,created_by) VALUES($1,$2,$3,$4) RETURNING id,invite_code",[name,city,code,user.id]);
    await c.query(`INSERT INTO team_members(user_id,team_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE
      SET team_id=EXCLUDED.team_id,joined_at=NOW()`,[user.id,r.rows[0].id]);
    return r.rows[0];
   });
   return ok(result);
  }
  if(b.action==="joinTeam"){
   const code=String(b.code||"").trim().toLowerCase();
   const r=await db.query("SELECT id FROM teams WHERE invite_code=$1",[code]);
   if(!r.rows[0])error("Invitation code not found",404);
   await db.query(`INSERT INTO team_members(user_id,team_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE
     SET team_id=EXCLUDED.team_id,joined_at=NOW()`,[user.id,r.rows[0].id]);
   return ok();
  }
  if(b.action==="claim"){
   if(typeof b.offerId!=='string')error('Invalid offer');
   return ok(await claimOffer(user.id,b.offerId));
  }
  if(b.action==="redeem"){
   const code=typeof b.code==='string'?b.code.trim().toUpperCase():'';
   // Enforce token-guessing rate limit before hashing/DB lock.
   await enforceVoucherAttempts(user.id);
   return ok(await redeemVoucher(user,code));
  }
  error("Unsupported action",400);
 }catch(e:any){
  const status=e.status||500;
  if(status===500)console.error("action failed",e instanceof Error?e.message:"unknown");
  return fail(status===500?"Action unavailable":e.message,status);
 }
}
