import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import InstallAppButton from "@/app/components/InstallAppButton";
import { PublicWebsiteRenderer } from "@/app/admin/businesses/[id]/website/WebsiteEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Props = {
  params: Promise<{ id: string }>;
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ||
  "https://www.ktowntriangle.com";


type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 편집기에서 만든 logo 셀의 image_url을 먼저 찾습니다.
 * header_grid 안의 로고가 가장 먼저 선택됩니다.
 */
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

async function loadBusiness(businessId: number) {
  return getServerSupabase()
    .from("businesses")
    .select(
      "id, name, image_url, hours, website_enabled, website_slug, website_status, website_settings",
    )
    .eq("id", businessId)
    .maybeSingle();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return {
      title: "Ktown Triangle",
      description: "Discover local businesses on Ktown Triangle.",
    };
  }

  const { data: business } = await loadBusiness(businessId);

  if (!business) {
    return {
      title: "Ktown Triangle",
      description: "Discover local businesses on Ktown Triangle.",
    };
  }

  const businessName = text(business.name) || "Business";

  // 편집기에서 업로드한 헤더 로고를 자동으로 앱 아이콘으로 사용합니다.
  const uploadedLogo = findUploadedLogo(business.website_settings);
  const appIcon = absoluteUrl(
    uploadedLogo || business.image_url,
    "/icon-512.png",
  );

  const pageUrl = `${SITE_URL}/business/${businessId}/website`;

  return {
    metadataBase: new URL(SITE_URL),
    title: businessName,
    description: `${businessName} official website`,
    manifest: `/business/${businessId}/website/manifest.webmanifest`,

    appleWebApp: {
      capable: true,
      title: businessName,
      statusBarStyle: "default",
    },

    icons: {
      icon: [{ url: appIcon }],
      apple: [{ url: appIcon }],
    },

    alternates: {
      canonical: pageUrl,
    },
  };
}

export default async function BusinessWebsitePage({ params }: Props) {
  noStore();

  const { id } = await params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    notFound();
  }

  const supabase = getServerSupabase();

  const [businessResult, sectionsResult] = await Promise.all([
    loadBusiness(businessId),

    supabase
      .from("business_sections")
      .select(
        "id, business_id, section_type, title, content, settings, sort_order, is_visible",
      )
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (businessResult.error) {
    throw new Error(businessResult.error.message);
  }

  if (sectionsResult.error) {
    throw new Error(sectionsResult.error.message);
  }

  if (!businessResult.data) {
    notFound();
  }

  return (
    <>
      <InstallAppButton />

      <PublicWebsiteRenderer
        business={businessResult.data}
        sections={sectionsResult.data || []}
        pageSlug="home"
      />
    </>
  );
}
