// app/deals/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../../components/BottomNav";

type Business = {
  id: number;
  name: string | null;
};

type DealItemForm = {
  name: string;
  originalPrice: string;
  salePrice: string;
  description: string;
  imageFile: File | null;
  imagePreview: string;
};

function makeEmptyItem(): DealItemForm {
  return {
    name: "",
    originalPrice: "",
    salePrice: "",
    description: "",
    imageFile: null,
    imagePreview: "",
  };
}

export default function NewDealPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [items, setItems] = useState<DealItemForm[]>([makeEmptyItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadBusinesses();
  }, []);

  async function loadBusinesses() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("businesses")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("name", { ascending: true });

    const rows = (data || []) as Business[];

    setBusinesses(rows);

    if (rows.length === 1) {
      setBusinessId(String(rows[0].id));
    }
  }

  function handleImage(file: File | null) {
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview("");
  }

  function updateItem(
    index: number,
    field: keyof DealItemForm,
    value: string | File | null
  ) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        if (field === "imageFile") {
          const file = value as File | null;

          return {
            ...item,
            imageFile: file,
            imagePreview: file ? URL.createObjectURL(file) : "",
          };
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );
  }

  function addItem() {
    setItems((prev) => [...prev, makeEmptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => {
      if (prev.length === 1) return [makeEmptyItem()];
      return prev.filter((_, i) => i !== index);
    });
  }

  function removeItemImage(index: number) {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              imageFile: null,
              imagePreview: "",
            }
          : item
      )
    );
  }

  async function uploadImage(file: File, userId: string) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("deal-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error("이미지 업로드 실패: " + uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from("deal-images")
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  }

  async function submitDeal(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      alert("Deal 제목을 입력하세요.");
      return;
    }

    const validItems = items.filter((item) => item.name.trim());

    if (validItems.length === 0) {
      alert("Deal 메뉴를 최소 1개 입력하세요.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("로그인이 필요합니다.");
        setSaving(false);
        return;
      }

      let imageUrl: string | null = null;

      if (imageFile) {
        imageUrl = await uploadImage(imageFile, user.id);
      }

      const { data: insertedDeal, error } = await supabase
        .from("deals")
        .insert({
          owner_id: user.id,
          business_id: businessId ? Number(businessId) : null,
          title: title.trim(),
          description: description.trim() || null,
          image_url: imageUrl,
          start_date: startDate || null,
          end_date: endDate || null,
          status: "approved",
          active: true,
        })
        .select("id")
        .single();

      if (error || !insertedDeal) {
        alert("Deal 등록 실패: " + (error?.message || "Unknown Error"));
        setSaving(false);
        return;
      }

      const itemRows = [];

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        let itemImageUrl: string | null = null;

        if (item.imageFile) {
          itemImageUrl = await uploadImage(item.imageFile, user.id);
        }

        itemRows.push({
          deal_id: insertedDeal.id,
          name: item.name.trim(),
          original_price: item.originalPrice ? Number(item.originalPrice) : null,
          sale_price: item.salePrice ? Number(item.salePrice) : null,
          description: item.description.trim() || null,
          image_url: itemImageUrl,
          sort_order: i,
        });
      }

      const { error: itemError } = await supabase
        .from("deal_items")
        .insert(itemRows);

      if (itemError) {
        alert("Deal은 등록됐지만 메뉴 등록 실패: " + itemError.message);
        setSaving(false);
        return;
      }

      alert("Deal이 등록되었습니다.");
      window.location.href = "/deals";
    } catch (err: any) {
      alert("저장 실패: " + (err?.message || "Unknown Error"));
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-32 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="relative mb-5 flex items-center justify-center">
          <Link
            href="/"
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black shadow"
          >
            ←
          </Link>

          <h1 className="text-2xl font-black">
            Create Deal
          </h1>

          <details className="absolute right-0">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-white text-2xl font-black shadow">
              ⋯
            </summary>

            <div className="absolute right-0 top-12 z-[99999] w-56 overflow-hidden rounded-2xl bg-white text-sm font-bold shadow-xl">
              <Link href="/profile" className="block px-4 py-3 hover:bg-gray-100">
                Edit Profile
              </Link>

              <Link href="/my-coupons" className="block px-4 py-3 hover:bg-gray-100">
                My Coupons
              </Link>

              <Link href="/owner" className="block px-4 py-3 hover:bg-gray-100">
                My Business
              </Link>

              <Link href="/business/new" className="block px-4 py-3 hover:bg-gray-100">
                Register Business
              </Link>

              <Link href="/events/new" className="block px-4 py-3 hover:bg-gray-100">
                Create Event
              </Link>

              <Link href="/deals/new" className="block px-4 py-3 hover:bg-gray-100">
                Create Deal
              </Link>

              <Link href="/coupon/new" className="block px-4 py-3 hover:bg-gray-100">
                Register Coupon
              </Link>

              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                }}
                className="block w-full px-4 py-3 text-left text-red-600 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          </details>
        </div>

        <form
          onSubmit={submitDeal}
          className="space-y-4 rounded-3xl bg-white p-5 shadow-xl"
        >
          <select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          >
            <option value="">Business 선택</option>

            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name || `Business #${business.id}`}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Deal Title 예: Lunch Special"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm font-black">
                대표 이미지
              </span>

              <label className="cursor-pointer rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white shadow">
                파일 첨부

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImage(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            {imagePreview && (
              <div className="relative mt-3 overflow-hidden rounded-2xl border bg-white">
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-sm font-black text-white"
                >
                  ×
                </button>

                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-44 w-full object-cover"
                />
              </div>
            )}
          </div>

          <textarea
            placeholder="Deal Description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black">Deal 메뉴</h2>

              <button
                type="button"
                onClick={addItem}
                className="rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white shadow"
              >
                + 메뉴 추가
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-3xl bg-white p-4 shadow"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-black">
                      메뉴 {index + 1}
                    </p>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-600"
                    >
                      삭제
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="메뉴명 예: 불고기 + 밥 + 음료"
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    className="mb-2 w-full rounded-2xl border px-4 py-3 text-sm font-bold"
                  />

                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="원가"
                      value={item.originalPrice}
                      onChange={(e) =>
                        updateItem(index, "originalPrice", e.target.value)
                      }
                      className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
                    />

                    <input
                      type="number"
                      step="0.01"
                      placeholder="할인가"
                      value={item.salePrice}
                      onChange={(e) =>
                        updateItem(index, "salePrice", e.target.value)
                      }
                      className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
                    />
                  </div>

                  <textarea
                    placeholder="메뉴 설명"
                    rows={3}
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, "description", e.target.value)
                    }
                    className="mb-2 w-full rounded-2xl border px-4 py-3 text-sm font-bold"
                  />

                  <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <span className="text-sm font-black">
                      메뉴 이미지
                    </span>

                    <label className="cursor-pointer rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white shadow">
                      첨부

                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          updateItem(index, "imageFile", e.target.files?.[0] || null)
                        }
                        className="hidden"
                      />
                    </label>
                  </div>

                  {item.imagePreview && (
                    <div className="relative mt-3 overflow-hidden rounded-2xl border bg-white">
                      <button
                        type="button"
                        onClick={() => removeItemImage(index)}
                        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-sm font-black text-white"
                      >
                        ×
                      </button>

                      <img
                        src={item.imagePreview}
                        alt="Menu Preview"
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-[#172033] py-4 text-sm font-black text-white disabled:bg-gray-400"
          >
            {saving ? "등록 중..." : "Deal 등록하기"}
          </button>

          <p className="text-center text-xs font-bold text-gray-500">
            하나의 Deal 안에 여러 메뉴를 추가할 수 있습니다.
          </p>
        </form>
      </div>

      <BottomNav />
    </main>
  );
}
