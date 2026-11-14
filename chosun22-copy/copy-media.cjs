'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const SOURCE='https://zultqdhzynoftvaglant.supabase.co';
const TARGET='https://miskaxvfipywmlvxelrs.supabase.co';
const PREFIX='ktown-22-import-20261102';
const OUTPUT=path.join(__dirname,'BAPCARRY_22_Import.sql');
function mediaPlan(data){
 const files=new Map();
 function add(bucket,raw){
  const object=decodeURIComponent(raw);
  if(!object || object.startsWith('/') || object.split('/').includes('..'))throw Error('Unsafe media path');
  const key=bucket+'/'+object;
  files.set(key,{bucket,sourcePath:object,targetPath:PREFIX+'/'+object});
 }
 function scan(v){if(Array.isArray(v))v.forEach(scan);else if(v&&typeof v==='object')Object.values(v).forEach(scan);else if(typeof v==='string'){
  const re=/https:\/\/zultqdhzynoftvaglant\.supabase\.co\/storage\/v1\/object\/public\/([^\s"'<>\\]+)/g;
  for(const m of v.matchAll(re)){const raw=m[1].split(/[?#]/)[0],i=raw.indexOf('/');if(i>0)add(raw.slice(0,i),raw.slice(i+1));}
 }}
 scan(data);
 for(const row of data.items||[])for(const field of ['image_path','thumbnail_path'])if(row[field]&&!/^(https?:|data:)/.test(row[field]))add('menu-images',row[field]);
 return [...files.values()];
}
const encoded=s=>s.split('/').map(encodeURIComponent).join('/');
function rewrite(data,files){
 const map=new Map(files.map(f=>[f.bucket+'/'+f.sourcePath,f]));
 function walk(v){if(Array.isArray(v))return v.map(walk);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x)]));if(typeof v!=='string')return v;
  return v.replace(/https:\/\/zultqdhzynoftvaglant\.supabase\.co\/storage\/v1\/object\/public\/([^\s"'<>\\]+)/g,(full,raw)=>{
   const [base]=raw.split(/[?#]/),f=map.get(decodeURIComponent(base));if(!f)throw Error('Missing media mapping');
   return TARGET+'/storage/v1/object/public/'+f.bucket+'/'+encoded(f.targetPath)+raw.slice(base.length);
  }).replace(/https?:\/\/(?:www\.)?ktowntriangle\.com(?=\/business\/22(?:[/?#]|$))/g,'https://www.bapcarry.com');
 }
 const out=walk(data);
 for(const row of out.items||[])for(const field of ['image_path','thumbnail_path'])if(row[field]&&!/^(https?:|data:)/.test(row[field])){
  const f=map.get('menu-images/'+decodeURIComponent(row[field]));if(!f)throw Error('Missing relative media mapping');row[field]=f.targetPath;
 }
 return out;
}
async function main(){
 fs.rmSync(OUTPUT,{force:true});
 const key=process.env.BAPCARRY_SERVICE_ROLE_KEY;
 if(!key)throw Error('BAPCARRY_SERVICE_ROLE_KEY is missing. Run RUN.ps1.');
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'source.json'),'utf8'));
 const files=mediaPlan(data);
 console.log(`Chosun Ok (22): ${data.items.length} menus, ${data.sections.length} layers, ${files.length} media files.`);
 const auth={apikey:key,Authorization:'Bearer '+key};
 async function request(url,options={},allow404=false){const r=await fetch(url,{...options,signal:AbortSignal.timeout(60000)});if(!r.ok&&!(allow404&&r.status===404))throw Error(`HTTP ${r.status}: ${url.replace(TARGET,'BAPCARRY').replace(SOURCE,'KTOWN')}`);return r;}
 // Read bucket inventory before any writes. Existing buckets are never changed.
 const buckets=await(await request(TARGET+'/storage/v1/bucket',{headers:auth})).json();
 for(const bucket of new Set(files.map(f=>f.bucket)))if(!buckets.some(b=>b.id===bucket)){
  await request(TARGET+'/storage/v1/bucket',{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({id:bucket,name:bucket,public:true})});
 }
 let checked=0;const failed=[];
 for(const f of files){
  try{
   const source=await request(SOURCE+'/storage/v1/object/public/'+f.bucket+'/'+encoded(f.sourcePath));
   const bytes=Buffer.from(await source.arrayBuffer());
   if(!bytes.length)throw Error('Empty source');
   const dest=TARGET+'/storage/v1/object/'+f.bucket+'/'+encoded(f.targetPath);
   await request(dest,{method:'POST',headers:{...auth,'Content-Type':source.headers.get('content-type')||'application/octet-stream','x-upsert':'true'},body:bytes});
   const copied=Buffer.from(await(await request(dest,{headers:auth})).arrayBuffer());
   if(!crypto.timingSafeEqual(crypto.createHash('sha256').update(bytes).digest(),crypto.createHash('sha256').update(copied).digest()))throw Error('Content verification failed');
  }catch(e){failed.push({file:f.bucket+'/'+f.sourcePath,error:e.message});console.log('FAILED:',f.bucket+'/'+f.sourcePath,'::',e.message);}
  checked++;if(checked%20===0||checked===files.length)console.log(`Checked ${checked}/${files.length}; failed ${failed.length}`);
 }
 fs.writeFileSync(path.join(__dirname,'media-report.json'),JSON.stringify({checked,failed},null,2));
 if(failed.length)throw Error(`${failed.length} files failed. No import SQL generated. Send media-report.json; rerunning is safe.`);
 const rewritten=rewrite(data,files),payload=JSON.stringify(rewritten);
 if(payload.includes('$bap22$')||payload.includes(SOURCE))throw Error('Unexpected source reference or SQL delimiter');
 const template=fs.readFileSync(path.join(__dirname,'import-template.sql'),'utf8');
 fs.writeFileSync(OUTPUT,template.replace('__PAYLOAD_JSON__',payload));
 console.log('SUCCESS: media copied and verified. Next: run BAPCARRY_22_Import.sql ONLY in BAPCARRY Supabase SQL Editor.');
 console.log('Database menus/design have NOT been changed yet.');
}
module.exports={mediaPlan,rewrite};
if(require.main===module)main().catch(e=>{console.error('STOP:',e.message);process.exitCode=1;});
