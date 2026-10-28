import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
const url=process.env.DATABASE_URL;
if(!url) throw new Error("DATABASE_URL required");
const pool=new Pool({connectionString:url});
try{
  await pool.query(readFileSync(join(process.cwd(),"scripts/schema.sql"),"utf8"));
  await pool.query(readFileSync(join(process.cwd(),"scripts/sprint-2-migration.sql"),"utf8"));
  await pool.query(`INSERT INTO challenges (title,city,details,target_miles,ends_at)
    SELECT 'Sacramento Moves Together','Greater Sacramento',
      'Demo citywide goal. Run or walk to help the community move 10,000 miles. No sponsored prize is promised.',10000,NOW()+INTERVAL '90 days'
    WHERE NOT EXISTS (SELECT 1 FROM challenges WHERE title='Sacramento Moves Together')`);
  await pool.query(`INSERT INTO offers(title,merchant,details,city,cost_points,max_claims,is_demo,state,ends_at)
    SELECT 'Demo coffee reward','Demo Partner (not a real merchant)',
      'TEST ONLY. No real coffee, discount, or commercial entitlement is offered. Redeem only in the test verifier.',
      'Sacramento',10,1000,TRUE,'active',NOW()+INTERVAL '90 days'
    WHERE NOT EXISTS (SELECT 1 FROM offers WHERE title='Demo coffee reward')`);
  console.log("USKORUN schema initialized");
}finally{await pool.end()}
