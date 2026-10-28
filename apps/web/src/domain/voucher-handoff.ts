export function voucherFragment(code:string):string {
 // Hash fragment is never sent to a server by an HTTP request. Still sensitive in local browser history until cleared.
 return '#redeem='+encodeURIComponent(code);
}
export function parseAndScrubVoucherFragment(location:{hash:string;pathname:string;search:string},history:{replaceState:(state:unknown,title:string,url:string)=>void}):string|null{
 const params=new URLSearchParams(location.hash.replace(/^#/,''));
 const code=params.get('redeem');
 if(code!==null){history.replaceState(null,'',location.pathname+location.search);}
 return code;
}
