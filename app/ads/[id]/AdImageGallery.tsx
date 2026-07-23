"use client";

import {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type AdImageGalleryProps = {
  images: string[];
  title: string;
};

type Point = {
  x: number;
  y: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function getDistance(point1: Point, point2: Point) {
  return Math.sqrt(
    Math.pow(point2.x - point1.x, 2) +
      Math.pow(point2.y - point1.y, 2),
  );
}

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export default function AdImageGallery({
  images,
  title,
}: AdImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState<Point>({
    x: 0,
    y: 0,
  });

  const [isMoving, setIsMoving] = useState(false);

  const pointersRef = useRef<Map<number, Point>>(
    new Map(),
  );

  const dragStartRef = useRef<Point | null>(null);
  const positionStartRef = useRef<Point>({
    x: 0,
    y: 0,
  });

  const pinchStartDistanceRef = useRef<number | null>(
    null,
  );

  const pinchStartScaleRef = useRef(1);

  const lastTapTimeRef = useRef(0);

  const currentImage = images[currentIndex];

  function resetZoom() {
    setScale(1);
    setPosition({
      x: 0,
      y: 0,
    });

    pointersRef.current.clear();
    dragStartRef.current = null;
    pinchStartDistanceRef.current = null;
    setIsMoving(false);
  }

function openImage() {
  const imageUrl = images[currentIndex];

  if (!imageUrl) return;

  window.location.href = imageUrl;
}

  function closeImage() {
    resetZoom();
    setIsOpen(false);
  }

  function showPrevious() {
    setCurrentIndex((previousIndex) =>
      previousIndex === 0
        ? images.length - 1
        : previousIndex - 1,
    );

    resetZoom();
  }

  function showNext() {
    setCurrentIndex((previousIndex) =>
      previousIndex === images.length - 1
        ? 0
        : previousIndex + 1,
    );

    resetZoom();
  }

  function zoomIn() {
    setScale((previousScale) =>
      clampScale(previousScale + 0.5),
    );
  }

  function zoomOut() {
    setScale((previousScale) => {
      const nextScale = clampScale(
        previousScale - 0.5,
      );

      if (nextScale === 1) {
        setPosition({
          x: 0,
          y: 0,
        });
      }

      return nextScale;
    });
  }

  function handleDoubleTap() {
    const now = Date.now();
    const timeSinceLastTap =
      now - lastTapTimeRef.current;

    if (timeSinceLastTap < 300) {
      if (scale > 1) {
        resetZoom();
      } else {
        setScale(2.5);
      }
    }

    lastTapTimeRef.current = now;
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.currentTarget.setPointerCapture(
      event.pointerId,
    );

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    handleDoubleTap();

    if (pointersRef.current.size === 1) {
      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      positionStartRef.current = {
        ...position,
      };
    }

    if (pointersRef.current.size === 2) {
      const points = Array.from(
        pointersRef.current.values(),
      );

      pinchStartDistanceRef.current = getDistance(
        points[0],
        points[1],
      );

      pinchStartScaleRef.current = scale;
    }

    setIsMoving(true);
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (
      !pointersRef.current.has(event.pointerId)
    ) {
      return;
    }

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    const pointers = Array.from(
      pointersRef.current.values(),
    );

    if (
      pointers.length === 2 &&
      pinchStartDistanceRef.current
    ) {
      const currentDistance = getDistance(
        pointers[0],
        pointers[1],
      );

      const ratio =
        currentDistance /
        pinchStartDistanceRef.current;

      const nextScale = clampScale(
        pinchStartScaleRef.current * ratio,
      );

      setScale(nextScale);

      if (nextScale === 1) {
        setPosition({
          x: 0,
          y: 0,
        });
      }

      return;
    }

    if (
      pointers.length === 1 &&
      scale > 1 &&
      dragStartRef.current
    ) {
      const moveX =
        event.clientX - dragStartRef.current.x;

      const moveY =
        event.clientY - dragStartRef.current.y;

      setPosition({
        x: positionStartRef.current.x + moveX,
        y: positionStartRef.current.y + moveY,
      });
    }
  }

  function handlePointerEnd(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    pointersRef.current.delete(event.pointerId);

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId,
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId,
      );
    }

    if (pointersRef.current.size === 1) {
      const remainingPoint = Array.from(
        pointersRef.current.values(),
      )[0];

      dragStartRef.current = {
        ...remainingPoint,
      };

      positionStartRef.current = {
        ...position,
      };
    } else {
      dragStartRef.current = null;
    }

    if (pointersRef.current.size < 2) {
      pinchStartDistanceRef.current = null;
    }

    if (pointersRef.current.size === 0) {
      setIsMoving(false);
    }
  }

  function handleWheel(
    event: ReactWheelEvent<HTMLDivElement>,
  ) {
    event.preventDefault();

    const zoomAmount =
      event.deltaY < 0 ? 0.25 : -0.25;

    setScale((previousScale) => {
      const nextScale = clampScale(
        previousScale + zoomAmount,
      );

      if (nextScale === 1) {
        setPosition({
          x: 0,
          y: 0,
        });
      }

      return nextScale;
    });
  }

  useEffect(() => {
    if (!isOpen) {
      document.body.classList.remove(
        "ad-image-modal-open",
      );

      document.body.style.overflow = "";

      return;
    }

    document.body.classList.add(
      "ad-image-modal-open",
    );

    document.body.style.overflow = "hidden";

    return () => {
      document.body.classList.remove(
        "ad-image-modal-open",
      );

      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;

      if (event.key === "Escape") {
        closeImage();
      }

      if (
        event.key === "ArrowLeft" &&
        images.length > 1
      ) {
        showPrevious();
      }

      if (
        event.key === "ArrowRight" &&
        images.length > 1
      ) {
        showNext();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen, images.length]);

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <div className="relative overflow-hidden bg-black">
        <button
          type="button"
          onClick={openImage}
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
              onClick={(event) => {
                event.stopPropagation();
                showPrevious();
              }}
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-3xl text-white"
              aria-label="이전 이미지"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                showNext();
              }}
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-3xl text-white"
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
          className="fixed inset-0 z-[99999] bg-black"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} 이미지 크게 보기`}
        >
          <div
            className="absolute inset-0 overflow-hidden touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onWheel={handleWheel}
          >
            <div className="flex h-full w-full items-center justify-center">
              <img
                src={currentImage}
                alt={`${title} 큰 이미지 ${currentIndex + 1}`}
                draggable={false}
                className={`max-h-full max-w-full object-contain ${
                  isMoving
                    ? ""
                    : "transition-transform duration-200"
                }`}
                style={{
                  transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
                  transformOrigin: "center center",
                  willChange: "transform",
                }}
              />
            </div>
          </div>

          <div className="pointer-events-none absolute left-0 right-0 top-0 z-[100001] flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="rounded-full bg-black/50 px-3 py-1 text-xs font-black text-white">
              {currentIndex + 1} / {images.length}
            </div>

            <button
              type="button"
              onClick={closeImage}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-3xl font-light text-white backdrop-blur"
              aria-label="큰 이미지 닫기"
            >
              ×
            </button>
          </div>

          {images.length > 1 && scale === 1 && (
            <>
              <button
                type="button"
                onClick={showPrevious}
                className="absolute left-3 top-1/2 z-[100001] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-4xl text-white backdrop-blur"
                aria-label="이전 이미지"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={showNext}
                className="absolute right-3 top-1/2 z-[100001] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-4xl text-white backdrop-blur"
                aria-label="다음 이미지"
              >
                ›
              </button>
            </>
          )}

          <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[100001] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/65 p-2 backdrop-blur">
            <button
              type="button"
              onClick={zoomOut}
              disabled={scale <= 1}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl font-black text-white disabled:opacity-30"
              aria-label="축소"
            >
              −
            </button>

            <button
              type="button"
              onClick={resetZoom}
              className="min-w-[66px] rounded-full bg-white/15 px-3 py-2 text-sm font-black text-white"
              aria-label="확대 초기화"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              onClick={zoomIn}
              disabled={scale >= MAX_SCALE}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl font-black text-white disabled:opacity-30"
              aria-label="확대"
            >
              +
            </button>
          </div>
        </div>
      )}
    </>
  );
}