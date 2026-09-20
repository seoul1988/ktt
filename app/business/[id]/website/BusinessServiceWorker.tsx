"use client";

import { useEffect } from "react";

type Props = {
  businessId: string;
};

const PRIMARY_HOSTS = new Set([
  "ktowntriangle.com",
  "www.ktowntriangle.com",
]);

function normalizeHost(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(":")[0]
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

export default function BusinessServiceWorker({
  businessId,
}: Props) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.error(
        "This browser does not support service workers.",
      );
      return;
    }

    const host = normalizeHost(window.location.host);

    const isCustomDomain =
      !PRIMARY_HOSTS.has(host) &&
      !host.endsWith(".vercel.app") &&
      host !== "localhost";

    /*
     * KTown 기본 주소:
     * /business/90/website/sw.js
     *
     * 커스텀 도메인:
     * /sw.js
     */
    const workerPath = isCustomDomain
      ? "/sw.js"
      : `/business/${businessId}/website/sw.js`;

    /*
     * KTown 기본 주소:
     * /business/90/
     *
     * 커스텀 도메인:
     * /
     */
    const scopePath = isCustomDomain
      ? "/"
      : `/business/${businessId}/`;

    const expectedWorkerUrl = new URL(
      workerPath,
      window.location.origin,
    ).href;

    const expectedScopeUrl = new URL(
      scopePath,
      window.location.origin,
    ).href;

    const reloadKey =
      `business-sw-reload-v4-${businessId}`;

    let cancelled = false;

    const handleControllerChange = () => {
      const controllerUrl =
        navigator.serviceWorker.controller?.scriptURL || "";

      console.log(
        "Service worker controller changed:",
        controllerUrl,
      );

      if (controllerUrl === expectedWorkerUrl) {
        sessionStorage.removeItem(reloadKey);
      }
    };

    async function registerBusinessWorker() {
      try {
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          handleControllerChange,
        );

        const registrations =
          await navigator.serviceWorker.getRegistrations();

        /*
         * 현재 사용할 서비스워커와 같은 script인데
         * scope가 잘못된 경우만 삭제합니다.
         */
        for (const existing of registrations) {
          const scriptUrl =
            existing.active?.scriptURL ||
            existing.waiting?.scriptURL ||
            existing.installing?.scriptURL ||
            "";

          const isCurrentBusinessWorker =
            scriptUrl === expectedWorkerUrl;

          const hasWrongScope =
            existing.scope !== expectedScopeUrl;

          if (
            isCurrentBusinessWorker &&
            hasWrongScope
          ) {
            await existing.unregister();

            console.log(
              "Old business worker removed:",
              existing.scope,
            );
          }
        }

        if (cancelled) return;

        console.log(
          "Registering business service worker:",
          {
            workerPath,
            scopePath,
            isCustomDomain,
          },
        );

        const registration =
          await navigator.serviceWorker.register(
            workerPath,
            {
              scope: scopePath,
              updateViaCache: "none",
            },
          );

        await registration.update();

        if (cancelled) return;

        console.log(
          "Business service worker registered:",
          registration.scope,
        );

        const worker =
          registration.installing ||
          registration.waiting ||
          registration.active;

        /*
         * 서비스워커가 activated 상태가 될 때까지 기다립니다.
         */
        if (worker && worker.state !== "activated") {
          await new Promise<void>((resolve) => {
            const handleStateChange = () => {
              if (
                worker.state === "activated" ||
                worker.state === "redundant"
              ) {
                worker.removeEventListener(
                  "statechange",
                  handleStateChange,
                );

                resolve();
              }
            };

            worker.addEventListener(
              "statechange",
              handleStateChange,
            );
          });
        }

        if (cancelled) return;

        const currentControllerUrl =
          navigator.serviceWorker.controller?.scriptURL || "";

        console.log(
          "Current service worker controller:",
          currentControllerUrl,
        );

        /*
         * 이미 올바른 서비스워커가 현재 페이지를
         * 제어하고 있으면 끝냅니다.
         */
        if (
          currentControllerUrl === expectedWorkerUrl
        ) {
          sessionStorage.removeItem(reloadKey);

          console.log(
            "Business service worker is controlling this page.",
          );

          return;
        }

        /*
         * 새 서비스워커가 다음 로드부터 페이지를
         * 제어할 수 있도록 한 번만 새로고침합니다.
         */
        if (
          sessionStorage.getItem(reloadKey) !== "1"
        ) {
          sessionStorage.setItem(reloadKey, "1");

          console.log(
            "Reloading once to activate the business worker.",
          );

          window.location.reload();
          return;
        }

        console.warn(
          "Business service worker is registered, but this page is still controlled by:",
          currentControllerUrl,
        );
      } catch (error) {
        console.error(
          "Business service worker registration failed:",
          error,
        );
      }
    }

    void registerBusinessWorker();

    return () => {
      cancelled = true;

      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, [businessId]);

  return null;
}