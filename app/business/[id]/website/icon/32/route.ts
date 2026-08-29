import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function findUploadedLogo(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUploadedLogo(item);
      if (found) return found;
    }
    return "";
  }

  if (!isRecord(value)) return "";

  const type = text(value.type).toLowerCase();

  if (type === "logo") {
    const logo =
      text(value.image_url) ||
      text(value.imageUrl) ||
      text(value.logo_url) ||
      text(value.logoUrl) ||
      text(value.url) ||
      text(value.src);

    if (logo) return logo;
  }

  const explicitLogo =
    text(value.app_icon_url) ||
    text(value.appIconUrl) ||
    text(value.logo_url) ||
    text(value.logoUrl) ||
    text(value.business_logo_url) ||
    text(value.businessLogoUrl) ||
    text(value.header_logo_url) ||
    text(value.headerLogoUrl);

  if (explicitLogo) return explicitLogo;

  for (const child of Object.values(value)) {
    const found = findUploadedLogo(child);
    if (found) return found;
  }

  return "";
}

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function absoluteImageUrl(value: string, origin: string) {
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;

  return new URL(
    value.startsWith("/") ? value : `/${value}`,
    origin,
  ).href;
}

async function fetchImage(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Icon image request failed: ${response.status}`,
    );
  }

  const contentType =
    response.headers.get("content-type") || "image/png";

  const bytes = await response.arrayBuffer();

  return {
    bytes,
    contentType,
  };
}

export async function GET(
  request: Request,
  { params }: Props,
) {
  try {
    const { id } = await params;
    const businessId = Number(id);

    if (
      !Number.isInteger(businessId) ||
      businessId <= 0
    ) {
      return new NextResponse("Invalid business id", {
        status: 400,
      });
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id,image_url,image_urls,slider_image_urls,website_settings",
      )
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      console.error(
        "Business favicon database error:",
        error,
      );

      return new NextResponse(
        "Could not load business",
        { status: 500 },
      );
    }

    if (!data) {
      return new NextResponse(
        "Business not found",
        { status: 404 },
      );
    }

    /*
     * 우선순위:
     * 1. Website Editor에 저장된 app icon / logo
     * 2. businesses.image_url
     * 3. 사이트 기본 icon-512.png
     *
     * 브라우저가 32x32로 표시하므로 원본 이미지를 그대로 반환해도
     * favicon으로 정상 축소됩니다. 이렇게 하면 sharp 같은 추가
     * 이미지 라이브러리가 필요하지 않습니다.
     */
    const uploadedLogo =
      findUploadedLogo(data.website_settings);

    const source =
      uploadedLogo ||
      text(data.image_url) ||
      "/icon-512.png";

    const origin = new URL(request.url).origin;
    const imageUrl = absoluteImageUrl(source, origin);

    try {
      const image = await fetchImage(imageUrl);

      return new NextResponse(image.bytes, {
        status: 200,
        headers: {
          "Content-Type": image.contentType,
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (imageError) {
      console.error(
        "Business favicon source image error:",
        imageError,
      );

      /*
       * 저장된 로고 URL이 삭제되었거나 접근할 수 없는 경우
       * KTown 기본 아이콘으로 fallback 합니다.
       */
      const fallbackUrl = new URL(
        "/icon-512.png",
        origin,
      ).href;

      const fallback = await fetchImage(fallbackUrl);

      return new NextResponse(fallback.bytes, {
        status: 200,
        headers: {
          "Content-Type": fallback.contentType,
          "Cache-Control":
            "public, max-age=60, s-maxage=60",
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  } catch (error) {
    console.error(
      "Business favicon route failed:",
      error,
    );

    return new NextResponse(
      "Favicon generation failed",
      { status: 500 },
    );
  }
}
