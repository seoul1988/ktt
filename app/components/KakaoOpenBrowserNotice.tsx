"use client";

import { useEffect, useState } from "react";

type AppType = "kakao" | "instagram" | "threads" | null;

const NOTICE_SESSION_KEY = "ktown_open_browser_notice_shown";

export default function KakaoOpenBrowserNotice() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appType, setAppType] = useState<AppType>(null);

  useEffect(() => {
    /*
     * 같은 브라우저 탭에서 안내창을 이미 한 번 표시했다면
     * 페이지 이동이나 새로고침 후에도 다시 띄우지 않습니다.
     *
     * 탭을 완전히 닫은 뒤 카카오톡·Instagram·Threads에서
     * 사이트에 다시 접속하면 새 세션이므로 다시 한 번 표시됩니다.
     */
    const alreadyShown =
      window.sessionStorage.getItem(NOTICE_SESSION_KEY) === "true";

    if (alreadyShown) {
      return;
    }

    const ua = navigator.userAgent.toLowerCase();

    let detectedApp: AppType = null;

    if (ua.includes("kakaotalk")) {
      detectedApp = "kakao";
    } else if (ua.includes("instagram")) {
      detectedApp = "instagram";
    } else if (ua.includes("threads")) {
      detectedApp = "threads";
    }

    if (!detectedApp) {
      return;
    }

    setAppType(detectedApp);
    setShow(true);

    /*
     * 창이 실제로 표시되는 순간 세션 저장소에 기록합니다.
     * 사용자가 "그냥 계속 보기"를 누르지 않아도 같은 세션에서는
     * 다시 표시되지 않습니다.
     */
    window.sessionStorage.setItem(NOTICE_SESSION_KEY, "true");
  }, []);

  const currentUrl =
    typeof window !== "undefined"
      ? window.location.href
      : "https://www.ktowntriangle.com";

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      window.prompt("아래 주소를 복사하세요.", currentUrl);
    }
  };

  const openChromeAndroid = () => {
    const url = currentUrl.replace(/^https?:\/\//, "");

    window.location.href =
      `intent://${url}` +
      "#Intent;" +
      "scheme=https;" +
      "package=com.android.chrome;" +
      "end";
  };

  if (!show || !appType) {
    return null;
  }

  const isKakao = appType === "kakao";

  const appName =
    appType === "kakao"
      ? "카카오톡"
      : appType === "instagram"
        ? "Instagram"
        : "Threads";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-5">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <h2 className="text-xl font-extrabold text-gray-900">
          {isKakao
            ? "크롬/사파리 브라우저에 최적화되어 있습니다."
            : "Best viewed in Chrome or Safari"}
        </h2>

        {isKakao ? (
          <p className="mt-3 text-sm leading-6 text-gray-700">
            현재{" "}
            <span className="font-bold text-red-600">
              {appName}
            </span>{" "}
            브라우저에서 열려 있습니다.
            <br />
            화면이 제대로 보이지 않으면 Chrome에서 열어주세요.
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-gray-700">
            You are currently viewing this page inside{" "}
            <span className="font-bold text-red-600">
              {appName}
            </span>
            .
            <br />
            For the best experience, please open it in Chrome or Safari.
          </p>
        )}

        <button
          type="button"
          onClick={openChromeAndroid}
          className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          {isKakao
            ? "Android Chrome에서 열기"
            : "Open in Android Chrome"}
        </button>

        <button
          type="button"
          onClick={copyUrl}
          className="mt-3 w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          {copied
            ? isKakao
              ? "주소가 복사되었습니다"
              : "Link copied"
            : isKakao
              ? "주소 복사하기"
              : "Copy link"}
        </button>

        {isKakao ? (
          <p className="mt-4 text-xs leading-5 text-gray-500">
            <span className="rounded bg-red-100 px-1 font-bold text-red-700">
              iPhone
            </span>{" "}
            은 아래쪽 공유 버튼 또는 오른쪽 위 메뉴에서 Safari/Chrome으로
            열어주세요.
          </p>
        ) : (
          <p className="mt-4 text-xs leading-5 text-gray-500">
            <span className="rounded bg-red-100 px-1 font-bold text-red-700">
              iPhone
            </span>{" "}
            users: tap the Share button or the menu, then open this page in
            Safari or Chrome.
          </p>
        )}

        <button
          type="button"
          onClick={() => setShow(false)}
          className="mt-4 text-xs font-semibold text-gray-500 underline"
        >
          {isKakao ? "그냥 계속 보기" : "Continue here"}
        </button>
      </div>
    </div>
  );
}