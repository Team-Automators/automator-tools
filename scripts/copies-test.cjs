process.env.SESSION_SECRET='t'; process.env.VERCEL='';
const PORT=4700, BASE=`http://localhost:${PORT}`;
const app=require('../server');
const session=require('../lib/session');
const U1=session.sign({lid:'L1',cid:'C1',uid:'U1',email:'u1@x.com'});
const U2=session.sign({lid:'L1',cid:'C1',uid:'U2',email:'u2@x.com'});
async function rq(m,p,tok,body){const h={};if(body)h['Content-Type']='application/json';if(tok)h.Authorization='Bearer '+tok;const r=await fetch(BASE+p,{method:m,headers:h,body:body?JSON.stringify(body):undefined});let j=null;try{j=await r.json()}catch{}return{status:r.status,j};}
let pass=0,fail=0;const ck=(n,c,x='')=>{console.log(`  [${c?'PASS':'FAIL'}] ${n}${x?' — '+x:''}`);c?pass++:fail++;};
const srv=app.listen(PORT,async()=>{
  const created=await rq('POST','/api/copies',U1,{locationId:'x',type:'email',messages:[{role:'assistant',content:'hi'}],title:'C1'});
  ck('create → 200 + owner + default status', created.status===200 && created.j.ownerUserId==='U1' && created.j.status==='in-progress');
  const id=created.j.id;
  const u1list=await rq('GET','/api/copies',U1); ck('owner U1 sees it', Array.isArray(u1list.j)&&u1list.j.some(c=>c.id===id));
  const u2list=await rq('GET','/api/copies',U2); ck('other user U2 does NOT see it', Array.isArray(u2list.j)&&!u2list.j.some(c=>c.id===id));
  const u2get=await rq('GET',`/api/copies/${id}`,U2); ck('U2 cannot GET U1 copy by id → 404', u2get.status===404);
  const u2st=await rq('PUT',`/api/copies/${id}/status`,U2,{locationId:'x',status:'completed'}); ck('U2 cannot change U1 copy status → 404', u2st.status===404);
  const u2del=await rq('DELETE',`/api/copies/${id}?locationId=x`,U2); ck('U2 cannot delete U1 copy → 404', u2del.status===404);
  const u1still=await rq('GET',`/api/copies/${id}`,U1); ck('owner U1 can still GET it', u1still.status===200);
  const st=await rq('PUT',`/api/copies/${id}/status`,U1,{locationId:'x',status:'completed'}); ck('set status completed', st.j.status==='completed');
  const badst=await rq('PUT',`/api/copies/${id}/status`,U1,{locationId:'x',status:'nope'}); ck('invalid status → 400', badst.status===400);
  const del=await rq('DELETE',`/api/copies/${id}?locationId=x`,U1); ck('delete = soft archive', del.j.archived===true);
  const afterDel=await rq('GET','/api/copies',U1); ck('archived hidden from live view', !afterDel.j.some(c=>c.id===id));
  const arch=await rq('GET','/api/copies?status=archived',U1); ck('shows in archive view', arch.j.some(c=>c.id===id));
  const purge=await rq('DELETE',`/api/copies/${id}?locationId=x&permanent=true`,U1); ck('permanent delete', purge.j.permanent===true);
  const gone=await rq('GET','/api/copies?status=archived',U1); ck('gone after purge', !gone.j.some(c=>c.id===id));
  console.log(`\n  RESULT: ${pass} passed, ${fail} failed`); srv.close();
});
