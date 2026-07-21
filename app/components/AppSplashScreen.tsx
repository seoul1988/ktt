"use client";

import { useEffect, useState } from "react";

export default function AppSplashScreen() {
  const [showSplash, setShowSplash] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const standaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean(
        (window.navigator as Navigator & {
          standalone?: boolean;
        }).standalone,
      );

    setIsStandalone(standaloneMode);

    if (!standaloneMode) {
      setShowSplash(false);
      return;
    }

    const closeTimer = window.setTimeout(() => {
      setIsClosing(true);
    }, 1000);

    const removeTimer = window.setTimeout(() => {
      setShowSplash(false);
    }, 1350);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!showSplash || !isStandalone) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[999999] flex min-h-[100dvh] items-center justify-center bg-[#F8F3EC] transition-opacity duration-300 ${
        isClosing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center justify-center">
        <img
          src="/icon-512.png"
          alt="KTown Triangle"
          className="h-28 w-28 rounded-[26px] object-cover shadow-lg"
        />

        <div className="mt-5 text-center">
          <p className="text-xl font-extrabold tracking-tight text-[#172033]">
            KTown Triangle
          </p>

          <p className="mt-1 text-xs font-medium text-[#6B7280]">
            Raleigh · Durham · Cary · Chapel Hill
          </p>
        </div>

        <div className="mt-6 h-5 w-5 animate-spin rounded-full border-2 border-[#172033]/20 border-t-[#F7A928]" />
      </div>
    </div>
  );
}