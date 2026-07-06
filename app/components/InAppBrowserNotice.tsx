"use client";

import { useEffect, useState } from "react";

export default function InAppBrowserNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";

    const isInstagram = ua.includes("Instagram");
    const isFacebook = ua.includes("FBAN") || ua.includes("FBAV");

    if (isInstagram || isFacebook) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
  <div className="fixed inset-x-0 top-0 z-[9999] bg-[#172033] px-4 py-4 text-white shadow-lg">
  <div className="mx-auto max-w-md text-center">
    <div className="text-lg font-extrabold">
      📱 Install the KTown Triangle App
    </div>

    <p className="mt-2 text-sm leading-relaxed">
      You're viewing this site inside Instagram.
      <br />
      To install the app, tap the <b>⋮</b> or <b>•••</b> menu in the top right,
      then select <b>Open in Chrome</b>.
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