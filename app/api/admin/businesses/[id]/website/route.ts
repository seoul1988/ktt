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

    const rawSections: SectionInput[] = Array.isArray(body?.sections)
      ? body.sections
      : [];

    const replaceSections = body?.replace_sections === true;
    const saveRequestId = String(
      body?.save_request_id ||
        request.headers.get("x-website-save-request-id") ||
        "",
    ).trim();

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
            conflict_type: "custom_domain",
            custom_domain: customDomain,
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

    /*
     * 요청에 들어온 레이어를 먼저 정규화합니다.
     * sort_order가 중복되면 DB의 unique constraint와 충돌할 수 있으므로
     * 배열 순서대로 1, 2, 3...으로 다시 지정합니다.
     */
    const sectionsInput = rawSections
      .filter((section) => {
        const sectionType = String(section.section_type || "").trim();
        return Boolean(sectionType);
      })
      .map((section, index) => ({
        ...section,
        sort_order: index + 1,
        is_visible: section.is_visible !== false,
        content: normalizeObject(section.content),
        settings: normalizeObject(section.settings),
      }));

    /*
     * 현재 DB 상태를 저장 전에 한 번 읽습니다.
     * 존재하지 않는 양수 ID는 UPDATE 409로 중단하지 않고 새 레이어로 INSERT합니다.
     */
    const { data: existingRows, error: existingRowsError } =
      await supabaseAdmin
        .from("business_sections")
        .select(
          "id,business_id,section_type,title,content,settings,sort_order,is_visible",
        )
        .eq("business_id", businessId)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });

    if (existingRowsError) {
      return jsonResponse(
        {
          error: existingRowsError.message,
          code: existingRowsError.code,
        },
        500,
      );
    }

    const existingIds = new Set(
      (existingRows ?? [])
        .map((row) => Number(row.id))
        .filter((id) => Number.isInteger(id) && id > 0),
    );

    /*
     * 삭제는 저장 맨 마지막에 실행합니다.
     * 이전 코드는 먼저 DELETE한 뒤 UPDATE/INSERT 중 하나가 실패하면
     * 일부 레이어가 이미 사라진 상태로 끝났습니다.
     */
    const requestedExistingIds = sectionsInput
      .map((section) => Number(section.id))
      .filter(
        (id) =>
          Number.isInteger(id) &&
          id > 0 &&
          existingIds.has(id),
      );

    const missingServerIds = replaceSections
      ? Array.from(existingIds).filter(
          (id) => !requestedExistingIds.includes(id),
        )
      : [];

    const idsToDelete = Array.from(
      new Set([...explicitDeletedIds, ...missingServerIds]),
    ).filter((id) => existingIds.has(id));

    let updatedCount = 0;
    let insertedCount = 0;
    const insertedClientKeys: string[] = [];
    const warnings: string[] = [];

    /*
     * 기존 row의 sort_order unique 충돌을 피하기 위해 먼저 임시 큰 값으로 이동합니다.
     * 예: 1번과 2번 레이어의 순서를 맞바꿀 때 순차 UPDATE하면 중복 충돌이 날 수 있습니다.
     */
    const rowsToUpdate = sectionsInput.filter((section) => {
      const sectionId = Number(section.id);
      return (
        Number.isInteger(sectionId) &&
        sectionId > 0 &&
        existingIds.has(sectionId)
      );
    });

    for (let index = 0; index < rowsToUpdate.length; index += 1) {
      const sectionId = Number(rowsToUpdate[index].id);
      const temporaryOrder = 1_000_000 + index;

      const { error: temporaryOrderError } = await supabaseAdmin
        .from("business_sections")
        .update({ sort_order: temporaryOrder })
        .eq("id", sectionId)
        .eq("business_id", businessId);

      if (temporaryOrderError) {
        return jsonResponse(
          {
            error:
              `레이어 임시 정렬 저장 실패: ${temporaryOrderError.message}`,
            code: temporaryOrderError.code,
            section_id: sectionId,
            save_request_id: saveRequestId || null,
          },
          500,
        );
      }
    }

    /*
     * 기존 레이어 UPDATE / 새 레이어 INSERT
     * DB에서 사라진 양수 ID는 409로 전체 저장을 중단하지 않고 INSERT로 복구합니다.
     */
    for (const section of sectionsInput) {
      const sectionId = Number(section.id);
      const sectionType = String(section.section_type || "").trim();
      const content = normalizeObject(section.content);
      const clientSaveKey = String(
        content.client_save_key || "",
      ).trim();

      const sectionPatch = {
        section_type: sectionType,
        title: String(section.title ?? "").trim() || null,
        content,
        settings: normalizeObject(section.settings),
        sort_order: Number(section.sort_order) || 0,
        is_visible: section.is_visible !== false,
      };

      const canUpdateExisting =
        Number.isInteger(sectionId) &&
        sectionId > 0 &&
        existingIds.has(sectionId);

      if (canUpdateExisting) {
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
              section_type: sectionType,
              save_request_id: saveRequestId || null,
            },
            500,
          );
        }

        if (!updatedRows || updatedRows.length === 0) {
          warnings.push(
            `기존 레이어 ID ${sectionId}가 없어 새 레이어로 다시 저장했습니다.`,
          );
        } else {
          updatedCount += 1;
          continue;
        }
      } else if (
        Number.isInteger(sectionId) &&
        sectionId > 0
      ) {
        warnings.push(
          `서버에 없는 레이어 ID ${sectionId}를 새 레이어로 복구했습니다.`,
        );
      }

      const { data: insertedRows, error: insertError } =
        await supabaseAdmin
          .from("business_sections")
          .insert({
            business_id: businessId,
            ...sectionPatch,
          })
          .select("id,content");

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
            client_save_key: clientSaveKey || null,
            save_request_id: saveRequestId || null,
          },
          500,
        );
      }

      if (!insertedRows || insertedRows.length === 0) {
        return jsonResponse(
          {
            error: `새 레이어 ${sectionType}를 INSERT했지만 반환된 row가 없습니다.`,
            section_type: sectionType,
            client_save_key: clientSaveKey || null,
            save_request_id: saveRequestId || null,
          },
          500,
        );
      }

      if (clientSaveKey) insertedClientKeys.push(clientSaveKey);
      insertedCount += 1;
    }

    /*
     * UPDATE/INSERT가 모두 성공한 뒤에만 삭제합니다.
     */
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
            save_request_id: saveRequestId || null,
          },
          500,
        );
      }
    }

    /*
     * 비즈니스 설정은 레이어 저장이 끝난 다음 저장합니다.
     * 레이어 저장 실패 시 business만 새 값으로 바뀌는 현상을 줄입니다.
     */
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
        {
          error: businessError.message,
          code: businessError.code,
          save_request_id: saveRequestId || null,
        },
        500,
      );
    }

    /*
     * 최종 DB 상태를 다시 읽고 요청한 client_save_key가 모두 존재하는지 검증합니다.
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
          save_request_id: saveRequestId || null,
        },
        500,
      );
    }

    const savedClientKeys = new Set(
      (savedSections ?? []).map((section) =>
        String(
          normalizeObject(section.content).client_save_key || "",
        ).trim(),
      ),
    );

    const requestedClientKeys = sectionsInput
      .map((section) =>
        String(
          normalizeObject(section.content).client_save_key || "",
        ).trim(),
      )
      .filter(Boolean);

    const missingClientKeys = requestedClientKeys.filter(
      (key) => !savedClientKeys.has(key),
    );

    if (
      (savedSections ?? []).length !== sectionsInput.length ||
      missingClientKeys.length > 0
    ) {
      return jsonResponse(
        {
          error:
            "저장 후 DB 검증 결과가 요청과 일치하지 않습니다.",
          sent_section_count: sectionsInput.length,
          saved_section_count: (savedSections ?? []).length,
          missing_client_save_keys: missingClientKeys,
          save_request_id: saveRequestId || null,
          warnings,
          sections: savedSections ?? [],
        },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      business_id: businessId,
      save_request_id: saveRequestId || null,
      updated_sections: updatedCount,
      inserted_sections: insertedCount,
      deleted_sections: idsToDelete.length,
      deleted_section_ids: idsToDelete,
      inserted_client_save_keys: insertedClientKeys,
      warnings,
      sections: savedSections ?? [],
    });
  } catch (error) {
    console.error("Website builder PATCH unexpected error:", error);
    return jsonResponse(
      {
        error: getErrorMessage(error),
      },
      500,
    );
  }
}

