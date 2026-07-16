"use client";

import type {
  AdPage,
  FlipbookAd,
  FlipbookAdSize,
} from "./flipbookTypes";

type LeafNode = {
  id: string;
  type: "leaf";
};

type SplitNode = {
  id: string;
  type: "split";
  direction: "horizontal" | "vertical";
  children: [CustomNode, CustomNode];
};

type CustomNode = LeafNode | SplitNode;

type CustomLayoutDocument = {
  version: 1;
  root: CustomNode;
};

type PublicAdPage = AdPage & {
  layout_type?: string | null;
  layout_json?: CustomLayoutDocument | null;
  background_color?: string | null;
  page_image_url?: string | null;
  page_title?: string | null;
};

type Props = {
  page: PublicAdPage;
  pageWidth: number;
  pageHeight: number;
};

type PublicFlipbookAd = FlipbookAd & {
  slot_key?: string | null;
};

const sizeLabel: Record<FlipbookAdSize, string> = {
  1: "전체면",
  2: "반면",
  3: "1/4면",
  4: "1/6면",
  5: "1/12면",
};

function getFallbackSpan(ad: FlipbookAd) {
  switch (ad.ad_size) {
    case 1:
      return {
        columnStart: 1,
        rowStart: 1,
        columnSpan: 6,
        rowSpan: 6,
      };

    case 2:
      return ad.orientation === "vertical"
        ? {
            columnStart: 1,
            rowStart: 1,
            columnSpan: 3,
            rowSpan: 6,
          }
        : {
            columnStart: 1,
            rowStart: 1,
            columnSpan: 6,
            rowSpan: 3,
          };

    case 3:
      return {
        columnStart: 1,
        rowStart: 1,
        columnSpan: 3,
        rowSpan: 3,
      };

    case 4:
      return {
        columnStart: 1,
        rowStart: 1,
        columnSpan: 3,
        rowSpan: 2,
      };

    case 5:
      return {
        columnStart: 1,
        rowStart: 1,
        columnSpan: 3,
        rowSpan: 1,
      };

    default:
      return {
        columnStart: 1,
        rowStart: 1,
        columnSpan: 6,
        rowSpan: 6,
      };
  }
}

function getAdUrl(ad: FlipbookAd) {
  const clickUrl = String(ad.click_url || "").trim();
  const websiteUrl = String(ad.website_url || "").trim();

  return clickUrl || websiteUrl || null;
}

function isCustomLayoutDocument(
  value: unknown,
): value is CustomLayoutDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!("root" in value)) {
    return false;
  }

  const root = (value as { root?: unknown }).root;

  return (
    !!root &&
    typeof root === "object" &&
    "id" in root &&
    "type" in root
  );
}

function AdImage({
  ad,
  fitMode = "contain",
}: {
  ad: FlipbookAd;
  fitMode?: "contain" | "fill";
}) {
  const objectFit: React.CSSProperties["objectFit"] =
    fitMode === "fill" || ad.object_fit === "fill"
      ? "fill"
      : "contain";

  return (
    <img
      src={ad.image_url}
      alt={
        ad.business_name
          ? `${ad.business_name} 광고`
          : `${sizeLabel[ad.ad_size]} 광고`
      }
      draggable={false}
      loading="eager"
      className="pointer-events-none absolute inset-0 block h-full w-full select-none"
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit,
        objectPosition: "center center",
        display: "block",
      }}
    />
  );
}

