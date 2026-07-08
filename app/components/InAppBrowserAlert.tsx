"use client";

import { useEffect, useState } from "react";

export default function InAppBrowserNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";

    const isInstagram = ua.includes("Instagram");
    const isFacebook = ua.includes("FBAN") || ua.includes("FBAV");
    const isThreads = ua.includes("Threads") || ua.includes("Barcelona");

    if (isInstagram || isFacebook || isThreads) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] bg-[#172033] px-4 py-3 text-white shadow-lg">
      <div className="mx-auto max-w-md text-center">
        <div className="text-base font-extrabold">
          🌐 Open in Chrome or Safari
        </div>

        <p className="mt-2 text-sm leading-relaxed">
          You're viewing this site inside Instagram, Facebook, or Threads.
          <br />
          For the best experience, tap the <b>⋮</b> or <b>•••</b> menu and select{" "}
          <b>Open in Browser</b>.
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