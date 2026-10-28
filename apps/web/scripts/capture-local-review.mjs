// Local QA capture only. Not invoked by production, CI or Railway.
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const base=process.env.SCREENSHOT_BASE_URL||'http://127.0.0.1:3000';
const url=new URL(base);
if(!['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname))
 throw new Error('Screenshot capture is local-only; remote deployment is not authorized');
const email=process.env.DEMO_LOGIN_EMAIL,password=process.env.DEMO_LOGIN_PASSWORD;
if(!email||!password)throw new Error('Use dedicated DEMO_LOGIN_EMAIL and DEMO_LOGIN_PASSWORD; no real personal accounts');
const output=process.env.SCREENSHOT_DIR||'qa/screenshots-local';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 await page.goto(base,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Sign in'}).first().click();
 await page.locator('input[type=email]').fill(email);
 await page.locator('input[type=password]').fill(password);
 await page.locator('form button[type=submit]').click();
 await page.getByRole('navigation',{name:'App navigation'}).waitFor();
 for(const viewport of [
  {name:'320',width:320,height:740},
  {name:'390',width:390,height:844},
  {name:'desktop',width:1440,height:900}
 ]){
  await page.setViewportSize({width:viewport.width,height:viewport.height});
  await page.getByRole('navigation',{name:'App navigation'}).getByRole('button',{name:'Home'}).click();
  await page.getByRole('heading',{name:'Your goal'}).waitFor();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  if(overflow)throw new Error('Horizontal overflow at '+viewport.name);
  await page.screenshot({path:join(output,'home-'+viewport.name+'.png'),fullPage:true});
  await page.getByRole('navigation',{name:'App navigation'}).getByRole('button',{name:'Shop'}).click();
  await page.getByRole('heading',{name:'Move. Earn. Exchange.'}).waitFor();
  for(const partner of ['DEMO Partner A','DEMO Partner B','DEMO Partner C'])
   if(!await page.getByText(partner,{exact:false}).count())
    throw new Error(partner+' missing: run approved demo seed on LOCAL disposable DB first');
  await page.screenshot({path:join(output,'shop-'+viewport.name+'.png'),fullPage:true});
 }
 await context.close();
 console.log('Captured 6 local HOME/SHOP screenshots. No user emails or tokens logged.');
}finally{await browser.close()}
