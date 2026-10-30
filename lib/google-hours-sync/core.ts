import type {SupabaseClient} from '@supabase/supabase-js';
import {googlePeriodsToHours,newYorkSchedule} from './convert';
type Claim={id:number;current_hours:string|null;manual_hours:string|null;place_id:string|null;claim_token:string};
export function createHoursSyncWorker(supabaseAdmin:SupabaseClient,googleKey:string){
async function syncBusinessHours(id:number,force=false){
 const day=newYorkSchedule(new Date()).day;
 const claimed=await supabaseAdmin.rpc('claim_google_hours',{p_id:id,p_day:day,p_force:force});
 if(claimed.error)throw new Error(`동기화 준비 실패: ${claimed.error.message}`);
 const row=(claimed.data as Claim[]|null)?.[0];if(!row)return 'not_due';
 let next:string|null=null,source='google',result='preserved',error:string|null=null;
 try{
  if(!row.place_id){result='missing_place_id';error='Google 영업시간 가져오기로 매장을 최초 한 번 연결하세요. 기존 시간은 유지됩니다.';}
  else {
   const key=googleKey.trim();if(!key)throw new Error('서버 GOOGLE_PLACES_API_KEY 설정이 필요합니다.');
   const response=await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(row.place_id)}`,{cache:'no-store',signal:AbortSignal.timeout(10000),headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':'regularOpeningHours'}});
   if(!response.ok)throw new Error(`Google 조회 실패 (HTTP ${response.status}). 기존 시간을 유지합니다.`);
   const data=await response.json();
   next=googlePeriodsToHours(data.regularOpeningHours?.periods);
   if(next!==null)result='google_updated';
   else if(row.manual_hours?.trim()){next=row.manual_hours;source='manual_fallback';result='manual_fallback';}
   else result='no_google_hours';
  }
 }catch(err){next=null;result='error_preserved';error=err instanceof Error?err.message:'Google 조회 실패. 기존 시간을 유지합니다.';}
 const finished=await supabaseAdmin.rpc('finish_google_hours',{p_id:row.id,p_token:row.claim_token,p_expected:row.current_hours,p_hours:next,p_source:source,p_result:result,p_error:error});
 if(finished.error)throw new Error(`동기화 결과 저장 실패: ${finished.error.message}`);
 return String(finished.data);
}
async function syncHoursShard(shard:number){
 const start=Date.now(),counts:Record<string,number>={};let incomplete=false;
 while(Date.now()-start<220000){
  const ids=await supabaseAdmin.rpc('google_hours_due_ids',{p_shard:shard,p_day:newYorkSchedule(new Date()).day,p_limit:12});
  if(ids.error)throw new Error(`자동 동기화 SQL 설치를 확인하세요: ${ids.error.message}`);
  const rows=(ids.data||[]) as Array<{id:number}>;
  if(!rows.length)return {counts,incomplete:false};
  for(let index=0;index<rows.length;index+=3){
   if(Date.now()-start>=220000){incomplete=true;break;}
   const results=await Promise.allSettled(rows.slice(index,index+3).map(row=>syncBusinessHours(row.id)));
   for(const result of results){const key=result.status==='fulfilled'?result.value:'database_error';counts[key]=(counts[key]||0)+1;}
   if(results.some(result=>result.status==='rejected'))throw new Error('일부 동기화 결과를 저장하지 못했습니다. 서버 DB 상태를 확인하세요.');
  }
  if(incomplete)break;
 }
 return {counts,incomplete:true};
}

return {syncBusinessHours,syncHoursShard};
}
