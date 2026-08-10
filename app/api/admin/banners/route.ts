import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BUCKET = "ktowntriangle-banner-images";
const ALLOWED_TYPES = new Set(["popup"]);

function getAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase 환경변수를 확인하세요.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getToken(request: Request) {
  const authorization =
    request.headers.get("authorization") || "";

  return authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function positiveInteger(value: unknown) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0
    ? number
    : null;
}

async function requireAdmin(request: Request) {
  const token = getToken(request);

  if (!token) {
    return {
      allowed: false,
      status: 401,
      error: "로그인이 필요합니다.",
    };
  }

  const supabase = getAdminClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      allowed: false,
      status: 401,
      error: "로그인 정보를 확인할 수 없습니다.",
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) throw profileError;

  if (profile?.role !== "admin") {
    return {
      allowed: false,
      status: 403,
      error: "관리자 권한이 필요합니다.",
    };
  }

  return { allowed: true, status: 200, error: "" };
}

async function ensureBucket(
  supabase: ReturnType<typeof getAdminClient>,
) {
  const { data, error } =
    await supabase.storage.listBuckets();

  if (error) {
    throw new Error(
      `Storage 버킷 목록 확인 실패: ${error.message}`,
    );
  }

  const bucket = data.find(
    (item) => item.name === BUCKET,
  );

  if (!bucket) {
    const { error: createError } =
      await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: "5MB",
        allowedMimeTypes: ["image/webp"],
      });

    if (createError) {
      throw new Error(
        `Storage 버킷 생성 실패: ${createError.message}`,
      );
    }

    return;
  }

  const { error: updateError } =
    await supabase.storage.updateBucket(BUCKET, {
      public: true,
      fileSizeLimit: "5MB",
      allowedMimeTypes: ["image/webp"],
    });

  if (updateError) {
    throw new Error(
      `Storage 버킷 설정 실패: ${updateError.message}`,
    );
  }
}

function imageUrl(
  supabase: ReturnType<typeof getAdminClient>,
  path: string | null,
) {
  if (!path) return null;

  return supabase.storage
    .from(BUCKET)
    .getPublicUrl(path).data.publicUrl;
}

function normalizeBanner(
  supabase: ReturnType<typeof getAdminClient>,
  row: Record<string, unknown>,
) {
  return {
    ...row,
    image_url: imageUrl(
      supabase,
      (row.image_path as string | null) || null,
    ),
  };
}

function parseBoolean(value: unknown) {
  return (
    value === true ||
    value === "true" ||
    value === "1"
  );
}

function requiredEndDate(value: unknown) {
  const parsed = optionalDate(value);

  if (!parsed) {
    throw new Error("팝업 종료일을 입력하세요.");
  }

  return parsed;
}

function optionalDate(value: unknown) {
  const text = String(value || "").trim();

  if (!text) return null;

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error("배너 날짜 형식이 올바르지 않습니다.");
  }

  return date.toISOString();
}

function boundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.round(number)));
}

function validTextAlign(value: unknown) {
  return value === "center" || value === "right" ? value : "left";
}

function validImagePosition(value: unknown) {
  return value === "left" || value === "background" ? value : "top";
}

function validPopupPreset(value: unknown) {
  return ["square", "rounded", "modern", "glass", "iphone", "coupon", "circle"].includes(String(value))
    ? String(value)
    : "rounded";
}

function validPopupShadow(value: unknown) {
  return ["none", "small", "medium", "large", "glass"].includes(String(value))
    ? String(value)
    : "medium";
}

function validImageFit(value: unknown) {
  return value === "cover" || value === "fill"
    ? value
    : "contain";
}

function validColor(value: unknown, fallback: string) {
  const text = String(value || "").trim();

  return /^#[0-9A-Fa-f]{6}$/.test(text)
    ? text
    : fallback;
}

