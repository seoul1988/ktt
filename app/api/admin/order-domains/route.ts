import {normalizeBrandCode} from "@/lib/restaurant-brand/brand";
import { NextResponse } from "next/server";
import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { domainKind, normalizeOrderHostname, orderRootDomain } from "@/lib/order-domains/hostname";
import { domainServiceConfigured, inspectOrderDomain } from "@/lib/order-domains/vercel";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"no-store"};
async function authorize() {
  const access = await requireBusinessApiAccess(1);
  if (!access.ok) return access.response;
  if (!access.isAdmin) return NextResponse.json({error:"관리자만 사용할 수 있습니다."},{status:403,headers});
  return null;
}
function failed(error: unknown, status = 400) { return NextResponse.json({error: error instanceof Error ? error.message : "요청을 처리하지 못했습니다."},{status,headers}); }
export async function GET(request: Request) {
  const denied = await authorize(); if (denied) return denied;
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") || "").trim().slice(0,80);
    const page = Math.max(0, Number(url.searchParams.get("page")) || 0);
    if (url.searchParams.get("search") === "business") {
      let query = supabaseAdmin.from("businesses").select("id,name").order("name").limit(30);
      if (/^\d+$/.test(q)) query = query.eq("id", Number(q));
      else if (q) query = query.ilike("name", `%${q.replace(/[%_,()]/g, "")}%`);
      const result = await query;
      if (result.error) throw new Error(result.error.message);
      return NextResponse.json({businesses:result.data || []},{headers});
    }
    let query = supabaseAdmin.from("restaurant_order_domains").select("*,businesses(name)",{count:"exact"}).order("created_at",{ascending:false}).range(page*40,page*40+39);
    if(q) query = query.ilike("hostname",`%${q.replace(/[%_,()]/g, "")}%`);
    const result = await query;
    if (result.error) throw new Error("도메인 테이블을 읽지 못했습니다. order-domains.sql 설치 여부를 확인하세요.");
    return NextResponse.json({domains:result.data || [],total:result.count || 0,configured:domainServiceConfigured(),rootDomain:orderRootDomain()},{headers});
  } catch(error) {return failed(error,503);}
}
export async function POST(request: Request) {
  const denied = await authorize(); if (denied) return denied;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return failed(new Error("잘못된 요청 출처입니다."),403);
  try {
    const body = await request.json();
    const host = normalizeOrderHostname(body.hostname);
    const kind = domainKind(host,orderRootDomain());
    const existing = await supabaseAdmin.from("restaurant_order_domains").select("*").eq("hostname",host).maybeSingle();
    if(existing.error) throw new Error("order-domains.sql을 먼저 설치하세요.");
    if(body.action === "register") {
      const brandCode = normalizeBrandCode(body.brandCode);
      const businessId = brandCode ? null : Number(body.businessId);
      if (brandCode) {
        const brand = await supabaseAdmin.from("businesses").select("id").eq("brand_code",brandCode).or("hidden.is.null,hidden.eq.false").limit(1);
        if(brand.error || !brand.data?.length) throw new Error("해당 브랜드 코드로 등록된 공개 매장이 없습니다. 비즈니스 등록·수정에서 브랜드 코드를 먼저 저장하세요.");
      } else {
        if(!Number.isSafeInteger(businessId)||!businessId||businessId<=0) throw new Error("식당을 선택하세요.");
        const business=await supabaseAdmin.from("businesses").select("id").eq("id",businessId).maybeSingle();
        if(business.error||!business.data) throw new Error("식당을 찾을 수 없습니다.");
      }
      if(existing.data && (existing.data.business_id !== businessId || (existing.data.brand_code || "") !== brandCode)) return failed(new Error("이미 다른 매장 또는 브랜드에 등록된 주소입니다. 기존 연결을 변경하려면 별도 관리가 필요합니다."),409);
      const website=await supabaseAdmin.from("businesses").select("id").in("custom_domain",[host,host.replace(/^www\./,""),`www.${host}`]).limit(1);
      if(website.error) throw new Error("기존 홈페이지 도메인을 확인하지 못했습니다.");
      if(website.data?.length) throw new Error("기존 홈페이지에 사용하는 주소입니다. order. 등 별도 주문 주소를 입력하세요.");
      if(!existing.data) {
        const inserted=await supabaseAdmin.from("restaurant_order_domains").insert({hostname:host,business_id:businessId,brand_code:brandCode || null,kind});
        if(inserted.error) return failed(new Error("주소 등록이 충돌했습니다. 목록을 새로고침하세요."),409);
      }
    } else if (!existing.data) return failed(new Error("등록되지 않은 주소입니다."),404);
    if(body.action === "toggle") {
      if(typeof body.enabled !== "boolean") throw new Error("잘못된 활성 상태입니다.");
      const result=await supabaseAdmin.from("restaurant_order_domains").update({enabled:body.enabled}).eq("hostname",host);
      if(result.error) throw new Error(result.error.message);
      return NextResponse.json({success:true},{headers});
    }
    if(!["register","check"].includes(body.action)) throw new Error("잘못된 작업입니다.");
    try {
      const inspection=await inspectOrderDomain(host,kind,orderRootDomain(),body.action === "register");
      const updated=await supabaseAdmin.from("restaurant_order_domains").update({status:inspection.verified?"verified":"pending",dns_records:inspection.dns,last_error:null,checked_at:new Date().toISOString()}).eq("hostname",host);
      if(updated.error) throw new Error(updated.error.message);
      return NextResponse.json({success:true,...inspection},{headers});
    } catch(error) {
      await supabaseAdmin.from("restaurant_order_domains").update({status:existing.data?.status === "verified" ? "verified" : "error",last_error:error instanceof Error?error.message:"연결 확인 실패",checked_at:new Date().toISOString()}).eq("hostname",host);
      return failed(error,502);
    }
  } catch(error) {return failed(error);}
}
