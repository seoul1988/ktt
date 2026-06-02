"use client";

import { useState } from "react";

export default function DealImageSlider({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(0);

  const prev = () => {
    setCurrent((v) => (v === 0 ? images.length - 1 : v - 1));
  };

  const next = () => {
    setCurrent((v) => (v === images.length - 1 ? 0 : v + 1));
  };

  return (
    <>
      <div className="relative h-64 w-full overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-full w-full"
        >
          <img
            src={images[current]}
            alt={title}
            className="h-full w-full object-contain"
          />
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 z-40 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-lg font-black text-white"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 z-40 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-lg font-black text-white"
            >
              ›
            </button>

            <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black text-white">
              {current + 1}/{images.length}
            </div>
          </>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[9999] bg-black">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black text-black"
          >
            ×
          </button>

          <div className="flex h-full w-full items-center justify-center p-4">
            <img
              src={images[current]}
              alt={title}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-4 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-3xl font-black text-black"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={next}
                className="absolute right-4 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-3xl font-black text-black"
              >
                ›
              </button>

              <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white/90 px-4 py-2 text-sm font-black text-black">
                {current + 1}/{images.length}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}