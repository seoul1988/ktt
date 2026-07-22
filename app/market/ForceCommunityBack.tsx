"use client";

import { useRouter } from "next/navigation";

export default function MarketBackButton() {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.replace("/community/hub");
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033] shadow"
      aria-label="이전 페이지로 이동"
    >
      ← Back
    </button>
  );
}