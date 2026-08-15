"use client";

import { useEffect, useState } from "react";

type Props = {
  src: string;
  alt: string;
};

export default function TrafficImageModal({ src, alt }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full cursor-zoom-in bg-[#F3EEE7] p-2 text-left"
        aria-label={`${alt} 크게 보기`}
      >
        <img
          src={src}
          alt={alt}
          className="h-auto w-full rounded-2xl bg-white object-contain"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="통계 이미지 크게 보기"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed right-4 top-4 z-[10000] flex h-11 w-11 items-center justify-center rounded-full bg-white text-2xl font-black leading-none text-[#172033] shadow-xl"
            aria-label="이미지 닫기"
          >
            ×
          </button>

          <div
            className="relative flex max-h-[94vh] max-w-[96vw] items-center justify-center overflow-auto rounded-2xl bg-white p-2 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={src}
              alt={alt}
              className="block h-auto max-h-[90vh] w-auto max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}