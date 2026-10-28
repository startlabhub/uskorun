import test from 'node:test';
import assert from 'node:assert/strict';
import {assessGPS,activityPoints,DEMO_EARN_RULE} from '../src/domain/gps.ts';
import type {GPSPoint} from '../src/domain/gps.ts';
function path(speed:number,step:number,duration:number,segment=0,start=Date.now()-200000):GPSPoint[]{
 const arr:GPSPoint[]=[];
 for(let t=0;t<=duration;t+=step)arr.push({lat:38.58,lon:-121.49+speed*t/86900,accuracy:4,t:start+t*1000,segment});
 return arr;
}
function check(points:GPSPoint[],kind:'run'|'walk'='run'){
 return assessGPS(points,kind,points[0].t-1000,points[points.length-1].t+1000);
}
test('1 Hz running and walking regression retained',()=>{
 const run=check(path(3,1,120));assert.equal(run.reason,'accepted');assert.ok(run.miles>0.18&&run.miles<0.27);
 const walk=check(path(1.4,1,120),'walk');assert.equal(walk.reason,'accepted');assert.ok(walk.miles>0.08&&walk.miles<0.14);
});
test('5 Hz sampling gap-free run remains valid',()=>{assert.ok(check(path(3,5,120)).miles>0.18)});
test('30s pause, 60m displacement is NEVER bridged',()=>{
 const t=Date.now()-120000;
 const a=path(2,5,40,0,t),first=a[a.length-1];
 const b=path(2,5,40,1,t+70000).map(p=>({...p,lon:p.lon+((first.lon-a[0].lon)+60/86900)}));
 const joined=check([...a,...b]);
 const separated=check(a).miles+check(b).miles;
 assert.ok(Math.abs(joined.miles-separated)<0.004,`joined ${joined.miles} independent ${separated}`);
});
test('very short 2s pause bridge does not count displacement',()=>{
 const t=Date.now()-120000;
 const a=path(2.4,5,40,0,t),first=a[a.length-1];
 const b=path(2.4,5,40,1,t+42000).map(p=>({...p,lon:p.lon+(first.lon-a[0].lon)+10/86900}));
 assert.ok(Math.abs(check([...a,...b]).miles-check(a).miles-check(b).miles)<0.004);
});
test('app background/visibility interruption requires incremented segment',()=>{
 const start=Date.now()-130000;
 const a=path(2.5,5,40,0,start),b=path(2.5,5,40,1,start+48000).map(p=>({...p,lon:p.lon+500/86900}));
 const r=check([...a,...b]);
 assert.ok(r.miles<0.14,`background hop counted ${r.miles}`);
});
test('120s missing GPS samples never bridge gap',()=>{
 const t=Date.now()-150000,p={lat:38.58,lon:-121.49,accuracy:4,t,segment:0};
 assert.equal(check([p,{...p,t:t+120000,lon:-121.48}]).miles,0);
});
test('duplicate timestamps and implausible jumps do not earn',()=>{
 const t=Date.now()-15000,p={lat:38.58,lon:-121.49,accuracy:4,t,segment:0};
 assert.equal(check([p,{...p,t,lon:-121.48}]).miles,0);
 assert.equal(check([p,{...p,t:t+1000,lon:-121.4}]).miles,0);
});
test('stationary GPS jitter does not earn',()=>{
 const t=Date.now()-150000,arr:GPSPoint[]=[];
 for(let s=0;s<=120;s++)arr.push({lat:38.58,lon:-121.49+(s%2?0.00001:0),accuracy:5,t:t+s*1000,segment:0});
 assert.equal(check(arr,'walk').miles,0);
});
test('out-of-order segment is rejected and not bridged',()=>{
 const t=Date.now()-50000,p={lat:38.58,lon:-121.49,accuracy:4,t,segment:2};
 assert.equal(check([p,{...p,t:t+10000,lon:-121.488,segment:1}]).miles,0);
});
test('demo earning coefficients are not sponsor economics',()=>{
 assert.equal(DEMO_EARN_RULE.version,'demo-v0.1');assert.equal(activityPoints('run',1),15);assert.equal(activityPoints('walk',1),10);
});

test('GPS timestamps outside server recording window cannot be reused',()=>{
 const fixes=path(3,5,60),serverStart=fixes[fixes.length-1].t+1000;
 assert.equal(assessGPS(fixes,'run',serverStart,serverStart+60000).miles,0);
});

test('silent 30-second 60-meter gap in same segment fails closed',()=>{
 const t=Date.now()-35000,p={lat:38.58,lon:-121.49,accuracy:4,t,segment:0};
 assert.equal(check([p,{...p,t:t+30000,lon:-121.49+60/86900}]).miles,0);
});
