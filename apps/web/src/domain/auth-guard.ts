export type AuthRequest={email:string;password:string};
export const AUTH_LIMITS={login:{identity:6,network:30,windowSeconds:600},signup:{identity:3,network:8,windowSeconds:3600}} as const;
export function validateAuthInput(rawEmail:unknown,rawPassword:unknown,mode:'login'|'signup'):AuthRequest|null{
 if(typeof rawEmail!=='string'||typeof rawPassword!=='string')return null;
 const email=rawEmail.trim().toLowerCase();
 if(email.length<3||email.length>240||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return null;
 if(rawPassword.length>(mode==='login'?200:200)||rawPassword.length<(mode==='signup'?12:1))return null;
 return {email,password:rawPassword};
}
export function throttleBucket(nowMs:number,windowSeconds:number):number {
 return Math.floor(nowMs/(windowSeconds*1000));
}
export function mayAttempt(attempts:number,max:number):boolean {return attempts<=max;}
