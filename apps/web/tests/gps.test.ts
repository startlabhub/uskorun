import test from "node:test";
import assert from "node:assert/strict";
import {assessGPS,activityPoints} from "../src/domain/gps";
test("duplicate timestamp gives no miles",()=>{
 const now=Date.now(),p={lat:38.58,lon:-121.49,accuracy:5,t:now};
 assert.equal(assessGPS([p,{...p,lon:-121.48}], "run",now-1000,now+1000).miles,0);
});
test("GPS gap does not mint a straight-line distance",()=>{
 const now=Date.now(),p={lat:38.58,lon:-121.49,accuracy:5,t:now};
 assert.equal(assessGPS([p,{...p,t:now+120000,lon:-121.48}], "run",now-1000,now+121000).miles,0);
});
test("walking and running earn different points",()=>{
 assert.equal(activityPoints("run",1),15);
 assert.equal(activityPoints("walk",1),10);
});
test("an implausible teleport earns no miles",()=>{
 const now=Date.now(),p={lat:38.58,lon:-121.49,accuracy:5,t:now};
 assert.equal(assessGPS([p,{...p,lon:-121.4,t:now+1000}], "run",now-1000,now+2000).miles,0);
});
