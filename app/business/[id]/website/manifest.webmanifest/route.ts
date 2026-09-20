
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHost(value: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .split(",")[0]
    .trim()
    .split(":")[0]
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

function getServerSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase 환경변수가 설정되어 있지 않습니다.",
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: Props,
) {
  const { id } = await params;
  const businessId = Number(id);

  if (
    !Number.isInteger(businessId) ||
    businessId <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid business ID" },
      { status: 400 },
    );
  }

  const { data: business, error } =
    await getServerSupabase()
      .from("businesses")
      .select("id, name, custom_domain")
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

  const businessName =
    text(business.name) || "Business";

  const websitePath =
    `/business/${businessId}/website`;

  const requestHost = normalizeHost(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host"),
  );

  const customDomain = normalizeHost(
    business.custom_domain,
  );

  const isCustomDomain =
    Boolean(customDomain) &&
    requestHost === customDomain;

  /*
   * 커스텀 도메인에서는 사이트 루트 자체를 PWA 범위로 사용합니다.
   * KTown 기본 도메인에서는 기존 비즈니스별 경로를 그대로 유지합니다.
   */
  const appId = isCustomDomain
    ? "/"
    : `${websitePath}?pwa=business-${businessId}`;

  const startUrl = isCustomDomain
    ? "/?source=pwa"
    : `${websitePath}?source=pwa&business=${businessId}`;

  const scope = isCustomDomain
    ? "/"
    : websitePath;

  return NextResponse.json(
    {
      id: appId,

      name: businessName,

      short_name:
        businessName.length > 12
          ? businessName.slice(0, 12).trim()
          : businessName,

      description:
        `${businessName} official website`,

      start_url: startUrl,

      scope,

      display: "standalone",

      display_override: [
        "window-controls-overlay",
        "standalone",
        "minimal-ui",
      ],

      orientation: "any",

      background_color: "#ffffff",
      theme_color: "#ffffff",

      prefer_related_applications: false,

      icons: [
        {
          src:
            `/business/${businessId}/website/icon/192`,
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src:
            `/business/${businessId}/website/icon/512`,
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src:
            `/business/${businessId}/website/icon/512?purpose=maskable`,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type":
          "application/manifest+json; charset=utf-8",

        "Cache-Control":
          "no-store, no-cache, must-revalidate, max-age=0",

        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}
