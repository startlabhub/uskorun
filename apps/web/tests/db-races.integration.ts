// REAL PostgreSQL integration tests. Never confuse with mocked unit tests.
// Usage: TEST_DATABASE_URL=postgresql://.../uskorun_test npx tsx --test tests/db-races.integration.ts
// Refuses to connect if test DB name is not explicitly marked _test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const connection=process.env.TEST_DATABASE_URL;
const safe=Boolean(connection && /(^|[_-])test($|[_-])/i.test(decodeURIComponent(new URL(connection).pathname)));
test('REAL PostgreSQL concurrent starts, finish retry, points, claims and redemptions', {skip:!safe?'Dedicated *_test DB with TEST_DATABASE_URL required':false}, async()=>{
 process.env.DATABASE_URL=connection!;
 process.env.APP_SECRET='temporary-test-secret-32-chars-minimum-never-commit';
 const {Pool}=await import('pg');
 const pool=new Pool({connectionString:connection});
 const {startRecording,finishRecording,abandonRecording}=await import('../src/server/activity-service');
 const {claimOffer,redeemVoucher}=await import('../src/server/reward-service');
 const {decryptCode}=await import('../src/server/security');
 const {enforceAuthLimits}=await import('../src/server/auth-rate');
 const {closeTestDatabasePool}=await import('../src/server/db');
 try{
  await pool.query(readFileSync(join(process.cwd(),'scripts/schema.sql'),'utf8'));
  await pool.query(readFileSync(join(process.cwd(),'scripts/sprint-2-migration.sql'),'utf8'));
  const runner=(await pool.query("INSERT INTO users(email,password_hash) VALUES($1,'test') RETURNING id",[`runner-${randomUUID()}@example.test`])).rows[0].id;
  const merchant=(await pool.query("INSERT INTO users(email,password_hash,role) VALUES($1,'test','merchant') RETURNING id",[`merchant-${randomUUID()}@example.test`])).rows[0].id;
  const otherMerchant=(await pool.query("INSERT INTO users(email,password_hash,role) VALUES($1,'test','merchant') RETURNING id",[`bad-${randomUUID()}@example.test`])).rows[0].id;
  const clientIds=[randomUUID(),randomUUID()];
  const starts=await Promise.allSettled(clientIds.map(id=>startRecording(runner,id,'run')));
  assert.equal(starts.filter(r=>r.status==='fulfilled').length,1,'Only one recording can exist');
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM activities WHERE user_id=$1 AND status='recording'",[runner])).rows[0].count,1);
  const activityId=(starts.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<{activityId:string;status:string}>).value.activityId;
  const firstClient=clientIds[starts.findIndex(r=>r.status==='fulfilled')];
  assert.equal((await startRecording(runner,firstClient,'run')).activityId,activityId,'client ID retries are idempotent');
  // Advance test start timestamp so synthetic samples fall within accepted server time.
  await pool.query("UPDATE activities SET started_at=NOW()-INTERVAL '2 minutes' WHERE id=$1",[activityId]);
  const start=Date.now()-115000,points=[];
  for(let i=0;i<=110;i++)points.push({lat:38.58,lon:-121.49+i*3/86900,accuracy:4,t:start+i*1000,segment:0});
  const finished=await Promise.all([finishRecording(runner,activityId,points),finishRecording(runner,activityId,points)]);
  assert.equal(finished[0].status,'accepted');assert.equal(finished[1].status,'accepted');
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM points_ledger WHERE source_type='activity' AND source_id=$1",[activityId])).rows[0].count,1);
  const offer=(await pool.query(`INSERT INTO offers(title,merchant,details,city,cost_points,max_claims,is_demo,state,ends_at)
   VALUES('Real DB race test','Test merchant','not real','Sacramento',1,1,TRUE,'active',NOW()+INTERVAL '1 hour') RETURNING id`)).rows[0].id;
  await pool.query('INSERT INTO merchant_access(user_id,offer_id) VALUES($1,$2)',[merchant,offer]);
  // Auth throttle must be concurrency-safe across requests; no synchronous hash work involved.
  const authKey='limit-'+randomUUID()+'@example.test';
  const brute=await Promise.allSettled(Array.from({length:9},()=>enforceAuthLimits('login',authKey)));
  assert.equal(brute.filter(x=>x.status==='fulfilled').length,6,'Exactly six attempts within identity window');
  // Different offers competing for one point: at most one may be claimed.
  const secondRunner=(await pool.query("INSERT INTO users(email,password_hash) VALUES($1,'test') RETURNING id",[`second-${randomUUID()}@example.test`])).rows[0].id;
  await pool.query("INSERT INTO points_ledger(user_id,source_type,source_id,delta) VALUES($1,'test_seed',$2,1)",[secondRunner,randomUUID()]);
  const makeOffer=async()=> (await pool.query(`INSERT INTO offers(title,merchant,details,city,cost_points,max_claims,is_demo,state,ends_at)
   VALUES('Balance race','Test merchant','not real','Sacramento',1,1,TRUE,'active',NOW()+INTERVAL '1 hour') RETURNING id`)).rows[0].id;
  const twoOffers=await Promise.all([makeOffer(),makeOffer()]);
  const spend=await Promise.allSettled(twoOffers.map(oid=>claimOffer(secondRunner,oid)));
  assert.equal(spend.filter(x=>x.status==='fulfilled').length,1,'Concurrent spend cannot overdraw one point');
  assert.equal((await pool.query('SELECT COALESCE(SUM(delta),0)::int AS balance FROM points_ledger WHERE user_id=$1',[secondRunner])).rows[0].balance,0);
  const claims=await Promise.allSettled([claimOffer(runner,offer),claimOffer(runner,offer)]);
  assert.equal(claims.filter(r=>r.status==='fulfilled').length,1,'Only one voucher can be claimed');
  const row=(await pool.query('SELECT encrypted_code,id FROM vouchers WHERE user_id=$1 AND offer_id=$2',[runner,offer])).rows[0];
  const code=decryptCode(row.encrypted_code);
  await assert.rejects(redeemVoucher({id:otherMerchant,role:'merchant'},code),/not authorized/);
  const redeems=await Promise.allSettled([
   redeemVoucher({id:merchant,role:'merchant'},code),redeemVoucher({id:merchant,role:'merchant'},code)]);
  assert.equal(redeems.filter(r=>r.status==='fulfilled').length,1,'Only one redemption succeeds');
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM audit_events WHERE action='redeem' AND object_id=$1",[row.id])).rows[0].count,1);
  const offer2=(await pool.query(`INSERT INTO offers(title,merchant,details,city,cost_points,max_claims,is_demo,state,ends_at)
   VALUES('Expired test','Test merchant','not real','Sacramento',0,1,TRUE,'active',NOW()+INTERVAL '1 hour') RETURNING id`)).rows[0].id;
  const second=await claimOffer(runner,offer2);
  await pool.query("UPDATE offers SET ends_at=NOW()-INTERVAL '1 second' WHERE id=$1",[offer2]);
  const v2=(await pool.query('SELECT encrypted_code FROM vouchers WHERE id=$1',[second.voucherId])).rows[0];
  await assert.rejects(redeemVoucher({id:merchant,role:'merchant'},decryptCode(v2.encrypted_code)),/no longer valid/);
  // A new activity may not reuse any old activity timestamps to mint another award.
  const secondSession=await startRecording(runner,randomUUID(),'run');
  const rejected=await finishRecording(runner,secondSession.activityId,points);
  assert.equal(rejected.status,'rejected');
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM points_ledger WHERE source_type='activity' AND source_id=$1",[secondSession.activityId])).rows[0].count,0);
  const activeAfter=await startRecording(runner,randomUUID(),'walk');
  await abandonRecording(runner,activeAfter.activityId);
  assert.equal((await pool.query("SELECT COUNT(*)::int AS count FROM activities WHERE status='recording' AND user_id=$1",[runner])).rows[0].count,0);
 }finally{
  // Both the test-owned pool and the singleton used by service modules must close.
  // The service teardown refuses any non-test DB connection.
  try{await closeTestDatabasePool();}
  finally{await pool.end();}
 }
});
