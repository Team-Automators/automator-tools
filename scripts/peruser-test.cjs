process.env.SESSION_SECRET='t'; process.env.VERCEL='';
const PORT=4800, BASE=`http://localhost:${PORT}`;
const app=require('../server'); const session=require('../lib/session');
const U1=session.sign({lid:'L1',cid:'C1',uid:'U1',email:'u1@x.com'});
const U2=session.sign({lid:'L1',cid:'C1',uid:'U2',email:'u2@x.com'});
async function rq(m,p,tok,body){const h={};if(body)h['Content-Type']='application/json';if(tok)h.Authorization='Bearer '+tok;const r=await fetch(BASE+p,{method:m,headers:h,body:body?JSON.stringify(body):undefined});let j=null;try{j=await r.json()}catch{}return{status:r.status,j};}
let p=0,f=0;const ck=(n,c,x='')=>{console.log('  ['+(c?'PASS':'FAIL')+'] '+n+(x?' — '+x:''));c?p++:f++;};
const srv=app.listen(PORT,async()=>{
  // Tasks
  const t=await rq('POST','/api/tasks',U1,{locationId:'x',title:'T1'}); ck('task create owner U1', t.status===200 && t.j.ownerUserId==='U1');
  const u1t=await rq('GET','/api/tasks',U1); ck('U1 sees own task', u1t.j.some(x=>x.id===t.j.id));
  const u2t=await rq('GET','/api/tasks',U2); ck('U2 does NOT see U1 task', !u2t.j.some(x=>x.id===t.j.id));
  const u2put=await rq('PUT','/api/tasks/'+t.j.id,U2,{locationId:'x',stage:'done'}); ck('U2 cannot edit U1 task → 404', u2put.status===404);
  const u2del=await rq('DELETE','/api/tasks/'+t.j.id+'?locationId=x',U2); ck('U2 cannot delete U1 task → 404', u2del.status===404);
  // Hooks
  const h=await rq('POST','/api/hooks',U1,{locationId:'x',name:'H1'}); ck('hook create owner U1', h.status===200 && h.j.ownerUserId==='U1');
  const u2h=await rq('GET','/api/hooks',U2); ck('U2 does NOT see U1 hook', !u2h.j.some(x=>x.id===h.j.id));
  const u2hput=await rq('PUT','/api/hooks/'+h.j.id,U2,{locationId:'x',name:'x'}); ck('U2 cannot edit U1 hook → 404', u2hput.status===404);
  // Brand voice per-user
  await rq('POST','/copywrite/feedback',U1,{locationId:'x',type:'email',text:'love it',sentiment:'up'});
  const u1bv=await rq('GET','/copywrite/brand-voice?locationId=x',U1); ck('U1 has feedback', (u1bv.j.feedback||[]).length===1);
  const u2bv=await rq('GET','/copywrite/brand-voice?locationId=x',U2); ck('U2 has separate (empty) feedback', (u2bv.j.feedback||[]).length===0);
  // Session per-user
  await rq('POST','/copywrite/session',U1,{locationId:'x',type:'email',messages:[{role:'user',content:'hi'}]});
  const u1s=await rq('GET','/copywrite/session?locationId=x&type=email',U1); ck('U1 session saved', (u1s.j.messages||[]).length===1);
  const u2s=await rq('GET','/copywrite/session?locationId=x&type=email',U2); ck('U2 session separate (empty)', (u2s.j.messages||[]).length===0);
  console.log('\n  RESULT: '+p+' passed, '+f+' failed'); srv.close();
});
