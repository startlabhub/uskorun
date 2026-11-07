import {mkdtempSync,cpSync,rmSync,symlinkSync,mkdirSync,existsSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
// Next.js SSR route handlers CANNOT run in a packaged WebView.
// Build a temporary static export of the SAME apps/web UI, omitting ONLY
// src/app/api and src/server. The static client uses an explicitly local
// contract that cannot create users/credits and cannot approve Finish.
const root=process.cwd(),deps=join(root,'node_modules');
if(!existsSync(join(deps,'next')))throw new Error('npm install required locally; Next.js not installed');
execFileSync('node',['scripts/generate-native-licenses.mjs'],{cwd:root,stdio:'inherit'});
const work=mkdtempSync(join(tmpdir(),'uskorun-next-native-'));
try{
 const shouldCopy=p=>{
  const relative=p.slice(root.length).split(sep).join('/');
  return !(relative==='/src/app/api'||relative.startsWith('/src/app/api/')||
    relative==='/src/server'||relative.startsWith('/src/server/'));
 };
 cpSync(join(root,'src'),join(work,'src'),{recursive:true,filter:shouldCopy});
 for(const p of ['package.json','tsconfig.json','next-env.d.ts'])
  cpSync(join(root,p),join(work,p));
 if(existsSync(join(root,'public')))cpSync(join(root,'public'),join(work,'public'),{recursive:true});
 symlinkSync(deps,join(work,'node_modules'),'dir');
 writeFileSync(join(work,'next.config.mjs'),`
export default {
 output: 'export',
 trailingSlash: true,
 images: {unoptimized: true},
 reactStrictMode: true,
 poweredByHeader: false
};
`);
 execFileSync(join(deps,'.bin','next'),['build'],{
  cwd:work,stdio:'inherit',
  env:{...process.env,NEXT_PUBLIC_USKORUN_NATIVE_EXPORT:'1',NEXT_TELEMETRY_DISABLED:'1'}
 });
 const out=join(work,'out');
 if(!existsSync(join(out,'index.html')))throw new Error('Native static export missing index.html');
 const dest=join(root,'native-dist');rmSync(dest,{recursive:true,force:true});
 mkdirSync(dest,{recursive:true});cpSync(out,dest,{recursive:true});
 console.log('Native offline web bundle built:',dest);
}finally{rmSync(work,{recursive:true,force:true})}
