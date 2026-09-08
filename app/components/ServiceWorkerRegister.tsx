"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    async function setupServiceWorker() {
      if (!("serviceWorker" in navigator)) {
        return;
      }

      // 로컬 개발 환경에서는 기존 Service Worker와 Cache를 제거합니다.
      // 오래된 sw.js가 /stock/live 같은 새 경로 이동을 가로막는 문제를 방지합니다.
      if (process.env.NODE_ENV === "development") {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();

          await Promise.all(
            registrations.map((registration) => registration.unregister()),
          );

          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }

          console.log("Service worker disabled in development.");
        } catch (error) {
          console.error(
            "Failed to clear development service worker/cache:",
            error,
          );
        }

        return;
      }

      // Production에서만 Service Worker를 등록합니다.
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        await registration.update();

        console.log(
          "Service worker registered:",
          registration.scope,
        );
      } catch (error) {
        console.error(
          "Service worker registration failed:",
          error,
        );
      }
    }

    void setupServiceWorker();
  }, []);

  return null;
}
