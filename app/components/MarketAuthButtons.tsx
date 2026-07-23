"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabase } from "../../lib/supabase";

const LOGIN_REDIRECT_KEY = "ktown_login_redirect";

type Destination = "/market/my" | "/market/new";

export default function MarketAuthButtons() {
  const router = useRouter();
  const [loadingPath, setLoadingPath] =
    useState<Destination | null>(null);

  async function moveToProtectedPage(
    destination: Destination,
  ) {
    if (loadingPath) return;

    try {
      setLoadingPath(destination);

      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error(
          "Market session check error:",
          error,
        );
      }

      if (!session?.user) {
        sessionStorage.setItem(
          LOGIN_REDIRECT_KEY,
          destination,
        );

        router.push(
          `/login?redirect=${encodeURIComponent(
            destination,
          )}`,
        );

        return;
      }

      router.push(destination);
    } catch (error) {
      console.error(
        "Market protected navigation error:",
        error,
      );

      sessionStorage.setItem(
        LOGIN_REDIRECT_KEY,
        destination,
      );

      router.push(
        `/login?redirect=${encodeURIComponent(
          destination,
        )}`,
      );
    } finally {
      setLoadingPath(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() =>
          moveToProtectedPage("/market/my")
        }
        disabled={loadingPath !== null}
        className="
          rounded-full border border-[#172033]
          px-2.5 py-1 text-[11px] font-bold
          text-[#172033] transition
          active:scale-95 disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        {loadingPath === "/market/my"
          ? "확인 중..."
          : "내 물품"}
      </button>

      <button
        type="button"
        onClick={() =>
          moveToProtectedPage("/market/new")
        }
        disabled={loadingPath !== null}
        className="
          rounded-full bg-[#172033]
          px-2.5 py-1 text-[11px] font-bold
          text-white transition
          active:scale-95 disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        {loadingPath === "/market/new"
          ? "확인 중..."
          : "+ 등록"}
      </button>
    </div>
  );
}