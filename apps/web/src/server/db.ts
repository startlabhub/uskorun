import {Pool,PoolClient} from "pg";
let pool:Pool|undefined;
export function database():Pool {
 if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL missing");
 pool??=new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:8000,ssl:process.env.DB_SSL==="true"?{rejectUnauthorized:true}:undefined});
 return pool;
}
export async function transaction<T>(work:(c:PoolClient)=>Promise<T>):Promise<T>{
 const c=await database().connect();
 try {await c.query("BEGIN");const r=await work(c);await c.query("COMMIT");return r}
 catch(e){await c.query("ROLLBACK");throw e}finally{c.release()}
}
