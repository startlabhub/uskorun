import Link from 'next/link';
import {nativeRequiredLicenses} from '@/domain/native-licenses';
import {additionalNativeNotices} from '@/generated/dependency-licenses';
export const dynamic='force-static';

export default function About(){
 const notices=[...nativeRequiredLicenses,...additionalNativeNotices];
 return <main className="shell">
  <header className="top"><div className="row"><span className="logo">USKO<b>RUN</b></span></div><span className="tag">ABOUT</span></header>
  <div className="section"><h1 style={{fontSize:'2rem'}}>About · Licenses</h1></div>
  <div className="card"><p>USKORUN is a development-stage movement app. Phone location is used only during a user-started recording. Demo points are estimates until a real server accepts Finish. Native location in the background requires platform permission and is not guaranteed after an app is terminated.</p>
  <p className="small muted" style={{marginTop:12}}>Open-source notices below include full MIT grants for the native GPS plugin and Capacitor, plus license records collected from the installed dependency tree during native build.</p></div>
  <div className="section"><h2>Open-source licenses ({notices.length})</h2></div>
  <div className="stack">{notices.map((entry,i)=><details className="card" key={entry.name+'-'+i} open={i<2}>
   <summary><strong>{entry.name}</strong> · {entry.version} · {entry.license}</summary>
   <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12,marginTop:16,lineHeight:1.55}}>{entry.text}</pre>
  </details>)}</div>
  <div className="space"/><Link className="btn secondary" href="/">← Back to USKORUN</Link>
 </main>;
}