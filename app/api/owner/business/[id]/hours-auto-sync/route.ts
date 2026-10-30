import {NextResponse} from 'next/server';
import {requireBusinessApiAccess} from '@/lib/requireBusinessApiAccess';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
import {syncBusinessHours} from '@/lib/google-hours-sync/worker';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
type Context={params:Promise<{id:string}>};
const headers={'Cache-Control':'no-store'};
async function access(context:Context){const {id}=await context.params;const businessId=Number(id);if(!Number.isSafeInteger(businessId)||businessId<=0)return {response:NextResponse.json({error:'Invalid ID'},{status:400})};const auth=await requireBusinessApiAccess(businessId);return auth.ok?{businessId}:{response:auth.response};}
export async function PATCH(request:Request,context:Context){
 const checked=await access(context);if(checked.response)return checked.response;
 try{const body=await request.json();if(typeof body.enabled!=='boolean')return NextResponse.json({error:'Invalid setting'},{status:400});
 const result=await supabaseAdmin.from('businesses').update({google_hours_auto_enabled:body.enabled}).eq('id',checked.businessId!).select('google_hours_auto_enabled').single();
 if(result.error)throw result.error;return NextResponse.json({ok:true,enabled:result.data.google_hours_auto_enabled},{headers});
 }catch{return NextResponse.json({error:'설정 저장 실패. 자동 영업시간 SQL 설치와 접근 권한을 확인하세요.'},{status:500,headers});}
}
export async function POST(_request:Request,context:Context){
 const checked=await access(context);if(checked.response)return checked.response;
 try{const result=await syncBusinessHours(checked.businessId!,true);return NextResponse.json({ok:true,result},{headers});}
 catch{return NextResponse.json({error:'동기화 실패. SQL과 Google API 설정을 확인하세요. 기존 시간은 유지됩니다.'},{status:500,headers});}
}
