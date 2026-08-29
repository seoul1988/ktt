import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "business-banner-images";

type PublicBannerRow = {
  id: number;
  image_path: string | null;
  dismiss_option_enabled: boolean | null;
  dismiss_hours: number | string | null;
  [key: string]: unknown;
};

function getServerSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase 환경변수가 없습니다.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function imageUrl(
  supabase: ReturnType<typeof getServerSupabase>,
  path: string | null,
) {
  if (!path) return null;

  if (
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }

  return supabase.storage
    .from(BUCKET)
    .getPublicUrl(path).data.publicUrl;
}

function normalizeDismissHours(value: unknown) {
  const parsedValue = Number(value);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue <= 0
  ) {
    return 24;
  }

  return Math.max(
    1,
    Math.min(24 * 30, Math.round(parsedValue)),
  );
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (
      !Number.isInteger(businessId) ||
      businessId <= 0
    ) {
      return NextResponse.json(
        {
          error: "잘못된 비즈니스 ID입니다.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const supabase = getServerSupabase();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("business_website_banners")
      .select(
        [
          "id",
          "title",
          "subtitle",
          "button_text",
          "link_url",
          "image_path",
          "background_color",
          "title_color",
          "subtitle_color",
          "button_color",
          "button_text_color",
          "title_font_size",
          "subtitle_font_size",
          "button_font_size",
          "title_font_weight",
          "subtitle_font_weight",
          "text_align",
          "image_position",
          "popup_width",
          "button_enabled",
          "text_x",
          "text_y",
          "text_width",
          "image_x",
          "image_y",
          "image_width",
          "image_height",
          "image_fit",
          "image_zoom",
          "style_preset",
          "popup_radius",
          "image_radius",
          "button_radius",
          "popup_shadow",
          "popup_height",
          "lead_capture_enabled",
          "email_placeholder",
          "terms_text",
          "submit_button_text",
          "success_message",
          "coupon_code_prefix",
          "reward_signup_url",
          "form_background_color",
          "lead_expanded_mode",
          "dismiss_option_enabled",
          "dismiss_hours",
          "display_order",
        ].join(","),
      )
      .eq("business_id", businessId)
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("display_order", {
        ascending: true,
      })
      .order("id", {
        ascending: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    /*
     * Supabase가 동적으로 생성된 select 문자열의 결과를
     * 객체가 아닌 오류 타입으로 추론할 수 있으므로,
     * 실제 반환 배열을 명시적인 배너 타입으로 변환합니다.
     */
    const bannerRows = (
      Array.isArray(data) ? data : []
    ) as unknown as PublicBannerRow[];

    const banners = bannerRows.map((banner) => ({
      ...banner,

      dismiss_option_enabled:
        banner.dismiss_option_enabled !== false,

      dismiss_hours: normalizeDismissHours(
        banner.dismiss_hours,
      ),

      image_url: imageUrl(
        supabase,
        banner.image_path,
      ),
    }));

    return NextResponse.json(
      {
        banners,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    console.error(
      "공개 웹사이트 팝업 조회 실패:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "팝업을 불러오지 못했습니다.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}