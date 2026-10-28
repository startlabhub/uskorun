"use client";
import {useEffect,useRef,useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {meters,GPSPoint} from "@/domain/gps";
type User={id:string;email:string;role:"runner"|"admin"|"merchant"};
type Challenge={id:string;title:string;city:string;details:string;target_miles:number;ends_at:string;progress_miles:number;active_people:number};
type Offer={id:string;title:string;merchant:string;city:string;details:string;cost_points:number;is_demo:boolean;claimed:number;max_claims:number};
type Team={id:string;name:string;city:string;invite_code:string;members:number;miles:number};
type Voucher={id:string;state:string;title:string;merchant:string;is_demo:boolean;code:string;issued_at:string};
type Activity={id:string;kind:string;distance_miles:number;status:string;reason:string;started_at:string};
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
 const points=useRef<GPSPoint[]>([]),watch=useRef<number|null>(null),activity=useRef<string|null>(null),wake=useRef<any>(null);
 async function refresh(){
  try{const r=await fetch("/api/data",{cache:"no-store"});if(!r.ok)throw new Error("Data service unavailable");
   setData(await r.json());
  }catch(e:any){setProblem(e.message||"Connection failed")}finally{setLoading(false)}
 }
 useEffect(()=>{refresh();const code=new URLSearchParams(window.location.search).get("redeem");
  if(code){setRedeemCode(code);setTab("merchant")}
  return()=>{if(watch.current!==null)navigator.geolocation?.clearWatch(watch.current);wake.current?.release?.()};
 },[]);
 async function act(action:string,payload:any={}){
  setProblem("");setNotice("");
  try{const r=await fetch("/api/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});
   const json=await r.json();if(!r.ok)throw new Error(json.error||"Request failed");
   await refresh();return json;
  }catch(e:any){setProblem(e.message||"Request failed");return null}
 }
 async function auth(e:React.FormEvent){e.preventDefault();
  const r=await act(authMode,{email,password,ageConfirmed:age,consent});
  if(r){setPassword("");setTab("home");setNotice("Welcome to USKORUN!")}
 }
 const geoloc=(navigatorAvailable:boolean)=>navigatorAvailable&&"geolocation" in navigator;
 function clearWatch(){if(watch.current!==null&&geoloc(typeof navigator!=="undefined"))navigator.geolocation.clearWatch(watch.current);watch.current=null;wake.current?.release?.();wake.current=null}
 function observe(){
  if(!geoloc(typeof navigator!=="undefined")){setProblem("This browser has no GPS geolocation");return}
  watch.current=navigator.geolocation.watchPosition(({coords,timestamp})=>{
   const p={lat:coords.latitude,lon:coords.longitude,accuracy:coords.accuracy,t:timestamp};
   if(p.accuracy>50){setGpsNote("Weak GPS signal; this segment may not count");return}
   const prev=points.current[points.current.length-1];
   points.current.push(p);setFixCount(points.current.length);
   if(prev){const dt=(p.t-prev.t)/1000,dist=meters(prev,p);
     if(dt>0&&dt<=60&&dist/dt<=(kind==="run"?8:3.5)&&dist>Math.max(6,(p.accuracy+prev.accuracy)/3))
       setLiveMiles(n=>n+dist/1609.344);
   }
   setGpsNote("GPS connected · accuracy ±"+Math.round(p.accuracy)+"m");
  },(err)=>setGpsNote("GPS interrupted: "+err.message),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  // Optional screen wake lock: never a substitute for native background GPS.
  try{(navigator as any).wakeLock?.request("screen").then((lock:any)=>wake.current=lock).catch(()=>{})}catch{}
 }
 async function start(){
  if(!geoloc(typeof navigator!=="undefined")){setProblem("GPS unavailable");return}
  const id=crypto.randomUUID(),r=await act("start",{kind,clientId:id});
  if(!r)return;
  activity.current=r.activityId;points.current=[];setLiveMiles(0);setFixCount(0);setTracking(true);setPaused(false);setGpsNote("Acquiring GPS…");observe();
 }
 function pause(){clearWatch();setPaused(true);setGpsNote("Paused — no distance is recorded")}
 function resume(){setPaused(false);setGpsNote("Reconnecting GPS…");observe()}
 async function stop(){
  clearWatch();setTracking(false);setPaused(false);
  const r=await act("finish",{activityId:activity.current,points:points.current});
  activity.current=null;points.current=[];
  if(r){setNotice(r.status==="accepted"?`Recorded ${mi(r.miles)} mi. Check your points and challenge progress.`:`Session not credited: ${r.reason}`);setTab("profile")}
 }
 async function share(text:string,url:string){
  try{if(navigator.share)await navigator.share({title:"USKORUN",text,url});
  else{await navigator.clipboard.writeText(text+" "+url);setNotice("Invitation copied")}
  }catch{}
 }
 const invite=(team?:Team)=>typeof window!=="undefined"?window.location.origin+(team?"/?team="+team.invite_code:"/?invite=1"):"";
 const me=data.user,role=me?.role||"runner";
 if(loading)return <main className="shell"><div className="logo">USKO<b>RUN</b></div><p className="muted">Loading your movement…</p></main>;
 return <main className="shell">
  <header className="top"><div className="row"><span className="logo-small">↗</span><span className="logo">USKO<b>RUN</b></span></div><span className="tag">SACRAMENTO BETA</span></header>
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
    <p className="small muted" style={{marginTop:14}}>Beta: GPS tracking works only while the app is foregrounded and the screen stays awake. GPS can be spoofed, and no real sponsor rewards are promised yet. See privacy and beta terms below.</p>
   </div>
  </>:<>
   {tab==="home"&&<>
    <section className="hero"><span className="eyebrow">GREATER SACRAMENTO · YOUR CITY MOVES</span><h1>Move more.<br/><span style={{color:"var(--lime)"}}>Earn more.</span></h1>
      <p>Your next run or walk helps your team and your city. Every verified foreground mile counts.</p>
      <button className="btn" onClick={()=>setTab("track")}>Start moving →</button></section>
    <div className="grid" style={{marginTop:14}}>
     <div className="card"><div className="stat">{data.points}</div><div className="stat-label">Beta points</div></div>
     <div className="card"><div className="stat">{data.activities.filter(x=>x.status==="accepted").length}</div><div className="stat-label">Accepted activities</div></div>
     <div className="card"><div className="stat">{data.myChallenges.length}</div><div className="stat-label">Joined challenges</div></div>
    </div>
    <div className="section"><h2>Citywide mission</h2><button className="btn secondary small" onClick={()=>setTab("challenges")}>Explore →</button></div>
    {data.challenges.slice(0,1).map(c=><ChallengeCard key={c.id} c={c} joined={data.myChallenges.includes(c.id)} onJoin={()=>act("joinChallenge",{id:c.id})}/>)}
    <div className="section"><h2>Why we move</h2></div>
    <div className="grid two"><div className="card"><h3>Better together</h3><p className="muted small">Invite people into your team and unlock shared milestones.</p><div className="space"/><button className="btn secondary small" onClick={()=>setTab("teams")}>Explore teams</button></div>
    <div className="card"><h3>Real neighborhood value</h3><p className="muted small">Discover the reward system as we onboard verified local partners.</p><div className="space"/><button className="btn secondary small" onClick={()=>setTab("rewards")}>See rewards</button></div></div>
   </>}
   {tab==="challenges"&&<><div className="section"><div><span className="eyebrow">CHALLENGES</span><h2>Move your community</h2></div></div>
    <div className="stack">{data.challenges.map(c=><ChallengeCard key={c.id} c={c} joined={data.myChallenges.includes(c.id)} onJoin={()=>act("joinChallenge",{id:c.id})}/>)}</div>
    <div className="card" style={{marginTop:15}}><h3>Create a movement</h3><p className="muted small">Team-created challenges are on the closed-beta roadmap. Create a team now and invite people to join you.</p><div className="space"/><button className="btn secondary small" onClick={()=>setTab("teams")}>Teams →</button></div>
   </>}
   {tab==="track"&&<><div className="section"><div><span className="eyebrow">TRACKING</span><h2>Your movement matters</h2></div></div>
    <div className="card accent">
     <div className="tabs" style={{justifyContent:"center"}}><button disabled={tracking} className={kind==="run"?"active":""} onClick={()=>setKind("run")}>🏃 Run</button><button disabled={tracking} className={kind==="walk"?"active":""} onClick={()=>setKind("walk")}>🚶 Walk</button></div>
     <div className="track-circle"><div className="stat">{liveMiles.toFixed(2)}</div><div className="muted small">MILES · provisional</div></div>
     <p style={{textAlign:"center",marginBottom:15}} className="small muted">{gpsNote} · {fixCount} fixes</p>
     <div className="track-control">{!tracking?<button className="btn" onClick={start}>▶ Start {kind}</button>:<><button className="btn secondary" onClick={paused?resume:pause}>{paused?"▶ Resume":"Ⅱ Pause"}</button><button className="btn danger" onClick={stop}>■ Finish</button></>}</div>
     <div className="line"/><div className="alert"><strong>Foreground GPS beta</strong><br/>Keep this page visible and screen awake. Locked-screen or background mileage may be lost and will never be recreated. Server checks route plausibility; GPS alone cannot prove real physical activity.</div>
    </div>
    <div className="section"><h2>How points work</h2></div>
    <div className="grid two"><div className="card"><div className="stat">15</div><div className="stat-label">Beta points / accepted running mile</div></div><div className="card"><div className="stat">10</div><div className="stat-label">Beta points / accepted walking mile</div></div></div>
    <p className="small muted" style={{marginTop:12}}>Provisional non-cash beta rules. Accuracy filters, daily caps and manual reviews may change. Rewards here are demonstrations, not real partner promises.</p>
   </>}
   {tab==="rewards"&&<><div className="section"><div><span className="eyebrow">YOUR REWARDS</span><h2>Movement pays forward</h2></div><div className="pill">{data.points} points</div></div>
    <div className="grid two">{data.offers.map(o=><div className="card" key={o.id}><div className="row"><span className="pill demo">{o.is_demo?"DEMO ONLY":"PARTNER OFFER"}</span><span className="tiny muted">{o.city}</span></div><div className="space"/><h3>{o.title}</h3><p className="small muted">{o.merchant}</p><p className="small" style={{marginTop:12}}>{o.details}</p><div className="line"/><div className="row"><strong>{o.cost_points} points</strong><button className="btn small" disabled={data.points<o.cost_points||o.claimed>=o.max_claims} onClick={async()=>{const r=await act("claim",{offerId:o.id});if(r)setNotice("Demo voucher issued. See your wallet below.")}}>Claim →</button></div></div>)}</div>
    <div className="section"><h2>My vouchers</h2></div>
    {!data.vouchers.length&&<div className="card"><p className="muted">No vouchers yet. Record an accepted activity to earn beta points.</p></div>}
    <div className="grid two">{data.vouchers.map(v=><div className="card" key={v.id}><div className="row"><h3>{v.title}</h3><span className="pill demo">{v.state}</span></div><p className="small muted">{v.merchant} · {v.is_demo?"Demo only":"Offer"}</p><div className="space"/>
      {v.state==="issued"?<><div className="qr"><QRCodeSVG size={140} value={typeof window!=="undefined"?window.location.origin+"/?redeem="+encodeURIComponent(v.code):v.code}/></div><div className="space"/><p className="code">{v.code}</p><p className="tiny muted">QR and code represent the same one-time voucher. Staff must log in to redeem.</p></>:<p className="muted small">Voucher already used or revoked.</p>}
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
    <div className="section"><h2>Recent activity</h2></div><div className="stack">{data.activities.length?data.activities.map(a=><div className="card row" key={a.id}><div><h3>{a.kind==="run"?"🏃 Run":"🚶 Walk"} · {mi(a.distance_miles)} mi</h3><p className="tiny muted">{new Date(a.started_at).toLocaleDateString()} · {a.reason}</p></div><span className={"pill "+(a.status!=="accepted"?"demo":"")}>{a.status}</span></div>):<div className="card muted">No activities yet. Start moving!</div>}</div><div className="space"/><button className="btn danger small" onClick={async()=>{if(await act("logout")){setTab("home");setNotice("Signed out")}}}>Sign out</button>
   </>}
   {tab==="merchant"&&<><div className="section"><div><span className="eyebrow">PARTNER VERIFICATION</span><h2>Redeem a one-time reward</h2></div></div><div className="card auth-box"><p className="small muted">Requires an assigned merchant or operator account. The first redemption consumes the reward permanently; QR and typed code cannot both be used.</p><div className="space"/><div className="form"><label className="field">Voucher code<input value={redeemCode} onChange={e=>setRedeemCode(e.target.value)} placeholder="Enter code from runner"/></label><button className="btn" onClick={async()=>{const r=await act("redeem",{code:redeemCode});if(r){setRedeemCode("");setNotice(r.title+" redeemed successfully"+(r.is_demo?" (DEMO ONLY)":""))}}}>Confirm redemption</button></div></div></>}
  </>}
  <footer className="footer"><strong>USKORUN · Independent sports startup</strong><br/>Closed-development beta. GPS tracks are processed for distance plausibility; raw routes are not retained in the database. Never use your phone while crossing roads. No medical, financial or commercial guarantees. 18+ only. Demo offers are not real discounts. Contact support through the project administrator before testing with real personal location data.</footer>
  {me&&<nav className="bottom" aria-label="App navigation">{([["home","⌂","Home"],["challenges","⚑","Goals"],["track","◉","Track"],["rewards","♢","Rewards"],["teams","☷","Teams"],["profile","♙","Me"]] as [Tab,string,string][]).map(([id,icon,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><span>{icon}</span>{label}</button>)}</nav>}
 </main>
}
function ChallengeCard({c,joined,onJoin}:{c:Challenge;joined:boolean;onJoin:()=>void}){
 const progress=Math.min(100,(c.progress_miles/Number(c.target_miles))*100);
 return <div className="card accent"><div className="row wrap"><span className="pill">CITYWIDE CHALLENGE</span><span className="muted tiny">{c.city}</span></div><div className="space"/><h2>{c.title}</h2><p className="muted small">{c.details}</p>
  <div className="progress"><div style={{width:progress+"%"}}/></div>
  <div className="row"><span className="small"><strong>{mi(c.progress_miles)}</strong> / {mi(Number(c.target_miles))} miles</span><span className="tiny muted">{c.active_people} active contributors</span></div><div className="space"/><button className={"btn "+(joined?"secondary":"")} disabled={joined} onClick={onJoin}>{joined?"✓ Joined":"Join challenge →"}</button>
 </div>
}
