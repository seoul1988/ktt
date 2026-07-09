"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewInquiryPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState("open");
  const [loading, setLoading] = useState(false);

  async function submitInquiry() {
    if (!title.trim() || !message.trim()) {
      alert("제목과 문의 내용을 입력해주세요.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("inquiries").insert({
      name,
      email,
      title,
      message,
      visibility,
      status: "new",
    });

    setLoading(false);

    if (error) {
      alert("문의 등록에 실패했습니다.");
      return;
    }

    alert("문의가 접수되었습니다.");
    router.push("/community/inquiries");
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-4 py-6 pb-24">
      <div className="mx-auto max-w-md">
        <h1 className="mb-5 text-2xl font-black text-[#172033]">문의하기</h1>

        <div className="space-y-4 rounded-3xl bg-white p-5 shadow-sm">
          <div>
            <label className="text-sm font-bold">공개 설정</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="mt-1 w-full rounded-xl border p-3"
            >
              <option value="open">오픈 문의</option>
              <option value="private">비밀 문의</option>
            </select>
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
            className="w-full rounded-xl border p-3"
          />

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 또는 연락처"
            className="w-full rounded-xl border p-3"
          />

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            className="w-full rounded-xl border p-3"
          />

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="문의 내용을 입력하세요"
            rows={7}
            className="w-full rounded-xl border p-3"
          />

          <button
            onClick={submitInquiry}
            disabled={loading}
            className="w-full rounded-xl bg-[#172033] py-3 font-black text-white disabled:opacity-50"
          >
            {loading ? "등록 중..." : "문의 등록"}
          </button>
        </div>
      </div>
    </main>
  );
}