"use client";

import { useState } from "react";

export default function MarketMediaSlider({
  media,
}: {
  media: {
    type: "image" | "video";
    url: string;
  }[];
}) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  if (!media.length) {
    return (
      <div className="flex h-72 items-center justify-center bg-gray-200">
        이미지 없음
      </div>
    );
  }

  const current = media[index];

  function prevMedia() {
    setIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  }

  function nextMedia() {
    setIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
  }

  return (
    <>
      <div className="relative">
        {current.type === "image" ? (
          <img
            src={current.url}
            alt={`media-${index + 1}`}
            className="h-72 w-full cursor-zoom-in object-cover"
            onClick={() => setFullscreen(true)}
          />
        ) : (
          <video
            src={current.url}
            controls
            className="h-72 w-full bg-black object-contain"
          />
        )}

        {media.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevMedia}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white"
            >
              ◀
            </button>

            <button
              type="button"
              onClick={nextMedia}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-white"
            >
              ▶
            </button>
          </>
        )}

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
          {index + 1} / {media.length}
        </div>
      </div>

      {fullscreen && current.type === "image" && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95"
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 text-3xl font-black text-white"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreen(false);
            }}
          >
            ×
          </button>

          <img
            src={current.url}
            alt="fullscreen"
            className="max-h-[95vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}