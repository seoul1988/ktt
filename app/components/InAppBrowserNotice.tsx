"use client";

import { useEffect, useState } from "react";

export default function InAppBrowserNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;

    const isInstagram = /Instagram/i.test(ua);
    const isFacebook = /FBAN|FBAV/i.test(ua);
    const isThreads = /Threads|Barcelona/i.test(ua);

    const isChrome =
      /Chrome|CriOS/i.test(ua) &&
      !isInstagram &&
      !isFacebook &&
      !isThreads;

    const isSafari =
      /Safari/i.test(ua) &&
      !/Chrome|CriOS|EdgiOS|FxiOS/i.test(ua);

    // Chrome, Safari, Instagram, Facebook, Threads에서는 표시하지 않음
    if (
      isChrome ||
      isSafari ||
      isInstagram ||
      isFacebook ||
      isThreads
    ) {
      setShow(false);
      return;
    }

    // 그 외 브라우저에서만 표시
    setShow(true);
  }, []);

  if (!show) return null;

 return (
  <div
    onClick={() => setShow(false)}
    className="fixed inset-x-0 top-0 z-[9999] cursor-pointer bg-[#172033] px-4 py-3 text-white shadow-lg"
  >
    <div className="mx-auto max-w-md text-center">
      <p className="text-sm leading-relaxed">
        Install the app from Chrome or Safari for the best experience.
      </p>
    </div>
  </div>
);
}