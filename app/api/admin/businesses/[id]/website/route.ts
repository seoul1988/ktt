import { NextRequest, NextResponse } from "next/server";

import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SectionInput = {
  id?: number;
  section_type?: string;
  title?: string | null;
  content?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  sort_order?: number;
  is_visible?: boolean;
};

type BusinessInput = {
  website_enabled?: boolean;
  website_slug?: string | null;
  website_status?: string | null;
  website_settings?: Record<string, unknown> | null;
  custom_domain?: string | null;
};

type DefaultSection = {
  business_id: number;
  section_type: string;
  title: string;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  sort_order: number;
  is_visible: boolean;
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
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function normalizeObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeSettings(value: unknown) {
  const settings = normalizeObject(value);

  return {
    ...settings,
    primary_color:
      typeof settings.primary_color === "string"
        ? settings.primary_color
        : "#111827",
    secondary_color:
      typeof settings.secondary_color === "string"
        ? settings.secondary_color
        : "#f3f4f6",
    accent_color:
      typeof settings.accent_color === "string"
        ? settings.accent_color
        : "#d97706",
    font_style:
      typeof settings.font_style === "string"
        ? settings.font_style
        : "modern",
    button_style:
      typeof settings.button_style === "string"
        ? settings.button_style
        : "rounded",
    layout_width:
      typeof settings.layout_width === "string"
        ? settings.layout_width
        : "wide",
    header_background_color:
      typeof settings.header_background_color === "string"
        ? settings.header_background_color
        : "#ffffff",
  };
}

function normalizeSlug(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeCustomDomain(value: unknown) {
  let domain = String(value ?? "").trim().toLowerCase();

  if (!domain) return "";

  domain = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/\.$/, "");

  return domain;
}

function isValidCustomDomain(domain: string) {
  if (!domain) return true;

  if (domain === "localhost") return false;
  if (domain.endsWith(".vercel.app")) return false;
  if (domain === "ktowntriangle.com") return false;

  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    domain,
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown server error.";
}

function createCell(
  id: string,
  type: string,
  text: string,
  span: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    type,
    span,
    width_percent: (span / 4) * 100,
    text,
    color: type === "title" ? "#ffffff" : "#111827",
    background_color: "transparent",
    font_size: type === "title" ? 42 : 16,
    font_weight: type === "title" ? "black" : "semibold",
    text_align: type === "title" ? "left" : "center",
    vertical_align: type === "title" ? "bottom" : "center",
    ...extra,
  };
}

function createDefaultSections(
  businessId: number,
  businessName: string,
): DefaultSection[] {
  const safeName = businessName.trim() || "Business";

  return [
    {
      business_id: businessId,
      section_type: "hero",
      title: "Main",
      content: {
        background_type: "color",
        background_color: "#6b3f1f",
        layouts: [
          {
            id: `layout-${businessId}-main`,
            height: "large",
            cells: [
              createCell(
                `cell-${businessId}-main-title`,
                "title",
                safeName,
                4,
                {
                  display_mode: "text",
                  width_percent: 100,
                },
              ),
            ],
          },
        ],
        grid: {
          id: `layout-${businessId}-main`,
          height: "large",
          cells: [
            createCell(
              `cell-${businessId}-main-title`,
              "title",
              safeName,
              4,
              {
                display_mode: "text",
                width_percent: 100,
              },
            ),
          ],
        },
      },
      settings: {
        height: "large",
        text_align: "left",
        overlay: false,
        overlay_opacity: 0,
      },
      sort_order: 1,
      is_visible: true,
    },
    {
      business_id: businessId,
      section_type: "about",
      title: "About",
      content: {
        description: `${safeName}을 소개합니다.`,
      },
      settings: {},
      sort_order: 2,
      is_visible: true,
    },
    {
      business_id: businessId,
      section_type: "services",
      title: "Services",
      content: {
        description: "서비스 내용을 입력하세요.",
      },
      settings: {},
      sort_order: 3,
      is_visible: true,
    },
    {
      business_id: businessId,
      section_type: "gallery",
      title: "Gallery",
      content: {
        description: "사진을 추가하세요.",
      },
      settings: {},
      sort_order: 4,
      is_visible: true,
    },
    {
      business_id: businessId,
      section_type: "reviews",
      title: "Reviews",
      content: {},
      settings: {},
      sort_order: 5,
      is_visible: true,
    },
    {
      business_id: businessId,
      section_type: "hours",
      title: "Business Hours",
      content: {},
      settings: {},
      sort_order: 6,
      is_visible: true,
    },
    {
      business_id: businessId,
      section_type: "map",
      title: "Map",
      content: {},
      settings: {},
      sort_order: 7,
      is_visible: true,
    },
    {
      business_id: businessId,
      section_type: "contact",
      title: "Contact",
      content: {},
      settings: {},
      sort_order: 8,
      is_visible: true,
    },
  ];
}

