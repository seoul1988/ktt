import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{
    id: string;
    size: string;
  }>;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase 환경변수가 설정되어 있지 않습니다.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function GET(request: Request, { params }: Props) {
  const { id, size: requestedSize } = await params;
  const businessId = Number(id);
  const size = Number(requestedSize);

  if (
    !Number.isInteger(businessId) ||
    businessId <= 0 ||
    (size !== 192 && size !== 512)
  ) {
    return NextResponse.json(
      { error: "Invalid icon request" },
      { status: 400 },
    );
  }

  const { data: business, error } = await getServerSupabase()
    .from("businesses")
    .select("id, name, image_url, website_settings")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  if (!business) {
    return NextResponse.json(
      { error: "Business not found" },
      { status: 404 },
    );
  }

  const uploadedLogo = findUploadedLogo(business.website_settings);
  const logoUrl =
    uploadedLogo ||
    text(business.image_url) ||
    new URL("/icon-512.png", request.url).href;

  const requestUrl = new URL(request.url);
  const maskable = requestUrl.searchParams.get("purpose") === "maskable";

  /*
   * 업로드한 로고 자체는 수정하지 않습니다.
   * 브라우저에 전달할 때만 정확한 192×192 또는 512×512 PNG로 렌더링합니다.
   * objectFit: contain으로 로고를 자르지 않습니다.
   */
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "#ffffff" : "transparent",
          padding: maskable ? "18%" : "8%",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    },
  );
}
