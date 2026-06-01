"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function PushSubscribeButton() {
  const [loading, setLoading] = useState(false);

  async function subscribePush() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("로그인이 필요합니다.");
        return;
      }

      if (!("serviceWorker" in navigator)) {
        alert("이 브라우저는 푸시알림을 지원하지 않습니다.");
        return;
      }

      if (!("PushManager" in window)) {
        alert("이 브라우저는 푸시알림을 지원하지 않습니다.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        alert("알림 허용이 필요합니다.");
        return;
      }

      const registration = await navigator.serviceWorker.register(
        "/service-worker.js"
      );

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        alert("VAPID Public Key가 없습니다.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/push/subscribe", {
		  method: "POST",
		  headers: {
			"Content-Type": "application/json",
		  },
		  body: JSON.stringify({
			subscription,
			userId: user.id,
		  }),
		});

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "푸시 구독 저장 실패");
      }

      alert("관리자 푸시알림이 설정되었습니다.");
    } catch (err: any) {
      alert("푸시알림 설정 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={subscribePush}
      disabled={loading}
      className="rounded-full bg-[#172033] px-4 py-3 text-sm font-black text-white shadow disabled:bg-gray-400"
    >
      {loading ? "설정 중..." : "관리자 푸시알림 허용"}
    </button>
  );
}