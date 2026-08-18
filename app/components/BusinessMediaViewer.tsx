"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type MediaItem = {
  type: "video" | "image";
  url: string;
};

function getYoutubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("youtu.be")) {
      const id = parsed.pathname
        .replace("/", "")
        .split("?")[0];

      return id
        ? `https://www.youtube.com/embed/${id}`
        : "";
    }

    if (host.includes("youtube.com")) {
      const watchId =
        parsed.searchParams.get("v");

      if (watchId) {
        return `https://www.youtube.com/embed/${watchId}`;
      }

      const shortsMatch =
        parsed.pathname.match(
          /\/shorts\/([^/?]+)/,
        );

      if (shortsMatch?.[1]) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      }

      const embedMatch =
        parsed.pathname.match(
          /\/embed\/([^/?]+)/,
        );

      if (embedMatch?.[1]) {
        return `https://www.youtube.com/embed/${embedMatch[1]}`;
      }
    }

    return "";
  } catch {
    return "";
  }
}

function getVideoKind(url: string) {
  const lower = url.toLowerCase();

  if (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be")
  ) {
    return "youtube";
  }

  if (lower.includes("instagram.com")) {
    return "instagram";
  }

  if (
    lower.includes("facebook.com") ||
    lower.includes("fb.watch")
  ) {
    return "facebook";
  }

  return "upload";
}

function ExternalVideoButton({
  url,
}: {
  url: string;
}) {
  const kind = getVideoKind(url);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
      <div className="text-5xl">▶</div>

      <p className="text-lg font-black">
        {kind === "instagram"
          ? "Instagram Video"
          : "Facebook Video"}
      </p>

      <p className="text-sm font-bold text-white/70">
        이 영상은 앱 안에서 직접 재생이 제한될 수
        있어요.
      </p>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-white px-5 py-3 text-sm font-black text-black"
      >
        Open Video
      </a>
    </div>
  );
}

function MediaDisplay({
  item,
  name,
  full = false,
  onOpen,
}: {
  item: MediaItem;
  name: string;
  full?: boolean;
  onOpen?: () => void;
}) {
  if (item.type === "image") {
    return (
      <img
        src={item.url}
        alt={name}
        onClick={onOpen}
        draggable={false}
        className={
          full
            ? "max-h-[calc(100dvh-120px)] max-w-[calc(100vw-24px)] select-none rounded-xl object-contain"
            : "h-full w-full cursor-pointer select-none object-contain"
        }
      />
    );
  }

  const kind = getVideoKind(item.url);

  if (kind === "youtube") {
    const embedUrl =
      getYoutubeEmbedUrl(item.url);

    if (embedUrl) {
      return (
        <iframe
          src={embedUrl}
          title={name || "YouTube video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className={
            full
              ? "aspect-video w-[calc(100vw-24px)] max-w-5xl rounded-xl bg-black"
              : "h-full w-full bg-black"
          }
        />
      );
    }
  }

  if (
    kind === "instagram" ||
    kind === "facebook"
  ) {
    return (
      <ExternalVideoButton url={item.url} />
    );
  }

  return (
    <video
      src={item.url}
      autoPlay
      muted
      loop
      playsInline
      controls
      className={
        full
          ? "max-h-[calc(100dvh-120px)] max-w-[calc(100vw-24px)] rounded-xl object-contain"
          : "h-full w-full object-contain"
      }
    />
  );
}

