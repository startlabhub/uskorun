import {randomBytes,createHash,createHmac,scryptSync,timingSafeEqual,createCipheriv,createDecipheriv} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {database} from "./db";
function secret():string {
 const s=process.env.APP_SECRET;
 if(!s||s.length<32)throw new Error("APP_SECRET must be at least 32 characters");
 return s;
}
export function hashPassword(pass:string):string{
 const salt=randomBytes(16).toString("hex");
 return salt+":"+scryptSync(pass,salt,64).toString("hex");
}
export function validPassword(pass:string,stored:string):boolean{
 try{const [salt,key]=stored.split(":");const a=Buffer.from(key,"hex"),b=scryptSync(pass,salt,a.length);return timingSafeEqual(a,b)}
 catch{return false}
}
const key=()=>createHash("sha256").update(secret()).digest();
export function opaqueToken():string{return randomBytes(32).toString("base64url")}
export function tokenHash(token:string):string{return createHmac("sha256",key()).update(token).digest("hex")}
export function encryptCode(code:string):string{
 const iv=randomBytes(12),c=createCipheriv("aes-256-gcm",key(),iv);
 const body=Buffer.concat([c.update(code,"utf8"),c.final()]);
 return [iv.toString("base64url"),c.getAuthTag().toString("base64url"),body.toString("base64url")].join(".");
}
export function decryptCode(encoded:string):string{
 const [iv,tag,body]=encoded.split(".");
 const d=createDecipheriv("aes-256-gcm",key(),Buffer.from(iv,"base64url"));
 d.setAuthTag(Buffer.from(tag,"base64url"));
 return Buffer.concat([d.update(Buffer.from(body,"base64url")),d.final()]).toString("utf8");
}
export type CurrentUser={id:string;email:string;role:"runner"|"admin"|"merchant"};
export async function currentUser(req:NextRequest):Promise<CurrentUser|null>{
 const token=req.cookies.get("uskorun_session")?.value;
 if(!token)return null;
 const r=await database().query(`SELECT u.id,u.email,u.role FROM auth_sessions s JOIN users u ON u.id=s.user_id
 WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[tokenHash(token)]);
 return r.rows[0]||null;
}
export async function establishSession(res:NextResponse,userId:string){
 const token=opaqueToken();
 await database().query("INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '14 days')",[tokenHash(token),userId]);
 res.cookies.set("uskorun_session",token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:14*24*3600});
}
export function sameOrigin(req:NextRequest):boolean{
 const origin=req.headers.get("origin");
 if(!origin)return false;
 try{return new URL(origin).host===req.headers.get("host")}
 catch{return false}
}
