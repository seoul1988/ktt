import { supabaseAdmin } from "../../../lib/supabaseAdmin";
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

type MagazineIssueRow = {
  id: number;
  title: string;
  issue_number: string | null;
  published_at: string | null;
};

type MagazinePageRow = {
  id: number;
  issue_id: number;
  page_number: number;
  page_title: string | null;
  layout_type: string;
  layout_json: unknown | null;
  background_color: string | null;
  page_image_url: string | null;
};

type MagazineSlotRow = {
  id: number;
  page_id: number;
  slot_key: string;
  ad_id: string | null;
  expected_ad_size: number;
  grid_column_start: number;
  grid_row_start: number;
  grid_column_span: number;
  grid_row_span: number;
  sort_order: number;
};

type MagazineAdRow = {
  id: string;
  business_id: number;
  ad_size: number;
  image_url: string | null;
  enabled: boolean | null;
  priority: number | null;
  object_fit?: "cover" | "contain" | "fill" | null;
};

type PackedAd = FlipbookAd & {
  grid_column_start: number;
  grid_row_start: number;
  grid_column_span: number;
  grid_row_span: number;
};

type Shape = {
  columnSpan: number;
  rowSpan: number;
};

const GRID_COLUMNS = 6;
const GRID_ROWS = 6;

const AD_SHAPES: Record<FlipbookAdSize, Shape> = {
  1: { columnSpan: 6, rowSpan: 6 },
  2: { columnSpan: 6, rowSpan: 3 },
  3: { columnSpan: 3, rowSpan: 3 },
  4: { columnSpan: 3, rowSpan: 2 },
  5: { columnSpan: 3, rowSpan: 1 },
};

function normalizeAdSize(value: unknown): FlipbookAdSize | null {
  const size = Number(value);

  if (
    size === 1 ||
    size === 2 ||
    size === 3 ||
    size === 4 ||
    size === 5
  ) {
    return size;
  }

  return null;
}

function createGrid() {
  return Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLUMNS }, () => false),
  );
}

function canPlace(
  grid: boolean[][],
  rowStart: number,
  columnStart: number,
  shape: Shape,
) {
  if (
    rowStart + shape.rowSpan > GRID_ROWS ||
    columnStart + shape.columnSpan > GRID_COLUMNS
  ) {
    return false;
  }

  for (
    let row = rowStart;
    row < rowStart + shape.rowSpan;
    row += 1
  ) {
    for (
      let column = columnStart;
      column < columnStart + shape.columnSpan;
      column += 1
    ) {
      if (grid[row][column]) {
        return false;
      }
    }
  }

  return true;
}

function occupy(
  grid: boolean[][],
  rowStart: number,
  columnStart: number,
  shape: Shape,
) {
  for (
    let row = rowStart;
    row < rowStart + shape.rowSpan;
    row += 1
  ) {
    for (
      let column = columnStart;
      column < columnStart + shape.columnSpan;
      column += 1
    ) {
      grid[row][column] = true;
    }
  }
}

function findPlacement(
  grid: boolean[][],
  size: FlipbookAdSize,
) {
  const shape = AD_SHAPES[size];

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (
      let column = 0;
      column < GRID_COLUMNS;
      column += 1
    ) {
      if (
        canPlace(
          grid,
          row,
          column,
          shape,
        )
      ) {
        return {
          rowStart: row,
          columnStart: column,
          shape,
        };
      }
    }
  }

  return null;
}

function adArea(ad: FlipbookAd) {
  const shape = AD_SHAPES[ad.ad_size];
  return shape.columnSpan * shape.rowSpan;
}

/**
 * 기존 광고 라이브러리를 자동으로 6×6 페이지에 배치합니다.
 * 발행된 잡지가 없을 때만 백업 플립북으로 사용합니다.
 */
function buildLegacyAdPages(
  ads: FlipbookAd[],
): AdPage[] {
  const pages: AdPage[] = [];
  let remaining = [...ads];

  while (remaining.length > 0) {
    const candidates = [...remaining].sort(
      (a, b) => {
        const areaDifference =
          adArea(b) - adArea(a);

        if (areaDifference !== 0) {
          return areaDifference;
        }

        return (
          Number(b.priority || 0) -
          Number(a.priority || 0)
        );
      },
    );

    const grid = createGrid();
    const packed: PackedAd[] = [];
    const usedIds = new Set<string>();

    for (const ad of candidates) {
      const placement = findPlacement(
        grid,
        ad.ad_size,
      );

      if (!placement) {
        continue;
      }

      occupy(
        grid,
        placement.rowStart,
        placement.columnStart,
        placement.shape,
      );

      packed.push({
        ...ad,
        grid_column_start:
          placement.columnStart + 1,
        grid_row_start:
          placement.rowStart + 1,
        grid_column_span:
          placement.shape.columnSpan,
        grid_row_span:
          placement.shape.rowSpan,
      });

      usedIds.add(String(ad.id));

      if (ad.ad_size === 1) {
        break;
      }
    }

    if (packed.length === 0) {
      const fallback = remaining[0];
      const shape =
        AD_SHAPES[fallback.ad_size];

      packed.push({
        ...fallback,
        grid_column_start: 1,
        grid_row_start: 1,
        grid_column_span:
          shape.columnSpan,
        grid_row_span:
          shape.rowSpan,
      });

      usedIds.add(String(fallback.id));
    }

    pages.push({
      id: `legacy-ad-page-${
        pages.length + 1
      }`,
      ads: packed,
    });

    remaining = remaining.filter(
      (ad) =>
        !usedIds.has(String(ad.id)),
    );
  }

  return pages;
}

