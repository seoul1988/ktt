"use client";

import { useEffect, useMemo, useState } from "react";

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

  const ios = useMemo(() => isIosDevice(), []);

  useEffect(() => {
    setInstalled(isStandalone());

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error) => {
          console.error("Service worker registration failed:", error);
        });
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setShowIosHelp(false);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installApp() {
    if (ios) {
      setShowIosHelp(true);
      return;
    }

    if (!installEvent) return;

    await installEvent.prompt();
    const choice = await installEvent.userChoice;

    if (choice.outcome === "accepted") {
      setInstalled(true);
    }

    setInstallEvent(null);
  }

  if (installed || dismissed) return null;

  // Android/Chrome/Edge에서는 beforeinstallprompt가 준비된 경우 표시합니다.
  // iPhone/iPad에서는 Safari의 "홈 화면에 추가" 안내를 표시합니다.
  if (!installEvent && !ios) return null;

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
    </>
  );
}
