import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAuthInput,throttleBucket,mayAttempt,AUTH_LIMITS} from '../src/domain/auth-guard.ts';
test('reject huge password before expensive scrypt path',()=>{
 assert.equal(validateAuthInput('x@example.com','x'.repeat(201),'login'),null);
 assert.equal(validateAuthInput('x@example.com','x'.repeat(201),'signup'),null);
});
test('no coercion of object passwords and emails',()=>{
 assert.equal(validateAuthInput({toString:()=> 'x@example.com'},'password','login'),null);
 assert.equal(validateAuthInput('x@example.com',{} ,'login'),null);
});
test('signup enforces minimum length, login allows legacy shorter stored password',()=>{
 assert.equal(validateAuthInput('X@EXAMPLE.COM','short','signup'),null);
 assert.equal(validateAuthInput('X@EXAMPLE.COM','short','login')?.email,'x@example.com');
});
test('rate window and cap deterministic',()=>{
 assert.equal(throttleBucket(600000,600),1);
 assert.equal(mayAttempt(AUTH_LIMITS.login.identity,AUTH_LIMITS.login.identity),true);
 assert.equal(mayAttempt(AUTH_LIMITS.login.identity+1,AUTH_LIMITS.login.identity),false);
});
