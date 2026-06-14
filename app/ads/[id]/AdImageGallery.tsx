"use client";

import { useState } from "react";

export default function AdImageGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <>
      <img
        src={images[0]}
        alt={title}
        onClick={() => setSelectedImage(images[0])}
        className="max-h-[420px] w-full cursor-zoom-in object-contain"
      />

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3">
          {images.map((img, index) => (
            <img
              key={index}
              src={img}
              alt={`${title}-${index}`}
              onClick={() => setSelectedImage(img)}
              className="h-20 w-20 shrink-0 cursor-pointer rounded-2xl border object-cover"
            />
          ))}
        </div>
      )}

      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
            className="absolute right-4 top-4 rounded-full bg-white px-4 py-2 text-lg font-black text-black"
          >
            ✕
          </button>

          <img
            src={selectedImage}
            alt={title}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain"
          />
        </div>
      )}
    </>
  );
}