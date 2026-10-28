// USKORUN: GPS is spoofable foreground evidence, not a location attestation.
export type GPSPoint = {lat:number;lon:number;accuracy:number;t:number;segment:number};
export type Result = {miles:number;acceptedPoints:number;discardedPoints:number;reason:string;durationSeconds:number};
const R=6371000;
const MAX_FIX_GAP_SECONDS=15; // conservative foreground fail-closed gate; calibrate on real phones
export const DEMO_EARN_RULE={version:'demo-v0.1',runPointsPerMile:15,walkPointsPerMile:10,maxPointsPerSession:75};
export function meters(a:GPSPoint,b:GPSPoint):number {
 const rad=Math.PI/180;
 const dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
export function assessGPS(points:GPSPoint[],kind:'run'|'walk',serverStart:number,serverEnd:number):Result {
 if(!Array.isArray(points)||points.length<2||points.length>10000)
  return {miles:0,acceptedPoints:0,discardedPoints:0,reason:'Not enough usable GPS samples',durationSeconds:0};
 let anchor:GPSPoint|null=null,last:GPSPoint|null=null,activeSeconds=0;
 let distance=0,acceptedPoints=0,discardedPoints=0;
 const maxSpeed=kind==='walk'?3.5:8;
 for(const p of points){
  if(!p||![p.lat,p.lon,p.accuracy,p.t,p.segment].every(Number.isFinite)||!Number.isSafeInteger(p.segment)||p.segment<0||p.segment>10000||
    Math.abs(p.lat)>90||Math.abs(p.lon)>180||p.accuracy<0||p.accuracy>50||
    p.t<serverStart||p.t>serverEnd){
    discardedPoints++;anchor=null;last=null;continue;
  }
  if(last){
   // A change of segment always stops distance credit, even for a 1-second pause.
   // Reject unordered segment values; they must never be reused on resume.
   if(p.segment<last.segment){discardedPoints++;anchor=null;last=null;continue;}
   if(p.segment!==last.segment){anchor=p;last=p;acceptedPoints++;continue;}
   const dt=(p.t-last.t)/1000;
   if(dt<=0){discardedPoints++;continue;}
   if(dt>MAX_FIX_GAP_SECONDS){discardedPoints++;anchor=p;last=p;continue;}
   const step=meters(last,p);
   if(step/dt>maxSpeed&&step>Math.max(20,last.accuracy+p.accuracy)){
    discardedPoints++;anchor=p;last=p;continue;
   }
   activeSeconds+=dt;
  }
  acceptedPoints++;
  if(!anchor){anchor=p;last=p;continue;}
  const dt=(p.t-anchor.t)/1000;
  // MAX_FIX_GAP_SECONDS applies to consecutive samples above, not anchor age.
  // A high-accuracy-uncertainty fix may need >15 seconds of continuous movement
  // to exceed the existing displacement noise floor. Never bridge a missing fix.
  if(dt<=0){discardedPoints++;anchor=p;last=p;continue;}
  // Preserve the prior accepted 1 Hz cumulative short-step logic.
  const d=meters(anchor,p);
  const noiseFloor=Math.max(7,0.7*(anchor.accuracy+p.accuracy));
  // The existing minimum average speed plus displacement floor suppresses
  // stationary jitter; resetting anchor on a fixed time would erase valid walks.
  if(d>=noiseFloor&&d/dt>=0.6&&d/dt<=maxSpeed){distance+=d;anchor=p;}
  last=p;
 }
 const miles=Math.round(distance/1609.344*1000)/1000;
 const durationSeconds=Math.max(0,Math.min(4*3600,Math.round(activeSeconds)));
 const reason=miles<0.03?'Too little accepted foreground distance':miles>5?'Session exceeds beta mileage cap':'accepted';
 return {miles,acceptedPoints,discardedPoints,reason,durationSeconds};
}
export function activityPoints(kind:'run'|'walk',miles:number):number {
 const rate=kind==='run'?DEMO_EARN_RULE.runPointsPerMile:DEMO_EARN_RULE.walkPointsPerMile;
 return Math.max(0,Math.min(DEMO_EARN_RULE.maxPointsPerSession,Math.floor(miles*rate)));
}
