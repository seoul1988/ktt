import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { PublicWebsiteRenderer } from "@/app/admin/businesses/[id]/website/WebsiteEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Props = {
  params: Promise<{ id: string }>;
};

type UnknownRecord = Record<string, unknown>;

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

function isRecord(value: unknown): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 상대경로 이미지를 실제 공개 주소로 변경합니다.
 */
function getAbsoluteImageUrl(value: unknown) {
  const imageUrl = getString(value);

  if (!imageUrl) {
    return "https://www.ktowntriangle.com/og-default.jpg";
  }

  if (
    imageUrl.startsWith("https://") ||
    imageUrl.startsWith("http://")
  ) {
    return imageUrl;
  }

  if (imageUrl.startsWith("//")) {
    return `https:${imageUrl}`;
  }

  if (imageUrl.startsWith("/")) {
    return `https://www.ktowntriangle.com${imageUrl}`;
  }

  return `https://www.ktowntriangle.com/${imageUrl}`;
}

/**
 * 슬라이드 배열 안에서 첫 번째 이미지 주소를 찾습니다.
 */
function getFirstImageFromArray(value: unknown): string {
  if (!Array.isArray(value)) return "";

  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      return item.trim();
    }

    if (!isRecord(item)) continue;

    const image =
      getString(item.url) ||
      getString(item.imageUrl) ||
      getString(item.image_url) ||
      getString(item.src) ||
      getString(item.image) ||
      getString(item.fileUrl) ||
      getString(item.file_url);

    if (image) {
      return image;
    }
  }

  return "";
}

/**
 * 이미지 슬라이드 셀인지 확인합니다.
 */
function isImageSliderObject(value: UnknownRecord) {
  const type = (
    getString(value.type) ||
    getString(value.cellType) ||
    getString(value.cell_type) ||
    getString(value.contentType) ||
    getString(value.content_type) ||
    getString(value.kind)
  ).toLowerCase();

  return (
    type.includes("slider") ||
    type.includes("slideshow") ||
    type.includes("carousel") ||
    type === "image-slide" ||
    type === "image_slider" ||
    type === "imageslider"
  );
}

/**
 * 이미지 슬라이드 객체에서 첫 번째 이미지를 찾습니다.
 */
function getSliderFirstImage(value: UnknownRecord): string {
  const possibleArrays = [
    value.images,
    value.slides,
    value.gallery,
    value.galleryImages,
    value.gallery_images,
    value.sliderImages,
    value.slider_images,
    value.imageUrls,
    value.image_urls,
    value.items,
  ];

  for (const possibleArray of possibleArrays) {
    const image = getFirstImageFromArray(possibleArray);

    if (image) {
      return image;
    }
  }

  return (
    getString(value.imageUrl) ||
    getString(value.image_url) ||
    getString(value.src) ||
    getString(value.url) ||
    getString(value.image)
  );
}

/**
 * section.content 안을 순서대로 검색하여
 * 첫 번째 이미지 슬라이드의 첫 번째 사진을 가져옵니다.
 */
function findFirstSliderImage(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstSliderImage(item);

      if (found) {
        return found;
      }
    }

    return "";
  }

  if (!isRecord(value)) {
    return "";
  }

  if (isImageSliderObject(value)) {
    const sliderImage = getSliderFirstImage(value);

    if (sliderImage) {
      return sliderImage;
    }
  }

  /*
   * 타입 이름이 저장되지 않았더라도
   * 슬라이드 전용 배열이 있으면 첫 번째 사진을 사용합니다.
   */
  const sliderArrayKeys = [
    "slides",
    "sliderImages",
    "slider_images",
    "galleryImages",
    "gallery_images",
    "imageUrls",
    "image_urls",
  ];

  for (const key of sliderArrayKeys) {
    const image = getFirstImageFromArray(value[key]);

    if (image) {
      return image;
    }
  }

  /*
   * 객체의 저장 순서를 유지하며 재귀 검색합니다.
   */
  for (const childValue of Object.values(value)) {
    const found = findFirstSliderImage(childValue);

    if (found) {
      return found;
    }
  }

  return "";
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { id } = await params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return {
      title: "Ktown Triangle",
      description:
        "Discover local businesses on Ktown Triangle.",
    };
  }

  const supabase = getServerSupabase();

  const [businessResult, sectionsResult] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "id, name, image_url, website_enabled, website_slug, website_status, website_settings",
      )
      .eq("id", businessId)
      .maybeSingle(),

    supabase
      .from("business_sections")
      .select(
        "id, business_id, section_type, title, content, settings, sort_order, is_visible",
      )
      .eq("business_id", businessId)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  const business = businessResult.data;
  const sections = sectionsResult.data || [];

  if (!business) {
    return {
      title: "Ktown Triangle",
      description:
        "Discover local businesses on Ktown Triangle.",
    };
  }

  /*
   * 화면에 표시되는 섹션을 위에서부터 확인합니다.
   * 가장 먼저 발견되는 이미지 슬라이드의 첫 번째 사진을 사용합니다.
   */
  let firstSliderImage = "";

  for (const section of sections) {
    firstSliderImage =
      findFirstSliderImage(section.content) ||
      findFirstSliderImage(section.settings);

    if (firstSliderImage) {
      break;
    }
  }

  /*
   * 슬라이드 이미지가 없을 때만 business.image_url을 사용합니다.
   */
  const shareImage = getAbsoluteImageUrl(
    firstSliderImage || business.image_url,
  );

  const businessName =
    getString(business.name) || "Ktown Triangle Business";

  const pageUrl =
    `https://www.ktowntriangle.com/business/${businessId}/website`;

  const description =
    `${businessName}의 공식 비즈니스 홈페이지입니다.`;

  return {
    metadataBase: new URL("https://www.ktowntriangle.com"),

    title: businessName,
    description,

    alternates: {
      canonical: pageUrl,
    },

    openGraph: {
      type: "website",
      siteName: "Ktown Triangle",
      url: pageUrl,
      title: businessName,
      description,
      images: [
        {
          url: shareImage,
          width: 1200,
          height: 630,
          alt: `${businessName} 대표 이미지`,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title: businessName,
      description,
      images: [shareImage],
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
    supabase
      .from("businesses")
      .select(
        "id, name, image_url, hours, website_enabled, website_slug, website_status, website_settings",
      )
      .eq("id", businessId)
      .maybeSingle(),

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
    <PublicWebsiteRenderer
      business={businessResult.data}
      sections={sectionsResult.data || []}
      pageSlug="home"
    />
  );
}