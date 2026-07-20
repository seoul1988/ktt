"use client";

import { useEffect, useState } from "react";

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      // 화면이 300px 이상 내려갔을 때 버튼 표시
      setIsVisible(window.scrollY > 300);
    }

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="맨 위로 이동"
      className={`
        fixed right-0 z-[70]
        flex h-9 w-9 items-center justify-center
        rounded-full
        bg-[#172033]
        text-3xl font-light text-white
        shadow-[0_8px_24px_rgba(23,32,51,0.35)]
        transition-all duration-300
        active:scale-90
        sm:right-0
        ${
          isVisible
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }
      `}
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 185px)",
      }}
    >
      <span className="-mt-1" aria-hidden="true">
        ↑
      </span>
    </button>
  );
}