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

  for (let row = rowStart; row < rowStart + shape.rowSpan; row += 1) {
    for (
      let column = columnStart;
      column < columnStart + shape.columnSpan;
      column += 1
    ) {
      if (grid[row][column]) return false;
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
  for (let row = rowStart; row < rowStart + shape.rowSpan; row += 1) {
    for (
      let column = columnStart;
      column < columnStart + shape.columnSpan;
      column += 1
    ) {
      grid[row][column] = true;
    }
  }
}

function findPlacement(grid: boolean[][], size: FlipbookAdSize) {
  const shape = AD_SHAPES[size];

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      if (canPlace(grid, row, column, shape)) {
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
 * 페이지를 실제 6×6 좌표로 배치합니다.
 *
 * 핵심:
 * 1. 큰 광고부터 먼저 넣어 공간이 조각나는 것을 막습니다.
 * 2. 같은 크기에서는 Display Priority가 높은 광고를 먼저 넣습니다.
 * 3. 각 광고의 정확한 grid row/column 좌표를 저장합니다.
 * 4. 화면 컴포넌트가 이 좌표를 그대로 사용하므로 다시 섞이지 않습니다.
 */
function buildAdPages(ads: FlipbookAd[]): AdPage[] {
  const pages: AdPage[] = [];
  let remaining = [...ads];

  while (remaining.length > 0) {
    /*
     * 페이지마다 큰 광고를 우선 배치합니다.
     * 따라서 다음 페이지의 큰 광고가 현재 페이지 빈 공간에 들어갈 수 있으면
     * 작은 광고보다 먼저 끌어와 페이지를 채웁니다.
     */
    const candidates = [...remaining].sort((a, b) => {
      const areaDifference = adArea(b) - adArea(a);

      if (areaDifference !== 0) {
        return areaDifference;
      }

      return Number(b.priority || 0) - Number(a.priority || 0);
    });

    const grid = createGrid();
    const packed: PackedAd[] = [];
    const usedIds = new Set<string>();

    for (const ad of candidates) {
      const placement = findPlacement(grid, ad.ad_size);

      if (!placement) continue;

      occupy(
        grid,
        placement.rowStart,
        placement.columnStart,
        placement.shape,
      );

      packed.push({
        ...ad,
        grid_column_start: placement.columnStart + 1,
        grid_row_start: placement.rowStart + 1,
        grid_column_span: placement.shape.columnSpan,
        grid_row_span: placement.shape.rowSpan,
      });

      usedIds.add(String(ad.id));

      if (ad.ad_size === 1) {
        break;
      }
    }

    if (packed.length === 0) {
      const fallback = remaining[0];
      const shape = AD_SHAPES[fallback.ad_size];

      packed.push({
        ...fallback,
        grid_column_start: 1,
        grid_row_start: 1,
        grid_column_span: shape.columnSpan,
        grid_row_span: shape.rowSpan,
      });

      usedIds.add(String(fallback.id));
    }

    pages.push({
      id: `ad-page-${pages.length + 1}`,
      ads: packed,
    });

    remaining = remaining.filter((ad) => !usedIds.has(String(ad.id)));
  }

  return pages;
}

export default async function BusinessAdsPage() {
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

  const adPages = buildAdPages(ads);

  return <BusinessAdFlipbook adPages={adPages} />;
}
