import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase server environment variables are missing.",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function requireAccess(
  request: Request,
  businessId: number,
) {
  const auth =
    request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7).trim()
    : "";

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      error: "로그인이 필요합니다.",
    };
  }

  const supabase = adminClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: "로그인 세션이 올바르지 않습니다.",
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) throw profileError;

  if (
    String(profile?.role || "").toLowerCase() ===
    "admin"
  ) {
    return { ok: true as const, supabase, isAdmin: true };
  }

  const { data: owner, error: ownerError } =
    await supabase
      .from("business_owners")
      .select("business_id,status")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

  if (ownerError) throw ownerError;

  // Existing KTown owner records may have approved/active status.
  const status = String(
    owner?.status || "",
  ).toLowerCase();

  if (
    !owner ||
    !["approved", "active"].includes(status)
  ) {
    return {
      ok: false as const,
      status: 403,
      error:
        "이 비즈니스를 관리할 권한이 없습니다.",
    };
  }

  return { ok: true as const, supabase, isAdmin: false };
}


type Context = { params: Promise<{id:string}> };
// Initial setup: credentials are stored as JSON text in a server-only table.
// The column name is retained for compatibility with the initial migration.
// No RESTAURANT_INTEGRATION_KEY is required. Values are never returned by GET.
function serializeCredentials(value: Record<string,string>) {
 return JSON.stringify(value);
}
function readCredentials(value:string): Record<string,string> {
 try {
  const parsed=JSON.parse(value);
  if(parsed && typeof parsed==='object' && !Array.isArray(parsed)) {
   const clean:Record<string,string>={};
   for(const [key,item] of Object.entries(parsed)) if(typeof item==='string') clean[key]=item;
   return clean;
  }
 } catch { /* Earlier encrypted values require re-entry; do not reuse ciphertext. */ }
 return {};
}
async function handle(request:Request,context:Context) {
 try {
 const {id}=await context.params, businessId=Number(id);
 if(!Number.isSafeInteger(businessId)||businessId<1) return NextResponse.json({error:'Invalid business ID'},{status:400});
 const access=await requireAccess(request,businessId);
 if(!access.ok) return NextResponse.json({error:access.error},{status:access.status});
 const db=access.supabase;
 if(request.method==='GET') {
 const s=await db.from('restaurant_integration_services').select('*').order('name');if(s.error) throw s.error;
 const c=await db.from('restaurant_integration_connections').select('kind,service_id,updated_at').eq('business_id',businessId);if(c.error) throw c.error;
 return NextResponse.json({isAdmin:access.isAdmin,services:(s.data||[]).filter(s=>access.isAdmin||s.enabled),connections:c.data||[]},{headers:{'Cache-Control':'no-store'}});
 }
 const body=await request.json();
 if(body.action==='saveService'||body.action==='deleteService') {
 if(!access.isAdmin) return NextResponse.json({error:'Administrator only'},{status:403});
 if(body.action==='deleteService') {
 const r=await db.from('restaurant_integration_services').delete().eq('id',body.id);if(r.error) return NextResponse.json({error:'사용 중인 서비스는 삭제할 수 없습니다. 먼저 연결을 해제하세요.'},{status:409});
 } else {
 const {kind,code,name,fields,enabled}=body;
 if(!['payment','pos'].includes(kind)||! /^[a-z][a-z0-9_]{1,49}$/.test(code)||typeof name!=='string'||!name.trim()||name.length>100||!Array.isArray(fields)||fields.length>20) throw new Error('서비스 이름, 코드, 입력 항목을 확인하세요.');
 const keys=new Set<string>();
 for(const f of fields) {if(!f||typeof f.key!=='string'||! /^[a-z][a-z0-9_]{0,49}$/.test(f.key)||keys.has(f.key)||typeof f.label!=='string'||!f.label.trim()||f.label.length>100) throw new Error('입력 항목은 중복 없는 영문 키와 표시 이름이 필요합니다.');keys.add(f.key);}
 const value={kind,code,name:name.trim(),fields:fields.map((f:any)=>({key:f.key,label:f.label})),enabled:enabled!==false};
 if(body.id) {
 const old=await db.from('restaurant_integration_services').select('kind,code').eq('id',body.id).single();if(old.error) throw old.error;
 if(old.data.kind!==kind||old.data.code!==code) throw new Error('등록 후 서비스 종류와 코드는 변경할 수 없습니다.');
 const r=await db.from('restaurant_integration_services').update(value).eq('id',body.id);if(r.error) throw r.error;
 } else {const r=await db.from('restaurant_integration_services').insert(value);if(r.error) throw r.error;}
 }
 } else if(body.action==='disconnect') {
 if(!['payment','pos'].includes(body.kind)) throw new Error('Invalid kind');
 const r=await db.from('restaurant_integration_connections').delete().eq('business_id',businessId).eq('kind',body.kind);if(r.error) throw r.error;
 } else if(body.action==='connect') {
 const s=await db.from('restaurant_integration_services').select('*').eq('id',body.serviceId).eq('enabled',true).single();if(s.error||!s.data) throw new Error('사용 가능한 서비스를 선택하세요.');
 const service=s.data;
 const previous=await db.from('restaurant_integration_connections').select('*').eq('business_id',businessId).eq('kind',service.kind).maybeSingle();if(previous.error) throw previous.error;
 const old=previous.data?.service_id===service.id ? readCredentials(previous.data.credentials_encrypted):{};
 const values:Record<string,string>={};
 for(const f of service.fields) {
 const incoming=body.values?.[f.key];
 if(incoming!==undefined&&typeof incoming!=='string') throw new Error('Invalid credential');
 const v=typeof incoming==='string'&&incoming.trim()?incoming.trim():old[f.key];
 if(!v||v.length>10000) throw new Error(`${f.label} 값을 입력하세요.`);values[f.key]=v;
 }
 const r=await db.from('restaurant_integration_connections').upsert({business_id:businessId,kind:service.kind,service_id:service.id,credentials_encrypted:serializeCredentials(values),updated_at:new Date().toISOString()},{onConflict:'business_id,kind'});if(r.error) throw r.error;
 } else return NextResponse.json({error:'Invalid action'},{status:400});
 return NextResponse.json({ok:true});
 } catch(error) {console.error('[integration settings]',error instanceof Error?error.name:'DatabaseError');return NextResponse.json({error:error instanceof Error?error.message:'저장 실패. DB 설정과 서버 환경 변수를 확인하세요.'},{status:400});}
}
export const GET=handle;
export const POST=handle;
