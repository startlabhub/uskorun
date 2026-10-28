import {transaction} from './db';
import {randomBytes} from 'node:crypto';
import {tokenHash,encryptCode} from './security';
export class RewardError extends Error {constructor(message:string,public status=400){super(message)}}
export async function claimOffer(userId:string,offerId:string){
 return transaction(async c=>{
  const result=await c.query("SELECT * FROM offers WHERE id=$1 AND state='active' AND ends_at>NOW() FOR UPDATE",[offerId]);
  const o=result.rows[0];if(!o)throw new RewardError('Offer not available',404);
  if(!o.is_demo && process.env.ALLOW_REAL_REWARDS!=='explicit-founder-approved')throw new RewardError('Real sponsor rewards are disabled',403);
  const prior=await c.query('SELECT id FROM vouchers WHERE offer_id=$1 AND user_id=$2',[offerId,userId]);
  if(prior.rowCount)throw new RewardError('Offer already claimed',409);
  const count=await c.query('SELECT COUNT(*)::int AS count FROM vouchers WHERE offer_id=$1',[offerId]);
  if(Number(count.rows[0].count)>=Number(o.max_claims))throw new RewardError('Offer sold out',409);
  await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  const points=await c.query('SELECT COALESCE(SUM(delta),0)::int AS balance FROM points_ledger WHERE user_id=$1',[userId]);
  if(Number(points.rows[0].balance)<o.cost_points)throw new RewardError('Not enough points',409);
  const code=randomBytes(12).toString('base64url').toUpperCase();
  const r=await c.query('INSERT INTO vouchers(offer_id,user_id,code_hash,encrypted_code) VALUES($1,$2,$3,$4) RETURNING id',
   [offerId,userId,tokenHash(code),encryptCode(code)]);
  if(o.cost_points>0)await c.query("INSERT INTO points_ledger(user_id,source_type,source_id,delta) VALUES($1,'claim',$2,$3)",[userId,r.rows[0].id,-o.cost_points]);
  return {voucherId:r.rows[0].id};
 });
}
export async function redeemVoucher(user:{id:string;role:'admin'|'merchant'|'runner'},code:string){
 if(!['merchant','admin'].includes(user.role))throw new RewardError('Merchant access required',403);
 if(code.length<12||code.length>64)throw new RewardError('Invalid voucher code');
 return transaction(async c=>{
  const r=await c.query(`SELECT v.id,v.state,v.offer_id,o.title,o.is_demo,o.ends_at,o.state AS offer_state FROM vouchers v
     JOIN offers o ON o.id=v.offer_id WHERE v.code_hash=$1 FOR UPDATE OF v`,[tokenHash(code.toUpperCase())]);
  const item=r.rows[0];if(!item)throw new RewardError('Voucher not found',404);
  if(user.role==='merchant'){
   const allowed=await c.query('SELECT 1 FROM merchant_access WHERE user_id=$1 AND offer_id=$2',[user.id,item.offer_id]);
   if(!allowed.rowCount)throw new RewardError('Merchant not authorized for this offer',403);
  }
  if(item.state!=='issued')throw new RewardError('Voucher already redeemed or revoked',409);
  if(new Date(item.ends_at).getTime()<=Date.now()||item.offer_state!=='active')throw new RewardError('Offer no longer valid',409);
  await c.query("UPDATE vouchers SET state='redeemed',redeemed_at=NOW() WHERE id=$1",[item.id]);
  await c.query("INSERT INTO audit_events(actor_id,action,object_id) VALUES($1,'redeem',$2)",[user.id,item.id]);
  return {title:item.title,is_demo:item.is_demo};
 });
}
