"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import CommunityBottomNav from "../../../components/CommunityBottomNav";

export default function NewCommunityDealPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [discountText, setDiscountText] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);
    setCheckingUser(false);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    try {
      setUploading(true);

      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `community-deals/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("deal-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("deal-images")
        .getPublicUrl(fileName);

      setImageUrl(data.publicUrl);
    } catch (err) {
      console.error("image upload error:", err);
      alert("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!userId) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (!title.trim()) {
      alert("딜 제목을 입력해주세요.");
      return;
    }

    if (!discountText.trim()) {
      alert("할인 내용을 입력해주세요.");
      return;
    }

    if (!endDate) {
      alert("종료일을 선택해주세요.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("deals").insert({
      user_id: userId,
      title: title.trim(),
      business_name: businessName.trim() || null,
      description: description.trim() || null,
      discount_text: discountText.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      website: website.trim() || null,
      image_url: imageUrl || null,
      start_date: startDate || null,
      end_date: endDate,
      active: true,
      status: "approved",
      deal_scope: "community",
    });

    setLoading(false);

    if (error) {
  console.error("community deal insert error:", error);

  alert(
    `딜 등록 오류\n\n메시지: ${error.message}\n코드: ${error.code || "없음"}\n상세: ${
      error.details || "없음"
    }`
  );

  return;
}

    router.push("/community");
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
        <p className="text-sm font-bold text-[#6B6257]">Checking login...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-xl px-5 pb-28 pt-6">
        <div className="mb-6">
          <Link
            href="/community"
            className="text-sm font-black text-[#C4483A]"
          >
            ← Back
          </Link>

          <p className="mt-5 text-sm font-black text-[#C4483A]">
            COMMUNITY DEAL
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight">
            딜 등록
          </h1>

          <p className="mt-2 text-sm font-semibold text-[#6B6257]">
            커뮤니티에만 표시되는 딜입니다.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl bg-white p-5 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-black">딜 제목 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Grand Opening 20% OFF"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">업소명</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="예: Salon Reve"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">
              할인 내용 *
            </label>
            <input
              value={discountText}
              onChange={(e) => setDiscountText(e.target.value)}
              placeholder="예: 20% OFF"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="딜 내용을 입력하세요."
              rows={4}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-black">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-black">
                종료일 *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">전화번호</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="예: (919) 430-3115"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">주소</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: Cary, NC"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">웹사이트</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-black">딜 이미지</label>

            <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-[#F8F3EC] px-4 py-5 text-sm font-black text-[#6B6257]">
              📷 이미지 선택
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>

            {uploading && (
              <p className="mt-2 text-xs font-bold text-[#6B6257]">
                업로드 중...
              </p>
            )}

            {imageUrl && (
              <div className="mt-3 overflow-hidden rounded-2xl">
                <img
                  src={imageUrl}
                  alt="preview"
                  className="h-48 w-full object-cover"
                />

                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="mt-2 rounded-full bg-gray-200 px-3 py-1 text-xs font-black text-[#172033]"
                >
                  이미지 삭제
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || uploading}
            className="mt-3 w-full rounded-2xl bg-[#C4483A] px-5 py-4 text-sm font-black text-white shadow-sm disabled:opacity-60"
          >
            {loading ? "등록 중..." : "🔥 딜 등록하기"}
          </button>
        </form>
      </section>

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}