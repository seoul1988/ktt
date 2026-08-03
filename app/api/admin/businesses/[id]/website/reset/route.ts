import { NextRequest, NextResponse } from "next/server";

import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function noStoreHeaders() {
  return {
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders(),
  });
}

function parseBusinessId(value: string) {
  const businessId = Number(value);
  return Number.isInteger(businessId) && businessId > 0
    ? businessId
    : null;
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  const { id: rawId } = await context.params;
  const businessId = parseBusinessId(rawId);

  if (!businessId) {
    return jsonResponse({ error: "잘못된 business id입니다." }, 400);
  }

  const access = await requireBusinessApiAccess(businessId);
  if (!access.ok) return access.response;

  try {
    const body = await request.json().catch(() => ({}));
    const confirmation = String(body?.confirmation || "").trim();

    if (confirmation !== String(businessId)) {
      return jsonResponse(
        {
          error: "초기화 확인 번호가 일치하지 않습니다.",
          code: "RESET_CONFIRMATION_MISMATCH",
        },
        400,
      );
    }

    const { error: sectionsError } = await supabaseAdmin
      .from("business_sections")
      .delete()
      .eq("business_id", businessId);

    if (sectionsError) {
      return jsonResponse(
        {
          error: `웹사이트 레이어 삭제 실패: ${sectionsError.message}`,
          code: sectionsError.code,
        },
        500,
      );
    }

    const { error: backupsError } = await supabaseAdmin
      .from("business_website_backups")
      .delete()
      .eq("business_id", businessId);

    if (backupsError) {
      return jsonResponse(
        {
          error: `백업 히스토리 삭제 실패: ${backupsError.message}`,
          code: backupsError.code,
        },
        500,
      );
    }

    const { error: businessError } = await supabaseAdmin
      .from("businesses")
      .update({
        website_settings: {},
        website_enabled: false,
        website_status: "draft",
      })
      .eq("id", businessId);

    if (businessError) {
      return jsonResponse(
        {
          error: `웹사이트 설정 초기화 실패: ${businessError.message}`,
          code: businessError.code,
        },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      business_id: businessId,
      message:
        "웹사이트 레이어, 디자인 설정과 백업 히스토리를 모두 삭제했습니다.",
    });
  } catch (error) {
    console.error("Website full reset failed:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "웹사이트 초기화 중 알 수 없는 오류가 발생했습니다.",
      },
      500,
    );
  }
}
