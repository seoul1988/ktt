"use client";

import { useEffect, useState } from "react";

const NOTICE_SESSION_KEY = "ktown_english_browser_notice_shown";

export default function InAppBrowserNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const alreadyShown =
        window.sessionStorage.getItem(NOTICE_SESSION_KEY) === "true";

      if (alreadyShown) {
        return;
      }

      const ua = navigator.userAgent || "";

      const isInstagram = /Instagram/i.test(ua);
      const isFacebook = /FBAN|FBAV/i.test(ua);
      const isThreads = /Threads|Barcelona/i.test(ua);

      // Instagram, Facebook, Threads에서만 영어 안내창 표시
      if (!(isInstagram || isFacebook || isThreads)) {
        return;
      }

      setShow(true);
      window.sessionStorage.setItem(NOTICE_SESSION_KEY, "true");
    } catch (error) {
      console.error("InAppBrowserNotice error:", error);
      setShow(false);
    }
  }, []);

  function closeNotice() {
    setShow(false);
  }

  if (!show) {
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
        aria-labelledby="english-browser-notice-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeNotice}
          className="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full text-2xl font-light text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 active:scale-95"
          aria-label="Close"
        >
          ×
        </button>

        <h2
          id="english-browser-notice-title"
          className="text-[17px] font-bold leading-7 text-gray-900"
        >
          Install the app from Chrome or Safari for the best experience.
        </h2>
      </div>
    </div>
  );
}