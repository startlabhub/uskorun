export type GPSPoint={lat:number;lon:number;accuracy:number;t:number};
export type Result={miles:number;acceptedPoints:number;discardedPoints:number;reason:string;durationSeconds:number};
const R=6371000;
export function meters(a:GPSPoint,b:GPSPoint):number {
  const rad=Math.PI/180;
  const dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
export function assessGPS(points:GPSPoint[],kind:"run"|"walk",serverStart:number,serverEnd:number):Result{
  if(!Array.isArray(points)||points.length<2||points.length>10000) return {miles:0,acceptedPoints:0,discardedPoints:0,reason:"Not enough usable GPS samples",durationSeconds:0};
  let prev:GPSPoint|null=null,distance=0,acceptedPoints=0,discardedPoints=0,earliest=0,latest=0;
  const maxSpeed=kind==="walk"?3.5:8.0;
  for(const p of points){
    if(!p||![p.lat,p.lon,p.accuracy,p.t].every(Number.isFinite)||Math.abs(p.lat)>90||Math.abs(p.lon)>180||p.accuracy<0||p.accuracy>50||p.t<serverStart-30000||p.t>serverEnd+30000){
      discardedPoints++;prev=null;continue;
    }
    acceptedPoints++;if(!earliest)earliest=p.t;latest=p.t;
    if(prev){
      const secs=(p.t-prev.t)/1000,delta=meters(prev,p);
      // Never connect missing time intervals or count noisy stationary GPS jitter.
      if(secs>0&&secs<=60&&delta>=Math.max(6,(p.accuracy+prev.accuracy)/3)&&delta/secs<=maxSpeed)distance+=delta;
      else if(secs<=0||secs>60||delta/secs>maxSpeed)discardedPoints++;
    }
    prev=p;
  }
  const miles=Math.round(distance/1609.344*1000)/1000;
  const durationSeconds=Math.max(0,Math.min(4*3600,Math.round((latest-earliest)/1000)));
  const reason=miles<0.03?"Too little verified foreground distance":miles>5?"Session exceeds beta mileage cap":"accepted";
  return {miles,acceptedPoints,discardedPoints,reason,durationSeconds};
}
export function activityPoints(kind:"run"|"walk",miles:number):number{
  // Provisional beta points only, NO CASH VALUE.
  return Math.max(0,Math.min(75,Math.floor(miles*(kind==="run"?15:10))));
}
