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

  const [isMobile, setIsMobile] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState({
    width: 360,
    height: 509,
  });

  useEffect(() => {
    function updatePageSize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      if (mobile) {
        const availableWidth = Math.max(
          280,
          window.innerWidth - 24,
        );
        const width = Math.min(420, availableWidth);

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
              className="flex w-full justify-center overflow-visible"
              style={{
                width: isMobile
                  ? `${pageSize.width}px`
                  : `${pageSize.width * 2}px`,
                maxWidth: "100%",
                height: `${pageSize.height}px`,
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
                usePortrait={isMobile}
                mobileScrollSupport={true}
                drawShadow={true}
                maxShadowOpacity={0.5}
                flippingTime={900}
                showPageCorners={true}
                disableFlipByClick={false}
                clickEventForward={true}
                useMouseEvents={true}
                swipeDistance={25}
                autoSize={false}
                startPage={0}
                startZIndex={0}
                className=""
                style={{
                  width: isMobile
                    ? `${pageSize.width}px`
                    : `${pageSize.width * 2}px`,
                  height: `${pageSize.height}px`,
                }}
                onFlip={(event: any) => {
                  setCurrentPage(
                    Number(event?.data || 0),
                  );
                }}
              >
                {flipPages}
              </HTMLFlipBook>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                onClick={() =>
                  bookRef.current
                    ?.pageFlip()
                    ?.flipPrev()
                }
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl font-black shadow-lg"
                aria-label="이전 페이지"
              >
                ‹
              </button>

              <p className="text-center text-xs font-bold text-[#6B6257]">
                페이지를 좌우로 넘겨보세요
              </p>

              <button
                type="button"
                onClick={() =>
                  bookRef.current
                    ?.pageFlip()
                    ?.flipNext()
                }
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#172033] text-2xl font-black text-white shadow-lg"
                aria-label="다음 페이지"
              >
                ›
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}