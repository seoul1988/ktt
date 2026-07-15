import { supabase } from "../../../lib/supabase";
import BusinessAdFlipbook from "../../components/BusinessAdFlipbook";
import type {
  AdPage,
  FlipbookAd,
  FlipbookAdSize,
} from "../../components/flipbookTypes";   

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FlipbookAdRow = {
  id: number | string;
  business_id: number;
  ad_size: number;
  image_url: string | null;
  enabled: boolean | null;
  priority: number | null;
  created_at?: string | null;
};

type BusinessRow = {
  id: number;
  name: string | null;
  website_url: string | null;
};

const PAGE_CAPACITY = 12;

const AD_UNITS: Record<FlipbookAdSize, number> = {
  1: 12, // 전체면
  2: 6,  // 반면
  3: 3,  // 1/4면
  4: 2,  // 1/6면
};

function normalizeAdSize(value: unknown): FlipbookAdSize | null {
  const size = Number(value);

  if (size === 1 || size === 2 || size === 3 || size === 4) {
    return size;
  }

  return null;
}

/**
 * 광고를 우선순위 순서대로 한 페이지 최대 12단위에 맞춰 배치합니다.
 *
 * Size 1 = 12단위 = 전체면
 * Size 2 =  6단위 = 반면
 * Size 3 =  3단위 = 1/4면
 * Size 4 =  2단위 = 1/6면
 */
function buildAdPages(ads: FlipbookAd[]): AdPage[] {
  const pages: AdPage[] = [];
  let currentAds: FlipbookAd[] = [];
  let currentUnits = 0;

  function completeCurrentPage() {
    if (currentAds.length === 0) return;

    pages.push({
      id: `ad-page-${pages.length + 1}`,
      ads: currentAds,
    });

    currentAds = [];
    currentUnits = 0;
  }

  for (const ad of ads) {
    const units = AD_UNITS[ad.ad_size];

    // 전체면 광고는 반드시 단독 페이지로 표시합니다.
    if (ad.ad_size === 1) {
      completeCurrentPage();

      pages.push({
        id: `ad-page-${pages.length + 1}`,
        ads: [ad],
      });

      continue;
    }

    // 현재 페이지에 들어가지 않으면 새 페이지를 시작합니다.
    if (currentUnits + units > PAGE_CAPACITY) {
      completeCurrentPage();
    }

    currentAds.push(ad);
    currentUnits += units;

    // 페이지가 정확히 채워졌으면 바로 완료합니다.
    if (currentUnits === PAGE_CAPACITY) {
      completeCurrentPage();
    }
  }

  completeCurrentPage();

  return pages;
}



export default async function BusinessAdsPage() {
  /*
   * 새 광고 테이블에서 활성화된 광고만 가져옵니다.
   * 등록/수정 페이지의 체크박스가 enabled 값으로 저장됩니다.
   */
  const { data: adData, error: adError } = await supabase
    .from("business_flipbook_ads")
    .select(`
      id,
      business_id,
      ad_size,
      image_url,
      enabled,
      priority,
      created_at
    `)
    .eq("enabled", true)
    .not("image_url", "is", null)
    .neq("image_url", "")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (adError) {
    console.error("Flipbook advertisement load error:", adError);
  }

  const rawAds = (adData || []) as FlipbookAdRow[];

  /*
   * 광고에 표시할 업체명과 웹사이트를 businesses 테이블에서 따로 가져옵니다.
   * 관계 설정 여부와 상관없이 안정적으로 작동하도록 두 번 조회합니다.
   */
  const businessIds = Array.from(
    new Set(
      rawAds
        .map((ad) => Number(ad.business_id))
        .filter((id) => Number.isFinite(id)),
    ),
  );

  let businessMap = new Map<number, BusinessRow>();

  if (businessIds.length > 0) {
    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("id, name, website_url")
      .in("id", businessIds);

    if (businessError) {
      console.error(
        "Flipbook business information load error:",
        businessError,
      );
    }

    businessMap = new Map(
      ((businessData || []) as BusinessRow[]).map((business) => [
        Number(business.id),
        business,
      ]),
    );
  }

  const ads: FlipbookAd[] = [];

  for (const row of rawAds) {
    const adSize = normalizeAdSize(row.ad_size);
    const imageUrl = String(row.image_url || "").trim();
    const businessId = Number(row.business_id);

    if (
      !adSize ||
      !imageUrl ||
      row.enabled !== true ||
      !Number.isFinite(businessId)
    ) {
      continue;
    }

    const business = businessMap.get(businessId);

    ads.push({
      id: row.id,
      business_id: businessId,
      ad_size: adSize,
      image_url: imageUrl,
      enabled: true,
      priority: Number(row.priority || 0),
      business_name: business?.name || "Advertisement",
      website_url: business?.website_url || null,
      show_size_badge: false,
    });
  }

  ads.sort((a, b) => {
    const priorityDifference =
      Number(b.priority || 0) - Number(a.priority || 0);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    // 같은 우선순위에서는 큰 광고부터 배치합니다.
    return a.ad_size - b.ad_size;
  });

  const adPages = buildAdPages(ads);

  return <BusinessAdFlipbook adPages={adPages} />;
}