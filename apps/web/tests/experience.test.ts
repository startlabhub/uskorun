import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEMO_EARN_RULE,activityPoints,assessGPS} from '../src/domain/gps.ts';
import {MIN_ACCEPTED_MILES,DEMO_DAILY_POINT_CAP,preliminaryActivityPoints,
 preliminaryPointsNote,remainingConfirmedPoints,canClaimDemoOffer,nextDemoReward,selectedJoinedGoal} from '../src/domain/experience.ts';
import {newPendingRun,withStartedId,withFix,withPause,withResume,withPendingFinish,finalizeAfterResponse} from '../src/domain/pending.ts';

test('run/walk use existing 15/10 beta rates, whole-point floor and per-session cap',()=>{
 assert.equal(DEMO_EARN_RULE.runPointsPerMile,15);
 assert.equal(DEMO_EARN_RULE.walkPointsPerMile,10);
 assert.equal(DEMO_DAILY_POINT_CAP,150);
 assert.equal(activityPoints('run',0.13),1);
 assert.equal(activityPoints('walk',0.13),1);
 assert.equal(preliminaryActivityPoints('run',0.13),1);
 assert.equal(preliminaryActivityPoints('walk',0.13),1);
 assert.equal(preliminaryActivityPoints('run',100),75);
 assert.equal(preliminaryActivityPoints('walk',100),75);
});
test('under 0.03 miles or invalid live measurement cannot estimate credit',()=>{
 assert.equal(MIN_ACCEPTED_MILES,0.03);
 for(const n of [-10,0,0.029,Number.NaN,Number.POSITIVE_INFINITY])
  assert.equal(preliminaryActivityPoints('run',n),0);
 assert.match(preliminaryPointsNote('walk',0.02),/minimum/);
});
test('preliminary session estimate NEVER increases confirmed spendable balance',()=>{
 const confirmed=1,preliminary=preliminaryActivityPoints('run',1);
 assert.equal(preliminary,15);
 assert.equal(remainingConfirmedPoints(confirmed,10),9);
 assert.equal(canClaimDemoOffer(confirmed,{id:'A',cost_points:10,claimed:0,max_claims:10},false),false);
});
test('confirmed balance sufficient and insufficient claim state',()=>{
 const offer={id:'B',cost_points:10,claimed:0,max_claims:15};
 assert.equal(remainingConfirmedPoints(4,10),6);
 assert.equal(canClaimDemoOffer(4,offer,false),false);
 assert.equal(remainingConfirmedPoints(10,10),0);
 assert.equal(canClaimDemoOffer(10,offer,false),true);
});
test('claimed and exhausted demo offers are never claimable by UI',()=>{
 const offer={id:'B',cost_points:10,claimed:0,max_claims:15};
 assert.equal(canClaimDemoOffer(100,offer,true),false);
 assert.equal(canClaimDemoOffer(100,{...offer,claimed:15},false),false);
});
test('Home prefers affordable unclaimed demo reward at balances 0, 5, 10',()=>{
 const offers=[{id:'a',cost_points:5,claimed:1,max_claims:25},
   {id:'coffee',cost_points:10,claimed:0,max_claims:100},
   {id:'c',cost_points:20,claimed:0,max_claims:20}];
 assert.deepEqual(nextDemoReward(0,offers,[]),{offer:offers[0],remaining:5});
 assert.deepEqual(nextDemoReward(5,offers,[]),{offer:offers[0],remaining:0});
 assert.deepEqual(nextDemoReward(10,offers,[]),{offer:offers[0],remaining:0});
 assert.deepEqual(nextDemoReward(10,offers,[{offer_id:'a',state:'issued'}]),
  {offer:offers[1],remaining:0});
 // Regression: 5 confirmed points must never be sent to 10-point coffee
 // while a currently claimable 5-point Partner A remains available.
 assert.notEqual(nextDemoReward(5,offers,[])?.offer.id,'coffee');
});
test('Home falls back to nearest unavailable, skipping claimed and sold-out',()=>{
 const offers=[{id:'a',cost_points:5,claimed:0,max_claims:5},
   {id:'b',cost_points:10,claimed:0,max_claims:3},
   {id:'c',cost_points:20,claimed:0,max_claims:3}];
 assert.deepEqual(nextDemoReward(7,offers,[]),{offer:offers[0],remaining:0});
 assert.deepEqual(nextDemoReward(7,offers,[{offer_id:'a',state:'issued'}]),
  {offer:offers[1],remaining:3});
 assert.deepEqual(nextDemoReward(7,[{...offers[0],claimed:5},offers[1],offers[2]],[]),
  {offer:offers[1],remaining:3});
 assert.deepEqual(nextDemoReward(7,offers,[{offer_id:'a',state:'redeemed'},{offer_id:'b',state:'issued'}]),
  {offer:offers[2],remaining:13});
 assert.equal(nextDemoReward(7,offers,[{offer_id:'a',state:'issued'},{offer_id:'b',state:'redeemed'},{offer_id:'c',state:'issued'}]),null);
 assert.equal(nextDemoReward(5,[],[]),null);
 assert.equal(nextDemoReward(20,offers.map(o=>({...o,claimed:o.max_claims})),[]),null);
});
test('API offer query contract filters expired, inactive and non-demo inventory',()=>{
 // Source contract only: actual PostgreSQL behavior must be checked separately.
 const source=readFileSync(new URL('../src/app/api/data/route.ts',import.meta.url),'utf8');
 assert.match(source,/WHERE o\.state='active' AND o\.is_demo=TRUE AND o\.ends_at>NOW\(\)/);
});
test('joined goal selection uses existing enrolled challenge, no new goal engine',()=>{
 const a={id:'a',title:'Together',target_miles:100,progress_miles:5};
 const b={id:'b',title:'Team challenge',target_miles:10,progress_miles:3};
 assert.deepEqual(selectedJoinedGoal([a,b],['b']),b);
 assert.equal(selectedJoinedGoal([a,b],[]),null);
});
test('active session kind remains frozen independently of UI selection',()=>{
 const original=withStartedId(newPendingRun('stable-id','walk',1000),'server-activity');
 let withPoints=withFix(original,{lat:38.58,lon:-121.49,accuracy:5,t:2000});
 withPoints=withPause(withPoints);withPoints=withResume(withPoints);
 assert.equal(withPoints.kind,'walk');
 assert.equal(withPoints.clientId,'stable-id');
 assert.equal(withPoints.activityId,'server-activity');
});
test('Start to Home to Track: pausing and resuming retains accumulated fixes and segments',()=>{
 let d=withStartedId(newPendingRun('c1','run',1000),'a1');
 d=withFix(d,{lat:38.58,lon:-121.49,t:1000,accuracy:4});
 d=withFix(d,{lat:38.58,lon:-121.4895,t:101000,accuracy:4});
 d=withPause(d);
 const old=d.points.slice();
 d=withResume(d);
 assert.deepEqual(d.points,old);
 d=withFix(d,{lat:38.58,lon:-121.489,t:103000,accuracy:4});
 assert.equal(d.points[2].segment,1);
 // No distance is minted from old segment to first fix in new segment.
 assert.equal(assessGPS([d.points[1],d.points[2]],'run',1000,104000).miles,0);
});
test('after failed Finish payload remains and terminal accepted/rejected clears only once',()=>{
 let d=withStartedId(newPendingRun('stable-client','walk',1000),'stable-activity');
 d=withFix(d,{lat:38.58,lon:-121.49,accuracy:5,t:1000});
 d=withPendingFinish(d);
 assert.deepEqual(finalizeAfterResponse(d,null),d);
 assert.deepEqual(finalizeAfterResponse(d,{ok:false}),d);
 assert.equal(finalizeAfterResponse(d,{ok:true,status:'accepted'}),null);
 assert.equal(finalizeAfterResponse(d,{ok:true,status:'rejected'}),null);
});
test('reject reason and min threshold are server-only, not wallet awards',()=>{
 const start=Date.now()-130000;
 const r=assessGPS([
  {lat:38.58,lon:-121.49,accuracy:4,t:start,segment:0},
  {lat:38.58,lon:-121.4899,accuracy:4,t:start+1000,segment:0}],
  'walk',start-1000,Date.now());
 assert.notEqual(r.reason,'accepted');
 assert.equal(preliminaryActivityPoints('walk',r.miles),0);
});
