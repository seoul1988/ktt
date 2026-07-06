"use client";

import { useEffect, useState } from "react";

export default function InAppBrowserNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";

    const isInstagram = ua.includes("Instagram");
    const isFacebook = ua.includes("FBAN") || ua.includes("FBAV");

    if (isInstagram || isFacebook) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] bg-[#172033] px-4 py-4 text-white shadow-lg">
      <div className="mx-auto max-w-md text-center">
        <div className="text-lg font-extrabold">
          📱 KTown Triangle 앱 설치 안내
        </div>

        <p className="mt-2 text-sm leading-relaxed">
          Instagram 안에서는 앱 설치 버튼이 나오지 않습니다.
          <br />
          오른쪽 위 <b>⋮</b> 또는 <b>•••</b> 를 누른 후
          <br />
          <b>Chrome에서 열기</b> 를 선택해주세요.
        </p>

        <button
          onClick={() => setShow(false)}
          className="mt-3 rounded-full bg-white px-5 py-2 text-sm font-bold text-[#172033]"
        >
          확인
        </button>
      </div>
    </div>
  );
}