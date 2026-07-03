"use client";

import { useState } from "react";

export default function ImageModal({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        className="h-auto w-full cursor-zoom-in object-contain transition hover:opacity-95"
      />

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
        >
          <img
            src={src}
            alt={alt}
            className="max-h-[95vh] max-w-[95vw] rounded-xl object-contain"
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="absolute right-5 top-5 rounded-full bg-white px-4 py-2 text-lg font-black text-[#172033]"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}