import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedFetch,localQARequest} from '../src/domain/api-client.ts';
test('bounded action fetch aborts after deadline and clears indefinite busy condition',async()=>{
 let signal:AbortSignal|undefined;
 const fetcher=async(_path:RequestInfo|URL,init?:RequestInit):Promise<Response>=>{
  signal=init?.signal??undefined;
  return await new Promise((_resolve,reject)=>{
   signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
  });
 };
 await assert.rejects(boundedFetch('/api/action',{method:'POST'},12,fetcher),/timed out/i);
 assert.equal(signal?.aborted,true);
});
test('bounded fetch propagates success responses with no new endpoint semantics',async()=>{
 const r=await boundedFetch('/api/action',{method:'POST'},100,
  async()=>new Response(JSON.stringify({ok:true,activityId:'existing-id',status:'recording'})));
 assert.equal((await r.json()).activityId,'existing-id');
});
test('local QA start uses existing request contract but cannot mint accepted points',async()=>{
 const id='12345678-1234-1234-1234-123456789abc';
 const start=localQARequest('/api/action',{method:'POST',body:JSON.stringify({action:'start',clientId:id,kind:'walk'})});
 assert.equal(start.status,200);
 const data=await start.json();assert.equal(data.activityId,'local-qa:'+id);
 const finish=localQARequest('/api/action',{method:'POST',body:JSON.stringify({action:'finish',activityId:data.activityId,points:[]})});
 assert.equal(finish.status,503);
 assert.match((await finish.json()).error,/saved locally/i);
 const summary=await localQARequest('/api/data').json();
 assert.equal(summary.points,0);
 assert.deepEqual(summary.vouchers,[]);
});
test('local QA never supports signup, rewards, merchant privileges',async()=>{
 const signup=localQARequest('/api/action',{method:'POST',body:JSON.stringify({action:'signup',email:'test@example.invalid'})});
 assert.equal(signup.status,503);
 assert.equal(localQARequest('/api/partner-summary').status,403);
});
test('local QA Abandon is a local-only terminal response, with no server write',async()=>{
 const r=localQARequest('/api/action',{method:'POST',body:JSON.stringify({action:'abandon',activityId:'local-qa:foo'})});
 assert.deepEqual(await r.json(),{ok:true,status:'abandoned'});
});
