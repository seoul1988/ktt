"use client";

import type {
  AdPage,
  FlipbookAd,
  FlipbookAdSize,
} from "./flipbookTypes";

type Props = {
  page: AdPage;
  pageWidth: number;
  pageHeight: number;
};

type PackedAd = FlipbookAd & {
  grid_column_start?: number;
  grid_row_start?: number;
  grid_column_span?: number;
  grid_row_span?: number;
};

const sizeLabel: Record<FlipbookAdSize, string> = {
  1: "전체면",
  2: "반면",
  3: "1/4면",
  4: "1/6면",
  5: "1/12면",
};

function getFallbackSpan(size: FlipbookAdSize) {
  switch (size) {
    case 1:
      return { columnSpan: 6, rowSpan: 6 };
    case 2:
      return { columnSpan: 6, rowSpan: 3 };
    case 3:
      return { columnSpan: 3, rowSpan: 3 };
    case 4:
      return { columnSpan: 3, rowSpan: 2 };
    case 5:
      return { columnSpan: 3, rowSpan: 1 };
  }
}

function AdTile({ ad }: { ad: PackedAd }) {
  const fallback = getFallbackSpan(ad.ad_size);

  const columnSpan = ad.grid_column_span ?? fallback.columnSpan;
  const rowSpan = ad.grid_row_span ?? fallback.rowSpan;

  return (
    <article
      className="relative min-h-0 min-w-0 overflow-hidden bg-white"
      style={{
        gridColumnStart: ad.grid_column_start,
        gridRowStart: ad.grid_row_start,
        gridColumnEnd: `span ${columnSpan}`,
        gridRowEnd: `span ${rowSpan}`,
        backgroundColor: "#ffffff",
      }}
      aria-label={
        ad.business_name
          ? `${ad.business_name} 광고`
          : `${sizeLabel[ad.ad_size]} 광고`
      }
    >
      <img
        src={ad.image_url}
        alt={
          ad.business_name
            ? `${ad.business_name} 광고`
            : `${sizeLabel[ad.ad_size]} 광고`
        }
        draggable={false}
        loading="eager"
        className="absolute inset-0 block h-full w-full select-none"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "fill",
          objectPosition: "center center",
        }}
      />

      {ad.show_size_badge && (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-1 text-[9px] font-black text-white">
          {sizeLabel[ad.ad_size]}
        </span>
      )}
    </article>
  );
}

export default function FlipbookAdGridPage({
  page,
  pageWidth,
  pageHeight,
}: Props) {
  const visibleAds = (Array.isArray(page?.ads) ? page.ads : []).filter(
    (ad): ad is PackedAd =>
      !!ad &&
      ad.enabled === true &&
      typeof ad.image_url === "string" &&
      ad.image_url.trim().length > 0,
  );

  return (
    <div
      className="grid bg-white"
      style={{
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        minWidth: `${pageWidth}px`,
        maxWidth: `${pageWidth}px`,
        minHeight: `${pageHeight}px`,
        maxHeight: `${pageHeight}px`,
        gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
        gridTemplateRows: "repeat(6, minmax(0, 1fr))",
        gap: 0,
        padding: 0,
        margin: 0,
        boxSizing: "border-box",
        overflow: "hidden",
        backgroundColor: "#ffffff",
      }}
    >
      {visibleAds.map((ad, index) => (
        <AdTile
          key={`${ad.business_id ?? "business"}-${ad.ad_size}-${ad.id ?? index}`}
          ad={ad}
        />
      ))}
    </div>
  );
}
