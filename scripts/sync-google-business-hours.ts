import {createClient} from '@supabase/supabase-js';
import {createHoursSyncWorker} from '../lib/google-hours-sync/core';
import {newYorkSchedule} from '../lib/google-hours-sync/convert';
async function main(){
 const url=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 const googleKey=process.env.GOOGLE_PLACES_API_KEY?.trim();
 if(!url||!serviceKey||!googleKey)throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY Secrets are required.');
 const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const worker=createHoursSyncWorker(db,googleKey);
 const total:Record<string,number>={};let incomplete=false;
 console.log(`Google business hours: ${newYorkSchedule(new Date()).day} · America/New_York · direct GitHub runner`);
 // No Vercel endpoint calls. Database and Google requests execute on this runner.
 for(let shard=0;shard<8;shard++){
  const result=await worker.syncHoursShard(shard);
  for(const [key,count] of Object.entries(result.counts))total[key]=(total[key]||0)+count;
  incomplete ||= result.incomplete;
  console.log(`Group ${shard}: ${JSON.stringify(result)}`);
 }
 console.log(`Total: ${JSON.stringify(total)}`);
 if(incomplete||(total.error_preserved||0)>0)throw new Error('Some businesses could not be synchronized. Existing hours were preserved. Review results and retry if needed.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Google hours sync failed');process.exitCode=1;});
