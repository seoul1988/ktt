"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";

function cleanVapidKey(key: string) {
  return key
    .replace(/^Public Key:\s*/i, "")
    .replace(/→/g, "")
    .replace(/;/g, "")
    .replace(/\//g, "")
    .replace(/\s/g, "")
    .trim();
}

function urlBase64ToUint8Array(base64String: string) {
  const cleanBase64 = cleanVapidKey(base64String);

  console.log("CLEAN VAPID KEY:", cleanBase64);
  console.log("VAPID LENGTH:", cleanBase64.length);
  console.log(
    "BAD CHARS:",
    [...cleanBase64].filter((c) => !/[A-Za-z0-9_-]/.test(c))
  );

  if (!cleanBase64) {
    throw new Error("VAPID Public Key가 비어 있습니다.");
  }

  const badChars = [...cleanBase64].filter((c) => !/[A-Za-z0-9_-]/.test(c));

  if (badChars.length > 0) {
    throw new Error("VAPID Public Key에 잘못된 문자가 있습니다: " + badChars.join(", "));
  }

  const padding = "=".repeat((4 - (cleanBase64.length % 4)) % 4);
  const base64 = (cleanBase64 + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
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

      if (!("Notification" in window)) {
        alert("이 브라우저는 알림을 지원하지 않습니다.");
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

      await navigator.serviceWorker.ready;

      const rawPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
      const publicKey = cleanVapidKey(rawPublicKey);

      if (!publicKey) {
        alert("VAPID Public Key가 없습니다.");
        return;
      }

      const existingSubscription =
        await registration.pushManager.getSubscription();

      if (existingSubscription) {
        await existingSubscription.unsubscribe();
      }

      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
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
        let errorMessage = "푸시 구독 저장 실패";

        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch {
          errorMessage = await res.text();
        }

        throw new Error(errorMessage);
      }

      alert("관리자 푸시알림이 설정되었습니다.");
    } catch (err: any) {
      console.error("Push subscribe error:", err);
      alert("푸시알림 설정 실패: " + (err?.message || String(err)));
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