"use client";

import { useEffect, useState } from "react";

export default function AppSplashScreen() {
  // 처음 렌더링될 때부터 스플래시를 표시
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = window.navigator as Navigator & {
      standalone?: boolean;
    };

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;

    // 일반 Safari/Chrome 접속이면 바로 제거
    if (!isStandalone) {
      setVisible(false);
      return;
    }

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

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999999] flex min-h-[100dvh] items-center justify-center bg-[#F8F3EC] transition-opacity duration-300 ${
        closing ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center justify-center">
        <img
          src="/icon-512.png"
          alt=""
          width={128}
          height={128}
          fetchPriority="high"
          className="h-32 w-32 rounded-[28px] object-cover shadow-lg"
        />

        <p className="mt-5 text-xl font-extrabold tracking-tight text-[#172033]">
          KTown Triangle
        </p>

        <p className="mt-1 text-xs font-medium text-[#6B7280]">
          Raleigh · Durham · Cary · Chapel Hill
        </p>
      </div>
    </div>
  );
}