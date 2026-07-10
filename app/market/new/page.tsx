"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";

const MARKET_CATEGORIES = [
  "가구",
  "전자제품",
  "골프용품",
  "자동차",
  "아기용품",
  "의류",
  "생활용품",
  "식품",
  "무료나눔",
  "구인구직",
  "기타",
];

const CONDITIONS = ["새것", "거의 새것", "중고", "고장/수리필요"];

const MAX_ITEMS = 20;
const MAX_IMAGES_PER_ITEM = 4;

type MarketItemForm = {
  localId: string;
  title: string;
  price: string;
  category: string;
  condition: string;
  description: string;
  imageFiles: File[];
};

function createEmptyItem(): MarketItemForm {
  return {
    localId: crypto.randomUUID(),
    title: "",
    price: "",
    category: MARKET_CATEGORIES[0],
    condition: CONDITIONS[2],
    description: "",
    imageFiles: [],
  };
}

export default function NewMarketItemPage() {
  const router = useRouter();

  // 판매자 공통 정보
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
const [email, setEmail] = useState("");
  // 여러 상품
  const [items, setItems] = useState<MarketItemForm[]>([
    createEmptyItem(),
  ]);

  const [uploading, setUploading] = useState(false);

  async function uploadMarketImage(
    userId: string,
    itemId: string,
    file: File,
    imageIndex: number
  ) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    const filePath = [
      userId,
      "images",
      itemId,
      `${Date.now()}-${imageIndex}-${safeName}`,
    ].join("/");

    const { error } = await supabase.storage
      .from("market")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage
      .from("market")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  function updateItem<K extends keyof MarketItemForm>(
    localId: string,
    field: K,
    value: MarketItemForm[K]
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function addItem() {
    if (items.length >= MAX_ITEMS) {
      alert(`상품은 한 번에 최대 ${MAX_ITEMS}개까지 등록할 수 있습니다.`);
      return;
    }

    setItems((prev) => [...prev, createEmptyItem()]);
  }

  function removeItem(localId: string) {
    if (items.length === 1) {
      alert("최소 한 개의 상품이 필요합니다.");
      return;
    }

    const targetItem = items.find(
      (item) => item.localId === localId
    );

    targetItem?.imageFiles.forEach((file) => {
      const previewUrl = URL.createObjectURL(file);
      URL.revokeObjectURL(previewUrl);
    });

    setItems((prev) =>
      prev.filter((item) => item.localId !== localId)
    );
  }

  function addImageFiles(localId: string, files: File[]) {
    const onlyImages = files.filter((file) =>
      file.type.startsWith("image/")
    );

    setItems((prev) =>
      prev.map((item) => {
        if (item.localId !== localId) {
          return item;
        }

        const merged = [...item.imageFiles, ...onlyImages];

        if (merged.length > MAX_IMAGES_PER_ITEM) {
          alert(
            `상품당 이미지는 최대 ${MAX_IMAGES_PER_ITEM}장까지 가능합니다.`
          );
        }

        return {
          ...item,
          imageFiles: merged.slice(0, MAX_IMAGES_PER_ITEM),
        };
      })
    );
  }

  function removeImage(localId: string, imageIndex: number) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.localId !== localId) {
          return item;
        }

        return {
          ...item,
          imageFiles: item.imageFiles.filter(
            (_, index) => index !== imageIndex
          ),
        };
      })
    );
  }

  function moveItem(index: number, direction: "up" | "down") {
    setItems((prev) => {
      const next = [...prev];

      const targetIndex =
        direction === "up" ? index - 1 : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= next.length
      ) {
        return prev;
      }

      [next[index], next[targetIndex]] = [
        next[targetIndex],
        next[index],
      ];

      return next;
    });
  }

  function validateItems() {
    if (!location.trim()) {
      alert("거래 지역을 입력하세요.");
      return false;
    }

    if (!phone.trim() && !email.trim()) {
  alert("전화번호 또는 이메일 중 하나는 입력해주세요.");
  return false;
}

    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      if (!item.title.trim()) {
        alert(`${index + 1}번 상품의 제목을 입력하세요.`);
        return false;
      }

      if (
        item.price.trim() &&
        Number.isNaN(Number(item.price))
      ) {
        alert(`${index + 1}번 상품의 가격을 숫자로 입력하세요.`);
        return false;
      }

      if (item.imageFiles.length === 0) {
        alert(`${index + 1}번 상품의 사진을 한 장 이상 선택하세요.`);
        return false;
      }

      if (
        item.imageFiles.length >
        MAX_IMAGES_PER_ITEM
      ) {
        alert(
          `${index + 1}번 상품의 이미지는 최대 ${MAX_IMAGES_PER_ITEM}장입니다.`
        );
        return false;
      }
    }

    return true;
  }

  async function submitItems() {
    if (uploading) return;

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError || !userData.user) {
      alert("로그인이 필요합니다.");
      return;
    }

    if (!validateItems()) {
      return;
    }

    setUploading(true);

    try {
      const rowsToInsert = [];

      for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
        const item = items[itemIndex];
        const uploadedImageUrls: string[] = [];

        for (
          let imageIndex = 0;
          imageIndex < item.imageFiles.length;
          imageIndex++
        ) {
          const file = item.imageFiles[imageIndex];

          const imageUrl = await uploadMarketImage(
            userData.user.id,
            item.localId,
            file,
            imageIndex
          );

          uploadedImageUrls.push(imageUrl);
        }

        rowsToInsert.push({
		  seller_id: userData.user.id,
		  title: item.title.trim(),
		  price: Number(item.price || 0),
		  category: item.category,
		  condition: item.condition,
		  location: location.trim(),
		  phone: phone.trim(),
		  email: email.trim().toLowerCase(),
		  description: item.description.trim(),
		  images: uploadedImageUrls,
		  video_url: null,
		  status: "available",
		});
      }

      const { error: insertError } = await supabase
        .from("market_items")
        .insert(rowsToInsert);

      if (insertError) {
        throw insertError;
      }

      alert(`${items.length}개의 상품이 등록되었습니다.`);
      router.push("/market");
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.";

      alert("등록 실패: " + message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-4 py-4 pb-28">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-4 rounded-3xl bg-white p-5 shadow">
          <div className="relative flex h-10 items-center border-b border-[#E8DED1] pb-3">
            <BackButton />

            <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xl font-black text-[#172033]">
              여러 상품 등록
            </h1>

            <div className="ml-auto">
              <ProfileButton />
            </div>
          </div>

        <div className="mt-5 rounded-2xl bg-[#F8F3EC] p-4">
  <h2 className="mb-1 text-base font-black text-[#172033]">
    판매자 공통 정보
  </h2>

  <p className="mb-4 text-xs leading-5 text-gray-500">
    아래 정보는 등록하는 모든 상품에 동일하게 적용됩니다.
    <br />
    <span className="font-semibold text-[#C2410C]">
      전화번호 또는 이메일 중 하나는 반드시 입력해주세요.
    </span>
  </p>

  {/* 거래지역 */}
  <input
    className="mb-3 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-[#172033]"
    placeholder="거래 지역 (예: Raleigh, Cary)"
    value={location}
    onChange={(e) => setLocation(e.target.value)}
  />

  {/* 전화번호 */}
  <input
    className="mb-3 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-[#172033]"
    placeholder="전화번호 (선택)"
    value={phone}
    onChange={(e) => setPhone(e.target.value)}
  />

  {/* 이메일 */}
  <input
    className="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-[#172033]"
    type="email"
    placeholder="이메일 (선택)"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
</div>
        </div>

        <div className="space-y-4">
          {items.map((item, itemIndex) => (
            <section
              key={item.localId}
              className="overflow-hidden rounded-3xl bg-white shadow"
            >
              <div className="flex items-center justify-between bg-[#172033] px-4 py-3 text-white">
                <div>
                  <p className="text-xs font-bold text-white/70">
                    ITEM {itemIndex + 1}
                  </p>

                  <h2 className="text-lg font-black">
                    {item.title.trim() || `상품 ${itemIndex + 1}`}
                  </h2>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={itemIndex === 0 || uploading}
                    onClick={() => moveItem(itemIndex, "up")}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-black disabled:opacity-30"
                    aria-label="상품 위로 이동"
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    disabled={
                      itemIndex === items.length - 1 ||
                      uploading
                    }
                    onClick={() => moveItem(itemIndex, "down")}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-sm font-black disabled:opacity-30"
                    aria-label="상품 아래로 이동"
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    disabled={items.length === 1 || uploading}
                    onClick={() => removeItem(item.localId)}
                    className="ml-1 rounded-full bg-red-500 px-3 py-2 text-xs font-black disabled:opacity-30"
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div className="p-4">
                <input
                  className="mb-3 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-[#172033]"
                  placeholder="상품 제목"
                  value={item.title}
                  onChange={(e) =>
                    updateItem(
                      item.localId,
                      "title",
                      e.target.value
                    )
                  }
                />

                <input
                  className="mb-3 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-[#172033]"
                  placeholder="가격 예: 100"
                  inputMode="decimal"
                  value={item.price}
                  onChange={(e) =>
                    updateItem(
                      item.localId,
                      "price",
                      e.target.value
                    )
                  }
                />

                <div className="mb-3 grid grid-cols-2 gap-3">
                  <select
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-[#172033]"
                    value={item.category}
                    onChange={(e) =>
                      updateItem(
                        item.localId,
                        "category",
                        e.target.value
                      )
                    }
                  >
                    {MARKET_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>

                  <select
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:border-[#172033]"
                    value={item.condition}
                    onChange={(e) =>
                      updateItem(
                        item.localId,
                        "condition",
                        e.target.value
                      )
                    }
                  >
                    {CONDITIONS.map((condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3 rounded-2xl bg-gray-50 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-[#172033]">
                        상품 사진
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        최대 4장 · 첫 번째 사진이 메인 사진입니다.
                      </p>
                    </div>

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#172033]">
                      {item.imageFiles.length}/
                      {MAX_IMAGES_PER_ITEM}
                    </span>
                  </div>

                  <label
                    htmlFor={`market-images-${item.localId}`}
                    className="inline-flex cursor-pointer items-center rounded-xl bg-[#172033] px-4 py-3 text-sm font-black text-white"
                  >
                    사진 선택
                  </label>

                  <input
                    id={`market-images-${item.localId}`}
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={uploading}
                    className="hidden"
                    onChange={(e) => {
                      addImageFiles(
                        item.localId,
                        Array.from(e.target.files || [])
                      );

                      e.target.value = "";
                    }}
                  />

                  {item.imageFiles.length > 0 && (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {item.imageFiles.map((file, imageIndex) => {
                        const previewUrl =
                          URL.createObjectURL(file);

                        return (
                          <div
                            key={`${file.name}-${file.lastModified}-${imageIndex}`}
                            className="relative aspect-square overflow-hidden rounded-xl border bg-white"
                          >
                            <img
                              src={previewUrl}
                              alt={`상품 ${itemIndex + 1} 사진 ${
                                imageIndex + 1
                              }`}
                              className="h-full w-full object-cover"
                              onLoad={() =>
                                URL.revokeObjectURL(previewUrl)
                              }
                            />

                            <button
                              type="button"
                              disabled={uploading}
                              onClick={() =>
                                removeImage(
                                  item.localId,
                                  imageIndex
                                )
                              }
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-xs font-black text-white"
                              aria-label="사진 삭제"
                            >
                              ×
                            </button>

                            <div
                              className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[9px] font-black text-white ${
                                imageIndex === 0
                                  ? "bg-green-600"
                                  : "bg-black/70"
                              }`}
                            >
                              {imageIndex === 0
                                ? "메인"
                                : imageIndex + 1}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <textarea
                  className="h-28 w-full resize-none rounded-xl border border-gray-200 p-3 outline-none focus:border-[#172033]"
                  placeholder="상품 설명"
                  value={item.description}
                  onChange={(e) =>
                    updateItem(
                      item.localId,
                      "description",
                      e.target.value
                    )
                  }
                />
              </div>
            </section>
          ))}
        </div>

        <button
          type="button"
          disabled={
            uploading || items.length >= MAX_ITEMS
          }
          onClick={addItem}
          className="mt-4 w-full rounded-2xl border-2 border-dashed border-[#172033] bg-white py-4 font-black text-[#172033] disabled:opacity-40"
        >
          ＋ 상품 추가 ({items.length}/{MAX_ITEMS})
        </button>

        <div className="sticky bottom-20 z-20 mt-4 rounded-3xl bg-white p-3 shadow-lg">
          <button
            type="button"
            disabled={uploading}
            onClick={submitItems}
            className="w-full rounded-full bg-[#172033] py-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? `${items.length}개 상품 등록 중...`
              : `${items.length}개 상품 전체 등록하기`}
          </button>
        </div>
      </div>

      <CommunityBottomNav activeNav="market" />
    </main>
  );
}