function AdContent({
  ad,
  fitMode = "contain",
}: {
  ad: FlipbookAd;
  fitMode?: "contain" | "fill";
}) {
  const destinationUrl = getAdUrl(ad);

  const label = ad.business_name
    ? `${ad.business_name} 광고`
    : `${sizeLabel[ad.ad_size]} 광고`;

  const content = (
    <>
      <AdImage ad={ad} fitMode={fitMode} />

      {ad.show_size_badge && (
        <span className="pointer-events-none absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-1 text-[9px] font-black text-white">
          {sizeLabel[ad.ad_size]}
        </span>
      )}
    </>
  );

  if (destinationUrl) {
    return (
      <a
        href={destinationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block h-full min-h-0 w-full min-w-0 overflow-hidden bg-white"
        aria-label={label}
        title={ad.business_name || label}
      >
        {content}
      </a>
    );
  }

  return (
    <article
      className="relative block h-full min-h-0 w-full min-w-0 overflow-hidden bg-white"
      aria-label={label}
    >
      {content}
    </article>
  );
}

function GridAdTile({ ad }: { ad: FlipbookAd }) {
  const fallback = getFallbackSpan(ad);

  const columnStart =
    Number(ad.grid_column_start) || fallback.columnStart;

  const rowStart =
    Number(ad.grid_row_start) || fallback.rowStart;

  const columnSpan =
    Number(ad.grid_column_span) || fallback.columnSpan;

  const rowSpan =
    Number(ad.grid_row_span) || fallback.rowSpan;

  return (
    <div
      className="relative min-h-0 min-w-0 overflow-hidden bg-white"
      style={{
        gridColumnStart: columnStart,
        gridRowStart: rowStart,
        gridColumnEnd: `span ${columnSpan}`,
        gridRowEnd: `span ${rowSpan}`,
      }}
    >
      <AdContent ad={ad} fitMode="contain" />
    </div>
  );
}

function CustomLayoutPage({
  document,
  ads,
}: {
  document: CustomLayoutDocument;
  ads: PublicFlipbookAd[];
}) {
  const adBySlotKey = new Map<string, PublicFlipbookAd>(
    ads
      .filter(
        (ad) =>
          typeof ad.slot_key === "string" &&
          ad.slot_key.length > 0,
      )
      .map((ad) => [String(ad.slot_key), ad]),
  );

  const renderNode = (
    node: CustomNode,
  ): React.ReactNode => {
    if (node.type === "split") {
      return (
        <div
          className={`relative flex h-full min-h-0 w-full min-w-0 ${
            node.direction === "horizontal"
              ? "flex-col"
              : "flex-row"
          }`}
        >
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {renderNode(node.children[0])}
          </div>

          <div
            className={
              node.direction === "horizontal"
                ? "h-px shrink-0 bg-black/10"
                : "w-px shrink-0 bg-black/10"
            }
          />

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {renderNode(node.children[1])}
          </div>
        </div>
      );
    }

    const ad = adBySlotKey.get(node.id) || null;

    return (
      <div
        className="relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-white"
        data-slot-key={node.id}
      >
        {ad ? <AdContent ad={ad} fitMode="fill" /> : null}
      </div>
    );
  };

  return (
    <div className="h-full w-full overflow-hidden bg-white">
      {renderNode(document.root)}
    </div>
  );
}

export default function FlipbookAdGridPage({
  page,
  pageWidth,
  pageHeight,
}: Props) {
  const visibleAds = (
    Array.isArray(page.ads) ? page.ads : []
  ).filter(
    (ad): ad is PublicFlipbookAd =>
      !!ad &&
      ad.enabled === true &&
      typeof ad.image_url === "string" &&
      ad.image_url.trim().length > 0,
  );

  const customLayoutDocument:
    | CustomLayoutDocument
    | null =
    page.layout_type === "custom" &&
    isCustomLayoutDocument(page.layout_json)
      ? page.layout_json
      : null;

  return (
    <div
      className="relative overflow-hidden bg-white"
      data-page-id={String(page.id)}
      data-layout-type={page.layout_type || "custom"}
      data-ad-count={visibleAds.length}
      style={{
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        minWidth: `${pageWidth}px`,
        maxWidth: `${pageWidth}px`,
        minHeight: `${pageHeight}px`,
        maxHeight: `${pageHeight}px`,
        margin: 0,
        padding: 0,
        boxSizing: "border-box",
        overflow: "hidden",
        backgroundColor:
          page.background_color || "#ffffff",
      }}
    >
      {page.page_image_url && visibleAds.length === 0 ? (
        <img
          src={page.page_image_url}
          alt={page.page_title || "잡지 페이지"}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : customLayoutDocument ? (
        <CustomLayoutPage
          document={customLayoutDocument}
          ads={visibleAds}
        />
      ) : (
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns:
              "repeat(6, minmax(0, 1fr))",
            gridTemplateRows:
              "repeat(6, minmax(0, 1fr))",
            gap: 0,
          }}
        >
          {visibleAds.map((ad, index) => (
            <GridAdTile
              key={[
                ad.id ?? index,
                ad.business_id ?? "business",
                ad.slot_key ?? "slot",
              ].join("-")}
              ad={ad}
            />
          ))}
        </div>
      )}
    </div>
  );
}