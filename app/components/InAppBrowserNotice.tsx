"use client";

import { useEffect, useState } from "react";

const NOTICE_SESSION_KEY = "ktown_in_app_browser_notice_v3";

type InAppBrowserType =
  | "instagram"
  | "facebook"
  | "threads"
  | "kakao"
  | null;

function detectInAppBrowser(userAgent: string): InAppBrowserType {
  const ua = userAgent.toLowerCase();

  // 카카오톡을 먼저 확인
  if (ua.includes("kakaotalk")) {
    return "kakao";
  }

  if (ua.includes("instagram")) {
    return "instagram";
  }

  if (ua.includes("fban") || ua.includes("fbav")) {
    return "facebook";
  }

  if (ua.includes("threads") || ua.includes("barcelona")) {
    return "threads";
  }

  return null;
}

export default function InAppBrowserNotice() {
  const [browserType, setBrowserType] =
    useState<InAppBrowserType>(null);

  useEffect(() => {
    try {
      const alreadyShown =
        window.sessionStorage.getItem(NOTICE_SESSION_KEY) === "true";

      if (alreadyShown) {
        return;
      }

      const detectedType = detectInAppBrowser(
        window.navigator.userAgent || "",
      );

      if (!detectedType) {
        return;
      }

      setBrowserType(detectedType);
    } catch (error) {
      console.error("InAppBrowserNotice error:", error);
      setBrowserType(null);
    }
  }, []);

  function closeNotice() {
    try {
      window.sessionStorage.setItem(NOTICE_SESSION_KEY, "true");
    } catch (error) {
      console.error(
        "Unable to save browser notice state:",
        error,
      );
    }

    setBrowserType(null);
  }

  if (!browserType) {
    return null;
  }

  const isKakao = browserType === "kakao";

  const message = isKakao
    ? "Chrome 또는 Safari에서 앱을 설치하여 이용하시면 더욱 편리합니다."
    : "Install the app from Chrome or Safari for the best experience.";

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/45 px-5"
      role="presentation"
      onClick={closeNotice}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-gray-300 bg-[#E5E7EB] px-6 pb-5 pt-8 text-center shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="in-app-browser-notice-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeNotice}
          className="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full text-2xl font-light text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 active:scale-95"
          aria-label={isKakao ? "닫기" : "Close"}
        >
          ×
        </button>

        <p
          id="in-app-browser-notice-title"
          className="text-[17px] font-semibold leading-7 text-gray-900"
        >
          {message}
        </p>
      </div>
    </div>
  );
}