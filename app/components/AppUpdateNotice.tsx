"use client";

import { useEffect, useState } from "react";

const VERSION_STORAGE_KEY = "ktown_app_version";
const UPDATE_RESTART_NOTICE_KEY = "ktown_update_restart_notice";

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

function isIOSInstalledApp() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = navigator as IOSNavigator;

  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1);

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true;

  return isIOS && isStandalone;
}

export default function AppUpdateNotice() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [showRestartNotice, setShowRestartNotice] =
    useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");

  useEffect(() => {
    if (!isIOSInstalledApp()) {
      return;
    }

    let cancelled = false;

    const shouldShowRestartNotice =
      sessionStorage.getItem(UPDATE_RESTART_NOTICE_KEY) === "1";

    if (shouldShowRestartNotice) {
      sessionStorage.removeItem(UPDATE_RESTART_NOTICE_KEY);
      setShowRestartNotice(true);
    }

    async function checkVersion() {
      try {
        const response = await fetch(
          `/app-version.json?t=${Date.now()}`,
          {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
            },
          },
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          version?: string;
        };

        const serverVersion = String(
          data.version || "",
        ).trim();

        if (!serverVersion || cancelled) {
          return;
        }

        const savedVersion = localStorage.getItem(
          VERSION_STORAGE_KEY,
        );

        // First-time users save the current version
        // without showing an update notice.
        if (!savedVersion) {
          localStorage.setItem(
            VERSION_STORAGE_KEY,
            serverVersion,
          );
          return;
        }

        if (savedVersion !== serverVersion) {
          setLatestVersion(serverVersion);
          setShowUpdate(true);
        }
      } catch (error) {
        console.warn("App version check failed:", error);
      }
    }

    void checkVersion();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    const intervalId = window.setInterval(() => {
      void checkVersion();
    }, 30 * 60 * 1000);

    return () => {
      cancelled = true;

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      window.clearInterval(intervalId);
    };
  }, []);

  async function updateApp() {
    if (isUpdating) {
      return;
    }

    setIsUpdating(true);

    sessionStorage.setItem(
      UPDATE_RESTART_NOTICE_KEY,
      "1",
    );

    const reloadApp = () => {
      if (latestVersion) {
        localStorage.setItem(
          VERSION_STORAGE_KEY,
          latestVersion,
        );
      }

      const currentUrl = new URL(window.location.href);

      currentUrl.searchParams.set(
        "_app_update",
        Date.now().toString(),
      );

      window.location.replace(currentUrl.toString());
    };

    try {
      if ("serviceWorker" in navigator) {
        const registrations =
          await navigator.serviceWorker.getRegistrations();

        await Promise.all(
          registrations.map(async (registration) => {
            try {
              await registration.update();
            } catch (error) {
              console.warn(
                "Service worker update failed:",
                error,
              );
            }
          }),
        );

        let reloading = false;

        const reloadOnce = () => {
          if (reloading) {
            return;
          }

          reloading = true;
          reloadApp();
        };

        navigator.serviceWorker.addEventListener(
          "controllerchange",
          reloadOnce,
          { once: true },
        );

        window.setTimeout(reloadOnce, 1800);
        return;
      }
    } catch (error) {
      console.warn("Service worker update failed:", error);
    }

    reloadApp();
  }

  function dismissUpdate() {
    setShowUpdate(false);
  }

  function dismissRestartNotice() {
    setShowRestartNotice(false);
  }

  if (showRestartNotice) {
    return (
      <div className="fixed inset-x-3 bottom-24 z-[99999] mx-auto max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#172033] text-xl text-white">
              ✓
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-black text-[#172033]">
                Update Complete
              </p>

              <p className="mt-1 text-xs leading-5 text-gray-600">
                If the app still looks the same, close and
                reopen it.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissRestartNotice}
            className="mt-3 w-full rounded-full bg-[#172033] px-4 py-2.5 text-xs font-black text-white transition active:scale-[0.98]"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-24 z-[99999] mx-auto max-w-md">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#172033] text-xl font-black text-white">
            ↑
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-black text-[#172033]">
              Update Available
            </p>

            <p className="mt-0.5 text-xs leading-5 text-gray-500">
              Tap Update to get the latest version.
            </p>
          </div>

          <button
            type="button"
            onClick={updateApp}
            disabled={isUpdating}
            className="shrink-0 rounded-full bg-[#F7B955] px-4 py-2 text-xs font-black text-[#172033] transition active:scale-95 disabled:cursor-wait disabled:opacity-60"
          >
            {isUpdating ? "Updating..." : "Update"}
          </button>
        </div>

        <button
          type="button"
          onClick={dismissUpdate}
          disabled={isUpdating}
          className="mt-3 w-full text-center text-xs font-bold text-gray-400 disabled:opacity-40"
        >
          Later
        </button>
      </div>
    </div>
  );
}