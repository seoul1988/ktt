"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallback?: string;
};

export default function BackButton({
  fallback = "/community/hub",
}: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    // 이전 페이지가 있으면 무조건 이전 페이지
    if (window.history.length > 1) {
      router.back();
      return;
    }

    // 직접 접속한 경우만 fallback
    router.replace(fallback);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-black shadow-sm transition active:scale-95"
    >
      ← 
    </button>
  );
}