async function loadBusinessMap(
  businessIds: number[],
) {
  if (businessIds.length === 0) {
    return new Map<number, BusinessRow>();
  }

  const {
    data: businessData,
    error: businessError,
  } = await supabaseAdmin
    .from("businesses")
    .select("id, name, website_url")
    .in("id", businessIds);

  if (businessError) {
    console.error(
      "Flipbook business information load error:",
      businessError,
    );

    return new Map<number, BusinessRow>();
  }

  return new Map(
    (
      (businessData || []) as BusinessRow[]
    ).map((business) => [
      Number(business.id),
      business,
    ]),
  );
}

/**
 * 가장 최근에 공개 발행된 잡지를 읽습니다.
 *
 * 발행된 잡지가 정상적으로 있으면 해당 편집 순서와 슬롯 좌표를 그대로 사용합니다.
 * 발행 잡지가 없거나 페이지가 비어 있으면 null을 반환하여 기존 플립북으로 넘어갑니다.
 */
async function loadLatestPublishedMagazinePages(): Promise<
  AdPage[] | null
> {
  const {
    data: issueData,
    error: issueError,
  } = await supabaseAdmin
    .from("magazine_issues")
    .select(`
      id,
      title,
      issue_number,
      published_at
    `)
    .eq("status", "published")
    .eq("is_public", true)
    .order("published_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("id", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (issueError) {
    console.error(
      "Published magazine issue load error:",
      issueError,
    );

    return null;
  }

  const issue =
    issueData as MagazineIssueRow | null;

  if (!issue) {
    return null;
  }

  const {
    data: pageData,
    error: pageError,
  } = await supabaseAdmin
    .from("magazine_pages")
    .select(`
      id,
      issue_id,
      page_number,
      page_title,
      layout_type,
      layout_json,
      background_color,
      page_image_url
    `)
    .eq("issue_id", issue.id)
    .order("page_number", {
      ascending: true,
    });

  if (pageError) {
    console.error(
      "Published magazine page load error:",
      pageError,
    );

    return null;
  }

  const pages =
    (pageData || []) as MagazinePageRow[];

  if (pages.length === 0) {
    return null;
  }

  const pageIds = pages.map(
    (page) => page.id,
  );

  const {
    data: slotData,
    error: slotError,
  } = await supabaseAdmin
    .from("magazine_page_slots")
    .select(`
      id,
      page_id,
      slot_key,
      ad_id,
      expected_ad_size,
      grid_column_start,
      grid_row_start,
      grid_column_span,
      grid_row_span,
      sort_order
    `)
    .in("page_id", pageIds)
    .order("sort_order", {
      ascending: true,
    });

  if (slotError) {
    console.error(
      "Published magazine slot load error:",
      slotError,
    );

    return null;
  }

  const slots =
    (slotData || []) as MagazineSlotRow[];

  const adIds = Array.from(
    new Set(
      slots
        .map((slot) => slot.ad_id)
        .filter(
          (id): id is string =>
            typeof id === "string" &&
            id.length > 0,
        ),
    ),
  );

  let magazineAds: MagazineAdRow[] = [];

  if (adIds.length > 0) {
    const {
      data: magazineAdData,
      error: magazineAdError,
    } = await supabaseAdmin
      .from("business_flipbook_ads")
      .select(`
        id,
        business_id,
        ad_size,
        image_url,
        enabled,
        priority,
        object_fit
      `)
      .in("id", adIds);

    if (magazineAdError) {
      console.error(
        "Published magazine advertisement load error:",
        magazineAdError,
      );

      return null;
    }

    magazineAds =
      (magazineAdData ||
        []) as MagazineAdRow[];
  }

  const businessIds = Array.from(
    new Set(
      magazineAds
        .map((ad) =>
          Number(ad.business_id),
        )
        .filter((id) =>
          Number.isFinite(id),
        ),
    ),
  );

  const businessMap =
    await loadBusinessMap(businessIds);

  const adMap = new Map(
    magazineAds.map((ad) => [
      String(ad.id),
      ad,
    ]),
  );

  const adPages: AdPage[] = pages.map(
    (page) => {
      const pageSlots = slots
        .filter(
          (slot) =>
            slot.page_id === page.id,
        )
        .sort(
          (a, b) =>
            a.sort_order -
            b.sort_order,
        );

      const pageAds: PackedAd[] = [];

      for (const slot of pageSlots) {
        if (!slot.ad_id) {
          continue;
        }

        const row = adMap.get(
          String(slot.ad_id),
        );

        if (!row) {
          continue;
        }

        const adSize = normalizeAdSize(
          row.ad_size,
        );

        const imageUrl = String(
          row.image_url || "",
        ).trim();

        const businessId = Number(
          row.business_id,
        );

        if (
          !adSize ||
          !imageUrl ||
          !Number.isFinite(businessId)
        ) {
          continue;
        }

        const business =
          businessMap.get(businessId);

        pageAds.push({
          id: row.id,
          business_id: businessId,
          ad_size: adSize,
          image_url: imageUrl,
          enabled: true,
          priority: Number(
            row.priority || 0,
          ),
          business_name:
            business?.name ||
            "Advertisement",
          website_url:
            business?.website_url ||
            null,
          show_size_badge: false,
          object_fit:
            row.object_fit ||
            "cover",
          slot_key:
            slot.slot_key,
          grid_column_start:
            Number(
              slot.grid_column_start,
            ) || 1,
          grid_row_start:
            Number(
              slot.grid_row_start,
            ) || 1,
          grid_column_span:
            Number(
              slot.grid_column_span,
            ) || 1,
          grid_row_span:
            Number(
              slot.grid_row_span,
            ) || 1,
        });
      }

      return {
        id: `magazine-${issue.id}-page-${page.id}`,
        ads: pageAds,
        page_number: page.page_number,
        page_title:
          page.page_title ||
          `Page ${page.page_number}`,
        background_color:
          page.background_color ||
          "#ffffff",
        page_image_url:
          page.page_image_url ||
          null,
        layout_type:
          page.layout_type,
        layout_json:
          page.layout_json || null,
      } as AdPage;
    },
  );

  /*
   * 빈 페이지도 잡지 구성의 일부이므로 그대로 반환합니다.
   * BusinessAdFlipbook이 빈 ads 배열을 지원하지 않는 경우에는
   * 아래 filter를 사용하세요:
   *
   * return adPages.filter((page) => page.ads.length > 0);
   */
  console.info("Published flipbook diagnostics:", {
    issueId: issue.id,
    pageCount: pages.length,
    slotCount: slots.length,
    referencedAdIds: adIds,
    loadedAdCount: magazineAds.length,
    loadedAdIds: magazineAds.map((ad) => String(ad.id)),
    pages: adPages.map((page) => ({
      id: page.id,
      page_number: page.page_number,
      adCount: page.ads.length,
      ads: page.ads.map((ad) => ({
        id: String(ad.id),
        grid_column_start: ad.grid_column_start,
        grid_row_start: ad.grid_row_start,
        grid_column_span: ad.grid_column_span,
        grid_row_span: ad.grid_row_span,
      })),
    })),
  });

  return adPages;
}

