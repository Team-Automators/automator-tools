process.env.SESSION_SECRET='t'; process.env.VERCEL='';
const PORT=4320, BASE=`http://localhost:${PORT}`;
const app=require('../server'); const session=require('../lib/session');
const U1=session.sign({lid:'L1',cid:'C1',uid:'U1'}), U2=session.sign({lid:'L1',cid:'C1',uid:'U2'});
async function rq(m,p,tok,body){const h={};if(body)h['Content-Type']='application/json';if(tok)h.Authorization='Bearer '+tok;const r=await fetch(BASE+p,{method:m,headers:h,body:body?JSON.stringify(body):undefined});let j=null;try{j=await r.json()}catch{}return{status:r.status,j};}
let p=0,f=0;const ck=(n,c,x='')=>{console.log('  ['+(c?'PASS':'FAIL')+'] '+n+(x?' — '+x:''));c?p++:f++;};
const srv=app.listen(PORT,async()=>{
  const c=await rq('POST','/api/pipeline',U1,{locationId:'x',clientName:'Mary Tse',service:'setup-calls'});
  ck('create -> owner U1 + active', c.status===200 && c.j.ownerUserId==='U1' && c.j.status==='active');
  const id=c.j.id;
  const u1=await rq('GET','/api/pipeline',U1); ck('U1 sees it', u1.j.some(e=>e.id===id));
  const u2=await rq('GET','/api/pipeline',U2); ck('U2 does NOT', !u2.j.some(e=>e.id===id));
  const badReq=await rq('POST','/api/pipeline',U1,{locationId:'x',clientName:'x'}); ck('missing service -> 400', badReq.status===400);
  const comp=await rq('PUT','/api/pipeline/'+id,U1,{locationId:'x',status:'completed'}); ck('complete sets finishedAt', comp.j.status==='completed' && !!comp.j.finishedAt);
  const u2del=await rq('DELETE','/api/pipeline/'+id+'?locationId=x',U2); ck('U2 cannot delete U1 -> 404', u2del.status===404);
  const imp=await rq('POST','/api/pipeline/import',U1,{locationId:'x',items:[{clientName:'Imported',service:'funnels'},{clientName:'Imported2',service:'voice-ai',status:'completed',finishedAt:Date.now()}]});
  ck('import returns count', imp.j.imported===2);
  const after=await rq('GET','/api/pipeline',U1); ck('import replaced U1 set', after.j.length===2 && after.j.some(e=>e.clientName==='Imported'));
  const u2after=await rq('GET','/api/pipeline',U2); ck('U2 unaffected by U1 import', Array.isArray(u2after.j));
  console.log('\n  RESULT: '+p+' passed, '+f+' failed'); srv.close();
});
