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
    <div className="fixed inset-x-0 top-0 z-[9999] bg-[#172033] px-4 py-4 text-white shadow-lg">
      <div className="mx-auto max-w-md text-center">
        <div className="text-lg font-extrabold">
          📱 Install the KTown Triangle App
        </div>

        <p className="mt-2 text-sm leading-relaxed">
          For the best experience, install the KTown Triangle app.
          <br />
          Open your browser menu and select <b>Add to Home Screen</b> or{" "}
          <b>Install App</b>.
        </p>

        <button
          onClick={() => setShow(false)}
          className="mt-3 rounded-full bg-white px-5 py-2 text-sm font-bold text-[#172033]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}