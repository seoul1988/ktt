import "server-only";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

type AccessSuccess = {
  ok: true;
  userId: string | null;
  businessId: number;
  isAdmin: boolean;
  isOwner: boolean;
  authSource: "admin-cookie" | "supabase-profile" | "business-owner";
};

type AccessFailure = {
  ok: false;
  response: NextResponse;
};

export type BusinessApiAccessResult =
  | AccessSuccess
  | AccessFailure;

type ProfileRow = {
  role: string | null;
};

type OwnerRow = {
  business_id: number;
  user_id: string;
  status: string | null;
};

function errorResponse(
  error: string,
  status: number,
  extra: Record<string, unknown> = {},
): AccessFailure {
  return {
    ok: false,
    response: NextResponse.json(
      {
        ok: false,
        error,
        ...extra,
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    ),
  };
}

function normalizeRole(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isAdministratorRole(value: unknown) {
  const role = normalizeRole(value);

  return (
    role === "admin" ||
    role === "administrator" ||
    role === "super_admin" ||
    role === "superadmin"
  );
}

/**
 * Website Builder API 공통 접근 검사
 *
 * 허용 순서:
 * 1. 기존 관리자 메뉴 로그인 쿠키(ktt_admin)
 * 2. Supabase 로그인 사용자의 profiles.role 관리자 권한
 * 3. 해당 업체의 approved 오너
 *
 * 주의:
 * ktt_admin 쿠키는 관리자 로그인 API에서 HttpOnly/Secure/SameSite로
 * 안전하게 발급되고 있다는 현재 프로젝트 구조를 기준으로 사용합니다.
 */
export async function requireBusinessApiAccess(
  businessId: number,
): Promise<BusinessApiAccessResult> {
  if (!Number.isInteger(businessId) || businessId <= 0) {
    return errorResponse("잘못된 business id입니다.", 400, {
      code: "INVALID_BUSINESS_ID",
    });
  }

  /*
   * 기존 관리자 메뉴는 ktt_admin 쿠키로 관리자 여부를 판정합니다.
   * Website Builder API에서도 같은 쿠키를 먼저 확인해야
   * 관리자 메뉴 로그인 상태가 그대로 인정됩니다.
   */
  const cookieStore = await cookies();
  const adminCookieRole = cookieStore.get("ktt_admin")?.value || "";

  if (isAdministratorRole(adminCookieRole)) {
    return {
      ok: true,
      userId: null,
      businessId,
      isAdmin: true,
      isOwner: false,
      authSource: "admin-cookie",
    };
  }

  /*
   * ktt_admin 쿠키가 없으면 일반 Supabase 로그인/오너 권한을 확인합니다.
   */
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("Business API auth lookup failed:", userError);

    return errorResponse(
      "로그인 상태를 확인하지 못했습니다.",
      401,
      { code: "AUTH_LOOKUP_FAILED" },
    );
  }

  if (!user) {
    return errorResponse(
      "로그인이 필요합니다.",
      401,
      { code: "LOGIN_REQUIRED" },
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    console.error("Business API profile lookup failed:", profileError);

    return errorResponse(
      "관리자 권한 정보를 확인하지 못했습니다.",
      500,
      { code: "PROFILE_LOOKUP_FAILED" },
    );
  }

  if (isAdministratorRole(profile?.role)) {
    return {
      ok: true,
      userId: user.id,
      businessId,
      isAdmin: true,
      isOwner: false,
      authSource: "supabase-profile",
    };
  }

  const {
    data: ownerLink,
    error: ownerError,
  } = await supabase
    .from("business_owners")
    .select("business_id,user_id,status")
    .eq("business_id", businessId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle<OwnerRow>();

  if (ownerError) {
    console.error("Business API owner lookup failed:", ownerError);

    return errorResponse(
      "비즈니스 권한을 확인하지 못했습니다.",
      500,
      { code: "OWNER_LOOKUP_FAILED" },
    );
  }

  if (!ownerLink) {
    return errorResponse(
      "이 비즈니스를 관리할 권한이 없습니다.",
      403,
      { code: "BUSINESS_ACCESS_DENIED" },
    );
  }

  return {
    ok: true,
    userId: user.id,
    businessId,
    isAdmin: false,
    isOwner: true,
    authSource: "business-owner",
  };
}
