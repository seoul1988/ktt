"use client";

import { useRef, useState } from "react";

export default function BusinessMediaViewer({
  images,
  videos,
  name,
}: {
  images: string[];
  videos: string[];
  name: string;
}) {
  const media = [
    ...videos.map((url) => ({ type: "video" as const, url })),
    ...images.map((url) => ({ type: "image" as const, url })),
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const touchStartX = useRef(0);

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
        className="relative h-[320px] w-full bg-black"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (diff > 50) goNext();
          if (diff < -50) goPrev();
        }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="block h-full w-full"
        >
          {current.type === "video" ? (
            <video
              src={current.url}
              autoPlay
              muted
              loop
              playsInline
              controls
              className="h-full w-full object-contain"
            />
          ) : (
            <img
              src={current.url}
              alt={name}
              className="h-full w-full object-contain"
            />
          )}
        </button>

        {media.length > 1 && (
          <>
            <button type="button" onClick={goPrev} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-2xl font-black text-white">
              ‹
            </button>
            <button type="button" onClick={goNext} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-2xl font-black text-white">
              ›
            </button>
            <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
              {currentIndex + 1}/{media.length}
            </div>
          </>
        )}
      </div>

      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute right-5 top-5 z-[10000] rounded-full bg-white px-4 py-2 font-black text-black"
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
                className="absolute left-4 top-1/2 z-[10000] -translate-y-1/2 rounded-full bg-white/90 px-4 py-3 text-3xl font-black text-black"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-4 top-1/2 z-[10000] -translate-y-1/2 rounded-full bg-white/90 px-4 py-3 text-3xl font-black text-black"
              >
                ›
              </button>

              <div className="absolute bottom-5 right-5 z-[10000] rounded-full bg-white/90 px-3 py-1 text-sm font-black text-black">
                {currentIndex + 1}/{media.length}
              </div>
            </>
          )}

          {current.type === "video" ? (
            <video
              src={current.url}
              autoPlay
              muted
              loop
              playsInline
              controls
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-full rounded-xl"
            />
          ) : (
            <img
              src={current.url}
              alt={name}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-full rounded-xl object-contain"
            />
          )}
        </div>
      )}
    </>
  );
}