// app/deals/new/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../../components/BottomNav";

type Business = {
  id: number;
  name: string | null;
  address?: string | null;
  street_address?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  zip?: string | null;
  zipcode?: string | null;
  postal_code?: string | null;
  [key: string]: unknown;
};

type DealItemForm = {
  name: string;
  originalPrice: string;
  salePrice: string;
  description: string;

  // 각 메뉴마다 적용 조건을 따로 설정합니다.
  scheduleType: "weekly" | "date";
  weekdays: string[];
  dealDate: string;
  startTime: string;
  endTime: string;

  imageFile: File | null;
  imagePreview: string;
};

function makeEmptyItem(): DealItemForm {
  return {
    name: "",
    originalPrice: "",
    salePrice: "",
    description: "",
    scheduleType: "weekly",
    weekdays: [],
    dealDate: "",
    startTime: "",
    endTime: "",
    imageFile: null,
    imagePreview: "",
  };
}

export default function NewDealPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState("");
  const [businessSearch, setBusinessSearch] = useState("");
  const [businessSearchOpen, setBusinessSearchOpen] = useState(false);
  const [businessAddress, setBusinessAddress] = useState("");
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
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        console.error("Business load failed: 로그인 세션이 없습니다.");
        return;
      }

      const response = await fetch("/api/deals/businesses", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const contentType = response.headers.get("content-type") || "";
      const rawText = await response.text();

      let result: any = null;

      if (contentType.includes("application/json")) {
        try {
          result = rawText ? JSON.parse(rawText) : {};
        } catch (parseError) {
          console.error("Business API JSON parse failed:", parseError, rawText);
          return;
        }
      } else {
        console.error(
          "Business API returned non-JSON:",
          response.status,
          contentType,
          rawText.slice(0, 500)
        );
        alert(
          `업소 목록을 불러오지 못했습니다. API 응답: ${response.status}. ` +
            "브라우저 Console에서 Business API returned non-JSON 내용을 확인하세요."
        );
        return;
      }

      if (!response.ok) {
        console.error("Business load failed:", result);
        alert(result?.error || "업소 목록을 불러오지 못했습니다.");
        return;
      }

      const rows = (result.businesses || []) as Business[];

      setBusinesses(rows);

      if (rows.length === 1) {
        setBusinessId(String(rows[0].id));
        setBusinessSearch(rows[0].name || `Business #${rows[0].id}`);
        setBusinessAddress(formatBusinessAddress(rows[0]));
      }
    } catch (error) {
      console.error("Business load error:", error);
    }
  }

  function formatBusinessAddress(business: Business) {
    const street = String(
      business.address ||
        business.street_address ||
        business.address1 ||
        ""
    ).trim();

    const address2 = String(business.address2 || "").trim();
    const city = String(business.city || "").trim();
    const zip = String(
      business.zip ||
        business.zipcode ||
        business.postal_code ||
        ""
    ).trim();

    const cityLine = [city, zip].filter(Boolean).join(" ");

    return [street, address2, cityLine].filter(Boolean).join(", ");
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
    value: string | string[] | File | null
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

  function toggleItemWeekday(index: number, day: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const weekdays = item.weekdays.includes(day)
          ? item.weekdays.filter((value) => value !== day)
          : [...item.weekdays, day];

        return {
          ...item,
          weekdays,
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

  async function compressImage(file: File) {
    const MAX_SIZE = 1200;
    const QUALITY = 0.82;

    const objectUrl = URL.createObjectURL(file);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
        img.src = objectUrl;
      });

      let width = image.naturalWidth;
      let height = image.naturalHeight;

      if (width > MAX_SIZE || height > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("이미지 처리에 실패했습니다.");
      }

      ctx.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error("이미지 압축에 실패했습니다."));
            }
          },
          "image/webp",
          QUALITY
        );
      });

      const baseName =
        file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-") ||
        "deal-image";

      return new File([blob], `${baseName}.webp`, {
        type: "image/webp",
        lastModified: Date.now(),
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function uploadImage(file: File, userId: string) {
    // 원본 파일은 Storage에 올리지 않고,
    // 브라우저에서 먼저 최대 1200px WebP로 축소/압축한 파일만 업로드합니다.
    const optimizedFile = await compressImage(file);

    const filePath = `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.webp`;

    const { error: uploadError } = await supabase.storage
      .from("deal-images")
      .upload(filePath, optimizedFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: "image/webp",
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

    if (!startDate || !endDate) {
      alert("Deal 시작 날짜와 종료 날짜를 입력하세요.");
      return;
    }

    if (startDate > endDate) {
      alert("종료 날짜는 시작 날짜보다 빠를 수 없습니다.");
      return;
    }

    const validItems = items.filter((item) => item.name.trim());

    if (validItems.length === 0) {
      alert("Deal 메뉴를 최소 1개 입력하세요.");
      return;
    }

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];

      if (item.scheduleType === "weekly" && item.weekdays.length === 0) {
        alert(`메뉴 ${i + 1}의 적용 요일을 선택하세요.`);
        return;
      }

      if (item.scheduleType === "date" && !item.dealDate) {
        alert(`메뉴 ${i + 1}의 적용 날짜를 선택하세요.`);
        return;
      }

      if (!item.startTime || !item.endTime) {
        alert(`메뉴 ${i + 1}의 시작/종료 시간을 입력하세요.`);
        return;
      }
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

          // 메뉴별 적용 조건
          schedule_type: item.scheduleType,
          weekdays: item.scheduleType === "weekly" ? item.weekdays : null,
          deal_date: item.scheduleType === "date" ? item.dealDate : null,
          start_time: item.startTime || null,
          end_time: item.endTime || null,

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

  const normalizedBusinessSearch = businessSearch.trim().toLowerCase();

  const filteredBusinesses = normalizedBusinessSearch
    ? businesses.filter((business) =>
        (business.name || `Business #${business.id}`)
          .trimStart()
          .toLowerCase()
          .startsWith(normalizedBusinessSearch)
      )
    : businesses;

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-32 text-[#172033]">
      <div className="mx-auto max-w-xl">
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

              <Link href="/coupons/new" className="block px-4 py-3 hover:bg-gray-100">
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
          <div className="relative">
            <input
              type="text"
              value={businessSearch}
              placeholder="Business 검색 (예: s, se)"
              autoComplete="off"
              onFocus={() => setBusinessSearchOpen(true)}
              onChange={(e) => {
                setBusinessSearch(e.target.value);
                setBusinessId("");
                setBusinessAddress("");
                setBusinessSearchOpen(true);
              }}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />

            {businessSearchOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border bg-white shadow-xl">
                {filteredBusinesses.length > 0 ? (
                  filteredBusinesses.map((business) => {
                    const label =
                      business.name || `Business #${business.id}`;

                    return (
                      <button
                        key={business.id}
                        type="button"
                        onClick={() => {
                          setBusinessId(String(business.id));
                          setBusinessSearch(label);
                          setBusinessAddress(formatBusinessAddress(business));
                          setBusinessSearchOpen(false);
                        }}
                        className="block w-full border-b px-4 py-3 text-left text-sm font-bold last:border-b-0 hover:bg-gray-100"
                      >
                        {label}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-3 text-sm font-bold text-gray-400">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>
            )}
          </div>

          <input
            type="text"
            placeholder="Business Address"
            value={businessAddress}
            readOnly
            className="w-full rounded-2xl border bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700"
          />

          <input
            type="text"
            placeholder="Deal Title 예: Lunch Special"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-black">Deal 기간</span>

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="text-xs font-black text-red-600"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-black text-gray-500">
                  시작 날짜
                </label>
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-black text-gray-500">
                  종료 날짜
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-bold"
                />
              </div>
            </div>
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

                  <div className="mb-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                    <p className="mb-2 text-xs font-black text-gray-600">
                      이 메뉴는 언제 적용되나요?
                    </p>

                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          updateItem(index, "scheduleType", "weekly");
                          updateItem(index, "dealDate", "");
                        }}
                        className={`rounded-xl border px-3 py-2 text-xs font-black ${
                          item.scheduleType === "weekly"
                            ? "border-[#172033] bg-[#172033] text-white"
                            : "bg-white text-[#172033]"
                        }`}
                      >
                        요일별 반복
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          updateItem(index, "scheduleType", "date");
                          updateItem(index, "weekdays", []);
                        }}
                        className={`rounded-xl border px-3 py-2 text-xs font-black ${
                          item.scheduleType === "date"
                            ? "border-[#172033] bg-[#172033] text-white"
                            : "bg-white text-[#172033]"
                        }`}
                      >
                        특정 날짜
                      </button>
                    </div>

                    {item.scheduleType === "weekly" ? (
                      <div className="mb-3 grid grid-cols-7 gap-1">
                        {[
                          ["Sun", "일"],
                          ["Mon", "월"],
                          ["Tue", "화"],
                          ["Wed", "수"],
                          ["Thu", "목"],
                          ["Fri", "금"],
                          ["Sat", "토"],
                        ].map(([value, label]) => {
                          const selected = item.weekdays.includes(value);

                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => toggleItemWeekday(index, value)}
                              className={`rounded-lg border py-2 text-xs font-black ${
                                selected
                                  ? "border-[#172033] bg-[#172033] text-white"
                                  : "bg-white text-gray-600"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type="date"
                        value={item.dealDate}
                        onChange={(e) =>
                          updateItem(index, "dealDate", e.target.value)
                        }
                        className="mb-3 w-full rounded-xl border bg-white px-3 py-2 text-sm font-bold"
                      />
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="mb-1 text-[11px] font-black text-gray-500">
                          시작 시간
                        </p>
                        <input
                          type="time"
                          value={item.startTime}
                          onChange={(e) =>
                            updateItem(index, "startTime", e.target.value)
                          }
                          className="w-full rounded-xl border bg-white px-3 py-2 text-sm font-bold"
                        />
                      </div>

                      <div>
                        <p className="mb-1 text-[11px] font-black text-gray-500">
                          종료 시간
                        </p>
                        <input
                          type="time"
                          value={item.endTime}
                          onChange={(e) =>
                            updateItem(index, "endTime", e.target.value)
                          }
                          className="w-full rounded-xl border bg-white px-3 py-2 text-sm font-bold"
                        />
                      </div>
                    </div>
                  </div>

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