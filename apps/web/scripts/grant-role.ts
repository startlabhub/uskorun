import {Pool} from "pg";
const [,,email,role]=process.argv;
if(!email||!["merchant","admin"].includes(role))throw new Error("Usage: npm run grant-role -- email@example.com merchant|admin");
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required");
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try {
 const r=await pool.query("UPDATE users SET role=$1 WHERE email=$2 RETURNING id,email,role",[role,email.toLowerCase()]);
 if(!r.rowCount)throw new Error("Account not found: sign up first");
 console.log("Updated role for",r.rows[0].email,"to",r.rows[0].role);
}finally{await pool.end()}
