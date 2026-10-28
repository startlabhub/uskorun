import {DEMO_EARN_RULE,activityPoints} from './gps.ts';

export type ActivityKind='run'|'walk';
export type GoalSummary={id:string;title:string;target_miles:number;progress_miles:number};
export type ShopOffer={id:string;cost_points:number;claimed:number;max_claims:number};
export type WalletVoucher={offer_id:string;state:string};
export const MIN_ACCEPTED_MILES=0.03;
export const DEMO_DAILY_POINT_CAP=150;

/**
 * Approximation from foreground route fixes only. This is NOT a ledger entry:
 * server acceptance, minimum distance, daily cap, and fraud rules still apply.
 */
export function preliminaryActivityPoints(kind:ActivityKind,miles:number):number{
 if(!Number.isFinite(miles)||miles<MIN_ACCEPTED_MILES)return 0;
 return activityPoints(kind,miles);
}
export function preliminaryPointsNote(kind:ActivityKind,miles:number):string{
 if(!Number.isFinite(miles)||miles<MIN_ACCEPTED_MILES)
  return `Estimate 0 pts · under ${MIN_ACCEPTED_MILES.toFixed(2)} mi minimum`;
 const rate=kind==='run'?DEMO_EARN_RULE.runPointsPerMile:DEMO_EARN_RULE.walkPointsPerMile;
 return `Estimate ${preliminaryActivityPoints(kind,miles)} pts · floor(${rate}/mi), session cap ${DEMO_EARN_RULE.maxPointsPerSession}`;
}
/** Never mix an unconfirmed session estimate into the spendable balance. */
export function remainingConfirmedPoints(confirmed:number,cost:number):number{
 return Math.max(0,Math.ceil(cost)-Math.max(0,Math.floor(confirmed)));
}
export function canClaimDemoOffer(confirmed:number,offer:ShopOffer,alreadyClaimed:boolean):boolean{
 return !alreadyClaimed&&offer.max_claims>offer.claimed&&remainingConfirmedPoints(confirmed,offer.cost_points)===0;
}
export function nextDemoReward(confirmed:number,offers:ShopOffer[],vouchers:WalletVoucher[]):{
 offer:ShopOffer;remaining:number}|null{
 const prior=new Set(vouchers.map(v=>v.offer_id));
 const candidates=offers.filter(o=>!prior.has(o.id)&&o.max_claims>o.claimed)
  .sort((a,b)=>a.cost_points-b.cost_points);
 if(!candidates.length)return null;
 const offer=candidates.find(o=>remainingConfirmedPoints(confirmed,o.cost_points)>0)??candidates[0];
 return {offer,remaining:remainingConfirmedPoints(confirmed,offer.cost_points)};
}
export function selectedJoinedGoal(challenges:GoalSummary[],joinedIds:string[]):GoalSummary|null{
 return challenges.find(c=>joinedIds.includes(c.id))??null;
}
