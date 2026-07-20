"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  from?: string;
};

export default function BackButton({ from }: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (from === "search") {
      router.back();
      return;
    }

    if (from === "community") {
      router.push("/community");
      return;
    }

    router.push("/map");
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-black shadow-sm transition active:scale-95"
    >
      ← Back
    </button>
  );
}