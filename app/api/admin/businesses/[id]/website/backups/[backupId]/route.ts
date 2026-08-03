import { NextRequest, NextResponse } from "next/server";

import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
    backupId: string;
  }>;
};

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function sanitizeCurrentBackup(
  value: unknown,
  businessId: number,
) {
  if (!isPlainObject(value)) {
    throw new Error("복원 전 현재 백업 데이터가 없습니다.");
  }

  const requestId = safeText(value.request_id, 100);
  const backupName = safeText(value.backup_name, 300);
  const backedUpAt = new Date(
    safeText(value.backed_up_at, 100),
  );

  if (!requestId || !backupName) {
    throw new Error(
      "복원 전 안전백업의 요청 ID 또는 이름이 없습니다.",
    );
  }

  if (Number.isNaN(backedUpAt.getTime())) {
    throw new Error(
      "복원 전 안전백업 날짜가 올바르지 않습니다.",
    );
  }

  const businessData = isPlainObject(value.business)
    ? value.business
    : {};

  if (Number(businessData.id) !== businessId) {
    throw new Error(
      "복원 전 안전백업의 business ID가 일치하지 않습니다.",
    );
  }

  const sectionsData = Array.isArray(value.sections)
    ? value.sections
    : [];

  if (sectionsData.length > 300) {
    throw new Error(
      "복원 전 안전백업 레이어가 300개를 초과했습니다.",
    );
  }

  return {
    requestId,
    backupName,
    backedUpAt,
    businessData,
    sectionsData,
  };
}

function buildBusinessRestorePatch(value: unknown) {
  const source = isPlainObject(value) ? value : {};

  const status = safeText(source.website_status, 50);
  const allowedStatus = [
    "draft",
    "published",
    "disabled",
  ].includes(status)
    ? status
    : "draft";

  return {
    website_enabled: source.website_enabled === true,
    website_slug:
      safeText(source.website_slug, 200) || null,
    website_status: allowedStatus,
    website_settings: isPlainObject(source.website_settings)
      ? source.website_settings
      : {},
    custom_domain:
      safeText(source.custom_domain, 300) || null,
    website_published_at:
      allowedStatus === "published"
        ? new Date().toISOString()
        : null,
  };
}

function buildSectionRows(
  value: unknown,
  businessId: number,
) {
  if (!Array.isArray(value)) return [];

  if (value.length > 300) {
    throw new Error(
      "복원 대상 레이어가 300개를 초과했습니다.",
    );
  }

  return value.map((rawSection, index) => {
    const section = isPlainObject(rawSection)
      ? rawSection
      : {};

    return {
      business_id: businessId,
      section_type:
        safeText(section.section_type, 100) || "section",
      title: safeText(section.title, 500) || null,
      content: isPlainObject(section.content)
        ? section.content
        : {},
      settings: isPlainObject(section.settings)
        ? section.settings
        : {},
      sort_order: Number.isFinite(Number(section.sort_order))
        ? Number(section.sort_order)
        : index,
      is_visible: section.is_visible !== false,
    };
  });
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { id, backupId } = await context.params;
  const businessId = Number(id);
  const numericBackupId = Number(backupId);

  if (
    !Number.isInteger(businessId) ||
    businessId <= 0 ||
    !Number.isInteger(numericBackupId) ||
    numericBackupId <= 0
  ) {
    return json({ error: "잘못된 요청입니다." }, 400);
  }

  const access = await requireBusinessApiAccess(businessId);
  if (!access.ok) return access.response;

  const { data, error } = await supabaseAdmin
    .from("business_website_backups")
    .select(
      "id,backup_name,backed_up_at,backup_reason,created_by,payload_bytes,business_data,sections_data",
    )
    .eq("id", numericBackupId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    return json(
      { error: `백업 내용 조회 실패: ${error.message}` },
      500,
    );
  }

  if (!data) {
    return json(
      { error: "선택한 백업을 찾을 수 없습니다." },
      404,
    );
  }

  return json({
    backup: {
      ...data,
      section_count: Array.isArray(data.sections_data)
        ? data.sections_data.length
        : 0,
    },
  });
}

