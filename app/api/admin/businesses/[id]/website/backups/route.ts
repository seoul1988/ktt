import { NextRequest, NextResponse } from "next/server";

import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type BackupReason =
  | "editor-entry-browser-prepared"
  | "before-restore"
  | "manual";

type BackupRequest = {
  request_id?: unknown;
  backup_name?: unknown;
  backed_up_at?: unknown;
  backup_reason?: unknown;
  business?: unknown;
  sections?: unknown;
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

function normalizeReason(value: unknown): BackupReason {
  return value === "before-restore" || value === "manual"
    ? value
    : "editor-entry-browser-prepared";
}

function sanitizeBusiness(
  value: unknown,
  businessId: number,
) {
  const source = isPlainObject(value) ? value : {};

  if (Number(source.id) !== businessId) {
    throw new Error(
      "백업 business ID가 요청 주소와 일치하지 않습니다.",
    );
  }

  return {
    id: businessId,
    name: safeText(source.name, 300) || null,
    image_url: safeText(source.image_url, 3000) || null,
    image_urls: Array.isArray(source.image_urls)
      ? source.image_urls
          .map((item) => safeText(item, 3000))
          .filter((item) => /^https?:\/\//i.test(item))
          .slice(0, 100)
      : [],
    logo_url: safeText(source.logo_url, 3000) || null,
    hours: source.hours ?? null,
    website_enabled: source.website_enabled === true,
    website_slug: safeText(source.website_slug, 200) || null,
    website_status: safeText(source.website_status, 50) || null,
    website_settings: isPlainObject(source.website_settings)
      ? source.website_settings
      : {},
    custom_domain: safeText(source.custom_domain, 300) || null,
  };
}

function sanitizeSections(
  value: unknown,
  businessId: number,
) {
  if (!Array.isArray(value)) return [];

  if (value.length > 300) {
    throw new Error("백업할 레이어가 300개를 초과했습니다.");
  }

  return value.map((rawSection, index) => {
    const section = isPlainObject(rawSection)
      ? rawSection
      : {};

    if (Number(section.business_id) !== businessId) {
      throw new Error(
        `${index + 1}번째 레이어의 business ID가 일치하지 않습니다.`,
      );
    }

    return {
      id: Number.isInteger(Number(section.id))
        ? Number(section.id)
        : 0,
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
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return json({ error: "잘못된 business ID입니다." }, 400);
  }

  const access = await requireBusinessApiAccess(businessId);
  if (!access.ok) return access.response;

  const requestedLimit = Number(
    request.nextUrl.searchParams.get("limit") || 50,
  );
  const limit = Math.max(
    1,
    Math.min(100, Number.isFinite(requestedLimit) ? requestedLimit : 50),
  );

  const { data, error } = await supabaseAdmin
    .from("business_website_backups")
    .select(
      "id,backup_name,backed_up_at,backup_reason,created_by,payload_bytes,sections_data",
    )
    .eq("business_id", businessId)
    .order("backed_up_at", { ascending: false })
    .limit(limit);

  if (error) {
    return json(
      { error: `백업 목록 조회 실패: ${error.message}` },
      500,
    );
  }

  return json({
    backups: (data ?? []).map((row) => ({
      id: row.id,
      backup_name: row.backup_name,
      backed_up_at: row.backed_up_at,
      backup_reason: row.backup_reason,
      created_by: row.created_by,
      payload_bytes: row.payload_bytes,
      section_count: Array.isArray(row.sections_data)
        ? row.sections_data.length
        : 0,
    })),
  });
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return json({ error: "잘못된 business ID입니다." }, 400);
  }

  const access = await requireBusinessApiAccess(businessId);
  if (!access.ok) return access.response;

  try {
    const contentLength = Number(
      request.headers.get("content-length") || 0,
    );

    if (contentLength > 8 * 1024 * 1024) {
      return json(
        { error: "백업 데이터는 8MB 이하여야 합니다." },
        413,
      );
    }

    const body = (await request.json()) as BackupRequest;
    const requestId = safeText(body.request_id, 100);
    const backupName = safeText(body.backup_name, 300);
    const backedUpAt = new Date(
      safeText(body.backed_up_at, 100),
    );

    if (!requestId || !backupName) {
      return json(
        { error: "백업 요청 ID 또는 백업 이름이 없습니다." },
        400,
      );
    }

    if (Number.isNaN(backedUpAt.getTime())) {
      return json(
        { error: "백업 날짜가 올바르지 않습니다." },
        400,
      );
    }

    const businessData = sanitizeBusiness(
      body.business,
      businessId,
    );
    const sectionsData = sanitizeSections(
      body.sections,
      businessId,
    );

    const { data: inserted, error: insertError } =
      await supabaseAdmin
        .from("business_website_backups")
        .insert({
          request_id: requestId,
          business_id: businessId,
          backup_name: backupName,
          backed_up_at: backedUpAt.toISOString(),
          backup_reason: normalizeReason(body.backup_reason),
          business_data: businessData,
          sections_data: sectionsData,
          created_by: access.userId,
          payload_bytes: contentLength || null,
        })
        .select("id,backup_name,backed_up_at")
        .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return json({
          ok: true,
          duplicated: true,
          backup_name: backupName,
          backed_up_at: backedUpAt.toISOString(),
        });
      }

      throw new Error(
        `서버 백업 저장 실패: ${insertError.message}`,
      );
    }

    return json({
      ok: true,
      duplicated: false,
      backup_id: inserted.id,
      backup_name: inserted.backup_name,
      backed_up_at: inserted.backed_up_at,
    });
  } catch (error) {
    console.error("Website backup save failed:", error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "서버 백업에 실패했습니다.",
      },
      500,
    );
  }
}
