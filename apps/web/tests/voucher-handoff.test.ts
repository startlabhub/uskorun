import test from 'node:test';
import assert from 'node:assert/strict';
import {voucherFragment,parseAndScrubVoucherFragment} from '../src/domain/voucher-handoff.ts';
test('QR code never uses server-bound ?redeem query parameter',()=>{
 const code='NEVER_LOG_THIS_TOKEN';const fragment=voucherFragment(code);
 assert.equal(fragment,'#redeem='+code);assert.equal(new URL('https://example.com/'+fragment).search,'');
});
test('voucher fragment immediately removed from address after consumption',()=>{
 let clean='';const code=parseAndScrubVoucherFragment({hash:'#redeem=SECRETCODE',pathname:'/',search:''},{replaceState:(_s,_t,url)=>{clean=url}});
 assert.equal(code,'SECRETCODE');assert.equal(clean,'/');
});
