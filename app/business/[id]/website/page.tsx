import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import InstallAppButton from "@/app/components/InstallAppButton";
import { PublicWebsiteRenderer } from "@/app/admin/businesses/[id]/website/WebsiteEditor";

import BusinessServiceWorker from "./BusinessServiceWorker";

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

type PublicBusiness = UnknownRecord & {
  id: number;
  name?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  slider_image_urls?: string[] | null;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  hours?: unknown;
  website_enabled?: boolean | null;
  website_slug?: string | null;
  website_status?: string | null;
  website_settings?: UnknownRecord | null;
};

type PublicSection = {
  id: number;
  business_id: number;
  section_type: string;
  title: string | null;
  content: UnknownRecord;
  settings: UnknownRecord;
  sort_order: number;
  is_visible: boolean;
};

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

function isDefaultKtownIcon(value: string) {
  if (!value) return false;

  try {
    const pathname = new URL(value, SITE_URL).pathname.toLowerCase();
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

/**
 * 웹사이트 설정 안에서 "실제 비즈니스 로고"를 찾습니다.
 * 오래전에 app_icon_url에 저장된 KTownTriangle 기본 아이콘은
 * 비즈니스 favicon 후보에서 제외합니다.
 */
function findUploadedBusinessLogo(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUploadedBusinessLogo(item);
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

    if (logo && !isDefaultKtownIcon(logo)) return logo;
  }

  // app_icon_url보다 실제 logo 계열을 먼저 사용합니다.
  const explicitLogo =
    text(value.logo_url) ||
    text(value.logoUrl) ||
    text(value.business_logo_url) ||
    text(value.businessLogoUrl) ||
    text(value.header_logo_url) ||
    text(value.headerLogoUrl);

  if (explicitLogo && !isDefaultKtownIcon(explicitLogo)) {
    return explicitLogo;
  }

  for (const [key, child] of Object.entries(value)) {
    // app_icon_url은 마지막 후보로 따로 처리합니다.
    if (key === "app_icon_url" || key === "appIconUrl") continue;

    const found = findUploadedBusinessLogo(child);
    if (found) return found;
  }

  const appIcon =
    text(value.app_icon_url) ||
    text(value.appIconUrl);

  if (appIcon && !isDefaultKtownIcon(appIcon)) {
    return appIcon;
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

async function loadBusiness(businessId: number): Promise<{
  data: PublicBusiness | null;
  error: { message: string } | null;
}> {
  const result = await getServerSupabase()
    .from("businesses")
    .select(
      [
        "id",
        "name",
        "image_url",
        "image_urls",
        "slider_image_urls",
        "logo_url",
        "address",
        "phone",
        "lat",
        "lng",
        "hours",
        "website_enabled",
        "website_slug",
        "website_status",
        "website_settings",
      ].join(","),
    )
    .eq("id", businessId)
    .maybeSingle();

  if (result.error) {
    return {
      data: null,
      error: { message: result.error.message },
    };
  }

  const rawData: unknown = result.data;

  if (!isRecord(rawData)) {
    return {
      data: null,
      error: null,
    };
  }

  const business: PublicBusiness = {
    ...rawData,
    id: Number(rawData.id) || businessId,
  };

  return {
    data: business,
    error: null,
  };
}

function normalizeSectionsForPublic(rows: unknown[]): PublicSection[] {
  return rows
    .filter(isRecord)
    .map((row) => ({
      id: Number(row.id) || 0,
      business_id: Number(row.business_id) || 0,
      section_type: text(row.section_type) || "section",
      title: text(row.title) || null,
      content: isRecord(row.content) ? row.content : {},
      settings: isRecord(row.settings) ? row.settings : {},
      sort_order: Number(row.sort_order) || 0,
      is_visible: row.is_visible !== false,
    }))
    .filter((section) => section.is_visible)
    .sort((a, b) => {
      const orderDifference = a.sort_order - b.sort_order;
      return orderDifference !== 0
        ? orderDifference
        : a.id - b.id;
    });
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { id } = await params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return {
      title: "KTown Triangle",
      description: "Discover local businesses on KTown Triangle.",
    };
  }

  const businessResult = await loadBusiness(businessId);

  if (businessResult.error || !businessResult.data) {
    return {
      title: "KTown Triangle",
      description: "Discover local businesses on KTown Triangle.",
    };
  }

  const business = businessResult.data;
  const businessName = text(business.name) || "Business";

  const uploadedLogo =
    text(business.logo_url) ||
    findUploadedBusinessLogo(business.website_settings) ||
    text(business.image_url);

  const websitePath = `/business/${businessId}/website`;
  const pageUrl = `${SITE_URL}${websitePath}`;
  const manifestUrl = `${websitePath}/manifest.webmanifest?v=7`;

  /*
   * favicon URL에 버전을 올려 브라우저가 예전 KTownTriangle favicon을
   * 계속 캐시해서 쓰지 않도록 합니다.
   */
  const icon32 = `${websitePath}/icon/32?v=7`;
  const icon192 = `${websitePath}/icon/192?v=7`;
  const icon512 = `${websitePath}/icon/512?v=7`;

  const fallbackIcon = absoluteUrl(uploadedLogo, "/icon-512.png");

  return {
    metadataBase: new URL(SITE_URL),
    title: businessName,
    description: `${businessName} official website`,
    applicationName: businessName,
    manifest: manifestUrl,

    appleWebApp: {
      capable: true,
      title: businessName,
      statusBarStyle: "default",
    },

    icons: {
      icon: [
        {
          url: icon32,
          sizes: "32x32",
          type: "image/png",
        },
        {
          url: icon192,
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: icon512,
          sizes: "512x512",
          type: "image/png",
        },
        {
          url: fallbackIcon,
        },
      ],
      shortcut: [
        {
          url: icon32,
          sizes: "32x32",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: icon192,
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },

    alternates: {
      canonical: pageUrl,
    },

    other: {
      "mobile-web-app-capable": "yes",
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-title": businessName,
    },
  };
}

export default async function BusinessWebsitePage({
  params,
}: Props) {
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
        "id,business_id,section_type,title,content,settings,sort_order,is_visible",
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

  const business = businessResult.data;

  if (!business) {
    notFound();
  }

  const businessName = text(business.name) || "Business";
  const publicSections = normalizeSectionsForPublic(
    sectionsResult.data || [],
  );

  return (
    <>
      <BusinessServiceWorker
        businessId={String(businessId)}
      />

      <InstallAppButton businessName={businessName} />

      <PublicWebsiteRenderer
        business={business}
        sections={publicSections}
        pageSlug="home"
      />
    </>
  );
}
