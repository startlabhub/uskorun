/**
 * MANUAL, IDEMPOTENT demo-only fixtures for a separately approved staging test.
 * Deliberately NOT imported or called by scripts/migrate.ts / app startup.
 * No real merchant, real goods, or customer benefit is promised.
 *
 * Example after explicit approval:
 * SEED_DEMO_SHOP_CONFIRM=I_ACKNOWLEDGE_DEMO_ONLY npx tsx scripts/seed-demo-shop.ts
 */
import {Pool} from 'pg';

const fixtures=[
 {title:'DEMO Partner A — 10% discount',merchant:'DEMO Partner A',
  details:'DEMO ONLY. Fictional 10% off a hypothetical eligible purchase. No actual merchant or purchase. One claim per user; subject to the displayed inventory cap and offer expiration.',
  cost:5,limit:25},
 {title:'DEMO Partner B — free snack',merchant:'DEMO Partner B',
  details:'DEMO ONLY. Simulated free snack; no actual item will be provided. One claim per user; subject to the displayed inventory cap and offer expiration.',
  cost:10,limit:15},
 {title:'DEMO Partner C — $5 fixed discount',merchant:'DEMO Partner C',
  details:'DEMO ONLY. Fictional fixed $5 off a hypothetical eligible purchase. No actual discount or payment. One claim per user; subject to the displayed inventory cap and offer expiration.',
  cost:20,limit:20}
] as const;

if(process.env.SEED_DEMO_SHOP_CONFIRM!=='I_ACKNOWLEDGE_DEMO_ONLY')
 throw new Error('Explicit SEED_DEMO_SHOP_CONFIRM required; no inserts performed');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
if(!['local-test','staging'].includes(process.env.USKORUN_ENV||''))
 throw new Error('USKORUN_ENV must explicitly be local-test or staging; production and unset environments are refused');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
try{
 await client.query('BEGIN');
 await client.query("SELECT pg_advisory_xact_lock(hashtext('uskorun_demo_shop_seed_v1'))");
 for(const d of fixtures){
  const prior=await client.query(
   'SELECT id,merchant,cost_points,max_claims,is_demo,state FROM offers WHERE title=$1 FOR UPDATE',[d.title]);
  if(prior.rowCount){
   if(prior.rowCount!==1||prior.rows[0].merchant!==d.merchant||
      Number(prior.rows[0].cost_points)!==d.cost||
      Number(prior.rows[0].max_claims)!==d.limit||
      prior.rows[0].is_demo!==true){
    throw new Error('Existing offer differs from immutable demo fixture: '+d.title);
   }
   console.log('Existing demo fixture found:',d.merchant);continue;
  }
  await client.query(`INSERT INTO offers
     (title,merchant,details,city,cost_points,max_claims,is_demo,state,ends_at)
     VALUES ($1,$2,$3,'Sacramento',$4,$5,TRUE,'active',NOW()+INTERVAL '90 days')`,
    [d.title,d.merchant,d.details,d.cost,d.limit]);
  console.log('Inserted demo fixture:',d.merchant);
 }
 await client.query('COMMIT');
}catch(e){await client.query('ROLLBACK');throw e}
finally{client.release();await pool.end()}
