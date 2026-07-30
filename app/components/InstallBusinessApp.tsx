"use client";

import { useEffect, useState } from "react";

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

function isSafariBrowser() {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent;

  return (
    /safari/i.test(userAgent) &&
    !/chrome|crios|android|edg|fxios/i.test(userAgent)
  );
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

export default function InstallBusinessApp({
  businessName,
}: Props) {
  const [mounted, setMounted] = useState(false);

  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const [isIos, setIsIos] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showBrowserHelp, setShowBrowserHelp] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsIos(isIosDevice());
    setIsSafari(isSafariBrowser());
    setInstalled(isStandaloneMode());

    /*
     * 현재 탭에서 사용자가 닫았는지만 기억합니다.
     * 브라우저를 새로 열거나 새 탭에서 접속하면 다시 나타납니다.
     */
    const wasDismissed =
      window.sessionStorage.getItem(
        "business-install-banner-dismissed",
      ) === "true";

    setDismissed(wasDismissed);

    /*
     * Service Worker 등록
     */
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", {
          scope: "/",
        })
        .catch((error) => {
          console.error(
            "Service worker registration failed:",
            error,
          );
        });
    }

    /*
     * Chrome, Edge, Android에서 설치 준비가 완료되면 발생합니다.
     */
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      setInstallEvent(event as BeforeInstallPromptEvent);
      setInstalled(false);

      /*
       * 설치가 다시 가능해졌다면 이전 닫힘 기록을 해제합니다.
       */
      window.sessionStorage.removeItem(
        "business-install-banner-dismissed",
      );

      setDismissed(false);
      setShowBrowserHelp(false);
    };

    /*
     * 실제 앱 설치가 끝났을 때 발생합니다.
     */
    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setDismissed(false);
      setShowIosHelp(false);
      setShowBrowserHelp(false);

      window.sessionStorage.removeItem(
        "business-install-banner-dismissed",
      );
    };

    /*
     * PWA 화면과 일반 브라우저 화면 전환 감지
     */
    const standaloneMedia = window.matchMedia(
      "(display-mode: standalone)",
    );

    const updateStandaloneState = () => {
      const standalone = isStandaloneMode();

      setInstalled(standalone);

      /*
       * 일반 브라우저 화면이면 설치 배너를 다시 표시할 수 있습니다.
       * 앱을 삭제한 뒤 브라우저에서 다시 열었을 때도 적용됩니다.
       */
      if (!standalone) {
        const wasDismissed =
          window.sessionStorage.getItem(
            "business-install-banner-dismissed",
          ) === "true";

        setDismissed(wasDismissed);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateStandaloneState();
      }
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled,
    );

    window.addEventListener(
      "pageshow",
      updateStandaloneState,
    );

    window.addEventListener(
      "focus",
      updateStandaloneState,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    standaloneMedia.addEventListener?.(
      "change",
      updateStandaloneState,
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

      window.removeEventListener(
        "pageshow",
        updateStandaloneState,
      );

      window.removeEventListener(
        "focus",
        updateStandaloneState,
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      standaloneMedia.removeEventListener?.(
        "change",
        updateStandaloneState,
      );
    };
  }, []);

  function closeBanner() {
    window.sessionStorage.setItem(
      "business-install-banner-dismissed",
      "true",
    );

    setDismissed(true);
    setShowIosHelp(false);
    setShowBrowserHelp(false);
  }

  async function installApp() {
    /*
     * 이미 PWA 화면에서 실행 중이면 설치 버튼을 숨깁니다.
     */
    if (isStandaloneMode()) {
      setInstalled(true);
      return;
    }

    /*
     * iPhone/iPad
     */
    if (isIos) {
      setShowIosHelp(true);
      return;
    }

    /*
     * Chrome 또는 Edge 설치 이벤트가 있는 경우
     */
    if (installEvent) {
      try {
        await installEvent.prompt();

        const choice = await installEvent.userChoice;

        /*
         * beforeinstallprompt 객체는 한 번만 사용할 수 있습니다.
         */
        setInstallEvent(null);

        if (choice.outcome === "accepted") {
          /*
           * 실제 설치 완료 여부는 appinstalled 이벤트가 판단합니다.
           * 설치 선택 직후 배너만 닫습니다.
           */
          window.sessionStorage.setItem(
            "business-install-banner-dismissed",
            "true",
          );

          setDismissed(true);
        }

        return;
      } catch (error) {
        console.error("App installation failed:", error);

        setInstallEvent(null);
        setShowBrowserHelp(true);
        return;
      }
    }

    /*
     * 설치 이벤트가 아직 준비되지 않은 경우에도
     * 버튼을 없애지 않고 수동 설치 방법을 표시합니다.
     */
    setShowBrowserHelp(true);
  }

  /*
   * hydration 완료 전에는 렌더링하지 않습니다.
   */
  if (!mounted) {
    return null;
  }

  /*
   * 실제 설치 앱 화면에서는 배너를 표시하지 않습니다.
   */
  if (installed) {
    return null;
  }

  /*
   * 사용자가 현재 탭에서 닫은 경우
   */
  if (dismissed) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-x-3 bottom-4 z-[9999] mx-auto max-w-md rounded-2xl border border-black/10 bg-white p-4 shadow-2xl">
        <button
          type="button"
          aria-label="설치 안내 닫기"
          onClick={closeBanner}
          className="absolute right-3 top-2 flex h-8 w-8 items-center justify-center rounded-full text-2xl leading-none text-gray-500 hover:bg-gray-100"
        >
          ×
        </button>

        <div className="pr-9">
          <p className="text-base font-bold text-gray-950">
            {businessName} 앱 설치
          </p>

          <p className="mt-1 text-sm leading-5 text-gray-600">
            홈 화면에 설치하면 더 빠르고 편리하게 다시 열 수
            있습니다.
          </p>
        </div>

        <button
          type="button"
          onClick={installApp}
          className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[0.99]"
        >
          {isIos ? "설치 방법 보기" : "앱 설치하기"}
        </button>
      </div>

      {showIosHelp ? (
        <div
          className="fixed inset-0 z-[10000] flex items-end bg-black/55 p-4"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  id="ios-install-title"
                  className="text-lg font-bold text-gray-950"
                >
                  iPhone 홈 화면에 설치
                </p>

                {!isSafari ? (
                  <p className="mt-2 text-sm leading-6 text-gray-700">
                    먼저 이 페이지를
                    <strong> Safari에서 여세요.</strong>
                  </p>
                ) : null}

                <ol className="mt-3 space-y-2 text-sm leading-6 text-gray-700">
                  <li>
                    1. Safari 아래쪽의
                    <strong> 공유 버튼</strong>을 누르세요.
                  </li>

                  <li>
                    2. 메뉴에서
                    <strong> 홈 화면에 추가</strong>를 선택하세요.
                  </li>

                  <li>
                    3. 오른쪽 위의
                    <strong> 추가</strong>를 누르세요.
                  </li>
                </ol>
              </div>

              <button
                type="button"
                aria-label="닫기"
                onClick={() => setShowIosHelp(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-gray-500 hover:bg-gray-100"
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
            role="dialog"
            aria-modal="true"
            aria-labelledby="browser-install-title"
            className="mx-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  id="browser-install-title"
                  className="text-lg font-bold text-gray-950"
                >
                  {businessName} 설치
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-700">
                  브라우저의 자동 설치 창이 아직 준비되지
                  않았습니다.
                </p>

                <div className="mt-3 rounded-xl bg-gray-100 p-3 text-sm leading-6 text-gray-700">
                  <strong>Chrome</strong>
                  <br />
                  오른쪽 위의 <strong>⋮</strong> 메뉴를 누른 후
                  <br />
                  <strong>앱 설치</strong> 또는
                  <strong> 홈 화면에 추가</strong>를 선택하세요.
                </div>

                <div className="mt-3 rounded-xl bg-gray-100 p-3 text-sm leading-6 text-gray-700">
                  <strong>Microsoft Edge</strong>
                  <br />
                  오른쪽 위의 <strong>⋯</strong> 메뉴를 누른 후
                  <br />
                  <strong>앱 → 이 사이트를 앱으로 설치</strong>를
                  선택하세요.
                </div>

                <p className="mt-3 text-xs leading-5 text-gray-500">
                  앱을 방금 삭제했다면 페이지를 새로고침한 뒤 다시
                  시도하세요. 브라우저가 설치 가능 상태를 다시
                  확인하는 데 시간이 걸릴 수 있습니다.
                </p>
              </div>

              <button
                type="button"
                aria-label="닫기"
                onClick={() => setShowBrowserHelp(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-gray-500 hover:bg-gray-100"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowBrowserHelp(false)}
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