"use client";

import { useEffect, useState } from "react";

export default function AppSplashScreen() {
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setClosing(true);
    }, 900);

    const removeTimer = window.setTimeout(() => {
      setVisible(false);
    }, 1200);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999999] flex min-h-[100dvh] items-center justify-center bg-[#F8F3EC] transition-opacity duration-300 ${
        closing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ backgroundColor: "#F8F3EC" }}
    >
      <img
        src="/icon-512.png"
        alt="KTown Triangle"
        width={128}
        height={128}
        fetchPriority="high"
        className="h-32 w-32 rounded-[28px] object-cover shadow-lg"
      />
    </div>
  );
}