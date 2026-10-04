import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource, database } from './mailbox-harness.mjs';
import { readFileSync } from 'node:fs';
const { sanitizeSignature, importSignature, renderSignedEmail } = loadSource('lib/email-signature.ts');
const { gmailMessage, sendMailboxMessage } = loadSource('lib/mailbox-providers.ts');
test('removes executable content and local images but preserves signature tables and HTTPS logos', () => {
 const s=importSignature(`<table><tr><td style="color:#123456;position:fixed"><b>Ross</b><a href="javascript:alert(1)">bad</a><img src="https://example.com/logo.png" onerror="alert(1)"><img src="file:///logo.png"><script>alert(1)</script></td></tr></table>`);
 assert.match(s.html,/<table>/); assert.match(s.html,/color:#123456/); assert.match(s.html,/https:\/\/example.com\/logo.png/);
 assert.doesNotMatch(s.html,/script|onerror|position|file:/); assert.match(s.text,/Ross/); assert.equal(s.warnings.length,1);
 assert.throws(()=>importSignature('x'.repeat(102401)),/100 KB/);
});
test('plain text, include toggle, and HTML escaping',()=>{
 assert.deepEqual(renderSignedEmail('Hello','Ross',null),{text:'Hello\n\nRoss',html:null});
 assert.deepEqual(renderSignedEmail('Hello','Ross','<b>Ross</b>',false),{text:'Hello',html:null});
 const result=renderSignedEmail('<script>hello</script>','old','<b>Ross</b>');
 assert.match(result.html,/&lt;script&gt;/);assert.match(result.text,/Ross/);
});
test('Gmail uses multipart alternative with readable text and HTML',()=>{
 const result=Buffer.from(gmailMessage('a@example.com','b@example.com','Hello','Hello Ross','<b>Ross</b>'),'base64url').toString();
 assert.match(result,/multipart\/alternative/);assert.match(result,/text\/plain/);assert.match(result,/text\/html/);
 assert.ok(result.includes(Buffer.from('<b>Ross</b>').toString('base64')));
});
test('Outlook receives sanitized HTML and older text messages remain Text',async()=>{
 const previous=globalThis.fetch;let bodies=[];
 globalThis.fetch=async(url,options)=>{bodies.push(JSON.parse(options.body));return new Response(null,{status:202});};
 try {
  await sendMailboxMessage('microsoft','token',{from:'a@example.com',to:'b@example.com',subject:'Hi',text:'Ross',html:'<b>Ross</b><script>bad()</script>'});
  await sendMailboxMessage('microsoft','token',{from:'a@example.com',to:'b@example.com',subject:'Hi',text:'Ross'});
  assert.equal(bodies[0].message.body.contentType,'HTML');assert.equal(bodies[0].message.body.content,'<b>Ross</b>');assert.equal(bodies[1].message.body.contentType,'Text');
 }finally{globalThis.fetch=previous;}
});
test('signature endpoint requires an owner and saves only sanitized profile-scoped data',async()=>{
 const serverPath=new URL('../lib/mailbox-server.ts',import.meta.url).pathname;
 let writes=[];
 class HttpError extends Error {constructor(message,status){super(message);this.status=status;}}
 const {POST}=loadSource('app/api/signature/route.ts',{[serverPath]:{MailboxHttpError:HttpError,mailboxOwner:async request=>{
 if(request.headers.get('authorization')!=='Bearer good')throw new HttpError('Sign in',401);
 return {profileId:'owner',db:{from:()=>({update:data=>({eq:async(k,v)=>{writes.push({data,k,v});return {error:null};}})})}};
 }}});
 const req=(save,auth='Bearer good')=>new Request('https://example.com',{method:'POST',headers:{authorization:auth},body:JSON.stringify({html:'<b>Ross</b><script>bad()</script>',save,profileId:'victim'})});
 assert.equal((await POST(req(true,''))).status,401);
 assert.equal((await POST(req(false))).status,200);assert.equal(writes.length,0);
 assert.equal((await POST(req(true))).status,200);assert.equal(writes[0].v,'owner');assert.equal(writes[0].data.email_signature_html,'<b>Ross</b>');
});
test('migrated schema includes HTML signature and snapshot columns',async()=>{
 const db=await database();try{
 // database() already applies the HTML signature migration.
 const result=await db.query(`select column_name from information_schema.columns where table_schema='public' and column_name in ('email_signature_html','body_html_snapshot')`);
 assert.equal(result.rows.length,2);
 }finally{await db.close();}
});
