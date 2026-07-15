"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import FlipbookAdGridPage from "./FlipbookAdGridPage";
import type { AdPage } from "./flipbookTypes";

const HTMLFlipBook = dynamic(
  () => import("react-pageflip"),
  { ssr: false },
) as any;

const COVER_BUSINESS_ID = "83";

type FlipPageProps = {
  children: React.ReactNode;
  className?: string;
  pageWidth: number;
  pageHeight: number;
};

const FlipPage = forwardRef<HTMLDivElement, FlipPageProps>(
  function FlipPage(
    {
      children,
      className = "",
      pageWidth,
      pageHeight,
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={`relative overflow-hidden bg-white ${className}`}
        style={{
          width: `${pageWidth}px`,
          height: `${pageHeight}px`,
          minWidth: `${pageWidth}px`,
          maxWidth: `${pageWidth}px`,
          minHeight: `${pageHeight}px`,
          maxHeight: `${pageHeight}px`,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${pageWidth}px`,
            height: `${pageHeight}px`,
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);

function getBusinessId(ad: unknown) {
  const adData = ad as {
    business_id?: string | number | null;
    businessId?: string | number | null;
    business?: {
      id?: string | number | null;
    } | null;
  };

  return (
    adData?.business_id ??
    adData?.businessId ??
    adData?.business?.id ??
    null
  );
}

export default function BusinessAdFlipbook({
  adPages,
}: {
  adPages: AdPage[];
}) {
  const bookRef = useRef<any>(null);
  const pinchRef = useRef({
    startDistance: 0,
    startZoom: 1,
  });
  const panRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const [isMobile, setIsMobile] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pageSize, setPageSize] = useState({
    width: 360,
    height: 509,
  });

  useEffect(() => {
    function updatePageSize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (mobile) {
        /*
         * 모바일에서도 항상 좌우 2페이지가 보이도록
         * 화면 너비를 반으로 나눠 한 페이지 크기를 계산합니다.
         */
        const availableSpreadWidth = Math.max(
          320,
          window.innerWidth - 16,
        );
        const width = Math.floor(
          Math.min(840, availableSpreadWidth) / 2,
        );

        setPageSize({
          width,
          height: Math.round(width * (594 / 420)),
        });
        return;
      }

      setPageSize({
        width: 420,
        height: 594,
      });
    }

    updatePageSize();
    window.addEventListener("resize", updatePageSize);

    return () => {
      window.removeEventListener(
        "resize",
        updatePageSize,
      );
    };
  }, []);

  const {
    coverAdPage,
    visibleAdPages,
  } = useMemo(() => {
    if (!Array.isArray(adPages)) {
      return {
        coverAdPage: null as AdPage | null,
        visibleAdPages: [] as AdPage[],
      };
    }

    let selectedCoverPage: AdPage | null = null;
    const normalPages: AdPage[] = [];

    adPages.forEach((page, pageIndex) => {
      const pageAds = Array.isArray(page?.ads)
        ? page.ads
        : [];

      const enabledAds = pageAds.filter(
        (ad) =>
          !!ad &&
          ad.enabled === true &&
          typeof ad.image_url === "string" &&
          ad.image_url.trim().length > 0,
      );

      const coverAds = enabledAds.filter(
        (ad) =>
          String(getBusinessId(ad)) ===
          COVER_BUSINESS_ID,
      );

      const regularAds = enabledAds.filter(
        (ad) =>
          String(getBusinessId(ad)) !==
          COVER_BUSINESS_ID,
      );

      /*
       * 비즈니스 ID 83 광고가 여러 개 있더라도
       * 가장 먼저 발견된 광고 1개만 표지로 사용합니다.
       */
      if (!selectedCoverPage && coverAds.length > 0) {
        selectedCoverPage = {
          ...page,
          id: `front-cover-${page?.id ?? pageIndex}`,
          ads: [coverAds[0]],
        };
      }

      /*
       * 비즈니스 ID 83 광고는 일반 광고 페이지에서 제거하여
       * 표지와 내부 페이지에 중복 노출되지 않게 합니다.
       */
      if (regularAds.length > 0) {
        normalPages.push({
          ...page,
          id: page?.id ?? `ad-page-${pageIndex}`,
          ads: regularAds,
        });
      }
    });

    return {
      coverAdPage: selectedCoverPage,
      visibleAdPages: normalPages,
    };
  }, [adPages]);

  const flipPages = useMemo(() => {
    const pages: React.ReactElement[] = [];

    /*
     * 비즈니스 ID 83 광고가 있으면 맨 앞 표지로 사용합니다.
     * 해당 광고가 없을 때만 기존 기본 표지를 보여줍니다.
     */
    if (coverAdPage) {
      pages.push(
        <FlipPage
          key="business-83-front-cover"
          pageWidth={pageSize.width}
          pageHeight={pageSize.height}
          className="bg-white"
        >
          <FlipbookAdGridPage
            page={coverAdPage}
            pageWidth={pageSize.width}
            pageHeight={pageSize.height}
          />
        </FlipPage>,
      );
    } else {
      pages.push(
        <FlipPage
          key="front-cover"
          pageWidth={pageSize.width}
          pageHeight={pageSize.height}
          className="bg-[#172033] text-white"
        >
          <div className="flex h-full w-full flex-col justify-between p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#F4C95D]">
                Korean Business Guide
              </p>

              <h2 className="mt-8 text-5xl font-black leading-[0.95]">
                KTown
                <br />
                Triangle
              </h2>
            </div>

            <p className="text-sm font-black">
              KTOWNTRIANGLE.COM
            </p>
          </div>
        </FlipPage>,
      );
    }

    for (const page of visibleAdPages) {
      pages.push(
        <FlipPage
          key={page.id}
          pageWidth={pageSize.width}
          pageHeight={pageSize.height}
          className="bg-white"
        >
          <FlipbookAdGridPage
            page={page}
            pageWidth={pageSize.width}
            pageHeight={pageSize.height}
          />
        </FlipPage>,
      );
    }

    /*
     * 마지막 뒷표지 전까지 페이지 수를 짝수로 맞춰
     * 데스크톱 양면 표시가 어긋나지 않게 합니다.
     */
    if (pages.length % 2 !== 0) {
      pages.push(
        <FlipPage
          key="inside-back-cover"
          pageWidth={pageSize.width}
          pageHeight={pageSize.height}
          className="bg-white"
        >
          <div
            style={{
              width: `${pageSize.width}px`,
              height: `${pageSize.height}px`,
              background: "white",
            }}
          />
        </FlipPage>,
      );
    }

    pages.push(
      <FlipPage
        key="back-cover"
        pageWidth={pageSize.width}
        pageHeight={pageSize.height}
        className="bg-[#C4483A] text-white"
      >
        <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
          <h2 className="text-4xl font-black">
            KTown Triangle
          </h2>

          <p className="mt-8 rounded-full bg-white px-6 py-3 text-sm font-black text-[#C4483A]">
            KTOWNTRIANGLE.COM
          </p>
        </div>
      </FlipPage>,
    );

    return pages;
  }, [
    coverAdPage,
    pageSize.height,
    pageSize.width,
    visibleAdPages,
  ]);

  const hasAnyAds =
    !!coverAdPage || visibleAdPages.length > 0;

  const spreadWidth = pageSize.width * 2;

  const clampZoom = (value: number) =>
    Math.min(4, Math.max(1, value));

  const zoomOut = () => {
    setZoom((value) => {
      const nextZoom = clampZoom(
        Number((value - 0.25).toFixed(2)),
      );

      if (nextZoom === 1) {
        setPan({ x: 0, y: 0 });
      }

      return nextZoom;
    });
  };

  const zoomIn = () => {
    setZoom((value) =>
      clampZoom(Number((value + 0.25).toFixed(2))),
    );
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const getTouchDistance = (
    first: React.Touch,
    second: React.Touch,
  ) =>
    Math.hypot(
      second.clientX - first.clientX,
      second.clientY - first.clientY,
    );

  const handleTouchStart = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    if (event.touches.length === 2) {
      pinchRef.current = {
        startDistance: getTouchDistance(
          event.touches[0],
          event.touches[1],
        ),
        startZoom: zoom,
      };
      return;
    }

    if (event.touches.length === 1 && zoom > 1) {
      panRef.current = {
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        originX: pan.x,
        originY: pan.y,
      };
    }
  };

  const handleTouchMove = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    if (event.touches.length === 2) {
      event.preventDefault();

      const distance = getTouchDistance(
        event.touches[0],
        event.touches[1],
      );
      const startDistance =
        pinchRef.current.startDistance || distance;

      const nextZoom = clampZoom(
        pinchRef.current.startZoom *
          (distance / startDistance),
      );

      setZoom(nextZoom);

      if (nextZoom === 1) {
        setPan({ x: 0, y: 0 });
      }

      return;
    }

    if (event.touches.length === 1 && zoom > 1) {
      event.preventDefault();

      setPan({
        x:
          panRef.current.originX +
          event.touches[0].clientX -
          panRef.current.startX,
        y:
          panRef.current.originY +
          event.touches[0].clientY -
          panRef.current.startY,
      });
    }
  };

  const handleTouchEnd = () => {
    if (zoom <= 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#D8D0C5] text-[#172033]">
      <header className="sticky top-0 z-50 border-b border-black/10 bg-[#F8F3EC]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link
            href="/community"
            className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm"
          >
            ← 돌아가기
          </Link>

          <div className="min-w-0 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C4483A]">
              Business Guide
            </p>

            <h1 className="truncate text-lg font-black">
              KTown Triangle 광고 책자
            </h1>
          </div>

          <div className="rounded-full bg-[#172033] px-3 py-2 text-xs font-black text-white">
            {currentPage + 1}
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-70px)] max-w-7xl flex-col items-center justify-center px-2 pb-24 pt-6">
        {!hasAnyAds ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-xl">
            <p className="font-black">
              표시할 광고가 없습니다.
            </p>
          </div>
        ) : (
          <>
            <div
              className="relative flex w-full items-center justify-center overflow-hidden bg-black/5 pb-2"
              style={{
                height: `${pageSize.height}px`,
                touchAction: zoom > 1 ? "none" : "pan-y",
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                style={{
                  width: `${spreadWidth}px`,
                  height: `${pageSize.height}px`,
                  flex: "0 0 auto",
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                  transformOrigin: "center center",
                  transition:
                    zoom === 1
                      ? "transform 180ms ease"
                      : "none",
                  willChange: "transform",
                }}
              >
                <HTMLFlipBook
                  key={[
                    isMobile,
                    pageSize.width,
                    pageSize.height,
                    visibleAdPages.length,
                    coverAdPage?.id ?? "default-cover",
                  ].join("-")}
                  ref={bookRef}
                  width={pageSize.width}
                  height={pageSize.height}
                  size="fixed"
                  minWidth={pageSize.width}
                  maxWidth={pageSize.width}
                  minHeight={pageSize.height}
                  maxHeight={pageSize.height}
                  showCover={true}
                  usePortrait={false}
                  mobileScrollSupport={true}
                  drawShadow={true}
                  maxShadowOpacity={0.5}
                  flippingTime={900}
                  showPageCorners={true}
                  disableFlipByClick={zoom > 1}
                  clickEventForward={zoom === 1}
                  useMouseEvents={zoom === 1}
                  swipeDistance={25}
                  autoSize={false}
                  startPage={0}
                  startZIndex={0}
                  className=""
                  style={{
                    width: `${spreadWidth}px`,
                    height: `${pageSize.height}px`,
                  }}
                  onFlip={(event: any) => {
                    setCurrentPage(
                      Number(event?.data || 0),
                    );
                    resetZoom();
                  }}
                >
                  {flipPages}
                </HTMLFlipBook>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() =>
                  bookRef.current
                    ?.pageFlip()
                    ?.flipPrev()
                }
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-black shadow-lg"
                aria-label="이전 페이지"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={zoomOut}
                disabled={zoom <= 1}
                className="flex h-11 min-w-11 items-center justify-center rounded-full bg-white px-3 text-xl font-black shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="축소"
              >
                −
              </button>

              <button
                type="button"
                onClick={resetZoom}
                className="h-11 min-w-[76px] rounded-full bg-white px-4 text-sm font-black shadow-lg"
                aria-label="확대 비율 초기화"
              >
                {Math.round(zoom * 100)}%
              </button>

              <button
                type="button"
                onClick={zoomIn}
                disabled={zoom >= 4}
                className="flex h-11 min-w-11 items-center justify-center rounded-full bg-white px-3 text-xl font-black shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="확대"
              >
                +
              </button>

              <button
                type="button"
                onClick={() =>
                  bookRef.current
                    ?.pageFlip()
                    ?.flipNext()
                }
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#172033] text-2xl font-black text-white shadow-lg"
                aria-label="다음 페이지"
              >
                ›
              </button>
            </div>

            <p className="mt-3 text-center text-xs font-bold text-[#6B6257]">
              두 손가락으로 플립북 자체를 확대·축소하고, 확대 후 한 손가락으로 이동하세요.
            </p>
          </>
        )}
      </section>
    </main>
  );
}


