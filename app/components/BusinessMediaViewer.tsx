"use client";

import { useEffect, useRef, useState } from "react";

type MediaItem = {
  type: "video" | "image";
  url: string;
};

function getYoutubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "").split("?")[0];
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    if (host.includes("youtube.com")) {
      const watchId = parsed.searchParams.get("v");
      if (watchId) return `https://www.youtube.com/embed/${watchId}`;

      const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch?.[1]) return `https://www.youtube.com/embed/${shortsMatch[1]}`;

      const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch?.[1]) return `https://www.youtube.com/embed/${embedMatch[1]}`;
    }

    return "";
  } catch {
    return "";
  }
}

function getVideoKind(url: string) {
  const lower = url.toLowerCase();

  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("facebook.com") || lower.includes("fb.watch")) return "facebook";

  return "upload";
}

function ExternalVideoButton({ url }: { url: string }) {
  const kind = getVideoKind(url);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
      <div className="text-5xl">▶</div>
      <p className="text-lg font-black">
        {kind === "instagram" ? "Instagram Video" : "Facebook Video"}
      </p>
      <p className="text-sm font-bold text-white/70">
        이 영상은 앱 안에서 직접 재생이 제한될 수 있어요.
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
        className={
          full
            ? "max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            : "h-full w-full cursor-pointer object-contain"
        }
      />
    );
  }

  const kind = getVideoKind(item.url);

  if (kind === "youtube") {
    const embedUrl = getYoutubeEmbedUrl(item.url);

    if (embedUrl) {
      return (
        <iframe
          src={embedUrl}
          title={name || "YouTube video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className={
            full
              ? "aspect-video w-[90vw] max-w-5xl rounded-xl bg-black"
              : "h-full w-full bg-black"
          }
        />
      );
    }
  }

  if (kind === "instagram" || kind === "facebook") {
    return <ExternalVideoButton url={item.url} />;
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
          ? "max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
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
    ...videos.filter(Boolean).map((url) => ({ type: "video" as const, url })),
    ...images.filter(Boolean).map((url) => ({ type: "image" as const, url })),
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (currentIndex > media.length - 1) {
      setCurrentIndex(0);
    }
  }, [media.length, currentIndex]);

  if (media.length === 0) return null;

  const current = media[currentIndex];

  function goPrev() {
    setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  }

  function goNext() {
    setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
  }

  return (
    <>
      <div
        className="relative h-[320px] w-full overflow-hidden bg-black"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (diff > 50) goNext();
          if (diff < -50) goPrev();
        }}
      >
        <MediaDisplay
          item={current}
          name={name}
          onOpen={() => {
            if (current.type === "image") setIsOpen(true);
          }}
        />

        {media.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-3 top-1/2 z-[999] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-3xl font-black text-black shadow-lg"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={goNext}
              className="absolute right-3 top-1/2 z-[999] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-3xl font-black text-black shadow-lg"
            >
              ›
            </button>

            <div className="absolute bottom-3 right-3 z-[999] rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-white">
              {currentIndex + 1}/{media.length}
            </div>
          </>
        )}
      </div>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[9999] bg-black/90"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <MediaDisplay item={current} name={name} full />
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute right-5 top-5 z-[10000] rounded-full bg-white px-4 py-2 font-black text-black shadow-lg"
          >
            ×
          </button>

          {media.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute left-4 top-1/2 z-[10000] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-4xl font-black text-black shadow-lg"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-4 top-1/2 z-[10000] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-4xl font-black text-black shadow-lg"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}