process.env.VERCEL='';process.env.GHL_CLIENT_ID='cid-x';process.env.GHL_CLIENT_SECRET='sec';process.env.GHL_REDIRECT_URI='https://app/install';process.env.GHL_VERSION_ID='v1';
const PORT=4600,BASE=`http://localhost:${PORT}`;
const axios=require('axios');
axios.post=async(url)=>{ if(url.includes('/oauth/token')) return {data:{access_token:'AT',refresh_token:'RT',locationId:'LOC1',companyId:'C1',expires_in:86400}}; return {data:{}}; };
const os=require('../lib/oauth-store'); let saved=null; os.set=async(k,t)=>{saved={k,hasAT:!!t.access_token,hasRT:!!t.refresh_token};};
const app=require('../server');
const srv=app.listen(PORT,async()=>{
  const r=await fetch(`${BASE}/install?code=abc123&locationId=LOC1`,{redirect:'manual'});
  console.log('  status:',r.status,'(expect 3xx redirect)');
  console.log('  location header:',(r.headers.get('location')||'').slice(0,60));
  console.log('  stored:',JSON.stringify(saved));
  // no-code path still serves the form (200 html), not the oauth branch
  const r2=await fetch(`${BASE}/install?locationId=LOC1`,{headers:{Accept:'text/html'}});
  console.log('  no-code GET status:',r2.status,'(expect 200 form)');
  srv.close();
});
