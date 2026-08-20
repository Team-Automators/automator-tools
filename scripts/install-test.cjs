process.env.SESSION_SECRET='t'; process.env.VERCEL='';
const PORT=4200, BASE=`http://localhost:${PORT}`;
const axios=require('axios');
// Stub GHL: sub PIT must contain "good" to be valid.
axios.get=async(url,cfg)=>{
  const auth=(cfg&&cfg.headers&&cfg.headers.Authorization)||'';
  if(url.includes('/contacts/')){ if(auth.includes('good')) return {data:{contacts:[]}}; const e=new Error('bad');e.response={status:401,data:{message:'Invalid token'}};throw e; }
  if(url.includes('/users/me')){ const e=new Error('agency');e.response={status:404};throw e; } // agency PIT valid
  if(url.includes('/custom-menus/')) return {data:{customMenus:[]}};
  return {data:{}};
};
axios.post=async(url)=>{ if(url.includes('/custom-menus/')) return {data:{id:'m1'}}; return {data:{}}; };
const keyStore=require('../lib/key-store'); let stored=null; keyStore.set=async(l,s,a)=>{stored={l,s,a};};
const app=require('../server');
async function put(body){ const r=await fetch(BASE+'/install',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); return {status:r.status,json:await r.json().catch(()=>null)}; }
const srv=app.listen(PORT,async()=>{
  let pass=0,fail=0; const ck=(n,c,x='')=>{console.log(`  [${c?'PASS':'FAIL'}] ${n}${x?' — '+x:''}`); c?pass++:fail++;};
  const ok=await put({locationId:'KogOOG0gkaYzCE9gAaWr',subLocationApiKey:'pit-good-sub',agencyApiKey:'pit-agency'});
  ck('valid PITs → success', ok.json?.success===true, `status=${ok.status}`);
  ck('stored the keys', stored && stored.l==='KogOOG0gkaYzCE9gAaWr');
  ck('reports endpoints ready', ok.json?.endpoints?.['update-contact']?.ready===true);
  const bad=await put({locationId:'KogOOG0gkaYzCE9gAaWr',subLocationApiKey:'pit-bad-sub',agencyApiKey:'pit-agency'});
  ck('invalid Origin PIT → success:false', bad.json?.success===false, bad.json?.error);
  const miss=await put({locationId:'X'});
  ck('missing fields → 400', miss.status===400);
  console.log(`\n  RESULT: ${pass} passed, ${fail} failed`);
  srv.close();
});
