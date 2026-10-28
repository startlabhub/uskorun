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

/**
 * Close the singleton service pool after a disposable PostgreSQL integration run.
 * Refuse to close live pools: TEST_DATABASE_URL must equal DATABASE_URL and
 * reference an explicitly named test database. Never call from app routes.
 */
export async function closeTestDatabasePool():Promise<void>{
 const testUrl=process.env.TEST_DATABASE_URL;
 if(!testUrl||process.env.DATABASE_URL!==testUrl)throw new Error("Test pool shutdown requires matching TEST_DATABASE_URL");
 let name:string;
 try{name=decodeURIComponent(new URL(testUrl).pathname).replace(/^\/+/, "");}
 catch{throw new Error("Invalid TEST_DATABASE_URL");}
 if(!/(^|[_-])test($|[_-])/i.test(name))throw new Error("Refusing pool shutdown on non-test database");
 const active=pool;
 pool=undefined;
 if(active)await active.end();
}
