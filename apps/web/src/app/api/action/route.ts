import {NextRequest,NextResponse} from "next/server";
import {randomBytes} from "node:crypto";
import {database,transaction} from "@/server/db";
import {assessGPS,activityPoints,GPSPoint} from "@/domain/gps";
import {currentUser,hashPassword,validPassword,opaqueToken,tokenHash,encryptCode,sameOrigin,establishSession} from "@/server/security";
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
  if(b.action==="signup"){
   const email=String(b.email||"").trim().toLowerCase(),password=String(b.password||"");
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>240)error("Enter a valid email");
   if(password.length<12||password.length>200)error("Password must be 12-200 characters");
   if(b.ageConfirmed!==true||b.consent!==true)error("Adults 18+ and agreement to beta terms required");
   let id:string;
   try{const r=await db.query("INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id",[email,hashPassword(password)]);id=r.rows[0].id}
   catch(e:any){if(e.code==="23505")error("Email already registered");throw e}
   const res=ok({registered:true});await establishSession(res,id);return res;
  }
  if(b.action==="login"){
   const email=String(b.email||"").trim().toLowerCase(),password=String(b.password||"");
   const r=await db.query("SELECT id,password_hash FROM users WHERE email=$1",[email]);
   if(!r.rows[0]||!validPassword(password,r.rows[0].password_hash))error("Invalid credentials",401);
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
   if(!["run","walk"].includes(b.kind))error("Select run or walk");
   if(typeof b.clientId!=="string"||b.clientId.length<16||b.clientId.length>100)error("Invalid tracking ID");
   const existing=await db.query("SELECT id,status FROM activities WHERE user_id=$1 AND client_id=$2",[user.id,b.clientId]);
   if(existing.rows[0])return ok({activityId:existing.rows[0].id});
   const active=await db.query("SELECT 1 FROM activities WHERE user_id=$1 AND status='recording' AND started_at>NOW()-INTERVAL '4 hours'",[user.id]);
   if(active.rowCount)error("Finish or abandon your previous recording");
   const r=await db.query("INSERT INTO activities(user_id,client_id,kind) VALUES($1,$2,$3) RETURNING id",[user.id,b.clientId,b.kind]);
   return ok({activityId:r.rows[0].id});
  }
  if(b.action==="finish"){
   if(!Array.isArray(b.points)||b.points.length>10000)error("Too many GPS samples");
   const result=await transaction(async c=>{
    const x=await c.query("SELECT * FROM activities WHERE id=$1 AND user_id=$2 FOR UPDATE",[b.activityId,user.id]);
    const a=x.rows[0];if(!a)error("Activity missing",404);
    if(a.status!=="recording")return {status:a.status,miles:Number(a.distance_miles),reason:a.reason};
    const start=new Date(a.started_at).getTime(),now=Date.now();
    const points=b.points as GPSPoint[],track=assessGPS(points,a.kind,start,now);
    const status=track.reason==="accepted"?"accepted":"rejected";
    await c.query(`UPDATE activities SET status=$1,completed_at=NOW(),duration_seconds=$2,distance_miles=$3,reason=$4 WHERE id=$5`,
      [status,track.durationSeconds,track.miles,track.reason,a.id]);
    if(status==="accepted"){
     // Beta award cap: per-activity 75 points and daily total 150.
     await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[user.id]);
     const daily=await c.query(`SELECT COALESCE(SUM(delta),0)::int AS total FROM points_ledger
       WHERE user_id=$1 AND source_type='activity' AND created_at>=date_trunc('day',NOW() AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles'`,[user.id]);
     const award=Math.max(0,Math.min(activityPoints(a.kind,track.miles),150-Number(daily.rows[0].total)));
     if(award>0)await c.query("INSERT INTO points_ledger(user_id,source_type,source_id,delta) VALUES($1,'activity',$2,$3) ON CONFLICT DO NOTHING",[user.id,a.id,award]);
     await c.query(`INSERT INTO challenge_contributions(challenge_id,activity_id,user_id,miles)
       SELECT cm.challenge_id,$1,$2,$3 FROM challenge_members cm
       JOIN challenges ch ON ch.id=cm.challenge_id
       WHERE cm.user_id=$2 AND cm.joined_at<= $4 AND ch.ends_at>$4 AND ch.state='active'
       ON CONFLICT DO NOTHING`,[a.id,user.id,track.miles,a.started_at]);
     await c.query(`INSERT INTO team_contributions(team_id,activity_id,user_id,miles)
       SELECT tm.team_id,$1,$2,$3 FROM team_members tm WHERE tm.user_id=$2 AND tm.joined_at<=$4
       ON CONFLICT DO NOTHING`,[a.id,user.id,track.miles,a.started_at]);
    }
    return {status,miles:track.miles,reason:track.reason,quality:{used:track.acceptedPoints,discarded:track.discardedPoints}};
   });
   return ok(result);
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
   const result=await transaction(async c=>{
    const o=await c.query("SELECT * FROM offers WHERE id=$1 AND state='active' AND ends_at>NOW() FOR UPDATE",[b.offerId]);
    const offer=o.rows[0];if(!offer)error("Offer not available",404);
    const prior=await c.query("SELECT id FROM vouchers WHERE offer_id=$1 AND user_id=$2",[b.offerId,user.id]);
    if(prior.rowCount)error("Offer already claimed",409);
    const used=await c.query("SELECT COUNT(*)::int AS count FROM vouchers WHERE offer_id=$1",[b.offerId]);
    if(Number(used.rows[0].count)>=Number(offer.max_claims))error("Offer sold out",409);
    await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[user.id]);
    const points=await c.query("SELECT COALESCE(SUM(delta),0)::int AS balance FROM points_ledger WHERE user_id=$1",[user.id]);
    if(Number(points.rows[0].balance)<offer.cost_points)error("Not enough points",409);
    const code=randomBytes(12).toString("base64url").toUpperCase();
    const v=await c.query(`INSERT INTO vouchers(offer_id,user_id,code_hash,encrypted_code)
      VALUES($1,$2,$3,$4) RETURNING id`,[offer.id,user.id,tokenHash(code),encryptCode(code)]);
    if(offer.cost_points>0)await c.query("INSERT INTO points_ledger(user_id,source_type,source_id,delta) VALUES($1,'claim',$2,$3)",[user.id,v.rows[0].id,-offer.cost_points]);
    return {voucherId:v.rows[0].id};
   });
   return ok(result);
  }
  if(b.action==="redeem"){
   if(!["admin","merchant"].includes(user.role))error("Merchant access required",403);
   const code=String(b.code||"").trim().toUpperCase();
   if(code.length<12||code.length>64)error("Invalid voucher code");
   const result=await transaction(async c=>{
    const v=await c.query(`SELECT v.id,v.state,v.offer_id,o.title,o.is_demo FROM vouchers v
       JOIN offers o ON o.id=v.offer_id WHERE v.code_hash=$1 FOR UPDATE OF v`,[tokenHash(code)]);
    const item=v.rows[0];
    if(!item)error("Voucher not found",404);
    if(user.role==="merchant"){
      const access=await c.query("SELECT 1 FROM merchant_access WHERE user_id=$1 AND offer_id=$2",[user.id,item.offer_id]);
      if(!access.rowCount)error("Merchant not authorized for this offer",403);
    }
    if(item.state!=="issued")error("Voucher already redeemed or revoked",409);
    await c.query("UPDATE vouchers SET state='redeemed',redeemed_at=NOW() WHERE id=$1",[item.id]);
    await c.query("INSERT INTO audit_events(actor_id,action,object_id) VALUES($1,'redeem',$2)",[user.id,item.id]);
    return {title:item.title,is_demo:item.is_demo};
   });
   return ok(result);
  }
  error("Unsupported action",400);
 }catch(e:any){
  const status=e.status||500;
  if(status===500)console.error("action failed",e instanceof Error?e.message:"unknown");
  return fail(status===500?"Action unavailable":e.message,status);
 }
}