async function loadLegacyAdPages(): Promise<
  AdPage[]
> {
  const {
    data: adData,
    error: adError,
  } = await supabaseAdmin
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
    .order("priority", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (adError) {
    console.error(
      "Legacy flipbook advertisement load error:",
      adError,
    );
  }

  const rawAds =
    (adData || []) as FlipbookAdRow[];

  const businessIds = Array.from(
    new Set(
      rawAds
        .map((ad) =>
          Number(ad.business_id),
        )
        .filter((id) =>
          Number.isFinite(id),
        ),
    ),
  );

  const businessMap =
    await loadBusinessMap(businessIds);

  const ads: FlipbookAd[] = [];

  for (const row of rawAds) {
    const adSize = normalizeAdSize(
      row.ad_size,
    );

    const imageUrl = String(
      row.image_url || "",
    ).trim();

    const businessId = Number(
      row.business_id,
    );

    if (
      !adSize ||
      !imageUrl ||
      row.enabled !== true ||
      !Number.isFinite(businessId)
    ) {
      continue;
    }

    const business =
      businessMap.get(businessId);

    ads.push({
      id: row.id,
      business_id: businessId,
      ad_size: adSize,
      image_url: imageUrl,
      enabled: true,
      priority: Number(
        row.priority || 0,
      ),
      business_name:
        business?.name ||
        "Advertisement",
      website_url:
        business?.website_url ||
        null,
      show_size_badge: false,
    });
  }

  return buildLegacyAdPages(ads);
}

export default async function BusinessAdsPage() {
  /*
   * 1. 최신 공개 발행 잡지를 먼저 시도합니다.
   * 2. 발행 잡지가 없거나 조회에 실패하면 기존 자동 플립북을 표시합니다.
   * 3. 따라서 새 발행 기능을 연결해도 기존 플립북 데이터는 삭제되지 않습니다.
   */
  const publishedMagazinePages =
    await loadLatestPublishedMagazinePages();

  if (
    publishedMagazinePages &&
    publishedMagazinePages.length > 0
  ) {
    return (
      <BusinessAdFlipbook
        adPages={
          publishedMagazinePages
        }
      />
    );
  }

  const legacyAdPages =
    await loadLegacyAdPages();

  return (
    <BusinessAdFlipbook
      adPages={legacyAdPages}
    />
  );
}