"use client";

import { useEffect, useState } from "react";

type AdImageGalleryProps = {
  images: string[];
  title: string;
};

export default function AdImageGallery({
  images,
  title,
}: AdImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const currentImage = images[currentIndex];

  useEffect(() => {
    if (!isOpen) {
      document.body.classList.remove(
        "ad-image-modal-open",
      );

      return;
    }

    document.body.classList.add("ad-image-modal-open");
    document.body.style.overflow = "hidden";

    return () => {
      document.body.classList.remove(
        "ad-image-modal-open",
      );
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  function showPrevious() {
    setCurrentIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1,
    );
  }

  function showNext() {
    setCurrentIndex((prev) =>
      prev === images.length - 1 ? 0 : prev + 1,
    );
  }

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <div className="relative bg-black">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="block w-full"
          aria-label={`${title} 이미지 크게 보기`}
        >
          <img
            src={currentImage}
            alt={`${title} 이미지 ${currentIndex + 1}`}
            className="aspect-[4/3] w-full object-cover"
          />
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={showPrevious}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl font-black text-white"
              aria-label="이전 이미지"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={showNext}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl font-black text-white"
              aria-label="다음 이미지"
            >
              ›
            </button>

            <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-black text-white">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} 이미지 크게 보기`}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-[10001] flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-3xl font-light text-white backdrop-blur"
            aria-label="큰 이미지 닫기"
          >
            ×
          </button>

          <div className="relative flex h-full w-full items-center justify-center px-3 py-16">
            <img
              src={currentImage}
              alt={`${title} 큰 이미지 ${currentIndex + 1}`}
              className="max-h-full max-w-full object-contain"
            />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPrevious}
                  className="absolute left-3 top-1/2 z-[10001] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-4xl font-light text-white backdrop-blur"
                  aria-label="이전 이미지"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={showNext}
                  className="absolute right-3 top-1/2 z-[10001] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-4xl font-light text-white backdrop-blur"
                  aria-label="다음 이미지"
                >
                  ›
                </button>

                <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[10001] -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-black text-white backdrop-blur">
                  {currentIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}