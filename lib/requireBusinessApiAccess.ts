import "server-only";

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

type AccessSuccess = {
  ok: true;
  userId: string;
  businessId: number;
  isAdmin: boolean;
};

type AccessFailure = {
  ok: false;
  response: NextResponse;
};

export type BusinessApiAccess = AccessSuccess | AccessFailure;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}

/**
 * API Route 전용 권한 검사입니다.
 *
 * - admin: 모든 비즈니스 허용
 * - owner: business_owners.status = approved인 자기 비즈니스만 허용
 * - 로그인 안 됨: 401
 * - 권한 없음: 403
 *
 * Service Role 키는 이후 DB/Storage 작업에만 사용하고,
 * 사용자 인증은 반드시 브라우저의 Supabase 로그인 쿠키로 확인합니다.
 */
export async function requireBusinessApiAccess(
  businessId: number,
): Promise<BusinessApiAccess> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: jsonError("로그인이 필요합니다.", 401),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profileError) {
    console.error("Failed to load API access profile:", profileError);
    return {
      ok: false,
      response: jsonError("사용자 권한을 확인하지 못했습니다.", 500),
    };
  }

  if (profile?.role === "admin") {
    return {
      ok: true,
      userId: user.id,
      businessId,
      isAdmin: true,
    };
  }

  if (profile?.role !== "owner") {
    return {
      ok: false,
      response: jsonError("이 작업을 수행할 권한이 없습니다.", 403),
    };
  }

  const { data: ownerLink, error: ownerError } = await supabase
    .from("business_owners")
    .select("business_id,status")
    .eq("user_id", user.id)
    .eq("business_id", businessId)
    .eq("status", "approved")
    .maybeSingle<{ business_id: number; status: string | null }>();

  if (ownerError) {
    console.error("Failed to verify business owner API access:", ownerError);
    return {
      ok: false,
      response: jsonError("비즈니스 권한을 확인하지 못했습니다.", 500),
    };
  }

  if (!ownerLink) {
    return {
      ok: false,
      response: jsonError("승인된 비즈니스 오너만 사용할 수 있습니다.", 403),
    };
  }

  return {
    ok: true,
    userId: user.id,
    businessId,
    isAdmin: false,
  };
}
