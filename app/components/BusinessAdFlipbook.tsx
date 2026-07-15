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
  const playerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const bookFrameRef = useRef<HTMLDivElement>(null);
  const pinchRef = useRef({
    startDistance: 0,
    startZoom: 1,
    contentX: 0,
    contentY: 0,
  });
  const panRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const [isMobile, setIsMobile] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState({
    width: 360,
    height: 509,
  });

  useEffect(() => {
    const PAGE_RATIO = 594 / 420;

    function updatePageSize() {
      const mobile = window.innerWidth < 768;
      const fullscreenActive = !!document.fullscreenElement;

      setIsMobile(mobile);
      setIsFullscreen(fullscreenActive);

      if (fullscreenActive) {
        /*
         * 전체화면에서는 유튜브 플레이어처럼 좌우 2페이지가
         * 화면에 최대한 크게 들어가도록 너비와 높이를 함께 계산합니다.
         */
        const controlsHeight = 72;
        const availableWidth = Math.max(
          320,
          window.innerWidth - 12,
        );
        const availableHeight = Math.max(
          220,
          window.innerHeight - controlsHeight,
        );

        const widthByScreen = availableWidth / 2;
        const widthByHeight = availableHeight / PAGE_RATIO;
        const width = Math.max(
          160,
          Math.floor(
            Math.min(widthByScreen, widthByHeight),
          ),
        );

        setPageSize({
          width,
          height: Math.round(width * PAGE_RATIO),
        });
        return;
      }

      if (mobile) {
        const availableSpreadWidth = Math.max(
          320,
          window.innerWidth - 16,
        );
        const width = Math.floor(
          Math.min(840, availableSpreadWidth) / 2,
        );

        setPageSize({
          width,
          height: Math.round(width * PAGE_RATIO),
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
    window.addEventListener(
      "orientationchange",
      updatePageSize,
    );
    document.addEventListener(
      "fullscreenchange",
      updatePageSize,
    );

    return () => {
      window.removeEventListener(
        "resize",
        updatePageSize,
      );
      window.removeEventListener(
        "orientationchange",
        updatePageSize,
      );
      document.removeEventListener(
        "fullscreenchange",
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

  const enterFullscreen = async () => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    try {
      await player.requestFullscreen();

      /*
       * Android Chrome 등 지원되는 브라우저에서는
       * 전체화면 진입 후 가로 방향으로 전환합니다.
       * iPhone Safari는 화면 방향 잠금을 지원하지 않을 수 있습니다.
       */
      const orientation = screen.orientation as
        | (ScreenOrientation & {
            lock?: (
              orientation: string,
            ) => Promise<void>;
          })
        | undefined;

      if (orientation?.lock) {
        try {
          await orientation.lock("landscape");
        } catch {
          // 방향 잠금이 지원되지 않으면 현재 방향을 유지합니다.
        }
      }
    } catch {
      // 브라우저가 전체화면을 거부하면 아무 작업도 하지 않습니다.
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }

      const orientation = screen.orientation as
        | (ScreenOrientation & {
            unlock?: () => void;
          })
        | undefined;

      orientation?.unlock?.();
    } catch {
      // 전체화면 종료 실패 시 현재 화면을 유지합니다.
    }
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await exitFullscreen();
      return;
    }

    await enterFullscreen();
  };

  const clampZoom = (value: number) =>
    Math.min(4, Math.max(1, value));

  const clampPan = (
    x: number,
    y: number,
    scale: number,
  ) => {
    /*
     * 플립북 중앙을 기준으로 확대하므로 이동 범위도
     * 좌우·상하 대칭으로 계산합니다.
     */
    const maxX = Math.max(
      0,
      (spreadWidth * scale - spreadWidth) / 2,
    );
    const maxY = Math.max(
      0,
      (pageSize.height * scale - pageSize.height) / 2,
    );

    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const getTouchDistance = (
    first: React.Touch,
    second: React.Touch,
  ) =>
    Math.hypot(
      second.clientX - first.clientX,
      second.clientY - first.clientY,
    );

  const getTouchCenter = (
    first: React.Touch,
    second: React.Touch,
  ) => ({
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  });

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsPinching(false);
  };

  useEffect(() => {
    setPan((currentPan) =>
      zoom <= 1
        ? { x: 0, y: 0 }
        : clampPan(
            currentPan.x,
            currentPan.y,
            zoom,
          ),
    );
  }, [pageSize.height, pageSize.width, zoom]);

  const handleTouchStartCapture = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    if (event.touches.length >= 2) {
      const distance = getTouchDistance(
        event.touches[0],
        event.touches[1],
      );
      const center = getTouchCenter(
        event.touches[0],
        event.touches[1],
      );
      const frameRect =
        bookFrameRef.current?.getBoundingClientRect();

      if (!frameRect) {
        return;
      }

      const localX = center.x - frameRect.left;
      const localY = center.y - frameRect.top;
      const frameCenterX = frameRect.width / 2;
      const frameCenterY = frameRect.height / 2;

      /*
       * 현재 두 손가락 아래에 있는 플립북 좌표를 저장합니다.
       * transform-origin이 중앙이므로 중앙 기준 좌표로 환산합니다.
       */
      pinchRef.current = {
        startDistance: distance,
        startZoom: zoom,
        contentX:
          frameCenterX +
          (localX - frameCenterX - pan.x) / zoom,
        contentY:
          frameCenterY +
          (localY - frameCenterY - pan.y) / zoom,
      };

      setIsPinching(true);
      event.stopPropagation();
      return;
    }

    if (event.touches.length === 1 && zoom > 1) {
      panRef.current = {
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        originX: pan.x,
        originY: pan.y,
      };

      event.stopPropagation();
    }
  };

  const handleTouchMoveCapture = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    if (event.touches.length >= 2) {
      event.preventDefault();
      event.stopPropagation();

      const distance = getTouchDistance(
        event.touches[0],
        event.touches[1],
      );
      const center = getTouchCenter(
        event.touches[0],
        event.touches[1],
      );
      const frameRect =
        bookFrameRef.current?.getBoundingClientRect();

      if (!frameRect) {
        return;
      }

      const startDistance =
        pinchRef.current.startDistance || distance;
      const startZoom =
        pinchRef.current.startZoom || 1;
      const nextZoom = clampZoom(
        startZoom * (distance / startDistance),
      );

      const localX = center.x - frameRect.left;
      const localY = center.y - frameRect.top;
      const frameCenterX = frameRect.width / 2;
      const frameCenterY = frameRect.height / 2;

      const nextPan = clampPan(
        localX -
          frameCenterX -
          (pinchRef.current.contentX - frameCenterX) *
            nextZoom,
        localY -
          frameCenterY -
          (pinchRef.current.contentY - frameCenterY) *
            nextZoom,
        nextZoom,
      );

      setZoom(nextZoom);
      setPan(
        nextZoom === 1
          ? { x: 0, y: 0 }
          : nextPan,
      );

      return;
    }

    if (event.touches.length === 1 && zoom > 1) {
      event.preventDefault();
      event.stopPropagation();

      const nextPan = clampPan(
        panRef.current.originX +
          event.touches[0].clientX -
          panRef.current.startX,
        panRef.current.originY +
          event.touches[0].clientY -
          panRef.current.startY,
        zoom,
      );

      setPan(nextPan);
    }
  };

  const handleTouchEndCapture = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    if (event.touches.length < 2) {
      window.setTimeout(() => {
        setIsPinching(false);
      }, 120);
    }

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
              ref={playerRef}
              className={
                isFullscreen
                  ? "flex h-screen w-screen flex-col overflow-hidden bg-black"
                  : "w-full overflow-hidden rounded-2xl bg-black shadow-2xl"
              }
            >
              <div
                ref={viewportRef}
                className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black"
                style={{
                  overscrollBehavior: "none",
                }}
              >
                <div
                  ref={bookFrameRef}
                  className="relative overflow-hidden"
                  style={{
                    width: `${spreadWidth}px`,
                    height: `${pageSize.height}px`,
                    flex: "0 0 auto",
                    touchAction: zoom > 1 ? "none" : "pan-y",
                    overscrollBehavior: "none",
                  }}
                  onTouchStartCapture={handleTouchStartCapture}
                  onTouchMoveCapture={handleTouchMoveCapture}
                  onTouchEndCapture={handleTouchEndCapture}
                >
                  <div
                    style={{
                      width: `${spreadWidth}px`,
                      height: `${pageSize.height}px`,
                      transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                      transformOrigin: "center center",
                      transition:
                        zoom === 1
                          ? "transform 160ms ease"
                          : "none",
                      willChange: "transform",
                      pointerEvents:
                        zoom > 1 ? "none" : "auto",
                    }}
                  >
                  <HTMLFlipBook
                    key={[
                      isMobile,
                      isFullscreen,
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
                    disableFlipByClick={true}
                    clickEventForward={false}
                    useMouseEvents={!isPinching && zoom === 1}
                    swipeDistance={35}
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

                {zoom > 1 && (
                  <div
                    className="absolute inset-0 z-40 cursor-grab active:cursor-grabbing"
                    style={{
                      touchAction: "none",
                      background: "transparent",
                    }}
                    onTouchStart={handleTouchStartCapture}
                    onTouchMove={handleTouchMoveCapture}
                    onTouchEnd={handleTouchEndCapture}
                    aria-label="확대된 플립북 이동 영역"
                  />
                )}
              </div>

              <div className="flex h-[64px] shrink-0 items-center gap-2 border-t border-white/15 bg-[#1F1F1F] px-3 text-white">
                <button
                  type="button"
                  onClick={() =>
                    bookRef.current
                      ?.pageFlip()
                      ?.flipPrev()
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl font-black hover:bg-white/20"
                  aria-label="이전 페이지"
                >
                  ‹
                </button>

                <div className="min-w-[64px] text-sm font-black">
                  {currentPage + 1} / {flipPages.length}
                </div>

                <input
                  type="range"
                  min={0}
                  max={Math.max(0, flipPages.length - 1)}
                  value={Math.min(
                    currentPage,
                    Math.max(0, flipPages.length - 1),
                  )}
                  onChange={(event) => {
                    const page = Number(event.target.value);
                    bookRef.current
                      ?.pageFlip()
                      ?.turnToPage(page);
                  }}
                  className="min-w-0 flex-1 accent-white"
                  aria-label="페이지 이동"
                />

                <button
                  type="button"
                  onClick={() =>
                    bookRef.current
                      ?.pageFlip()
                      ?.flipNext()
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl font-black hover:bg-white/20"
                  aria-label="다음 페이지"
                >
                  ›
                </button>

                {zoom > 1 && (
                  <button
                    type="button"
                    onClick={resetZoom}
                    className="flex h-10 min-w-10 items-center justify-center rounded-full bg-white/10 px-3 text-xs font-black hover:bg-white/20"
                    aria-label="확대 초기화"
                    title="확대 초기화"
                  >
                    원래크기
                  </button>
                )}

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="flex h-10 min-w-10 items-center justify-center rounded-full bg-white/10 px-3 text-xl font-black hover:bg-white/20"
                  aria-label={
                    isFullscreen
                      ? "전체화면 종료"
                      : "전체화면"
                  }
                  title={
                    isFullscreen
                      ? "전체화면 종료"
                      : "전체화면"
                  }
                >
                  {isFullscreen ? "✕" : "⛶"}
                </button>
              </div>
            </div>

            {!isFullscreen && (
              <p className="mt-3 text-center text-xs font-bold text-[#6B6257]">
                플립북에서 두 손가락으로 확대를 시작하세요. 확대된 뒤에는 화면 전체를 이동 영역으로 사용해 상하좌우로 움직일 수 있습니다.
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}