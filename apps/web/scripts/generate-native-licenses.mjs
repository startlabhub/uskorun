import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=process.cwd();
const command=execFileSync('npm',['ls','--parseable','--all','--omit=dev'],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
const list=[...new Set(command.split(/\r?\n/).filter(Boolean).map(p=>resolve(p)))].filter(p=>p!==root);
if(!list.length)throw new Error('Cannot build an empty license tree: install dependencies first');
const out=[];
for(const folder of list){
 const pkgFile=join(folder,'package.json');
 if(!existsSync(pkgFile))continue;
 const p=JSON.parse(readFileSync(pkgFile,'utf8'));
 if(!p.name||['@capacitor-community/background-geolocation','@capacitor/core'].includes(p.name))continue;
 const names=readdirSync(folder).filter(name=>/^(license|licence|copying|notice)(\.|$)/i.test(name));
 let text='';
 for(const name of names){
  try{
   const candidate=readFileSync(join(folder,name),'utf8');
   if(candidate.length<=160_000){text+=name+'\n'+candidate+'\n\n'}
  }catch{}
 }
 out.push({name:p.name,version:String(p.version||'unknown'),
  license:typeof p.license==='string'?p.license:'UNSPECIFIED',
  text:text.trim()||'Notice text not present in installed package; manual license audit required before store submission.'});
}
out.sort((a,b)=>a.name.localeCompare(b.name)||a.version.localeCompare(b.version));
const target=join(root,'src/generated/dependency-licenses.ts');
writeFileSync(target,'// GENERATED from local production dependency tree. Do not hand-edit.\n'+
 'export const additionalNativeNotices:{name:string;version:string;license:string;text:string}[]='+JSON.stringify(out,null,2)+';\n');
console.log('License notices generated from',out.length,'installed dependency packages');
