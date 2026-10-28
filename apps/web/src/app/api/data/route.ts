import {NextRequest,NextResponse} from "next/server";
import {database} from "@/server/db";
import {currentUser,decryptCode} from "@/server/security";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 try{
  const db=database(),user=await currentUser(req);
  const [challenges,offers,teams]=await Promise.all([
   db.query(`SELECT c.id,c.title,c.city,c.details,c.target_miles,c.ends_at,
    COALESCE(SUM(cc.miles),0)::float AS progress_miles,COUNT(DISTINCT cc.user_id)::int AS active_people
    FROM challenges c LEFT JOIN challenge_contributions cc ON cc.challenge_id=c.id
    WHERE c.state='active' AND c.ends_at>NOW() GROUP BY c.id ORDER BY c.ends_at`),
   db.query(`SELECT o.id,o.title,o.merchant,o.city,o.details,o.cost_points,o.is_demo,o.ends_at,o.max_claims,
       COUNT(v.id)::int AS claimed FROM offers o LEFT JOIN vouchers v ON v.offer_id=o.id
       WHERE o.state='active' AND o.is_demo=TRUE AND o.ends_at>NOW() GROUP BY o.id ORDER BY o.cost_points`),
   db.query(`SELECT t.id,t.name,t.city,t.invite_code,COUNT(tm.user_id)::int AS members,
    COALESCE(MAX(tc.miles),0)::float AS miles
    FROM teams t LEFT JOIN team_members tm ON tm.team_id=t.id
    LEFT JOIN (SELECT team_id,SUM(miles) AS miles FROM team_contributions GROUP BY team_id) tc ON tc.team_id=t.id
    GROUP BY t.id,tc.miles ORDER BY t.created_at DESC LIMIT 40`)
  ]);
  const data:any={user,challenges:challenges.rows,offers:offers.rows,teams:teams.rows,activities:[],vouchers:[],points:0,myChallenges:[],myTeam:null};
  if(user){
   const [a,v,p,e,t]=await Promise.all([
    db.query("SELECT id,client_id,kind,distance_miles::float,started_at,status,reason FROM activities WHERE user_id=$1 ORDER BY started_at DESC LIMIT 25",[user.id]),
    db.query(`SELECT v.id,v.offer_id,v.state,v.issued_at,v.redeemed_at,v.encrypted_code,o.title,o.merchant,o.is_demo
      FROM vouchers v JOIN offers o ON o.id=v.offer_id WHERE v.user_id=$1 ORDER BY v.issued_at DESC LIMIT 30`,[user.id]),
    db.query("SELECT COALESCE(SUM(delta),0)::int AS balance FROM points_ledger WHERE user_id=$1",[user.id]),
    db.query("SELECT challenge_id FROM challenge_members WHERE user_id=$1",[user.id]),
    db.query("SELECT team_id FROM team_members WHERE user_id=$1",[user.id])
   ]);
   data.activities=a.rows;
   data.vouchers=v.rows.map(({encrypted_code,...rest})=>({...rest,code:decryptCode(encrypted_code)}));
   data.points=p.rows[0].balance;
   data.myChallenges=e.rows.map(x=>x.challenge_id);
   data.myTeam=t.rows[0]?.team_id||null;
  }
  return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
 }catch(e){console.error("data error",e instanceof Error?e.message:"unknown");return NextResponse.json({error:"Data unavailable"},{status:503})}
}
