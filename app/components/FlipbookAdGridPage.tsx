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

const sizeLabel: Record<FlipbookAdSize, string> = {
  1: "전체면",
  2: "반면",
  3: "1/4면",
  4: "1/6면",
};

/**
 * 정확한 6 × 6 그리드
 *
 * 전체 페이지 = 36칸
 * Size 1 = 6 × 6 = 36칸 = 전체면
 * Size 2 = 6 × 3 = 18칸 = 1/2면
 * Size 3 = 3 × 3 =  9칸 = 1/4면
 * Size 4 = 3 × 2 =  6칸 = 1/6면
 */
function getGridSpan(size: FlipbookAdSize) {
  switch (size) {
    case 1:
      return {
        gridColumn: "span 6",
        gridRow: "span 6",
      };

    case 2:
      return {
        gridColumn: "span 6",
        gridRow: "span 3",
      };

    case 3:
      return {
        gridColumn: "span 3",
        gridRow: "span 3",
      };

    case 4:
      return {
        gridColumn: "span 3",
        gridRow: "span 2",
      };
  }
}

function AdTile({
  ad,
}: {
  ad: FlipbookAd;
}) {
  const span = getGridSpan(ad.ad_size);

  return (
    <article
      className="relative min-h-0 min-w-0 overflow-hidden bg-white"
      style={{
        ...span,
        backgroundColor: "#ffffff",
        backgroundImage: `url("${ad.image_url}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center center",
        backgroundSize: "contain",
      }}
      aria-label={
        ad.business_name
          ? `${ad.business_name} 광고`
          : `${sizeLabel[ad.ad_size]} 광고`
      }
    >
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
  const visibleAds = (
    Array.isArray(page?.ads) ? page.ads : []
  )
    .filter(
      (ad) =>
        !!ad &&
        ad.enabled === true &&
        typeof ad.image_url === "string" &&
        ad.image_url.trim().length > 0,
    )
    .sort((a, b) => {
      const priorityDifference =
        Number(b.priority || 0) -
        Number(a.priority || 0);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return a.ad_size - b.ad_size;
    });

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
        gridTemplateColumns:
          "repeat(6, minmax(0, 1fr))",
        gridTemplateRows:
          "repeat(6, minmax(0, 1fr))",
        gridAutoFlow: "dense",
        gap: 0,
        padding: 0,
        boxSizing: "border-box",
        overflow: "hidden",
        backgroundColor: "#ffffff",
      }}
    >
      {visibleAds.map((ad) => (
        <AdTile
          key={`${ad.business_id}-${ad.ad_size}-${ad.id}`}
          ad={ad}
        />
      ))}
    </div>
  );
}