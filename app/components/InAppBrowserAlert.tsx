"use client";

import { useEffect, useState } from "react";

export default function InAppBrowserAlert() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();

    const isInAppBrowser =
      ua.includes("instagram") ||
      ua.includes("fbav") ||
      ua.includes("fban") ||
      ua.includes("facebook") ||
      ua.includes("threads") ||
      ua.includes("barcelona");

    if (isInAppBrowser) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl">

        <div className="text-6xl">🌐</div>

        <h2 className="mt-4 text-2xl font-black text-[#172033]">
          Open in Chrome or Safari
        </h2>

        <p className="mt-5 text-base leading-7 text-gray-700">
          You are viewing this website inside the
          <br />
          <span className="font-bold">
            Instagram, Facebook or Threads
          </span>{" "}
          app.
        </p>

        <p className="mt-5 rounded-2xl bg-blue-50 p-4 text-[15px] leading-7 text-[#172033]">
          For the best experience,
          <br />
          please tap the
          <strong> ⋯ </strong>
          menu and choose
          <br />
          <span className="text-lg font-black text-blue-700">
            "Open in Browser"
          </span>
        </p>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-lg font-bold">
            ✅ Recommended Browsers
          </div>

          <div className="mt-3 text-xl">
            🌐 Google Chrome
            <br />
            🧭 Safari
          </div>
        </div>

        <button
          onClick={() => setShow(false)}
          className="mt-7 w-full rounded-full bg-[#172033] py-3 text-lg font-bold text-white transition hover:bg-[#283a5a]"
        >
          Continue Anyway
        </button>

      </div>
    </div>
  );
}