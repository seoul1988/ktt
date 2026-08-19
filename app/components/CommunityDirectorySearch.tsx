"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function CommunityDirectorySearch({
  initialQuery = "",
  back,
}: {
  initialQuery?: string;
  back?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  function updateSearch(nextValue: string) {
    setValue(nextValue);

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      const params = new URLSearchParams();

      if (back) {
        params.set("back", back);
      }

      const trimmed = nextValue.trim();

      if (trimmed) {
        params.set("q", trimmed);
      }

      const queryString = params.toString();

      router.replace(
        queryString
          ? `/community/directory?${queryString}`
          : "/community/directory",
        { scroll: false },
      );
    }, 120);
  }

  function clearSearch() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    setValue("");

    const params = new URLSearchParams();

    if (back) {
      params.set("back", back);
    }

    const queryString = params.toString();

    router.replace(
      queryString
        ? `/community/directory?${queryString}`
        : "/community/directory",
      { scroll: false },
    );
  }

  return (
    <div className="flex h-9 w-[180px] items-center overflow-hidden rounded-full border border-white/70 bg-white shadow-md md:w-[230px]">
      <span className="pl-3 text-sm">🔍</span>

      <input
        type="search"
        value={value}
        onChange={(e) => updateSearch(e.target.value)}
        placeholder="업체 검색"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-white px-2 text-xs font-bold text-[#172033] outline-none placeholder:text-gray-400"
      />

      {value ? (
        <button
          type="button"
          onClick={clearSearch}
          className="flex h-full w-9 shrink-0 items-center justify-center text-sm font-black text-gray-400 hover:text-[#C4483A]"
          aria-label="검색 지우기"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}