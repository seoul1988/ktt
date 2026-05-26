"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";

export default function OwnerRequestPage() {
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitRequest() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("owner_requests").insert({
      user_id: user.id,
      business_name: businessName,
      phone,
      message,
      status: "pending",
    });

    setLoading(false);

    if (error) {
      alert("신청 중 오류가 발생했습니다.");
      console.error(error);
      return;
    }

    alert("상점주 신청이 완료되었습니다.");
    window.location.href = "/profile";
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8">
      <h1 className="mb-6 text-2xl font-bold">상점주 등록 신청</h1>

      <input
        className="mb-3 w-full rounded-xl border p-3"
        placeholder="상점 이름"
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
      />

      <input
        className="mb-3 w-full rounded-xl border p-3"
        placeholder="전화번호"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <textarea
        className="mb-4 w-full rounded-xl border p-3"
        placeholder="관리자에게 보낼 메시지"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <button
        onClick={submitRequest}
        disabled={loading}
        className="w-full rounded-xl bg-black p-3 font-bold text-white"
      >
        {loading ? "신청 중..." : "신청하기"}
      </button>
    </main>
  );
}