"use client";

import { useEffect } from "react";

export default function AppBadgeManager() {
  useEffect(() => {
    async function clearBadge() {
      try {
        if ("clearAppBadge" in navigator) {
          await navigator.clearAppBadge();
        }
      } catch (error) {
        console.error("App badge clear error:", error);
      }
    }

    clearBadge();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        clearBadge();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, []);

  return null;
}