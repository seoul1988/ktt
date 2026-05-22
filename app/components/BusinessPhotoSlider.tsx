"use client";

import { useState } from "react";

export default function BusinessPhotoSlider({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  const [current, setCurrent] = useState(0);

  return (
    <div className="relative h-[300px] w-full overflow-hidden">
      <div
        className="flex h-full snap-x overflow-x-auto scroll-smooth"
        onScroll={(e) => {
          const width = e.currentTarget.clientWidth;

          if (!width) return;

          setCurrent(
            Math.round(
              e.currentTarget.scrollLeft / width
            )
          );
        }}
      >
        {images.map((image, index) => (
          <img
            key={index}
            src={image}
            alt={name}
            draggable={false}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">
          {current + 1} / {images.length}
        </div>
      )}
    </div>
  );
}