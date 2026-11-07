/**
 * The installed (static) Capacitor bundle cannot execute Next.js route handlers.
 * Local QA mode exercises real GPS + PendingRun without creating users, points,
 * vouchers or server activities. Only an explicit remote backend can validate Finish.
 * Browser/remote-URL mode retains the existing same-origin API and cookie contract.
 */
export const NATIVE_LOCAL_QA=process.env.NEXT_PUBLIC_USKORUN_NATIVE_EXPORT==='1';
export const ACTION_TIMEOUT_MS=15_000;
type Fetcher=(input:RequestInfo|URL,init?:RequestInit)=>Promise<Response>;
export async function boundedFetch(
  path:string,init:RequestInit={},timeoutMs=ACTION_TIMEOUT_MS,fetcher:Fetcher=fetch
):Promise<Response>{
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  return await fetcher(path,{...init,signal:controller.signal});
 }catch(error){
  if(controller.signal.aborted)throw new Error('Request timed out. Check connection; retry with the SAME session ID.');
  throw error;
 }finally{clearTimeout(timer)}
}
function json(value:object,status=200){return new Response(JSON.stringify(value),{
 status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
})}
/**
 * Stable no-server contract. No pretend accepted sessions or fake wallet credits.
 * A start ID is clearly local-only; Finish intentionally fails to preserve
 * pending GPS fixes until a real backend is configured or user abandons.
 */
export function localQARequest(path:string,init?:RequestInit):Response{
 if(path==='/api/data')return json({
  user:{id:'local-qa-only',email:'Local QA — no account created',role:'runner'},
  challenges:[],offers:[],teams:[],vouchers:[],activities:[],points:0,
  myChallenges:[],myTeam:null
 });
 if(path==='/api/partner-summary')return json({error:'Local QA has no merchant permissions'},403);
 if(path!=='/api/action'||init?.method!=='POST')return json({error:'Unsupported local QA request'},404);
 let body:Record<string,unknown>;
 try{body=JSON.parse(String(init.body||'{}'))}catch{return json({error:'Invalid request'},400)}
 switch(body.action){
  case 'start':
   if(!['run','walk'].includes(String(body.kind))||typeof body.clientId!=='string'||body.clientId.length<16)
    return json({error:'Invalid local tracking ID'},400);
   return json({ok:true,status:'recording',activityId:'local-qa:'+body.clientId});
  case 'finish':
   return json({error:'Local QA cannot award points. GPS samples are saved locally for retry; a separately approved server is required.'},503);
  case 'abandon':
   return json({ok:true,status:'abandoned'});
  case 'logout':
   return json({error:'Local QA does not create a server login.'},403);
  default:return json({error:'This action requires a real, approved API server. Local QA creates no accounts or points.'},503);
 }
}
export async function apiFetch(path:string,init:RequestInit={},timeoutMs=ACTION_TIMEOUT_MS,
 fetcher:Fetcher=fetch):Promise<Response>{
 if(NATIVE_LOCAL_QA)return localQARequest(path,init);
 return boundedFetch(path,init,timeoutMs,fetcher);
}