async function uploadImage(
  supabase: ReturnType<typeof getAdminClient>,
  file: File,
) {
  if (
    file.type !== "image/webp" &&
    !file.name.toLowerCase().endsWith(".webp")
  ) {
    throw new Error(
      `WEBP 이미지가 아닙니다. 받은 형식: ${file.type || "unknown"}`,
    );
  }

  if (file.size <= 0) {
    throw new Error("업로드할 이미지 파일이 비어 있습니다.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error(
      "변환된 팝업 이미지는 5MB 이하만 저장할 수 있습니다.",
    );
  }

  await ensureBucket(supabase);

  const path =
    `site/${Date.now()}-${randomUUID()}.webp`;

  const bytes = new Uint8Array(
    await file.arrayBuffer(),
  );

  const { data, error } =
    await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });

  if (error) {
    throw new Error(
      `팝업 이미지 업로드 실패: ${error.message}`,
    );
  }

  if (!data?.path) {
    throw new Error(
      "Storage가 업로드된 이미지 경로를 반환하지 않았습니다.",
    );
  }

  return data.path;
}

async function removeImage(
  supabase: ReturnType<typeof getAdminClient>,
  path: string | null,
) {
  if (!path) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([path]);

  if (error) {
    console.error("Banner image delete failed:", error);
  }
}

