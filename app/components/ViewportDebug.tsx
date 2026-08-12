"use client";

import { useEffect, useState } from "react";

type ViewportInfo = {
  innerWidth: number;
  innerHeight: number;
  clientWidth: number;
  clientHeight: number;
  screenWidth: number;
  screenHeight: number;
  visualWidth: number;
  visualHeight: number;
  scale: number;
  dpr: number;
};

export default function ViewportDebug() {
  const [info, setInfo] = useState<ViewportInfo | null>(null);

  useEffect(() => {
    function update() {
      const vv = window.visualViewport;

      setInfo({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,

        clientWidth:
          document.documentElement.clientWidth,

        clientHeight:
          document.documentElement.clientHeight,

        screenWidth: window.screen.width,
        screenHeight: window.screen.height,

        visualWidth:
          vv?.width ?? window.innerWidth,

        visualHeight:
          vv?.height ?? window.innerHeight,

        scale:
          vv?.scale ?? 1,

        dpr:
          window.devicePixelRatio,
      });
    }

    update();

    const timer1 = window.setTimeout(update, 200);
    const timer2 = window.setTimeout(update, 1000);
    const timer3 = window.setTimeout(update, 3000);

    window.addEventListener("resize", update);
    window.addEventListener("pageshow", update);
    window.addEventListener("orientationchange", update);

    window.visualViewport?.addEventListener(
      "resize",
      update,
    );

    window.visualViewport?.addEventListener(
      "scroll",
      update,
    );

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      window.removeEventListener("resize", update);
      window.removeEventListener("pageshow", update);
      window.removeEventListener(
        "orientationchange",
        update,
      );

      window.visualViewport?.removeEventListener(
        "resize",
        update,
      );

      window.visualViewport?.removeEventListener(
        "scroll",
        update,
      );
    };
  }, []);

  if (!info) return null;

  return (
    <div
      className="
        fixed left-1 top-1
        z-[2147483647]
        rounded-lg
        bg-black/90
        px-2 py-2
        font-mono
        text-[10px]
        leading-[1.4]
        text-white
        shadow-xl
      "
      style={{
        pointerEvents: "none",
      }}
    >
      <div>innerW: {info.innerWidth}</div>
      <div>innerH: {info.innerHeight}</div>

      <div>
        clientW: {info.clientWidth}
      </div>

      <div>
        clientH: {info.clientHeight}
      </div>

      <div>
        screenW: {info.screenWidth}
      </div>

      <div>
        screenH: {info.screenHeight}
      </div>

      <div>
        visualW: {info.visualWidth.toFixed(1)}
      </div>

      <div>
        visualH: {info.visualHeight.toFixed(1)}
      </div>

      <div>
        scale: {info.scale.toFixed(2)}
      </div>

      <div>DPR: {info.dpr}</div>
    </div>
  );
}