export default function BusinessMediaViewer({
  images,
  videos,
  name,
}: {
  images: string[];
  videos: string[];
  name: string;
}) {
  const media: MediaItem[] = [
    ...videos
      .filter(Boolean)
      .map((url) => ({
        type: "video" as const,
        url,
      })),
    ...images
      .filter(Boolean)
      .map((url) => ({
        type: "image" as const,
        url,
      })),
  ];

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const [isOpen, setIsOpen] =
    useState(false);

  const [mounted, setMounted] =
    useState(false);

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Fullscreen image pinch zoom / pan
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const pinchStartDistance = useRef(0);
  const pinchStartScale = useRef(1);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (
      media.length > 0 &&
      currentIndex > media.length - 1
    ) {
      setCurrentIndex(0);
    }
  }, [media.length, currentIndex]);

  /*
   * 확대 화면이 열리면 배경 페이지 스크롤 방지
   */
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow =
      document.body.style.overflow;

    const previousTouchAction =
      document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow =
        previousOverflow;

      document.body.style.touchAction =
        previousTouchAction;
    };
  }, [isOpen]);

  /*
   * ESC 키로 확대 화면 닫기
   */
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }

      if (event.key === "ArrowLeft") {
        goPrev();
      }

      if (event.key === "ArrowRight") {
        goNext();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen, media.length]);

  useEffect(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [isOpen, currentIndex]);

  function resetZoom() {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }

  function getTouchDistance(touches: React.TouchList) {
    if (touches.length < 2) return 0;

    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;

    return Math.hypot(dx, dy);
  }

  function handleFullscreenTouchStart(event: React.TouchEvent) {
    if (event.touches.length === 2) {
      event.preventDefault();
      pinchStartDistance.current = getTouchDistance(event.touches);
      pinchStartScale.current = scale;
      return;
    }

    if (event.touches.length === 1) {
      touchStartX.current = event.touches[0].clientX;
      touchStartY.current = event.touches[0].clientY;

      panStart.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };

      translateStart.current = { ...translate };
    }
  }

  function handleFullscreenTouchMove(event: React.TouchEvent) {
    if (event.touches.length === 2) {
      event.preventDefault();

      const distance = getTouchDistance(event.touches);
      if (!pinchStartDistance.current) return;

      const nextScale = Math.min(
        5,
        Math.max(
          1,
          pinchStartScale.current *
            (distance / pinchStartDistance.current),
        ),
      );

      setScale(nextScale);

      if (nextScale <= 1) {
        setTranslate({ x: 0, y: 0 });
      }

      return;
    }

    if (event.touches.length === 1 && scale > 1) {
      event.preventDefault();

      const dx = event.touches[0].clientX - panStart.current.x;
      const dy = event.touches[0].clientY - panStart.current.y;

      setTranslate({
        x: translateStart.current.x + dx,
        y: translateStart.current.y + dy,
      });
    }
  }

  function handleFullscreenTouchEnd(event: React.TouchEvent) {
    if (event.touches.length > 0) return;

    pinchStartDistance.current = 0;

    if (scale > 1) return;

    const changed = event.changedTouches[0];
    if (!changed) return;

    const diffX = touchStartX.current - changed.clientX;
    const diffY = touchStartY.current - changed.clientY;

    if (Math.abs(diffX) <= Math.abs(diffY)) return;

    if (diffX > 50) goNext();
    if (diffX < -50) goPrev();
  }

  function handleImageDoubleTap(event: React.TouchEvent) {
    if (event.changedTouches.length !== 1) return;

    const now = Date.now();

    if (now - lastTapTime.current < 300) {
      event.preventDefault();

      if (scale > 1) {
        resetZoom();
      } else {
        setScale(2.5);
        setTranslate({ x: 0, y: 0 });
      }

      lastTapTime.current = 0;
      return;
    }

    lastTapTime.current = now;
  }

  if (media.length === 0) return null;

  const current = media[currentIndex];

  function goPrev() {
    setCurrentIndex((prev) =>
      prev === 0
        ? media.length - 1
        : prev - 1,
    );
  }

  function goNext() {
    setCurrentIndex((prev) =>
      prev === media.length - 1
        ? 0
        : prev + 1,
    );
  }

  function handleTouchStart(
    event: React.TouchEvent,
  ) {
    touchStartX.current =
      event.touches[0].clientX;

    touchStartY.current =
      event.touches[0].clientY;
  }

  function handleTouchEnd(
    event: React.TouchEvent,
  ) {
    const diffX =
      touchStartX.current -
      event.changedTouches[0].clientX;

    const diffY =
      touchStartY.current -
      event.changedTouches[0].clientY;

    /*
     * 세로 스크롤보다 가로 스와이프가 클 때만 이동
     */
    if (
      Math.abs(diffX) <=
      Math.abs(diffY)
    ) {
      return;
    }

    if (diffX > 50) {
      goNext();
    }

    if (diffX < -50) {
      goPrev();
    }
  }

  const fullScreenModal =
    mounted && isOpen
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${name} media viewer`}
            onClick={() =>
              setIsOpen(false)
            }
            className="
              fixed inset-0
              z-[2147483647]
              overflow-hidden
              bg-black/95
            "
          >
            <div
              onClick={(event) =>
                event.stopPropagation()
              }
              className="
                absolute inset-0
                flex items-center justify-center
                px-3
                pb-[calc(24px+env(safe-area-inset-bottom))]
                pt-[calc(70px+env(safe-area-inset-top))]
              "
            >
              {current.type === "image" ? (
                <div
                  className="flex h-full w-full items-center justify-center overflow-hidden"
                  onTouchStart={handleFullscreenTouchStart}
                  onTouchMove={handleFullscreenTouchMove}
                  onTouchEnd={(event) => {
                    handleImageDoubleTap(event);
                    handleFullscreenTouchEnd(event);
                  }}
                  style={{ touchAction: "none" }}
                >
                  <img
                    src={current.url}
                    alt={name}
                    draggable={false}
                    className="max-h-[calc(100dvh-120px)] max-w-[calc(100vw-24px)] select-none object-contain"
                    style={{
                      transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`,
                      transformOrigin: "center center",
                      transition:
                        scale === 1 ? "transform 160ms ease-out" : "none",
                    }}
                  />
                </div>
              ) : (
                <MediaDisplay
                  item={current}
                  name={name}
                  full
                />
              )}
            </div>

            <button
              type="button"
              aria-label="Close"
              onClick={(event) => {
                event.stopPropagation();
                setIsOpen(false);
              }}
              className="
                absolute
                right-4
                top-[calc(12px+env(safe-area-inset-top))]
                z-[2147483647]
                flex h-11 w-11
                items-center justify-center
                rounded-full
                bg-white/95
                text-3xl font-black
                leading-none text-black
                shadow-xl
              "
            >
              ×
            </button>

            {media.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous media"
                  onClick={(event) => {
                    event.stopPropagation();
                    goPrev();
                  }}
                  className="
                    absolute
                    left-3 top-1/2
                    z-[2147483647]
                    flex h-12 w-12
                    -translate-y-1/2
                    items-center justify-center
                    rounded-full
                    bg-white/95
                    pb-1
                    text-4xl font-black
                    leading-none text-black
                    shadow-xl
                  "
                >
                  ‹
                </button>

                <button
                  type="button"
                  aria-label="Next media"
                  onClick={(event) => {
                    event.stopPropagation();
                    goNext();
                  }}
                  className="
                    absolute
                    right-3 top-1/2
                    z-[2147483647]
                    flex h-12 w-12
                    -translate-y-1/2
                    items-center justify-center
                    rounded-full
                    bg-white/95
                    pb-1
                    text-4xl font-black
                    leading-none text-black
                    shadow-xl
                  "
                >
                  ›
                </button>

                <div
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                  className="
                    absolute
                    bottom-[calc(16px+env(safe-area-inset-bottom))]
                    left-1/2
                    z-[2147483647]
                    -translate-x-1/2
                    rounded-full
                    bg-white/95
                    px-4 py-2
                    text-xs font-black
                    text-black shadow-xl
                  "
                >
                  {currentIndex + 1}/
                  {media.length}
                </div>
              </>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className="relative h-[320px] w-full overflow-hidden bg-black"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <MediaDisplay
          item={current}
          name={name}
          onOpen={() => {
            if (
              current.type === "image"
            ) {
              setIsOpen(true);
            }
          }}
        />

        {media.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous media"
              onClick={goPrev}
              className="absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 pb-1 text-3xl font-black leading-none text-black shadow-lg"
            >
              ‹
            </button>

            <button
              type="button"
              aria-label="Next media"
              onClick={goNext}
              className="absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 pb-1 text-3xl font-black leading-none text-black shadow-lg"
            >
              ›
            </button>

            <div className="absolute bottom-3 right-3 z-20 rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-white">
              {currentIndex + 1}/
              {media.length}
            </div>
          </>
        )}
      </div>

      {fullScreenModal}
    </>
  );
}