/**
 * 복원은 관리자만 실행할 수 있습니다.
 * 승인된 오너는 백업 생성 및 확인은 가능하지만 서버 덮어쓰기는 불가합니다.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { id, backupId } = await context.params;
  const businessId = Number(id);
  const numericBackupId = Number(backupId);

  if (
    !Number.isInteger(businessId) ||
    businessId <= 0 ||
    !Number.isInteger(numericBackupId) ||
    numericBackupId <= 0
  ) {
    return json({ error: "잘못된 요청입니다." }, 400);
  }

  const access = await requireBusinessApiAccess(businessId);
  if (!access.ok) return access.response;

  if (!access.isAdmin) {
    return json(
      { error: "백업 복원은 관리자만 실행할 수 있습니다." },
      403,
    );
  }

  try {
    const body = await request.json();
    const currentBackup = sanitizeCurrentBackup(
      body?.current_backup,
      businessId,
    );

    const { data: targetBackup, error: targetError } =
      await supabaseAdmin
        .from("business_website_backups")
        .select(
          "id,business_data,sections_data",
        )
        .eq("id", numericBackupId)
        .eq("business_id", businessId)
        .maybeSingle();

    if (targetError) {
      throw new Error(
        `복원 대상 조회 실패: ${targetError.message}`,
      );
    }

    if (!targetBackup) {
      return json(
        { error: "복원할 백업을 찾을 수 없습니다." },
        404,
      );
    }

    /*
     * 1. 현재 브라우저 상태를 먼저 안전백업합니다.
     * 이 단계가 실패하면 실제 복원을 시작하지 않습니다.
     */
    const { data: undoBackup, error: undoError } =
      await supabaseAdmin
        .from("business_website_backups")
        .insert({
          request_id: currentBackup.requestId,
          business_id: businessId,
          backup_name: currentBackup.backupName,
          backed_up_at:
            currentBackup.backedUpAt.toISOString(),
          backup_reason: "before-restore",
          business_data: currentBackup.businessData,
          sections_data: currentBackup.sectionsData,
          created_by: access.userId,
        })
        .select("id")
        .single();

    if (undoError || !undoBackup) {
      throw new Error(
        `복원 전 안전백업 실패: ${
          undoError?.message ||
          "안전백업 ID가 반환되지 않았습니다."
        }`,
      );
    }

    const businessPatch = buildBusinessRestorePatch(
      targetBackup.business_data,
    );
    const sectionRows = buildSectionRows(
      targetBackup.sections_data,
      businessId,
    );

    /*
     * 2. 웹사이트 전용 businesses 컬럼만 복원합니다.
     * 이름, 주소, 영업시간, 일반 이미지 등 비즈니스 원본 정보는 덮어쓰지 않습니다.
     */
    const { error: businessError } = await supabaseAdmin
      .from("businesses")
      .update(businessPatch)
      .eq("id", businessId);

    if (businessError) {
      throw new Error(
        `웹사이트 설정 복원 실패: ${businessError.message}`,
      );
    }

    /*
     * 3. 기존 레이어를 제거하고 백업 레이어를 한 번에 INSERT합니다.
     * 오래된 레이어 ID는 재사용하지 않아 충돌을 막습니다.
     */
    const { error: deleteError } = await supabaseAdmin
      .from("business_sections")
      .delete()
      .eq("business_id", businessId);

    if (deleteError) {
      throw new Error(
        `기존 레이어 정리 실패: ${deleteError.message}`,
      );
    }

    if (sectionRows.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("business_sections")
        .insert(sectionRows);

      if (insertError) {
        throw new Error(
          `백업 레이어 복원 실패: ${insertError.message}`,
        );
      }
    }

    return json({
      ok: true,
      restored_backup_id: numericBackupId,
      undo_backup_id: undoBackup.id,
      restored_sections: sectionRows.length,
    });
  } catch (error) {
    console.error("Website backup restore failed:", error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "백업 복원에 실패했습니다.",
      },
      500,
    );
  }
}
