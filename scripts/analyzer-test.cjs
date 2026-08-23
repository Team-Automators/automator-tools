process.env.SESSION_SECRET='t'; process.env.VERCEL=''; delete process.env.ANTHROPIC_API_KEY;
const PORT=4313, BASE=`http://localhost:${PORT}`;
const app=require('../server'); const session=require('../lib/session');
const TOK=session.sign({lid:'L1',cid:'C1',uid:'U1'});
async function rq(tok,body){const h={'Content-Type':'application/json'};if(tok)h.Authorization='Bearer '+tok;const r=await fetch(BASE+'/copywrite/analyze-transcript',{method:'POST',headers:h,body:JSON.stringify(body)});let j=null;try{j=await r.json()}catch{}return{status:r.status,j};}
let p=0,f=0;const ck=(n,c,x='')=>{console.log('  ['+(c?'PASS':'FAIL')+'] '+n+(x?' — '+x:''));c?p++:f++;};
const srv=app.listen(PORT,async()=>{
  const noAuth=await rq(null,{transcript:'hi'}); ck('no session -> 401', noAuth.status===401);
  const noT=await rq(TOK,{}); ck('missing transcript -> 400', noT.status===400, noT.j?.error);
  const noKey=await rq(TOK,{transcript:'discovery call',provider:'claude'}); ck('no api key -> 400', noKey.status===400, noKey.j?.error);
  const badProv=await rq(TOK,{transcript:'x',provider:'nope',apiKey:'k'}); ck('unknown provider -> 400', badProv.status===400, badProv.j?.error);
  console.log('\n  RESULT: '+p+' passed, '+f+' failed'); srv.close();
});