/**
 * 기존 섹션은 건드리지 않고, 빠진 기본 섹션만 자동 생성합니다.
 * 따라서 hero만 없거나 일부 섹션만 없는 경우에도 자동 복구됩니다.
 */
async function ensureDefaultSections(
  businessId: number,
  businessName: string,
) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("business_sections")
    .select("section_type")
    .eq("business_id", businessId);

  if (existingError) {
    throw new Error(`기존 섹션 확인 실패: ${existingError.message}`);
  }

  const existingTypes = new Set(
    (existing ?? []).map((row) => String(row.section_type || "")),
  );

  const missingSections = createDefaultSections(
    businessId,
    businessName,
  ).filter((section) => !existingTypes.has(section.section_type));

  if (missingSections.length === 0) return;

  const { error: insertError } = await supabaseAdmin
    .from("business_sections")
    .insert(missingSections);

  if (insertError) {
    throw new Error(`기본 섹션 자동 생성 실패: ${insertError.message}`);
  }
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: rawId } = await context.params;
  const businessId = parseBusinessId(rawId);

  if (!businessId) {
    return jsonResponse({ error: "Invalid business ID." }, 400);
  }

  const access = await requireBusinessApiAccess(businessId);
  if (!access.ok) return access.response;

  try {
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      console.error("Website builder business GET failed:", businessError);
      return jsonResponse(
        { error: businessError.message, code: businessError.code },
        500,
      );
    }

    if (!business) {
      return jsonResponse({ error: "Business not found." }, 404);
    }

    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from("business_sections")
      .select(
        "id,business_id,section_type,title,content,settings,sort_order,is_visible",
      )
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (sectionsError) {
      console.error("Website builder sections GET failed:", sectionsError);
      return jsonResponse(
        { error: sectionsError.message, code: sectionsError.code },
        500,
      );
    }

    return jsonResponse({
      business: {
        ...business,
        website_settings: normalizeSettings(business.website_settings),
      },
      sections: sections ?? [],
    });
  } catch (error) {
    console.error("Website builder GET unexpected error:", error);
    return jsonResponse({ error: getErrorMessage(error) }, 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: rawId } = await context.params;
  const businessId = parseBusinessId(rawId);

  if (!businessId) {
    return jsonResponse({ error: "Invalid business ID." }, 400);
  }

  const access = await requireBusinessApiAccess(businessId);
  if (!access.ok) return access.response;

  try {
    const body = await request.json();

    const businessInput: BusinessInput =
      body?.business &&
      typeof body.business === "object" &&
      !Array.isArray(body.business)
        ? body.business
        : {};

    const sectionsInput: SectionInput[] = Array.isArray(body?.sections)
      ? body.sections
      : [];

    const replaceSections = body?.replace_sections === true;

    const explicitDeletedIds = Array.isArray(body?.deleted_section_ids)
      ? body.deleted_section_ids
          .map((value: unknown) => Number(value))
          .filter(
            (value: number) =>
              Number.isInteger(value) && value > 0,
          )
      : [];

    const websiteSlug = normalizeSlug(businessInput.website_slug);

    if (
      websiteSlug &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(websiteSlug)
    ) {
      return jsonResponse(
        {
          error:
            "Website slug must contain lowercase letters, numbers, and hyphens only.",
        },
        400,
      );
    }

    const customDomain = normalizeCustomDomain(
      businessInput.custom_domain,
    );

    if (!isValidCustomDomain(customDomain)) {
      return jsonResponse(
        {
          error:
            "Custom domain is invalid. Enter only a domain such as example.com.",
        },
        400,
      );
    }

    if (customDomain) {
      const { data: domainOwner, error: domainOwnerError } =
        await supabaseAdmin
          .from("businesses")
          .select("id")
          .eq("custom_domain", customDomain)
          .neq("id", businessId)
          .maybeSingle();

      if (domainOwnerError) {
        return jsonResponse(
          {
            error: domainOwnerError.message,
            code: domainOwnerError.code,
          },
          500,
        );
      }

      if (domainOwner) {
        return jsonResponse(
          {
            error:
              "This custom domain is already connected to another business.",
          },
          409,
        );
      }
    }

    const websiteStatus = String(
      businessInput.website_status ?? "draft",
    ).trim();

    if (!["draft", "published", "disabled"].includes(websiteStatus)) {
      return jsonResponse({ error: "Invalid website status." }, 400);
    }

    const businessPatch: Record<string, unknown> = {
      website_enabled: Boolean(businessInput.website_enabled),
      website_status: websiteStatus,
      website_settings: normalizeSettings(
        businessInput.website_settings,
      ),
      website_published_at:
        websiteStatus === "published"
          ? new Date().toISOString()
          : null,
      website_slug: websiteSlug || null,
      custom_domain: customDomain || null,
    };

    const { error: businessError } = await supabaseAdmin
      .from("businesses")
      .update(businessPatch)
      .eq("id", businessId);

    if (businessError) {
      console.error("Website builder business PATCH failed:", businessError);
      return jsonResponse(
        { error: businessError.message, code: businessError.code },
        500,
      );
    }

    /*
     * 현재 왼쪽 Layers 목록에 포함된 기존 DB ID입니다.
     * 음수 ID나 ID가 없는 항목은 아직 DB에 없는 새 레이어입니다.
     */
    const currentExistingIds = sectionsInput
      .map((section) => Number(section.id))
      .filter(
        (sectionId) =>
          Number.isInteger(sectionId) && sectionId > 0,
      );

    /*
     * replace_sections=true이면 현재 요청에 없는 기존 레이어를 모두 삭제합니다.
     * 이렇게 해야 왼쪽 Layers에서 삭제한 Gallery, Services, Policy 등이
     * 다음 접속 때 다시 나타나지 않습니다.
     */
    let missingServerIds: number[] = [];

    if (replaceSections) {
      const { data: existingRows, error: existingRowsError } =
        await supabaseAdmin
          .from("business_sections")
          .select("id")
          .eq("business_id", businessId);

      if (existingRowsError) {
        return jsonResponse(
          {
            error: existingRowsError.message,
            code: existingRowsError.code,
          },
          500,
        );
      }

      missingServerIds = (existingRows ?? [])
        .map((row) => Number(row.id))
        .filter(
          (sectionId) =>
            Number.isInteger(sectionId) &&
            sectionId > 0 &&
            !currentExistingIds.includes(sectionId),
        );
    }

    const idsToDelete = Array.from(
      new Set([...explicitDeletedIds, ...missingServerIds]),
    );

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("business_sections")
        .delete()
        .eq("business_id", businessId)
        .in("id", idsToDelete);

      if (deleteError) {
        console.error("Website builder section DELETE failed:", deleteError);
        return jsonResponse(
          {
            error: deleteError.message,
            code: deleteError.code,
            deleted_section_ids: idsToDelete,
          },
          500,
        );
      }
    }

    let updatedCount = 0;
    let insertedCount = 0;

    for (const section of sectionsInput) {
      const sectionId = Number(section.id);
      const sectionType = String(section.section_type || "").trim();
      const sortOrder = Number(section.sort_order);

      if (!sectionType) continue;

      const sectionPatch = {
        section_type: sectionType,
        title: String(section.title ?? "").trim() || null,
        content: normalizeObject(section.content),
        settings: normalizeObject(section.settings),
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        is_visible: section.is_visible !== false,
      };

      if (Number.isInteger(sectionId) && sectionId > 0) {
        const { data: updatedRows, error: sectionError } =
          await supabaseAdmin
            .from("business_sections")
            .update(sectionPatch)
            .eq("id", sectionId)
            .eq("business_id", businessId)
            .select("id");

        if (sectionError) {
          console.error("Website builder section PATCH failed:", {
            sectionId,
            ...sectionError,
          });

          return jsonResponse(
            {
              error: sectionError.message,
              code: sectionError.code,
              section_id: sectionId,
            },
            500,
          );
        }

        if (!updatedRows || updatedRows.length === 0) {
          return jsonResponse(
            {
              error:
                `Section ${sectionId} was not found for business ${businessId}.`,
              section_id: sectionId,
            },
            409,
          );
        }

        updatedCount += 1;
        continue;
      }

      /*
       * 새 레이어만 INSERT합니다.
       * 저장 후 아래에서 DB 데이터를 다시 읽어 실제 양수 ID를 반환합니다.
       * 프론트는 반드시 반환된 sections로 상태를 교체해야 다음 저장 때
       * 같은 새 레이어가 다시 INSERT되지 않습니다.
       */
      const { error: insertError } = await supabaseAdmin
        .from("business_sections")
        .insert({
          business_id: businessId,
          ...sectionPatch,
        });

      if (insertError) {
        console.error("Website builder section INSERT failed:", {
          sectionType,
          ...insertError,
        });

        return jsonResponse(
          {
            error: insertError.message,
            code: insertError.code,
            section_type: sectionType,
          },
          500,
        );
      }

      insertedCount += 1;
    }

    /*
     * 기본 레이어 자동 재생성은 하지 않습니다.
     * 사용자가 삭제한 레이어는 삭제된 상태 그대로 유지합니다.
     */
    const { data: savedSections, error: savedSectionsError } =
      await supabaseAdmin
        .from("business_sections")
        .select(
          "id,business_id,section_type,title,content,settings,sort_order,is_visible",
        )
        .eq("business_id", businessId)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });

    if (savedSectionsError) {
      return jsonResponse(
        {
          error: savedSectionsError.message,
          code: savedSectionsError.code,
        },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      business_id: businessId,
      updated_sections: updatedCount,
      inserted_sections: insertedCount,
      deleted_sections: idsToDelete.length,
      deleted_section_ids: idsToDelete,
      sections: savedSections ?? [],
    });
  } catch (error) {
    console.error("Website builder PATCH unexpected error:", error);
    return jsonResponse({ error: getErrorMessage(error) }, 500);
  }
}