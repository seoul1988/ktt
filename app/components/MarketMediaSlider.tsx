"use client";

import { useState } from "react";

type MediaItem = {
  type: "image" | "video";
  url: string;
};

export default function MarketMediaSlider({ media }: { media: MediaItem[] }) {
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);

  if (!media || media.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center bg-gray-200 text-sm font-bold text-gray-400">
        이미지 없음
      </div>
    );
  }

  const currentMedia = media[current];
  const imagesOnly = media.filter((m) => m.type === "image");
  const currentImageIndex = imagesOnly.findIndex(
    (m) => m.url === currentMedia.url
  );

  function prev() {
    setCurrent((prevIndex) =>
      prevIndex === 0 ? media.length - 1 : prevIndex - 1
    );
  }

  function next() {
    setCurrent((prevIndex) =>
      prevIndex === media.length - 1 ? 0 : prevIndex + 1
    );
  }

  return (
    <>
      <div className="relative h-80 overflow-hidden bg-black">
        {currentMedia.type === "image" ? (
          <img
            src={currentMedia.url}
            alt="상품 이미지"
            onClick={() => setOpen(true)}
            className="h-full w-full cursor-zoom-in object-contain"
          />
        ) : (
          <video
            src={currentMedia.url}
            controls
            className="h-full w-full object-contain"
          />
        )}

        {media.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-2xl font-black text-white"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={next}
              className="absolute right-2 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-2xl font-black text-white"
            >
              ›
            </button>
          </>
        )}

        <div className="absolute bottom-3 right-3 rounded-full bg-black/80 px-3 py-1 text-xs font-black text-white">
          {current + 1}/{media.length}
        </div>
      </div>

      {open && currentMedia.type === "image" && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/95">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-black text-black"
          >
            ×
          </button>

          {media.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-3 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-4xl font-black text-black"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={next}
                className="absolute right-3 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-4xl font-black text-black"
              >
                ›
              </button>
            </>
          )}

          <img
            src={currentMedia.url}
            alt="확대 이미지"
            className="max-h-[90vh] max-w-[95vw] object-contain"
          />

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-sm font-black text-black">
            {currentImageIndex + 1}/{imagesOnly.length}
          </div>
        </div>
      )}
    </>
  );
}