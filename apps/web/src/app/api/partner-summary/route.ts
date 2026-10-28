import {NextRequest,NextResponse} from 'next/server';
import {currentUser} from '@/server/security';
import {database} from '@/server/db';

export const runtime='nodejs';

/** Scoped and aggregated partner demo figures only; never disclose individual GPS. */
export async function GET(req:NextRequest){
 try{
  const user=await currentUser(req);
  if(!user||!['admin','merchant'].includes(user.role))
   return NextResponse.json({error:'Authorized partner account required'},{status:403});
  const result=await database().query(`
   SELECT o.id,o.title,o.details,o.cost_points,o.max_claims,o.ends_at,
     COUNT(v.id) FILTER (WHERE v.state IN ('issued','redeemed'))::int AS issued_total,
     COUNT(v.id) FILTER (WHERE v.state='issued')::int AS outstanding,
     COUNT(v.id) FILTER (WHERE v.state='redeemed')::int AS redeemed
   FROM offers o LEFT JOIN vouchers v ON v.offer_id=o.id
   WHERE o.is_demo=TRUE
     AND ($2::boolean OR EXISTS(
       SELECT 1 FROM merchant_access ma WHERE ma.user_id=$1 AND ma.offer_id=o.id
     ))
   GROUP BY o.id ORDER BY o.title
  `,[user.id,user.role==='admin']);
  return NextResponse.json({offers:result.rows,demoOnly:true,disclaimer:
   'Issued/redeemed voucher counts are not proof of new customers, incremental sales, revenue, or ROI.'},
   {headers:{'Cache-Control':'private, no-store'}});
 }catch{
  return NextResponse.json({error:'Partner summary unavailable'},{status:503});
 }
}
