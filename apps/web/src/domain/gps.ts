// USKORUN beta foreground browser GPS estimator.
// GPS from browsers can be spoofed; this is a plausibility filter, not reliable proof of physical activity.
export type GPSPoint={lat:number;lon:number;accuracy:number;t:number};
export type Result={miles:number;acceptedPoints:number;discardedPoints:number;reason:string;durationSeconds:number};
const R=6371000;
export const DEMO_EARN_RULE={version:"demo-v0.1",runPointsPerMile:15,walkPointsPerMile:10,maxPointsPerSession:75};
export function meters(a:GPSPoint,b:GPSPoint):number{
 const rad=Math.PI/180;
 const dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
 const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
 return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
export function assessGPS(points:GPSPoint[],kind:"run"|"walk",serverStart:number,serverEnd:number):Result{
 if(!Array.isArray(points)||points.length<2||points.length>10000)
  return {miles:0,acceptedPoints:0,discardedPoints:0,reason:"Not enough usable GPS samples",durationSeconds:0};
 let anchor:GPSPoint|null=null,last:GPSPoint|null=null;
 let distance=0,acceptedPoints=0,discardedPoints=0,earliest=0,latest=0;
 const maxSpeed=kind==="walk"?3.5:8;
 for(const p of points){
  if(!p||![p.lat,p.lon,p.accuracy,p.t].every(Number.isFinite)||
    Math.abs(p.lat)>90||Math.abs(p.lon)>180||p.accuracy<0||p.accuracy>50||
    p.t<serverStart-30000||p.t>serverEnd+30000){
    discardedPoints++;anchor=null;last=null;continue;
  }
  if(last){
   const dt=(p.t-last.t)/1000;
   if(dt<=0){discardedPoints++;continue}
   if(dt>60){discardedPoints++;anchor=p;last=p;continue}
   // Clearly implausible point-to-point jump. Reset rather than crediting anything across it.
   const instantaneous=meters(last,p)/dt;
   if(instantaneous>maxSpeed&&meters(last,p)>Math.max(20,last.accuracy+p.accuracy)){
    discardedPoints++;anchor=p;last=p;continue;
   }
  }
  acceptedPoints++;
  if(!earliest)earliest=p.t;
  latest=p.t;
  if(!anchor){anchor=p;last=p;continue}
  const dt=(p.t-anchor.t)/1000;
  if(dt<=0||dt>60){discardedPoints++;anchor=p;last=p;continue}
  // Accumulate several short GPS steps from a fixed anchor. Per-sample 6m thresholds
  // discard legitimate ~1.4m/s walking and ~3m/s running at 1 Hz.
  const d=meters(anchor,p);
  const noiseFloor=Math.max(7,0.7*(anchor.accuracy+p.accuracy));
  if(d>=noiseFloor&&d/dt>=0.6&&d/dt<=maxSpeed){
   distance+=d;anchor=p;
  }else if(dt>=30){
   // Stop stationary drift accumulating without bound.
   anchor=p;
  }
  last=p;
 }
 const miles=Math.round(distance/1609.344*1000)/1000;
 const durationSeconds=Math.max(0,Math.min(4*3600,Math.round((latest-earliest)/1000)));
 const reason=miles<0.03?"Too little accepted foreground distance":miles>5?"Session exceeds beta mileage cap":"accepted";
 return {miles,acceptedPoints,discardedPoints,reason,durationSeconds};
}
export function activityPoints(kind:"run"|"walk",miles:number):number{
 // DEMO economy only. These coefficients are NOT approved sponsor economics.
 const rate=kind==="run"?DEMO_EARN_RULE.runPointsPerMile:DEMO_EARN_RULE.walkPointsPerMile;
 return Math.max(0,Math.min(DEMO_EARN_RULE.maxPointsPerSession,Math.floor(miles*rate)));
}