export async function GET(request: Request) {
  try {
    const access = await requireAdmin(request);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const supabase = getAdminClient();

    const { data: banners, error } = await supabase
      .from("ktowntriangle_banners")
      .select("*")
      .order("display_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      banners: (banners || []).map((row) =>
        normalizeBanner(supabase, row),
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "배너를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireAdmin(request);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const formData = await request.formData();
    const bannerType = String(
      formData.get("banner_type") || "",
    );
    const title = String(
      formData.get("title") || "",
    ).trim();

    if (!ALLOWED_TYPES.has(bannerType)) {
      return NextResponse.json(
        { error: "잘못된 배너 종류입니다." },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    const image = formData.get("image");
    const imageRequested =
      image instanceof File && image.size > 0;
    let imagePath: string | null = null;

    if (imageRequested) {
      imagePath = await uploadImage(
        supabase,
        image,
      );

      if (!imagePath) {
        throw new Error(
          "이미지 업로드 후 경로를 받지 못했습니다.",
        );
      }
    }

    const { data: banner, error } =
      await supabase
        .from("ktowntriangle_banners")
        .insert({
          banner_type: "popup",
          template_style:
            String(
              formData.get("template_style") || "classic",
            ).trim() || "classic",
          title,
          subtitle:
            String(
              formData.get("subtitle") || "",
            ).trim() || null,
          button_text:
            String(
              formData.get("button_text") || "",
            ).trim() || null,
          link_url:
            String(
              formData.get("link_url") || "",
            ).trim() || null,
          image_path: imagePath,
          background_color: validColor(
            formData.get("background_color"),
            "#172033",
          ),
          text_color: validColor(
            formData.get("text_color"),
            "#FFFFFF",
          ),
          button_color: validColor(
            formData.get("button_color"),
            "#B64032",
          ),
          button_text_color: validColor(
            formData.get("button_text_color"),
            "#FFFFFF",
          ),
          title_color: validColor(
            formData.get("title_color"),
            "#172033",
          ),
          subtitle_color: validColor(
            formData.get("subtitle_color"),
            "#667085",
          ),
          title_font_size: boundedInteger(
            formData.get("title_font_size"), 32, 16, 72,
          ),
          subtitle_font_size: boundedInteger(
            formData.get("subtitle_font_size"), 16, 10, 40,
          ),
          button_font_size: boundedInteger(
            formData.get("button_font_size"), 14, 10, 48,
          ),
          title_font_weight: boundedInteger(
            formData.get("title_font_weight"), 900, 400, 900,
          ),
          subtitle_font_weight: boundedInteger(
            formData.get("subtitle_font_weight"), 500, 400, 700,
          ),
          text_align: validTextAlign(
            formData.get("text_align"),
          ),
          image_position: validImagePosition(
            formData.get("image_position"),
          ),
          popup_width: boundedInteger(
            formData.get("popup_width"), 720, 320, 1100,
          ),
          button_enabled: parseBoolean(
            formData.get("button_enabled"),
          ),
          text_x: boundedInteger(
            formData.get("text_x"), 8, 0, 100,
          ),
          text_y: boundedInteger(
            formData.get("text_y"), 16, 0, 100,
          ),
          text_width: boundedInteger(
            formData.get("text_width"), 84, 20, 100,
          ),

          // 제목 / 설명 / 버튼을 각각 독립적으로 드래그한 위치
          title_x: boundedInteger(
            formData.get("title_x"), 8, 0, 100,
          ),
          title_y: boundedInteger(
            formData.get("title_y"), 14, 0, 100,
          ),
          title_width: boundedInteger(
            formData.get("title_width"), 84, 10, 100,
          ),
          subtitle_x: boundedInteger(
            formData.get("subtitle_x"), 8, 0, 100,
          ),
          subtitle_y: boundedInteger(
            formData.get("subtitle_y"), 32, 0, 100,
          ),
          subtitle_width: boundedInteger(
            formData.get("subtitle_width"), 84, 10, 100,
          ),
          button_x: boundedInteger(
            formData.get("button_x"), 8, 0, 100,
          ),
          button_y: boundedInteger(
            formData.get("button_y"), 52, 0, 100,
          ),
          button_width: boundedInteger(
            formData.get("button_width"), 34, 8, 100,
          ),
          button_height: boundedInteger(
            formData.get("button_height"), 10, 4, 35,
          ),
          hide_24h_enabled: parseBoolean(
            formData.get("hide_24h_enabled"),
          ),

          image_x: boundedInteger(
            formData.get("image_x"), 0, 0, 100,
          ),
          image_y: boundedInteger(
            formData.get("image_y"), 0, 0, 100,
          ),
          image_width: boundedInteger(
            formData.get("image_width"), 100, 10, 100,
          ),
          image_height: boundedInteger(
            formData.get("image_height"), 42, 10, 100,
          ),
          image_fit: validImageFit(
            formData.get("image_fit"),
          ),
          image_zoom: boundedInteger(
            formData.get("image_zoom"), 100, 25, 300,
          ),
          style_preset: validPopupPreset(
            formData.get("style_preset"),
          ),
          popup_radius: boundedInteger(
            formData.get("popup_radius"), 28, 0, 999,
          ),
          image_radius: boundedInteger(
            formData.get("image_radius"), 18, 0, 999,
          ),
          button_radius: boundedInteger(
            formData.get("button_radius"), 12, 0, 999,
          ),
          popup_shadow: validPopupShadow(
            formData.get("popup_shadow"),
          ),
          popup_height: boundedInteger(
            formData.get("popup_height"), 520, 320, 900,
          ),
          lead_capture_enabled: parseBoolean(formData.get("lead_capture_enabled")),
          email_placeholder: String(formData.get("email_placeholder") || "Enter email to claim").trim().slice(0, 160),
          terms_text: String(formData.get("terms_text") || "").trim().slice(0, 5000),
          submit_button_text: String(formData.get("submit_button_text") || "SIGN UP & CLAIM").trim().slice(0, 120),
          success_message: String(formData.get("success_message") || "Check your email! 🎉").trim().slice(0, 300),
          coupon_code_prefix: String(formData.get("coupon_code_prefix") || "WELCOME").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "WELCOME",
          reward_signup_url: String(formData.get("reward_signup_url") || "").trim().slice(0, 1000) || null,
          form_background_color: validColor(formData.get("form_background_color"), "#FFFFFF"),
          lead_expanded_mode: parseBoolean(formData.get("lead_expanded_mode")),
          display_order:
            positiveInteger(
              formData.get("display_order"),
            ) || 999,
          is_active: parseBoolean(
            formData.get("is_active"),
          ),
          starts_at: optionalDate(
            formData.get("starts_at"),
          ),
          ends_at: requiredEndDate(
            formData.get("ends_at"),
          ),
        })
        .select("*")
        .single();

    if (error) {
      await removeImage(supabase, imagePath);
      throw error;
    }

    if (imageRequested && !banner.image_path) {
      await removeImage(supabase, imagePath);

      return NextResponse.json(
        {
          error:
            "이미지는 업로드됐지만 image_path가 DB에 저장되지 않았습니다.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      banner: normalizeBanner(supabase, banner),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "배너를 등록하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireAdmin(request);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const supabase = getAdminClient();
    const contentType =
      request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      const bannerId = positiveInteger(body?.id);

      if (!bannerId) {
        return NextResponse.json(
          { error: "잘못된 배너 ID입니다." },
          { status: 400 },
        );
      }

      const { data: banner, error } =
        await supabase
          .from("ktowntriangle_banners")
          .update({
            is_active: Boolean(body?.is_active),
          })
          .eq("id", bannerId)
          .select("*")
          .maybeSingle();

      if (error) throw error;

      if (!banner) {
        return NextResponse.json(
          { error: "배너를 찾지 못했습니다." },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        banner: normalizeBanner(supabase, banner),
      });
    }

    const formData = await request.formData();
    const bannerId = positiveInteger(
      formData.get("id"),
    );
    const bannerType = String(
      formData.get("banner_type") || "",
    );
    const title = String(
      formData.get("title") || "",
    ).trim();

    if (!bannerId) {
      return NextResponse.json(
        { error: "잘못된 배너 ID입니다." },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(bannerType)) {
      return NextResponse.json(
        { error: "잘못된 배너 종류입니다." },
        { status: 400 },
      );
    }

    const { data: existing, error: existingError } =
      await supabase
        .from("ktowntriangle_banners")
        .select("id,image_path")
        .eq("id", bannerId)
        .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      return NextResponse.json(
        { error: "배너를 찾지 못했습니다." },
        { status: 404 },
      );
    }

    const image = formData.get("image");
    const imageRequested =
      image instanceof File && image.size > 0;
    let nextImagePath = existing.image_path;

    if (imageRequested) {
      nextImagePath = await uploadImage(
        supabase,
        image,
      );

      if (!nextImagePath) {
        throw new Error(
          "이미지 업로드 후 경로를 받지 못했습니다.",
        );
      }
    }

    const { data: banner, error: updateError } =
      await supabase
        .from("ktowntriangle_banners")
        .update({
          banner_type: "popup",
          template_style:
            String(
              formData.get("template_style") || "classic",
            ).trim() || "classic",
          title,
          subtitle:
            String(
              formData.get("subtitle") || "",
            ).trim() || null,
          button_text:
            String(
              formData.get("button_text") || "",
            ).trim() || null,
          link_url:
            String(
              formData.get("link_url") || "",
            ).trim() || null,
          image_path: nextImagePath,
          background_color: validColor(
            formData.get("background_color"),
            "#172033",
          ),
          text_color: validColor(
            formData.get("text_color"),
            "#FFFFFF",
          ),
          button_color: validColor(
            formData.get("button_color"),
            "#B64032",
          ),
          button_text_color: validColor(
            formData.get("button_text_color"),
            "#FFFFFF",
          ),
          title_color: validColor(
            formData.get("title_color"),
            "#172033",
          ),
          subtitle_color: validColor(
            formData.get("subtitle_color"),
            "#667085",
          ),
          title_font_size: boundedInteger(
            formData.get("title_font_size"), 32, 16, 72,
          ),
          subtitle_font_size: boundedInteger(
            formData.get("subtitle_font_size"), 16, 10, 40,
          ),
          button_font_size: boundedInteger(
            formData.get("button_font_size"), 14, 10, 48,
          ),
          title_font_weight: boundedInteger(
            formData.get("title_font_weight"), 900, 400, 900,
          ),
          subtitle_font_weight: boundedInteger(
            formData.get("subtitle_font_weight"), 500, 400, 700,
          ),
          text_align: validTextAlign(
            formData.get("text_align"),
          ),
          image_position: validImagePosition(
            formData.get("image_position"),
          ),
          popup_width: boundedInteger(
            formData.get("popup_width"), 720, 320, 1100,
          ),
          button_enabled: parseBoolean(
            formData.get("button_enabled"),
          ),
          text_x: boundedInteger(
            formData.get("text_x"), 8, 0, 100,
          ),
          text_y: boundedInteger(
            formData.get("text_y"), 16, 0, 100,
          ),
          text_width: boundedInteger(
            formData.get("text_width"), 84, 20, 100,
          ),

          // 제목 / 설명 / 버튼을 각각 독립적으로 드래그한 위치
          title_x: boundedInteger(
            formData.get("title_x"), 8, 0, 100,
          ),
          title_y: boundedInteger(
            formData.get("title_y"), 14, 0, 100,
          ),
          title_width: boundedInteger(
            formData.get("title_width"), 84, 10, 100,
          ),
          subtitle_x: boundedInteger(
            formData.get("subtitle_x"), 8, 0, 100,
          ),
          subtitle_y: boundedInteger(
            formData.get("subtitle_y"), 32, 0, 100,
          ),
          subtitle_width: boundedInteger(
            formData.get("subtitle_width"), 84, 10, 100,
          ),
          button_x: boundedInteger(
            formData.get("button_x"), 8, 0, 100,
          ),
          button_y: boundedInteger(
            formData.get("button_y"), 52, 0, 100,
          ),
          button_width: boundedInteger(
            formData.get("button_width"), 34, 8, 100,
          ),
          button_height: boundedInteger(
            formData.get("button_height"), 10, 4, 35,
          ),
          hide_24h_enabled: parseBoolean(
            formData.get("hide_24h_enabled"),
          ),

          image_x: boundedInteger(
            formData.get("image_x"), 0, 0, 100,
          ),
          image_y: boundedInteger(
            formData.get("image_y"), 0, 0, 100,
          ),
          image_width: boundedInteger(
            formData.get("image_width"), 100, 10, 100,
          ),
          image_height: boundedInteger(
            formData.get("image_height"), 42, 10, 100,
          ),
          image_fit: validImageFit(
            formData.get("image_fit"),
          ),
          image_zoom: boundedInteger(
            formData.get("image_zoom"), 100, 25, 300,
          ),
          style_preset: validPopupPreset(
            formData.get("style_preset"),
          ),
          popup_radius: boundedInteger(
            formData.get("popup_radius"), 28, 0, 999,
          ),
          image_radius: boundedInteger(
            formData.get("image_radius"), 18, 0, 999,
          ),
          button_radius: boundedInteger(
            formData.get("button_radius"), 12, 0, 999,
          ),
          popup_shadow: validPopupShadow(
            formData.get("popup_shadow"),
          ),
          popup_height: boundedInteger(
            formData.get("popup_height"), 520, 320, 900,
          ),
          lead_capture_enabled: parseBoolean(formData.get("lead_capture_enabled")),
          email_placeholder: String(formData.get("email_placeholder") || "Enter email to claim").trim().slice(0, 160),
          terms_text: String(formData.get("terms_text") || "").trim().slice(0, 5000),
          submit_button_text: String(formData.get("submit_button_text") || "SIGN UP & CLAIM").trim().slice(0, 120),
          success_message: String(formData.get("success_message") || "Check your email! 🎉").trim().slice(0, 300),
          coupon_code_prefix: String(formData.get("coupon_code_prefix") || "WELCOME").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "WELCOME",
          reward_signup_url: String(formData.get("reward_signup_url") || "").trim().slice(0, 1000) || null,
          form_background_color: validColor(formData.get("form_background_color"), "#FFFFFF"),
          lead_expanded_mode: parseBoolean(formData.get("lead_expanded_mode")),
          display_order:
            positiveInteger(
              formData.get("display_order"),
            ) || 999,
          is_active: parseBoolean(
            formData.get("is_active"),
          ),
          starts_at: optionalDate(
            formData.get("starts_at"),
          ),
          ends_at: requiredEndDate(
            formData.get("ends_at"),
          ),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bannerId)
        .select("*")
        .maybeSingle();

    if (updateError || !banner) {
      if (
        nextImagePath &&
        nextImagePath !== existing.image_path
      ) {
        await removeImage(
          supabase,
          nextImagePath,
        );
      }

      throw (
        updateError ||
        new Error("배너를 수정하지 못했습니다.")
      );
    }

    if (
      nextImagePath !== existing.image_path
    ) {
      await removeImage(
        supabase,
        existing.image_path,
      );
    }

    return NextResponse.json({
      success: true,
      banner: normalizeBanner(supabase, banner),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "배너를 수정하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await requireAdmin(request);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const body = await request.json();
    const bannerId = positiveInteger(body?.id);

    if (!bannerId) {
      return NextResponse.json(
        { error: "잘못된 배너 ID입니다." },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();

    const { data: banner, error: findError } =
      await supabase
        .from("ktowntriangle_banners")
        .select("id,image_path")
        .eq("id", bannerId)
        .maybeSingle();

    if (findError) throw findError;

    if (!banner) {
      return NextResponse.json(
        { error: "배너를 찾지 못했습니다." },
        { status: 404 },
      );
    }

    const { error: deleteError } =
      await supabase
        .from("ktowntriangle_banners")
        .delete()
        .eq("id", bannerId);

    if (deleteError) throw deleteError;

    await removeImage(
      supabase,
      banner.image_path,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "배너를 삭제하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}