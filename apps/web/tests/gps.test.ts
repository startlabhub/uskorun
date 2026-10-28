import test from "node:test";
import assert from "node:assert/strict";
import {assessGPS,activityPoints,DEMO_EARN_RULE} from "../src/domain/gps";

function movingSeries(speedMetersPerSec:number,intervalSec:number,durationSec:number){
 const t=Date.now()-durationSec*1000;
 const points=[];
 for(let sec=0;sec<=durationSec;sec+=intervalSec){
  // Near Sacramento (38.58° N), one longitude degree is about 87 km.
  points.push({lat:38.58,lon:-121.49+speedMetersPerSec*sec/86900,accuracy:4,t:t+sec*1000});
 }
 return {points,start:t,end:t+durationSec*1000};
}
test("1 Hz running fixes accumulate into meaningful distance",()=>{
 const v=movingSeries(3,1,120);
 const r=assessGPS(v.points,"run",v.start-1000,v.end+1000);
 assert.equal(r.reason,"accepted");
 assert.ok(r.miles>0.18&&r.miles<0.27,`unexpected ${r.miles} mi`);
});
test("1 Hz walking fixes also accumulate rather than zeroing short steps",()=>{
 const v=movingSeries(1.4,1,120);
 const r=assessGPS(v.points,"walk",v.start-1000,v.end+1000);
 assert.equal(r.reason,"accepted");
 assert.ok(r.miles>0.08&&r.miles<0.14,`unexpected ${r.miles} mi`);
});
test("5 second sampling retains plausible running",()=>{
 const v=movingSeries(3,5,120);
 const r=assessGPS(v.points,"run",v.start-1000,v.end+1000);
 assert.ok(r.miles>0.18&&r.miles<0.27);
});
test("duplicate timestamps never add distance",()=>{
 const now=Date.now(),p={lat:38.58,lon:-121.49,accuracy:4,t:now};
 assert.equal(assessGPS([p,{...p,lon:-121.489,t:now}],"run",now-1000,now+1000).miles,0);
});
test("a 2 minute GPS gap never mints interpolated straight-line distance",()=>{
 const now=Date.now()-121000,p={lat:38.58,lon:-121.49,accuracy:4,t:now};
 assert.equal(assessGPS([p,{...p,t:now+120000,lon:-121.485}],"run",now-1000,now+121000).miles,0);
});
test("implausible teleport earns no miles",()=>{
 const now=Date.now()-2000,p={lat:38.58,lon:-121.49,accuracy:4,t:now};
 assert.equal(assessGPS([p,{...p,lon:-121.4,t:now+1000}],"run",now-1000,now+2000).miles,0);
});
test("stationary and tiny oscillating noise do not earn miles",()=>{
 const now=Date.now()-120000,points=[];
 for(let sec=0;sec<=120;sec++)points.push({lat:38.58,lon:-121.49+(sec%2?0.00001:0),accuracy:5,t:now+sec*1000});
 assert.equal(assessGPS(points,"walk",now-1000,now+121000).miles,0);
});
test("demo rate is explicit and running differs from walking",()=>{
 assert.equal(DEMO_EARN_RULE.version,"demo-v0.1");
 assert.equal(activityPoints("run",1),15);
 assert.equal(activityPoints("walk",1),10);
});
