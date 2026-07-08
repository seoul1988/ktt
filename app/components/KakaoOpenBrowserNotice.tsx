"use client";

import { useEffect, useState } from "react";

export default function KakaoOpenBrowserNotice() {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();

    const isKakao = ua.includes("kakaotalk");
    if (isKakao) setShow(true);
  }, []);

  const currentUrl =
    typeof window !== "undefined"
      ? window.location.href
      : "https://ktowntriangle.com";

  const copyUrl = async () => {
    await navigator.clipboard.writeText(currentUrl);
    setCopied(true);
  };

  const openChromeAndroid = () => {
    const url = currentUrl.replace(/^https?:\/\//, "");
    window.location.href = `intent://${url}#Intent;scheme=https;package=com.android.chrome;end`;
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 px-5 flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <h2 className="text-xl font-extrabold text-gray-900">
          Chrome 브라우저에 최적화되어 있습니다.
        </h2>

        <p className="mt-3 text-sm leading-6 text-gray-700">
          현재 카카오톡 브라우저에서 열려 있습니다.
          <br />
          화면이 제대로 보이지 않으면 Chrome에서 열어주세요.
        </p>

 <button
          onClick={openChromeAndroid}
          className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
        >
          Android Chrome에서 열기
        </button>
		
		
        <button
          onClick={copyUrl}
          className="mt-5 w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white"
        >
          {copied ? "주소가 복사되었습니다" : "주소 복사하기"}
        </button>

       

        <p className="mt-4 text-xs leading-5 text-gray-500">
  <span className="rounded bg-red-100 px-1 font-bold text-red-700">
    iPhone
  </span>{" "}
  은 아래쪽 공유 버튼 또는 오른쪽 위 메뉴에서 Safari/Chrome으로 열어주세요.
</p>

        <button
          onClick={() => setShow(false)}
          className="mt-4 text-xs font-semibold text-gray-500 underline"
        >
          그냥 계속 보기
        </button>
      </div>
    </div>
  );
}