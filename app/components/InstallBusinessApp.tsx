"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

type Props = {
  businessName: string;
};

function isIosDevice() {
  if (typeof window === "undefined") return false;

  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

export default function InstallBusinessApp({ businessName }: Props) {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showBrowserHelp, setShowBrowserHelp] = useState(false);

  const [mounted, setMounted] = useState(false);

  const ios = useMemo(() => isIosDevice(), []);

  const checkInstalledState = useCallback(() => {
    const currentInstalledState = isStandalone();

    setInstalled(currentInstalledState);

    if (!currentInstalledState) {
      /*
       * 설치했던 앱을 삭제하고 일반 브라우저에서 다시 접속하면
       * 설치 배너가 다시 나타날 수 있도록 닫힘 상태를 초기화합니다.
       */
      setDismissed(false);
    }

    return currentInstalledState;
  }, []);

  useEffect(() => {
    setMounted(true);
    checkInstalledState();

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error) => {
          console.error("Service worker registration failed:", error);
        });
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      const promptEvent = event as BeforeInstallPromptEvent;

      setInstallEvent(promptEvent);
      setInstalled(false);
      setDismissed(false);
      setShowBrowserHelp(false);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setDismissed(false);
      setShowIosHelp(false);
      setShowBrowserHelp(false);
    };

    const handlePageShow = () => {
      checkInstalledState();
    };

    const handleFocus = () => {
      checkInstalledState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkInstalledState();
      }
    };

    const standaloneMedia = window.matchMedia(
      "(display-mode: standalone)",
    );

    const handleDisplayModeChange = () => {
      checkInstalledState();
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );

    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    standaloneMedia.addEventListener?.(
      "change",
      handleDisplayModeChange,
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled,
      );

      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      standaloneMedia.removeEventListener?.(
        "change",
        handleDisplayModeChange,
      );
    };
  }, [checkInstalledState]);

  async function installApp() {
    /*
     * 버튼을 누르는 순간 설치 상태를 한 번 더 검사합니다.
     */
    if (checkInstalledState()) {
      return;
    }

    if (ios) {
      setShowIosHelp(true);
      return;
    }

    /*
     * Chrome이 beforeinstallprompt를 아직 제공하지 않았거나
     * 앱 삭제 직후 이벤트 재발생이 지연되는 경우입니다.
     *
     * 배너를 숨기지 않고 브라우저 메뉴 설치 방법을 안내합니다.
     */
    if (!installEvent) {
      setShowBrowserHelp(true);
      return;
    }

    try {
      await installEvent.prompt();

      const choice = await installEvent.userChoice;

      /*
       * beforeinstallprompt 이벤트는 한 번만 사용할 수 있으므로
       * 선택 후 반드시 비웁니다.
       */
      setInstallEvent(null);

      if (choice.outcome === "accepted") {
        /*
         * 여기에서 installed=true로 변경하지 않습니다.
         * 실제 설치 완료는 appinstalled 이벤트가 처리합니다.
         */
        setDismissed(true);
      }
    } catch (error) {
      console.error("App installation failed:", error);

      setInstallEvent(null);
      setShowBrowserHelp(true);
    }
  }

  if (!mounted || installed || dismissed) {
    return null;
  }

  /*
   * 중요:
   * installEvent가 없어도 설치 배너 자체는 표시합니다.
   * 이벤트가 준비되지 않은 경우 버튼을 누르면 설치 방법을 안내합니다.
   */
  return (
    <>
      <div className="fixed inset-x-3 bottom-4 z-[9999] mx-auto max-w-md rounded-2xl border border-black/10 bg-white p-4 shadow-2xl">
        <button
          type="button"
          aria-label="설치 안내 닫기"
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-2 text-xl leading-none text-gray-500"
        >
          ×
        </button>

        <div className="pr-7">
          <p className="text-base font-bold text-gray-950">
            {businessName} 앱 설치
          </p>

          <p className="mt-1 text-sm leading-5 text-gray-600">
            홈 화면에 설치하면 더 빠르게 다시 열 수 있습니다.
          </p>
        </div>

        <button
          type="button"
          onClick={installApp}
          className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
        >
          {ios ? "설치 방법 보기" : "앱 설치하기"}
        </button>
      </div>

      {showIosHelp ? (
        <div
          className="fixed inset-0 z-[10000] flex items-end bg-black/55 p-4"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-gray-950">
                  iPhone 홈 화면에 설치
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-700">
                  Safari 아래쪽의 공유 버튼을 누른 다음
                  <strong> “홈 화면에 추가”</strong>를 선택하세요.
                </p>
              </div>

              <button
                type="button"
                aria-label="닫기"
                onClick={() => setShowIosHelp(false)}
                className="text-2xl leading-none text-gray-500"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="mt-5 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
            >
              확인
            </button>
          </div>
        </div>
      ) : null}

      {showBrowserHelp ? (
        <div
          className="fixed inset-0 z-[10000] flex items-end bg-black/55 p-4"
          onClick={() => setShowBrowserHelp(false)}
        >
          <div
            className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-gray-950">
                  {businessName} 설치
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-700">
                  브라우저의 설치 창이 아직 준비되지 않았습니다.
                </p>

                <div className="mt-3 rounded-xl bg-gray-100 p-3 text-sm leading-6 text-gray-700">
                  <strong>Chrome 또는 Edge</strong>
                  <br />
                  오른쪽 위의 메뉴 <strong>⋮</strong>를 누른 다음
                  <br />
                  <strong>앱 설치</strong> 또는
                  <strong> 이 사이트를 앱으로 설치</strong>를
                  선택하세요.
                </div>

                <p className="mt-3 text-xs leading-5 text-gray-500">
                  앱을 방금 삭제한 경우에는 브라우저를 완전히 닫았다가
                  다시 열거나 페이지를 새로고침하면 설치 창이 다시
                  준비될 수 있습니다.
                </p>
              </div>

              <button
                type="button"
                aria-label="닫기"
                onClick={() => setShowBrowserHelp(false)}
                className="text-2xl leading-none text-gray-500"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowBrowserHelp(false);
                checkInstalledState();
              }}
              className="mt-5 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white"
            >
              확인
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}