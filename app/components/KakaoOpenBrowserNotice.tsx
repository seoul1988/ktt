"use client";

import { useEffect, useState } from "react";

type AppType = "kakao" | "instagram" | "threads" | null;

const NOTICE_SESSION_KEY = "ktown_open_browser_notice_shown";

export default function KakaoOpenBrowserNotice() {
  const [show, setShow] = useState(false);
  const [appType, setAppType] = useState<AppType>(null);

  useEffect(() => {
    const alreadyShown =
      window.sessionStorage.getItem(NOTICE_SESSION_KEY) === "true";

    if (alreadyShown) {
      return;
    }

    const ua = navigator.userAgent.toLowerCase();

    let detectedApp: AppType = null;

    if (ua.includes("kakaotalk")) {
      detectedApp = "kakao";
    } else if (ua.includes("instagram")) {
      detectedApp = "instagram";
    } else if (
      ua.includes("threads") ||
      ua.includes("barcelona")
    ) {
      detectedApp = "threads";
    }

    if (!detectedApp) {
      return;
    }

    setAppType(detectedApp);
    setShow(true);

    window.sessionStorage.setItem(NOTICE_SESSION_KEY, "true");
  }, []);

  const closeNotice = () => {
    setShow(false);
  };

  if (!show || !appType) {
    return null;
  }



  return (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 px-5"
    role="presentation"
    onClick={closeNotice}
  >
    <div
  className="relative w-full max-w-sm rounded-2xl bg-gray-50 px-7 pb-7 pt-12 text-center shadow-xl"
  role="dialog"
  aria-modal="true"
  aria-labelledby="open-browser-notice-title"
  onClick={(event) => event.stopPropagation()}
>
      <button
        type="button"
        onClick={closeNotice}
        className="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full text-2xl font-light text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 active:scale-95"
        aria-label="닫기"
      >
        ×
      </button>

      <h2
        id="open-browser-notice-title"
        className="text-[17px] font-bold leading-7 text-gray-900"
      >
        Chrome 또는 Safari에서 앱을 설치하여 이용하시면 더욱 편리합니다.
      </h2>
    </div>
  </div>
);
}