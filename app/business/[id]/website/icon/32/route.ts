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

function isDefaultKtownIcon(value: string, origin: string) {
  if (!value) return false;

  try {
    const pathname = new URL(value, origin).pathname.toLowerCase();
    return (
      pathname === "/icon-512.png" ||
      pathname === "/icon-192.png" ||
      pathname === "/favicon.ico"
    );
  } catch {
    const clean = value.split("?")[0].toLowerCase();
    return (
      clean.endsWith("/icon-512.png") ||
      clean.endsWith("/icon-192.png") ||
      clean.endsWith("/favicon.ico")
    );
  }
}

function findUploadedBusinessLogo(
  value: unknown,
  origin: string,
): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUploadedBusinessLogo(item, origin);
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

    if (logo && !isDefaultKtownIcon(logo, origin)) {
      return logo;
    }
  }

  // 실제 비즈니스 로고를 app_icon_url보다 먼저 사용합니다.
  const explicitLogo =
    text(value.logo_url) ||
    text(value.logoUrl) ||
    text(value.business_logo_url) ||
    text(value.businessLogoUrl) ||
    text(value.header_logo_url) ||
    text(value.headerLogoUrl);

  if (
    explicitLogo &&
    !isDefaultKtownIcon(explicitLogo, origin)
  ) {
    return explicitLogo;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "app_icon_url" || key === "appIconUrl") {
      continue;
    }

    const found = findUploadedBusinessLogo(child, origin);
    if (found) return found;
  }

  // app icon은 마지막 후보. KTownTriangle 기본 icon이면 제외.
  const appIcon =
    text(value.app_icon_url) ||
    text(value.appIconUrl);

  if (appIcon && !isDefaultKtownIcon(appIcon, origin)) {
    return appIcon;
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

    const origin = new URL(request.url).origin;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id,logo_url,image_url,image_urls,slider_image_urls,website_settings",
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
     * 1. businesses.logo_url
     * 2. Website Editor의 실제 logo 셀 / logo_url
     * 3. businesses.image_url
     * 4. 마지막에만 KTownTriangle 기본 아이콘
     *
     * 오래된 website_settings.app_icon_url이 /icon-512.png인 경우에는
     * 비즈니스 로고로 취급하지 않습니다.
     */
    const uploadedLogo =
      findUploadedBusinessLogo(
        data.website_settings,
        origin,
      );

    const candidates = [
      text(data.logo_url),
      uploadedLogo,
      text(data.image_url),
    ].filter(
      (value) =>
        Boolean(value) &&
        !isDefaultKtownIcon(value, origin),
    );

    let lastError: unknown = null;

    for (const source of candidates) {
      try {
        const imageUrl = absoluteImageUrl(source, origin);
        const image = await fetchImage(imageUrl);

        return new NextResponse(image.bytes, {
          status: 200,
          headers: {
            "Content-Type": image.contentType,
            // favicon 변경이 바로 반영되도록 캐시를 사실상 끕니다.
            "Cache-Control":
              "no-store, no-cache, must-revalidate, max-age=0",
            Pragma: "no-cache",
            Expires: "0",
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
            "X-Business-Favicon-Source": source,
          },
        });
      } catch (error) {
        lastError = error;
        console.error(
          "Business favicon candidate failed:",
          source,
          error,
        );
      }
    }

    console.error(
      "No usable business favicon source. Falling back to KTown icon.",
      lastError,
    );

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
          "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "X-Business-Favicon-Source": "ktown-fallback",
      },
    });
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
