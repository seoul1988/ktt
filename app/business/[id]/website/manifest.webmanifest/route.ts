import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

type UnknownRecord = Record<string, unknown>;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://www.ktowntriangle.com";

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

function absoluteUrl(value: unknown, fallback = "/icon-512.png") {
  const url = text(value) || fallback;

  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;

  return `${SITE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json(
      { error: "Invalid business ID" },
      { status: 400 },
    );
  }

  const { data: business, error } = await getServerSupabase()
    .from("businesses")
    .select("id, name, image_url, website_settings")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!business) {
    return NextResponse.json(
      { error: "Business not found" },
      { status: 404 },
    );
  }

  const businessName = text(business.name) || "Business";

  const uploadedLogo = findUploadedLogo(business.website_settings);
  const appIcon = absoluteUrl(
    uploadedLogo || business.image_url,
    "/icon-512.png",
  );

  const startUrl = `/business/${businessId}/website`;

  return NextResponse.json(
    {
      id: startUrl,
      name: businessName,
      short_name: businessName.slice(0, 12),
      description: `${businessName} official website`,
      start_url: startUrl,
      scope: `${startUrl}/`,
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons: [
        {
          src: appIcon,
          sizes: "192x192",
          purpose: "any",
        },
        {
          src: appIcon,
          sizes: "512x512",
          purpose: "any",
        },
        {
          src: appIcon,
          sizes: "512x512",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}