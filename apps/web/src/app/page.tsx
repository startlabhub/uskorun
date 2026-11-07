"use client";
import {useEffect,useRef,useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {assessGPS,GPSPoint} from "@/domain/gps";
import {newPendingRun,withStartedId,withPause,withResume,withFix,withPendingFinish,readPendingRun,writePendingRun,clearPendingRun} from "@/domain/pending";
import type {PendingRun} from "@/domain/pending";
import {voucherFragment,parseAndScrubVoucherFragment} from "@/domain/voucher-handoff";
import {ForegroundWatch,browserWatchClock,blurEditingFocus} from "@/domain/foreground-watch";
import type {PositionSample} from "@/domain/foreground-watch";
import {nativeGPSAvailable,ensureNativeBackgroundPrerequisites} from "@/domain/gps-platform";
import {durableGPSPort} from "@/domain/durable-gps-platform";
import type {NativeDiskPort} from "@/domain/native-disk-queue";
import {nativeResumeKind,syncNativeQueue} from "@/domain/native-disk-queue";
import {apiFetch,NATIVE_LOCAL_QA} from "@/domain/api-client";
import {preliminaryActivityPoints,preliminaryPointsNote,remainingConfirmedPoints,canClaimDemoOffer,nextDemoReward,selectedJoinedGoal} from "@/domain/experience";
type User={id:string;email:string;role:"runner"|"admin"|"merchant"};
type Challenge={id:string;title:string;city:string;details:string;target_miles:number;ends_at:string;progress_miles:number;active_people:number};
type Offer={id:string;title:string;merchant:string;city:string;details:string;cost_points:number;is_demo:boolean;claimed:number;max_claims:number};
type Team={id:string;name:string;city:string;invite_code:string;members:number;miles:number};
type Voucher={id:string;offer_id:string;state:string;title:string;merchant:string;is_demo:boolean;code:string;issued_at:string};
type PartnerStats={id:string;title:string;details:string;cost_points:number;max_claims:number;issued_total:number;outstanding:number;redeemed:number};
type Activity={id:string;client_id:string;kind:string;distance_miles:number;status:string;reason:string;started_at:string};
type Data={user:User|null;challenges:Challenge[];offers:Offer[];teams:Team[];vouchers:Voucher[];activities:Activity[];points:number;myChallenges:string[];myTeam:string|null};
const empty:Data={user:null,challenges:[],offers:[],teams:[],vouchers:[],activities:[],points:0,myChallenges:[],myTeam:null};
type Tab="home"|"challenges"|"track"|"rewards"|"teams"|"profile"|"merchant";
const mi=(v:number)=>v.toLocaleString("en-US",{maximumFractionDigits:2});
export default function Home(){
 const [data,setData]=useState<Data>(empty),[tab,setTab]=useState<Tab>("home"),[loading,setLoading]=useState(true);
 const [notice,setNotice]=useState(""),[problem,setProblem]=useState(""),[authMode,setAuthMode]=useState<"signup"|"login">("signup");
 const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[age,setAge]=useState(false),[consent,setConsent]=useState(false);
 const [kind,setKind]=useState<"run"|"walk">("run"),[tracking,setTracking]=useState(false),[paused,setPaused]=useState(false);
 const [liveMiles,setLiveMiles]=useState(0),[gpsNote,setGpsNote]=useState("Ready to record"),[fixCount,setFixCount]=useState(0);
 const [teamName,setTeamName]=useState(""),[teamCode,setTeamCode]=useState(""),[redeemCode,setRedeemCode]=useState("");
 const [partnerStats,setPartnerStats]=useState<PartnerStats[]|null>(null),[partnerRefresh,setPartnerRefresh]=useState(0);
 const points=useRef<GPSPoint[]>([]),activity=useRef<string|null>(null),wake=useRef<any>(null);
 const watcher=useRef<ForegroundWatch|null>(null),wakeEpoch=useRef(0);
 const nativePort=useRef<NativeDiskPort|null>(null);
 const nativeActive=useRef(false),nativeSync=useRef<Promise<void>|null>(null);
 const nativePoll=useRef<ReturnType<typeof setInterval>|null>(null);
 const pausing=useRef(false);
 const [nativeConsent,setNativeConsent]=useState(false);
 const [nativeMode,setNativeMode]=useState(false);
 useEffect(()=>{setNativeMode(nativeGPSAvailable())},[]);

 const [busy,setBusy]=useState(false),busyRef=useRef(false);
 const [pendingRecovery,setPendingRecovery]=useState<PendingRun|null>(null);
 const draftRef=useRef<PendingRun|null>(null),watchEpoch=useRef(0);
 function saveDraft(d:PendingRun|null){
  draftRef.current=d;setPendingRecovery(d);
  // A native WebView may be terminated after a call; localStorage persists
  // pending unconfirmed fixes across app relaunch. Browser stays session-only.
  const storage=nativeGPSAvailable()?localStorage:sessionStorage;
  if(d){try{writePendingRun(storage,d)}catch{setGpsNote('Storage unavailable: do not close the app before finish')}}
  else{try{clearPendingRun(storage)}catch{}}
 }

 async function refresh(){
  try{const r=await apiFetch("/api/data",{cache:"no-store"});if(!r.ok)throw new Error("Data service unavailable");
   const json=await r.json();setData(json);
   // Recovery when browser storage was cleared but the server still has a recording.
   const orphan=json.user && json.activities?.find((a:any)=>a.status==='recording');
   if(orphan&&!draftRef.current){
    const recovered=withPause(withStartedId(newPendingRun(orphan.client_id,orphan.kind),orphan.id));
    saveDraft(recovered);activity.current=recovered.activityId;points.current=[];
    setTracking(false);setPaused(true);setTab('track');
    setGpsNote('Server recording recovered without GPS samples. Resume a new segment or abandon.');
   }
  }catch(e:any){setProblem(e.message||"Connection failed")}finally{setLoading(false)}
 }
 useEffect(()=>{
  refresh();
  // QR bearer token is in URL fragment only; clear immediately from history.
  const code=parseAndScrubVoucherFragment(window.location,window.history);
  if(code){setRedeemCode(code);setTab('merchant')}
  const old=readPendingRun(nativeGPSAvailable()?localStorage:sessionStorage);
  if(old){const paused=old.phase==='recording'&&!nativeGPSAvailable()?withPause(old):old;
   saveDraft(paused);activity.current=paused.activityId;points.current=paused.points;
   setKind(paused.kind);setFixCount(paused.points.length);
   if(paused.points.length>0){
    setLiveMiles(assessGPS(paused.points,paused.kind,paused.points[0].t-1000,Date.now()+1000).miles);
   }
   if(nativeGPSAvailable()&&paused.phase==='recording'){
    nativePort.current=durableGPSPort();
    nativeActive.current=true;setPaused(false);setTracking(true);
    startNativePoll();
    void syncNativePoints().catch(()=>{});
    setGpsNote('Native OS route recorder restored; draining previously saved fixes. Confirm foreground-service indicator.');
   }else{
    setPaused(true);setTracking(false);
    if(nativeGPSAvailable()&&paused.activityId){
     nativePort.current=durableGPSPort();
     void syncNativePoints().catch(()=>{});
    }
    setGpsNote('Previous activity recovered. Resume, retry Finish, or Abandon.');
   }
   // A saved session must be visible immediately after reload; QR handoff takes priority.
   if(!code)setTab('track');
  }
  const onVisibility=()=>{
   // Capacitor's native watcher stays active across calls, lock and background.
   // Only the standard browser watcher pauses on hidden/pagehide.
   if(nativeGPSAvailable()){
    if(document.visibilityState==='visible')void syncNativePoints().catch(()=>{});
    return;
   }
   if(document.visibilityState==='hidden'&&draftRef.current?.phase==='recording'&&!watcher.current?.isRunning)
    pause('App hidden: recording interrupted. Return and tap Resume.');
   watcher.current?.visibilityChanged();
  };
  const onPageHide=()=>{
   if(!nativeGPSAvailable()&&draftRef.current?.phase==='recording')
    pause('App interrupted: return and tap Resume.');
  };
  const onFocus=()=>{
   if(nativeGPSAvailable())void syncNativePoints().catch(()=>{});
   else watcher.current?.focus();
  };
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('pagehide',onPageHide);
  window.addEventListener('focus',onFocus);
  return()=>{
   document.removeEventListener('visibilitychange',onVisibility);
   window.removeEventListener('pagehide',onPageHide);
   window.removeEventListener('focus',onFocus);
   stopNativePoll();
   clearWatch(); // OS service intentionally unaffected by WebView teardown.
  };
 },[]);
 useEffect(()=>{
  if(tab!=="merchant"||!["merchant","admin"].includes(data.user?.role||"")){setPartnerStats(null);return}
  let cancelled=false;
  apiFetch("/api/partner-summary",{cache:"no-store"}).then(async r=>{if(!r.ok)throw new Error("Partner summary unavailable");return r.json()})
   .then(v=>{if(!cancelled)setPartnerStats(v.offers)})
   .catch(()=>{if(!cancelled)setPartnerStats(null)});
  return()=>{cancelled=true};
 },[tab,data.user?.role,partnerRefresh]);
 async function act(action:string,payload:any={}){
  setProblem("");setNotice("");
  try{const r=await apiFetch("/api/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});
   const json=await r.json();if(!r.ok)throw new Error(json.error||"Request failed");
   await refresh();return json;
  }catch(e:any){setProblem(e.message||"Request failed");return null}
 }
 async function auth(e:React.FormEvent){e.preventDefault();
  // iOS may retain an active text editing/undo context while the phone moves.
  // Blur only the currently focused editor on explicit form submission.
  blurEditingFocus(document.activeElement);
  const r=await act(authMode,{email,password,ageConfirmed:age,consent});
  if(r){setPassword("");setTab("home");setNotice("Welcome to USKORUN!")}
 }
 const geoloc=(navigatorAvailable:boolean)=>navigatorAvailable&&"geolocation" in navigator;
 function clearWatch(){
  // Do not stop OS recording on WebView unload / React unmount.
  // Only explicit Pause, Finish, Abandon stop the native service.
  watcher.current?.stop();
  wakeEpoch.current++;
  void wake.current?.release?.().catch?.(()=>{});
  wake.current=null;
 }
 /** Drain real OS fixes. Persist full PendingRun before ACKing any native seq. */
 async function syncNativePoints():Promise<void>{
  if(!nativeGPSAvailable())return;
  const run=draftRef.current;
  if(!run?.activityId)return;
  if(nativeSync.current)return nativeSync.current;
  const port=nativePort.current??durableGPSPort();
  nativePort.current=port;
  const task=(async()=>{
   try{
    const result=await syncNativeQueue(port,run,updated=>{
     // Strict write — if quota/IO fails, do not acknowledge OS records.
     writePendingRun(localStorage,updated);
     draftRef.current=updated;setPendingRecovery(updated);
     points.current=updated.points;setFixCount(updated.points.length);
    });
    if(result.accepted>0){
     const track=assessGPS(result.draft.points,result.draft.kind,
      result.draft.points[0].t-1000,Date.now()+1000);
     setLiveMiles(track.miles);
     setGpsNote('Native disk: '+result.draft.points.length+' real GPS fixes saved; credits only after server Finish');
    }
    if(!result.active&&!busyRef.current&&!pausing.current&&draftRef.current?.phase==='recording'){
     // OS persisted state says no active recorder (e.g., permission/service lost).
     // Never claim that GPS kept recording after a process restart.
     nativeActive.current=false;stopNativePoll();
     saveDraft(withPause(draftRef.current));
     setTracking(false);setPaused(true);
     setGpsNote('Native GPS service is inactive. Tap Resume to begin a new segment; lost distance is not credited.');
    }
    if(result.overflow||result.remaining)
     throw new Error('Native GPS queue is full or not fully drained; do not submit Finish.');
   }catch(e){
    const message='Durable GPS sync blocked: '+String(e instanceof Error?e.message:e);
    setProblem(message);
    throw e;
   }
  })();
  nativeSync.current=task;
  try{await task}finally{nativeSync.current=null}
 }
 function startNativePoll(){
  if(nativePoll.current!==null)return;
  nativePoll.current=setInterval(()=>{
   if(document.visibilityState==='visible'&&draftRef.current?.activityId)
    void syncNativePoints().catch(()=>{});
  },2000);
 }
 function stopNativePoll(){
  if(nativePoll.current!==null){clearInterval(nativePoll.current);nativePoll.current=null}
 }
 function onPosition({coords,timestamp}:PositionSample){
  const d=draftRef.current;
  if(d?.phase!=='recording')return;
  const raw={lat:coords.latitude,lon:coords.longitude,accuracy:coords.accuracy,t:timestamp};
  if(raw.accuracy>50){setGpsNote('Weak GPS accuracy: no distance credited for this fix');return}
  try{
   const updated=withFix(d,raw);
   saveDraft(updated);points.current=updated.points;setFixCount(points.current.length);
   const track=assessGPS(points.current,updated.kind,points.current[0].t-1000,Date.now()+1000);
   setLiveMiles(track.miles);
   setGpsNote('GPS accuracy ±'+Math.round(raw.accuracy)+'m'+(nativeGPSAvailable()?' · native location':''));
  }catch(e:any){pause(String(e.message||'GPS sample failed. Tap Resume.'))}
 }
 async function observe(){
  if(nativeGPSAvailable()){
   try{
    await ensureNativeBackgroundPrerequisites();
    const draft=draftRef.current;
    if(!draft)throw new Error('Missing native PendingRun');
    const port=nativePort.current??durableGPSPort();
    nativePort.current=port;
    // One active session and segment on disk; no JS callback required.
    await port.begin(nativeResumeKind(draft));
    // If Finish/Pause happened while native permission dialog was shown,
    // stop OS recording instead of silently resurrecting the watcher.
    if(draftRef.current?.phase!=='recording'||draftRef.current?.activityId!==draft.activityId){
     await port.pause();
     return;
    }
    nativeActive.current=true;
    startNativePoll();
    await syncNativePoints();
    setGpsNote('Phone GPS is writing real fixes to native disk before JS reads them.');
   }catch(e){
    await pause('Native GPS not started: '+String(e instanceof Error?e.message:e)+'. Resume after fixing permissions.');
   }
   return;
  }
  if(!geoloc(typeof navigator!=='undefined')){
   setProblem('GPS unavailable');pause('GPS unavailable. Tap Resume after location access is restored.');return;
  }
  if(!watcher.current)watcher.current=new ForegroundWatch({
   geo:navigator.geolocation,clock:browserWatchClock,
   visible:()=>document.visibilityState==='visible',
   onFix:onPosition,onInterrupted:reason=>pause(reason)
  });
  if(!watcher.current.start())return;
  const epoch=++wakeEpoch.current;
  // Wake Lock only improves foreground web tracking; not native background.
  try{
   (navigator as any).wakeLock?.request('screen').then((lock:any)=>{
    if(epoch!==wakeEpoch.current||!watcher.current?.isRunning){
     void lock.release().catch?.(()=>{});return;
    }
    wake.current=lock;
   }).catch(()=>{});
  }catch{}
 }
 async function start(){
  blurEditingFocus(document.activeElement);
  if(busyRef.current){setProblem('An action is still processing. Please wait for its result.');return}
  const existing=draftRef.current;
  if(existing?.phase==='recording'){setProblem('Already recording. Tap Pause or Finish.');return}
  if(existing?.phase==='paused'){setProblem('A saved activity is paused. Use Resume, Finish, or Abandon; do not start a new activity.');setTab('track');return}
  if(existing?.phase==='pending_finish'){setProblem('Finish has not been confirmed. Retry Finish or Abandon first.');setTab('track');return}
  if(watcher.current?.isRunning||nativeActive.current||tracking){setProblem('GPS recording already active');return}
  if(nativeGPSAvailable()&&!nativeConsent){
   setNativeConsent(true);
   setGpsNote('Before GPS permission: USKORUN requests phone location while walking/running, including screen lock and incoming calls. iOS Always location and Android background location / persistent notification may be needed. Tap Start again to confirm.');
   return;
  }
  if(!nativeGPSAvailable()&&!geoloc(typeof navigator!=='undefined')){setProblem('GPS unavailable');return}
  busyRef.current=true;setBusy(true);
  try{
   // Reuse the SAME clientId if start previously timed out after being accepted by server.
   const current=draftRef.current||newPendingRun(crypto.randomUUID(),kind);
   saveDraft(current);
   const r=await act('start',{kind:current.kind,clientId:current.clientId});
   if(!r){setGpsNote('Start not confirmed. Retry with same tracking ID.');return}
   if(r.status!=='recording'){saveDraft(null);setGpsNote('Session was already finalized.');return}
   const started=withStartedId(current,r.activityId);saveDraft(started);
   activity.current=started.activityId;points.current=started.points;
   setLiveMiles(0);setFixCount(points.current.length);setTracking(true);setPaused(false);
   await observe();
  }finally{busyRef.current=false;setBusy(false)}
 }
 async function pause(reason='Paused — no movement recorded until resumed'){
  if(pausing.current)return;
  pausing.current=true;
  clearWatch();
  try{
   if(nativeGPSAvailable()&&nativePort.current){
    // Stop durable producer first, then persist/ACK all its existing samples.
    await nativePort.current.pause();
    nativeActive.current=false;stopNativePoll();
    await syncNativePoints();
   }
  }catch(e){
   setProblem('Native pause/drain failed; location queue remains on disk: '+String(e));
  }finally{
   const d=draftRef.current;
   if(d?.phase==='recording')saveDraft(withPause(d));
   setTracking(false);setPaused(true);setGpsNote(reason);
   pausing.current=false;
  }
 }
 async function resume(){
  blurEditingFocus(document.activeElement);
  const d=draftRef.current;
  if(busyRef.current){setProblem('An action is still processing; Resume is unavailable.');return}
  if(!d||!d.activityId||d.phase!=='paused'){setProblem('Resume requires a paused activity with an ID.');return}
  if(watcher.current?.isRunning||nativeActive.current){setProblem('GPS is already recording.');return}
  busyRef.current=true;setBusy(true);
  try{
   if(nativeGPSAvailable())await syncNativePoints(); // old segment first
   const updated=draftRef.current??d;
   const next=withResume(updated);saveDraft(next);
   setTracking(true);setPaused(false);
   setGpsNote('Reconnecting GPS in a new segment; missed distance is not counted…');
   await observe();
  }catch(e){setProblem('Resume blocked by native queue: '+String(e))}
  finally{busyRef.current=false;setBusy(false)}
 }
 async function stop(){
  if(busyRef.current){setProblem('An action is in progress; Finish cannot start yet.');return}
  busyRef.current=true;setBusy(true);
  clearWatch();setTracking(false);setPaused(true);
  try{
   if(nativeGPSAvailable()&&nativePort.current){
    // End OS collection before snapshotting the Finish payload.
    await nativePort.current.end();
    nativeActive.current=false;stopNativePoll();
    await syncNativePoints(); // all queued, real fixes must be persisted/ACKed first
   }
   const d=draftRef.current;
   if(!d?.activityId){setGpsNote('Retry Start first to recover server ID');return}
   const frozen=withPendingFinish(d);saveDraft(frozen);
   const r=await act('finish',{activityId:frozen.activityId,points:frozen.points});
   if(!r||!['accepted','rejected','review','abandoned'].includes(r.status)){
    setGpsNote('Finish not confirmed. Native fixes saved locally; Retry Finish with same activity ID.');return;
   }
   if(nativeGPSAvailable()&&nativePort.current){
    // Do not clear user route if native disk still has unacknowledged points.
    await syncNativePoints();
    await nativePort.current.reset({clientId:frozen.clientId,activityId:frozen.activityId});
   }
   saveDraft(null);points.current=[];activity.current=null;
   setNotice(r.status==='accepted'?`Recorded ${mi(r.miles)} mi.`:`Session not credited: ${r.reason}`);
   setTab('profile');
  }catch(e){
   setProblem('Finish blocked; native route retained for retry: '+String(e));
   setGpsNote('GPS data is preserved on disk. Resolve native queue error before retrying Finish.');
  }finally{busyRef.current=false;setBusy(false)}
 }
 async function abandon(){
  const d=draftRef.current;
  if(!d){setProblem('No saved activity to abandon.');return}
  if(busyRef.current){setProblem('Wait for the current action before abandoning.');return}
  busyRef.current=true;setBusy(true);
  try{
   let id=d.activityId;
   if(!id){
    const r=await act('start',{kind:d.kind,clientId:d.clientId});
    if(!r)return;id=r.activityId;
   }
   if(nativeGPSAvailable()&&nativePort.current){
    await nativePort.current.end();nativeActive.current=false;stopNativePoll();
    await syncNativePoints();
   }
   const result=await act('abandon',{activityId:id});
   if(!result)return;
   if(nativeGPSAvailable()&&nativePort.current && d.activityId)
    await nativePort.current.reset({clientId:d.clientId,activityId:d.activityId});
   clearWatch();saveDraft(null);activity.current=null;points.current=[];
   setTracking(false);setPaused(false);setNotice('Run closed with status: '+result.status);
  }catch(e){setProblem('Abandon not cleared; native route retained: '+String(e))}
  finally{busyRef.current=false;setBusy(false)}
 }
 async function share(text:string,url:string){
  try{if(navigator.share)await navigator.share({title:"USKORUN",text,url});
  else{await navigator.clipboard.writeText(text+" "+url);setNotice("Invitation copied")}
  }catch{}
 }
 const invite=(team?:Team)=>typeof window!=="undefined"?window.location.origin+(team?"/?team="+team.invite_code:"/?invite=1"):"";
 const me=data.user,role=me?.role||"runner";
 const sessionKind=pendingRecovery?.kind??kind;
 const estimatedPoints=preliminaryActivityPoints(sessionKind,liveMiles);
 const joinedGoal=selectedJoinedGoal(data.challenges,data.myChallenges);
 const nextReward=nextDemoReward(data.points,data.offers,data.vouchers);
 const hasOpenActivity=!!pendingRecovery&&pendingRecovery.phase!=="starting";
 if(loading)return <main className="shell"><div className="logo">USKO<b>RUN</b></div><p className="muted">Loading your movement…</p></main>;
 return <main className="shell">
  <header className="top"><div className="row"><span className="logo-small">↗</span><span className="logo">USKO<b>RUN</b></span></div><span className="tag">SACRAMENTO BETA</span></header>
  {NATIVE_LOCAL_QA&&<div className="alert" role="status" style={{marginBottom:14}}><strong>LOCAL NATIVE QA · NO SERVER</strong><br/>Real GPS samples can be recorded on the phone. No account is created, Finish cannot be server-confirmed and no points or vouchers are awarded. Use Abandon to clear this local QA session.</div>}
  {problem&&<div role="alert" className="alert error" style={{marginBottom:14}}>{problem}</div>}
  {notice&&<div role="status" className="alert" style={{marginBottom:14}}>{notice}</div>}
  {!me?<>
   <section className="hero"><div className="eyebrow">MOVE · CONNECT · GET REWARDED</div><h1>Every mile<br/>moves us <span style={{color:"var(--lime)"}}>forward.</span></h1>
     <p>Run, walk, join your city and unlock local rewards. Building together in Greater Sacramento.</p>
     <button className="btn" onClick={()=>document.getElementById("join")?.scrollIntoView({behavior:"smooth"})}>Join the beta →</button>
   </section>
   <div className="grid" style={{marginTop:16}}>
    {[["🏃","Move","GPS-recorded running and walking"],["🤝","Connect","Team goals and city challenges"],["🎁","Earn","Points and partner-backed rewards"]].map(x=><div className="card" key={x[1]}><div style={{fontSize:28,marginBottom:8}}>{x[0]}</div><h3>{x[1]}</h3><p className="muted small">{x[2]}</p></div>)}
   </div>
   <div className="section" id="join"><h2>Join USKORUN</h2><span className="pill">18+ beta</span></div>
   <div className="card auth-box"><div className="tabs" style={{marginBottom:17}}><button className={authMode==="signup"?"active":""} onClick={()=>setAuthMode("signup")}>Create account</button><button className={authMode==="login"?"active":""} onClick={()=>setAuthMode("login")}>Sign in</button></div>
    <form className="form" onSubmit={auth}><label className="field">Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label>
    <label className="field">Password<input type="password" minLength={authMode==="signup"?12:1} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={authMode==="signup"?"new-password":"current-password"} required/></label>
    {authMode==="signup"&&<><label className="small"><input type="checkbox" checked={age} onChange={e=>setAge(e.target.checked)}/> I confirm I am 18 or older.</label>
      <label className="small"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> I agree to beta terms and the location privacy notice below.</label></>}
    <button className="btn" type="submit">{authMode==="signup"?"Create beta account":"Sign in"}</button></form>
    <p className="small muted" style={{marginTop:14}}>{nativeMode?'Capacitor on-device GPS can continue through lock/calls while the operating system permits it; background delivery must be tested on real devices.':'Browser GPS records only while visible and awake.'} GPS can be spoofed, and no real sponsor rewards are promised yet. See privacy and beta terms below.</p>
   </div>
  </>:<>
   {tab==="home"&&<>
    <section className="hero"><span className="eyebrow">GREATER SACRAMENTO · YOUR CITY MOVES</span><h1>Walk. Run.<br/><span style={{color:"var(--lime)"}}>Earn demo points.</span></h1>
      <p>{nativeMode?'The phone GPS plugin records across background / lock where permitted; the exact result still requires physical QA.':'Browser recording is foreground only.'} Demo points are only awarded after a server-accepted Finish.</p>
      <div className="row wrap"><button className="btn" onClick={()=>setTab("track")}>{hasOpenActivity?"Return to tracking →":"Start moving →"}</button>
        <button className="btn outline" onClick={()=>setTab("challenges")}>Choose goal</button><button className="btn outline" onClick={()=>setTab("rewards")}>Reward shop</button></div>
    </section>
    <div className="card accent" style={{marginTop:16}} aria-label="Activity and points">
      <div className="row wrap"><h2>{hasOpenActivity?(sessionKind==="run"?"Current run":"Current walk"):"Choose your movement"}</h2>
       <span className="pill">{pendingRecovery?.phase==="recording"?(nativeMode?"NATIVE GPS RECORDING":"FOREGROUND RECORDING"):pendingRecovery?"INTERRUPTED / SAVED":"READY"}</span></div>
      {!pendingRecovery&&<div className="tabs" style={{marginTop:15}}>
       <button className={kind==="walk"?"active":""} onClick={()=>{setKind("walk");setTab("track")}}>Walk →</button>
       <button className={kind==="run"?"active":""} onClick={()=>{setKind("run");setTab("track")}}>Run →</button>
      </div>}
      <div className="grid" style={{marginTop:16}}>
       <div><div className="stat">{hasOpenActivity?liveMiles.toFixed(2):"0.00"}</div><p className="stat-label">Foreground miles · provisional</p></div>
       <div><div className="stat">{hasOpenActivity?estimatedPoints:0}</div><p className="stat-label">Est. session points · NOT spendable</p></div>
       <div><div className="stat">{data.points}</div><p className="stat-label">Confirmed balance · shop eligible</p></div>
      </div>
      <p className="small muted" style={{marginTop:16}}>{hasOpenActivity?preliminaryPointsNote(sessionKind,liveMiles):"Start a walk or run to see an estimate."} No estimate is credited until Finish and server acceptance; minimum 0.03 mi, per-session limit 75 and daily limit 150 points apply.</p>
      {hasOpenActivity&&<div className="row wrap" style={{marginTop:14}}><span className="small muted">{pendingRecovery?.phase==="recording"?"Keep app visible while moving.":pendingRecovery?.phase==="pending_finish"?"Finish not confirmed — Retry Finish in Track.":"Recording paused. Resume explicitly in Track."}</span><button className="btn secondary small" onClick={()=>setTab("track")}>Open Track →</button></div>}
    </div>
    <div className="grid two" style={{marginTop:16}}>
      <div className="card"><div className="row"><h3>Your goal</h3><span className="pill">{joinedGoal?"JOINED":"CHOOSE"}</span></div>
       <p className="small muted" style={{marginTop:9}}>{joinedGoal?joinedGoal.title:"Join an available community challenge."}</p>
       {joinedGoal&&<><div className="progress"><div style={{width:Math.min(100,Number(joinedGoal.progress_miles)/Number(joinedGoal.target_miles)*100)+"%"}}/></div>
       <p className="tiny muted">{mi(Number(joinedGoal.progress_miles))} / {mi(Number(joinedGoal.target_miles))} verified city miles</p></>}
       <div className="space"/><button className="btn secondary small" onClick={()=>setTab("challenges")}>Choose goal →</button></div>
      <div className="card"><div className="row"><h3>Next demo reward</h3><span className="pill demo">DEMO ONLY</span></div>
       <p className="small muted" style={{marginTop:9}}>{nextReward?data.offers.find(o=>o.id===nextReward.offer.id)?.title||"Demo reward":"Shop fixtures not yet seeded."}</p>
       <div className="stat" style={{marginTop:12}}>{nextReward?nextReward.remaining:"—"}</div>
       <p className="small muted">{nextReward?(nextReward.remaining===0?"Ready to claim with confirmed balance":"More CONFIRMED points needed"):"No available demo offer"}</p>
       <div className="space"/><button className="btn secondary small" onClick={()=>setTab("rewards")}>Reward shop →</button></div>
    </div>
    <div className="section"><h2>Citywide mission</h2><button className="btn secondary small" onClick={()=>setTab("challenges")}>View goals →</button></div>
    {data.challenges.slice(0,1).map(c=><ChallengeCard key={c.id} c={c} joined={data.myChallenges.includes(c.id)} onJoin={()=>act("joinChallenge",{id:c.id})}/>)}
   </>}
   {tab==="challenges"&&<><div className="section"><div><span className="eyebrow">CHALLENGES</span><h2>Move your community</h2></div></div>
    <div className="stack">{data.challenges.map(c=><ChallengeCard key={c.id} c={c} joined={data.myChallenges.includes(c.id)} onJoin={()=>act("joinChallenge",{id:c.id})}/>)}</div>
    <div className="card" style={{marginTop:15}}><h3>Create a movement</h3><p className="muted small">Team-created challenges are on the closed-beta roadmap. Create a team now and invite people to join you.</p><div className="space"/><button className="btn secondary small" onClick={()=>setTab("teams")}>Teams →</button></div>
   </>}
   {tab==="track"&&<><div className="section"><div><span className="eyebrow">TRACKING</span><h2>Your movement matters</h2></div></div>
    {pendingRecovery&&!tracking&&<div className="alert" role="status" style={{marginBottom:14}}><strong>Activity paused — GPS not recording</strong><br/>{pendingRecovery.phase==='pending_finish'?'Finish was not confirmed. Your GPS samples are saved — retry Finish or abandon.':pendingRecovery.phase==='starting'?'Start was not confirmed. Retry Start with the same session ID or abandon.':'Your activity was interrupted or paused. Return to this screen and tap Resume to start a new GPS segment; missed distance is not counted.'}</div>}
    <div className="card accent">
     <div className="tabs" style={{justifyContent:"center"}}><button title={pendingRecovery?'Activity kind is locked until Finish or Abandon.':''} disabled={!!pendingRecovery} className={sessionKind==="run"?"active":""} onClick={()=>setKind("run")}>🏃 Run</button><button disabled={!!pendingRecovery} className={sessionKind==="walk"?"active":""} title={pendingRecovery?'Activity kind is locked until Finish or Abandon.':''} onClick={()=>setKind("walk")}>🚶 Walk</button></div>
     {pendingRecovery&&<p className="small muted" role="status" style={{textAlign:"center",marginTop:10}}>Run/Walk selection locked for saved {pendingRecovery.kind} activity. {pendingRecovery.phase==='pending_finish'?'Retry Finish or Abandon before starting another.':pendingRecovery.phase==='paused'?'Resume, Finish or Abandon this session first.':'Keep this activity or Abandon; a second Start is not allowed.'}</p>}
     <div className="track-circle"><div className="stat">{liveMiles.toFixed(2)}</div><div className="muted small">MILES · provisional</div></div>
     <div className="grid two">
      <div className="card"><div className="stat">{estimatedPoints}</div><div className="stat-label">Estimated session points · unconfirmed</div></div>
      <div className="card"><div className="stat">{data.points}</div><div className="stat-label">Confirmed shop balance</div></div>
     </div>
     <p className="tiny muted" style={{textAlign:"center",marginTop:12}}>{preliminaryPointsNote(sessionKind,liveMiles)}. Final award can be lower or zero after Finish, server validation and daily 150-point cap.</p>
     <p style={{textAlign:"center",marginBottom:15}} className="small muted">{gpsNote} · {fixCount} fixes</p>
     <div className="track-control">
      {pendingRecovery?.phase==='pending_finish'?<><button disabled={busy} className="btn" onClick={stop}>Retry Finish</button><button disabled={busy} className="btn danger" onClick={abandon}>Abandon</button></>:
       !tracking&&pendingRecovery?.phase==='starting'?<><button disabled={busy} className="btn" onClick={start}>Retry Start</button><button disabled={busy} className="btn danger" onClick={abandon}>Abandon</button></>:
       !tracking&&pendingRecovery?.phase==='paused'?<><button disabled={busy} className="btn" onClick={resume}>▶ Resume</button><button disabled={busy} className="btn secondary" onClick={stop}>Finish</button><button disabled={busy} className="btn danger" onClick={abandon}>Abandon</button></>:
       !tracking?<button disabled={busy} className="btn" onClick={start}>▶ Start {kind}</button>:
       <><button disabled={busy} className="btn secondary" onClick={()=>pause()}>Ⅱ Pause</button><button disabled={busy} className="btn danger" onClick={stop}>■ Finish</button></>}
     </div>
     {busy&&<p className="small muted" role="status" style={{textAlign:"center",marginTop:10}}>Request in progress. Controls are temporarily disabled; network requests time out after 15 seconds.</p>}
     <div className="line"/><div className="alert"><strong>{nativeMode?'Phone GPS · native background beta':'Foreground GPS · browser beta'}</strong><br/>{nativeMode?'Before granting permissions: USKORUN records your walking/running route even when the screen is locked or during a phone call, subject to operating-system restrictions. iOS may ask for Always location access; Android uses a persistent location notification. Updates are best-effort; if the app is killed, any missing distance cannot be reconstructed.':'Keep the browser visible and screen awake. Calls, tab switching, and locks interrupt web GPS; return and tap Resume.'} Raw GPS points are kept {nativeMode?'in this app’s local unencrypted storage until confirmed Finish or Abandon':'in this browser tab sessionStorage'} for failed Finish recovery. Server checks plausibility; GPS does not prove physical activity.</div>
    </div>
    <div className="section"><h2>How points work</h2></div>
    <div className="grid two"><div className="card"><div className="stat">15</div><div className="stat-label">Beta points / accepted running mile</div></div><div className="card"><div className="stat">10</div><div className="stat-label">Beta points / accepted walking mile</div></div></div>
    <p className="small muted" style={{marginTop:12}}>Provisional non-cash beta rules. Accuracy filters, daily caps and manual reviews may change. Rewards here are demonstrations, not real partner promises.</p>
   </>}
   {tab==="rewards"&&<><div className="section"><div><span className="eyebrow">DEMO REWARD SHOP</span><h2>Move. Earn. Exchange.</h2></div><div className="pill">{data.points} confirmed points</div></div>
    <div className="alert" role="note" style={{marginBottom:16}}><strong>DEMO ONLY — fictional partner offers.</strong> These are not real discounts or products. Only points from server-accepted finished activities can be spent. Live session estimates do not enter the wallet.</div>
    <div className="grid two">{data.offers.map(o=>{
      const wasClaimed=data.vouchers.some(v=>v.offer_id===o.id);
      const needed=remainingConfirmedPoints(data.points,o.cost_points);
      const soldOut=o.claimed>=o.max_claims;
      const eligible=canClaimDemoOffer(data.points,o,wasClaimed);
      return <div className="card" key={o.id}>
       <div className="row wrap"><span className="pill demo">DEMO ONLY</span><span className="tiny muted">{o.city}</span></div>
       <div className="space"/><h3>{o.title}</h3><p className="small muted" style={{marginTop:5}}>{o.merchant}</p>
       <p className="small" style={{marginTop:12}}>{o.details}</p>
       <div className="line"/>
       <div className="row"><strong>{o.cost_points} confirmed points</strong><span className="tiny muted">{Math.max(0,o.max_claims-o.claimed)} / {o.max_claims} available</span></div>
       <div className="progress"><div style={{width:(o.cost_points>0?Math.min(100,Math.max(0,data.points)/o.cost_points*100):100)+"%"}}/></div>
       <p className="small muted">{wasClaimed?"Already claimed by this account":soldOut?"Demo inventory exhausted":needed>0?"Need "+needed+" more confirmed points":"Confirmed balance sufficient"}</p>
       <div className="space"/><button className="btn small" disabled={!eligible} onClick={async()=>{const r=await act("claim",{offerId:o.id});if(r)setNotice("Demo voucher issued. See your wallet below.")}}>{wasClaimed?"Already claimed":soldOut?"Sold out":needed>0?"Earn "+needed+" more points":"Claim demo reward →"}</button>
      </div>;
    })}</div>
    {!data.offers.length&&<div className="card"><p className="muted">No active DEMO fixtures in this database yet. Fictional partner A/B/C offers are inserted only by a separately authorized manual seed, not during deploy or startup.</p></div>}
    <div className="section"><h2>My demo vouchers</h2></div>
    {!data.vouchers.length&&<div className="card"><p className="muted">No vouchers yet. Finish an accepted activity for confirmed demo points, then claim an eligible offer.</p></div>}
    <div className="grid two">{data.vouchers.filter(v=>v.is_demo).map(v=><div className="card" key={v.id}><div className="row wrap"><h3>{v.title}</h3><span className="pill demo">DEMO · {v.state}</span></div><p className="small muted">{v.merchant} · simulated benefit only</p><div className="space"/>
      {v.state==="issued"?<><div className="qr"><QRCodeSVG size={140} value={typeof window!=="undefined"?window.location.origin+"/"+voucherFragment(v.code):v.code}/></div><div className="space"/><p className="code">{v.code}</p><p className="tiny muted">QR and typed code refer to one atomic, single-use demo voucher. Only the assigned merchant or operator can redeem it.</p></>:<p className="muted small">Voucher already used or revoked.</p>}
     </div>)}</div>
   </>}
   {tab==="teams"&&<><div className="section"><div><span className="eyebrow">COMMUNITY</span><h2>Find your people</h2></div></div>
    <div className="grid two"><div className="card"><h3>Create a team</h3><p className="muted small">Invite friends to contribute to your shared mileage.</p><div className="space"/><div className="form"><label className="field">Team name<input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="Sunrise Crew"/></label><button className="btn" onClick={async()=>{const r=await act("createTeam",{name:teamName,city:"Sacramento"});if(r){setNotice("Team created! Share your invite link.");setTeamName("")}}}>Create team</button></div></div>
      <div className="card"><h3>Join a team</h3><p className="muted small">Enter the invitation code a friend shared.</p><div className="space"/><div className="form"><label className="field">Invite code<input value={teamCode} onChange={e=>setTeamCode(e.target.value)} placeholder="12-character code"/></label><button className="btn secondary" onClick={async()=>{const r=await act("joinTeam",{code:teamCode});if(r)setNotice("You're part of the team!")}}>Join team</button></div></div></div>
    <div className="section"><h2>Community teams</h2></div>
    <div className="grid two">{data.teams.map(t=><div className="card" key={t.id}><div className="row"><h3>{t.name}</h3><span className="pill">{t.members} members</span></div><p className="muted small">{t.city} · {mi(t.miles)} accepted miles</p><div className="space"/><div className="row"><button disabled={data.myTeam===t.id} className="btn secondary small" onClick={()=>act("joinTeam",{code:t.invite_code})}>{data.myTeam===t.id?"My team":"Join"}</button><button className="btn outline small" onClick={()=>share("Join my USKORUN team!",invite(t))}>Share ↗</button></div></div>)}</div>
    <p className="tiny muted" style={{marginTop:10}}>Joining a new team affects only future miles. Existing contributions remain with their original team.</p>
   </>}
   {tab==="profile"&&<><div className="section"><div><span className="eyebrow">PROFILE</span><h2>Your journey</h2></div></div><div className="card"><p className="small muted">{me.email}</p><div className="space"/><div className="grid two"><div><div className="stat">{data.points}</div><p className="muted small">Current balance</p></div><div><div className="stat">{mi(data.activities.filter(a=>a.status==="accepted").reduce((sum,a)=>sum+a.distance_miles,0))}</div><p className="muted small">Accepted miles</p></div></div><div className="space"/><button className="btn secondary small" onClick={()=>share("Move with me on USKORUN!",invite())}>Invite a friend ↗</button></div>
    <div className="section"><h2>Recent activity</h2></div><div className="stack">{data.activities.length?data.activities.map(a=><div className="card row" key={a.id}><div><h3>{a.kind==="run"?"🏃 Run":"🚶 Walk"} · {mi(a.distance_miles)} mi</h3><p className="tiny muted">{new Date(a.started_at).toLocaleDateString()} · {a.reason}</p></div><span className={"pill "+(a.status!=="accepted"?"demo":"")}>{a.status}</span></div>):<div className="card muted">No activities yet. Start moving!</div>}</div><div className="space"/><button className="btn danger small" onClick={async()=>{
     if(draftRef.current){
      setTab('track');
      setProblem('Finish or Abandon the saved GPS session before signing out. Native background recording must not be orphaned.');
      return;
     }
     if(await act("logout")){clearWatch();saveDraft(null);setTab("home");setNotice("Signed out")}
    }}>Sign out</button>
    {["merchant","admin"].includes(role)&&<button className="btn secondary small" style={{marginLeft:12}} onClick={()=>setTab("merchant")}>Partner demo dashboard →</button>}
   </>}
   {tab==="merchant"&&<><div className="section"><div><span className="eyebrow">PARTNER VERIFICATION · DEMO</span><h2>Redeem a one-time voucher</h2></div></div>
    <div className="card"><p className="small muted">An assigned merchant or operator account is required. The QR and manual code represent the same voucher; the first authorized redemption consumes it. These fixtures are fictional and create no real partner obligations.</p>
     <div className="space"/><div className="form"><label className="field">Voucher code<input value={redeemCode} onChange={e=>setRedeemCode(e.target.value)} placeholder="Enter code from runner"/></label>
     <button className="btn" onClick={async()=>{const r=await act("redeem",{code:redeemCode});if(r){setRedeemCode("");setPartnerRefresh(n=>n+1);setNotice(r.title+" redeemed successfully"+(r.is_demo?" (DEMO ONLY)":""))}}}>Confirm redemption</button></div></div>
    {["merchant","admin"].includes(role)&&<><div className="section"><h2>Assigned demo offers</h2><span className="pill demo">DEMO ONLY</span></div>
     <p className="small muted">Issued/redeemed are voucher counts, NOT proof of new customers, incremental sales, revenue or ROI. Inventory and conditions below are read from authorized offers.</p>
     <div className="grid two" style={{marginTop:14}}>{(partnerStats||[]).map(p=><div className="card" key={p.id}><h3>{p.title}</h3>
      <p className="small muted" style={{marginTop:8}}>{p.details}</p><div className="line"/>
      <div className="grid two"><div><div className="stat">{p.issued_total}</div><p className="stat-label">Issued (including redeemed)</p></div><div><div className="stat">{p.redeemed}</div><p className="stat-label">Redeemed</p></div></div>
      <p className="small muted" style={{marginTop:10}}>{p.outstanding} outstanding · {p.max_claims} total claim cap · {p.cost_points} confirmed points per claim</p></div>)}</div>
     {partnerStats===null&&<div className="alert" style={{marginTop:12}}>Partner summary is loading or unavailable.</div>}
     {partnerStats?.length===0&&<div className="alert" style={{marginTop:12}}>No demo offers assigned to this merchant account.</div>}
    </>}
   </>}
  </>}
  <footer className="footer"><strong>USKORUN · Independent sports startup</strong><br/>Closed-development beta. GPS tracks are processed for distance plausibility; raw routes are not retained in the database. Never use your phone while crossing roads. No medical, financial or commercial guarantees. 18+ only. Demo offers are not real discounts. Contact support through the project administrator before testing with real personal location data. <a href="/about/">About · Licenses</a>.</footer>
  {me&&<nav className="bottom" aria-label="App navigation">{([["home","⌂","Home"],["challenges","⚑","Goals"],["track","◉","Track"],["rewards","♢","Shop"],["teams","☷","Teams"],["profile","♙","Me"]] as [Tab,string,string][]).map(([id,icon,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><span>{icon}</span>{label}</button>)}</nav>}
 </main>
}
function ChallengeCard({c,joined,onJoin}:{c:Challenge;joined:boolean;onJoin:()=>void}){
 const progress=Math.min(100,(c.progress_miles/Number(c.target_miles))*100);
 return <div className="card accent"><div className="row wrap"><span className="pill">CITYWIDE CHALLENGE</span><span className="muted tiny">{c.city}</span></div><div className="space"/><h2>{c.title}</h2><p className="muted small">{c.details}</p>
  <div className="progress"><div style={{width:progress+"%"}}/></div>
  <div className="row"><span className="small"><strong>{mi(c.progress_miles)}</strong> / {mi(Number(c.target_miles))} miles</span><span className="tiny muted">{c.active_people} active contributors</span></div><div className="space"/><button className={"btn "+(joined?"secondary":"")} disabled={joined} onClick={onJoin}>{joined?"✓ Joined":"Join challenge →"}</button>
 </div>
}
