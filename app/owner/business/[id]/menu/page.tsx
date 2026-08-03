"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  display_order: number | null;
  is_active: boolean;
};

type MenuItem = {
  id: number;
  category_id: number | null;
  name: string;
  description: string | null;
  price: number | null;
  thumbnail_url: string | null;
  image_url: string | null;
  display_order: number | null;
  is_available: boolean;
};

type MenuResponse = {
  business?: {
    id: number;
    name: string | null;
  };
  categories?: Category[];
  items?: MenuItem[];
  error?: string;
};

function cleanPrice(value: string) {
  const normalized = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const dot = normalized.indexOf(".");

  if (dot === -1) return normalized;

  return (
    normalized.slice(0, dot + 1) +
    normalized.slice(dot + 1).replace(/\./g, "")
  );
}


type ResizedImage = {
  detail: Blob;
  thumbnail: Blob;
};

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지 파일을 읽지 못했습니다."));
    };

    image.src = objectUrl;
  });
}

function canvasToWebp(
  canvas: HTMLCanvasElement,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("이미지 변환에 실패했습니다."));
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

async function resizeContainImage(
  image: HTMLImageElement,
  maxWidth: number,
  maxHeight: number,
  quality: number,
) {
  const scale = Math.min(
    maxWidth / image.naturalWidth,
    maxHeight / image.naturalHeight,
    1,
  );

  const width = Math.max(
    1,
    Math.round(image.naturalWidth * scale),
  );
  const height = Math.max(
    1,
    Math.round(image.naturalHeight * scale),
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("이미지 처리 기능을 사용할 수 없습니다.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  return canvasToWebp(canvas, quality);
}

async function resizeSquareThumbnail(
  image: HTMLImageElement,
  size: number,
  quality: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("이미지 처리 기능을 사용할 수 없습니다.");
  }

  const sourceSize = Math.min(
    image.naturalWidth,
    image.naturalHeight,
  );
  const sourceX =
    (image.naturalWidth - sourceSize) / 2;
  const sourceY =
    (image.naturalHeight - sourceSize) / 2;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    size,
    size,
  );

  return canvasToWebp(canvas, quality);
}

async function createMenuImageFiles(
  file: File,
): Promise<ResizedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 선택할 수 있습니다.");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("원본 파일은 20MB 이하만 선택할 수 있습니다.");
  }

  const image = await loadImageElement(file);

  const [detail, thumbnail] = await Promise.all([
    resizeContainImage(image, 1200, 1200, 0.82),
    resizeSquareThumbnail(image, 320, 0.78),
  ]);

  return {
    detail,
    thumbnail,
  };
}

export default function OwnerBusinessMenuPage() {
  const params = useParams<{ id: string }>();
  const businessId = Number(params.id);

  const [businessName, setBusinessName] = useState("Business");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [priceInputs, setPriceInputs] = useState<Record<number, string>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "all">(
    "all",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("로그인이 필요합니다.");
    }

    return session.access_token;
  }

  async function loadMenu() {
    setLoading(true);
    setMessage("");

    try {
      if (!Number.isInteger(businessId) || businessId <= 0) {
        throw new Error("잘못된 비즈니스 ID입니다.");
      }

      const token = await getAccessToken();

      const response = await fetch(`/api/owner/business/${businessId}/menu`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = (await response.json()) as MenuResponse;

      if (!response.ok) {
        throw new Error(data.error || "메뉴를 불러오지 못했습니다.");
      }

      const nextCategories = data.categories || [];
      const nextItems = data.items || [];

      setBusinessName(data.business?.name || "Business");
      setCategories(nextCategories);
      setItems(nextItems);

      const nextPrices: Record<number, string> = {};
      for (const item of nextItems) {
        nextPrices[item.id] =
          item.price === null || item.price === undefined
            ? ""
            : Number(item.price).toFixed(2);
      }
      setPriceInputs(nextPrices);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "메뉴를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  const itemCountByCategory = useMemo(() => {
    const counts: Record<number, number> = {};

    for (const item of items) {
      if (item.category_id !== null) {
        counts[item.category_id] = (counts[item.category_id] || 0) + 1;
      }
    }

    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      if (
        selectedCategoryId !== "all" &&
        item.category_id !== selectedCategoryId
      ) {
        return false;
      }

      if (!keyword) return true;

      return [item.name, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [items, searchTerm, selectedCategoryId]);

  function updateCategory(
    categoryId: number,
    patch: Partial<Category>,
  ) {
    setCategories((current) =>
      current.map((category) =>
        category.id === categoryId ? { ...category, ...patch } : category,
      ),
    );
    setMessage("");
  }

  function updateItem(itemId: number, patch: Partial<MenuItem>) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    );
    setMessage("");
  }

  async function uploadItemImage(
    itemId: number,
    file: File,
  ) {
    setUploadingItemId(itemId);
    setMessage("");

    try {
      const resized = await createMenuImageFiles(file);
      const token = await getAccessToken();
      const formData = new FormData();

      formData.append("itemId", String(itemId));
      formData.append(
        "detail",
        resized.detail,
        "detail.webp",
      );
      formData.append(
        "thumbnail",
        resized.thumbnail,
        "thumbnail.webp",
      );

      const response = await fetch(
        `/api/owner/business/${businessId}/menu/image`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      const data = (await response.json()) as {
        image_url?: string;
        thumbnail_url?: string;
        error?: string;
      };

      if (
        !response.ok ||
        !data.image_url ||
        !data.thumbnail_url
      ) {
        throw new Error(
          data.error ||
            "이미지를 등록하지 못했습니다.",
        );
      }

      updateItem(itemId, {
        image_url: data.image_url,
        thumbnail_url: data.thumbnail_url,
      });

      setMessage(
        "✓ 원본은 저장하지 않고 상세 이미지와 썸네일만 저장했습니다.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "이미지 등록 실패",
      );
    } finally {
      setUploadingItemId(null);
    }
  }

  async function removeItemImage(itemId: number) {
    if (!window.confirm("이 메뉴 이미지를 삭제할까요?")) {
      return;
    }

    setUploadingItemId(itemId);
    setMessage("");

    try {
      const token = await getAccessToken();

      const response = await fetch(
        `/api/owner/business/${businessId}/menu/image`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ itemId }),
        },
      );

      const data = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error || "이미지를 삭제하지 못했습니다.",
        );
      }

      updateItem(itemId, {
        image_url: null,
        thumbnail_url: null,
      });

      setMessage("✓ 메뉴 이미지를 삭제했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "이미지 삭제 실패",
      );
    } finally {
      setUploadingItemId(null);
    }
  }

  async function addCategory() {
    const name = newCategoryName.trim();

    if (!name) {
      alert("카테고리 이름을 입력하세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();

      const response = await fetch(`/api/owner/business/${businessId}/menu`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "add-category",
          name,
        }),
      });

      const data = (await response.json()) as MenuResponse & {
        category?: Category;
      };

      if (!response.ok || !data.category) {
        throw new Error(data.error || "카테고리를 추가하지 못했습니다.");
      }

      setCategories((current) => [...current, data.category!]);
      setNewCategoryName("");
      setMessage("✓ 카테고리를 추가했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "카테고리 추가 실패",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(category: Category) {
    const itemCount = itemCountByCategory[category.id] || 0;

    if (itemCount > 0) {
      alert(
        `이 카테고리에 메뉴 ${itemCount}개가 있습니다. 먼저 다른 카테고리로 옮겨주세요.`,
      );
      return;
    }

    if (!window.confirm(`"${category.name}" 카테고리를 삭제할까요?`)) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const token = await getAccessToken();

      const response = await fetch(`/api/owner/business/${businessId}/menu`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoryId: category.id,
        }),
      });

      const data = (await response.json()) as MenuResponse;

      if (!response.ok) {
        throw new Error(data.error || "카테고리를 삭제하지 못했습니다.");
      }

      setCategories((current) =>
        current.filter((row) => row.id !== category.id),
      );

      if (selectedCategoryId === category.id) {
        setSelectedCategoryId("all");
      }

      setMessage("✓ 카테고리를 삭제했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "카테고리 삭제 실패",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    setMessage("");

    try {
      const normalizedItems = items.map((item) => {
        const rawPrice = (priceInputs[item.id] ?? "").trim();

        let price: number | null = null;

        if (rawPrice) {
          price = Number(rawPrice);

          if (!Number.isFinite(price) || price < 0) {
            throw new Error(`${item.name}의 가격이 올바르지 않습니다.`);
          }

          price = Number(price.toFixed(2));
        }

        if (!item.name.trim()) {
          throw new Error("상품명은 비워둘 수 없습니다.");
        }

        return {
          id: item.id,
          category_id: item.category_id,
          name: item.name.trim(),
          description: item.description?.trim() || null,
          price,
          display_order: Number(item.display_order ?? 999),
          is_available: item.is_available,
        };
      });

      const normalizedCategories = categories.map((category) => {
        if (!category.name.trim()) {
          throw new Error("카테고리 이름은 비워둘 수 없습니다.");
        }

        return {
          id: category.id,
          name: category.name.trim(),
          display_order: Number(category.display_order ?? 999),
          is_active: category.is_active,
        };
      });

      const token = await getAccessToken();

      const response = await fetch(`/api/owner/business/${businessId}/menu`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categories: normalizedCategories,
          items: normalizedItems,
        }),
      });

      const data = (await response.json()) as MenuResponse & {
        updatedCategories?: number;
        updatedItems?: number;
      };

      if (!response.ok) {
        throw new Error(data.error || "메뉴 저장에 실패했습니다.");
      }

      setMessage(
        `✓ 저장 완료: 카테고리 ${data.updatedCategories || 0}개, 메뉴 ${data.updatedItems || 0}개`,
      );

      await loadMenu();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "메뉴 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-5 py-10 text-[#172033]">
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 font-bold shadow">
          메뉴를 불러오는 중...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-4 pb-32 pt-6 text-[#172033] sm:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#B64032]">
              Menu Management
            </p>
            <h1 className="mt-1 text-2xl font-black">{businessName}</h1>
          </div>

          <Link
            href={`/owner/business/${businessId}/manage`}
            className="rounded-xl border border-[#E8DED1] bg-white px-3 py-2 text-xs font-black shadow-sm"
          >
            Back
          </Link>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${
              message.startsWith("✓")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addCategory();
                }
              }}
              placeholder="새 카테고리 이름"
              className="min-w-0 flex-1 rounded-xl border border-[#E8DED1] px-4 py-3 text-sm font-bold outline-none focus:border-[#172033]"
            />

            <button
              type="button"
              onClick={() => void addCategory()}
              disabled={saving}
              className="rounded-xl bg-[#172033] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              + 카테고리 추가
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {categories.length === 0 ? (
              <div className="rounded-2xl bg-yellow-50 p-4 text-sm font-bold text-yellow-800">
                카테고리가 없습니다. 도어대시 업데이트 과정에서
                business_menu_categories 테이블에도 카테고리가 저장됐는지 확인하세요.
              </div>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="grid gap-2 rounded-2xl border border-[#EEE5DA] p-3 sm:grid-cols-[1fr_90px_auto_auto]"
                >
                  <input
                    value={category.name}
                    onChange={(event) =>
                      updateCategory(category.id, {
                        name: event.target.value,
                      })
                    }
                    className="min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm font-black outline-none focus:border-[#172033]"
                  />

                  <input
                    type="number"
                    value={category.display_order ?? 999}
                    onChange={(event) =>
                      updateCategory(category.id, {
                        display_order: Number(event.target.value),
                      })
                    }
                    className="rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-black outline-none"
                    title="노출 순서"
                  />

                  <label className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={category.is_active}
                      onChange={(event) =>
                        updateCategory(category.id, {
                          is_active: event.target.checked,
                        })
                      }
                    />
                    노출
                  </label>

                  <button
                    type="button"
                    onClick={() => void deleteCategory(category)}
                    disabled={saving}
                    className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-5">
          <div className="sticky top-0 z-20 rounded-3xl border border-[#E8DED1] bg-[#F8F3EC]/95 py-3 backdrop-blur">
            <div className="flex gap-2 overflow-x-auto px-1 pb-2">
              <button
                type="button"
                onClick={() => setSelectedCategoryId("all")}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${
                  selectedCategoryId === "all"
                    ? "bg-[#172033] text-white"
                    : "bg-white text-[#172033]"
                }`}
              >
                전체 {items.length}
              </button>

              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${
                    selectedCategoryId === category.id
                      ? "bg-[#172033] text-white"
                      : "bg-white text-[#172033]"
                  }`}
                >
                  {category.name} {itemCountByCategory[category.id] || 0}
                </button>
              ))}
            </div>

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="상품명 또는 설명 검색"
              className="w-full rounded-2xl border border-[#E8DED1] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[#172033]"
            />
          </div>

          <div className="mt-4 space-y-4">
            {filteredItems.length === 0 ? (
              <div className="rounded-3xl bg-white p-6 text-center text-sm font-bold text-gray-500 shadow-sm">
                표시할 메뉴가 없습니다.
              </div>
            ) : (
              filteredItems.map((item) => {
                const imageUrl = item.thumbnail_url || item.image_url;

                return (
                  <article
                    key={item.id}
                    className={`rounded-3xl bg-white p-4 shadow-sm ${
                      item.is_available ? "" : "opacity-60"
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="w-24 shrink-0">
                        <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-gray-100">
                          {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-3xl">
                              🍽️
                            </div>
                          )}

                          {uploadingItemId === item.id && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-2 text-center text-[10px] font-black text-white">
                              변환·등록 중
                            </div>
                          )}
                        </div>

                        <label
                          className={`mt-2 flex items-center justify-center rounded-lg px-2 py-2 text-[11px] font-black ${
                            uploadingItemId === item.id
                              ? "cursor-not-allowed bg-gray-200 text-gray-500"
                              : "cursor-pointer bg-[#172033] text-white"
                          }`}
                        >
                          {imageUrl
                            ? "이미지 변경"
                            : "+ 이미지 등록"}

                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={
                              uploadingItemId === item.id
                            }
                            className="hidden"
                            onChange={(event) => {
                              const file =
                                event.target.files?.[0];

                              event.currentTarget.value = "";

                              if (file) {
                                void uploadItemImage(
                                  item.id,
                                  file,
                                );
                              }
                            }}
                          />
                        </label>

                        {imageUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              void removeItemImage(item.id)
                            }
                            disabled={
                              uploadingItemId === item.id
                            }
                            className="mt-1 w-full rounded-lg bg-red-50 px-2 py-1.5 text-[10px] font-black text-red-600 disabled:opacity-50"
                          >
                            이미지 삭제
                          </button>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <input
                          value={item.name}
                          onChange={(event) =>
                            updateItem(item.id, {
                              name: event.target.value,
                            })
                          }
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base font-black outline-none focus:border-[#172033]"
                        />

                        <textarea
                          value={item.description || ""}
                          onChange={(event) =>
                            updateItem(item.id, {
                              description: event.target.value,
                            })
                          }
                          placeholder="상품 설명"
                          rows={2}
                          className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium outline-none focus:border-[#172033]"
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px_90px_auto]">
                      <select
                        value={item.category_id ?? ""}
                        onChange={(event) =>
                          updateItem(item.id, {
                            category_id: event.target.value
                              ? Number(event.target.value)
                              : null,
                          })
                        }
                        className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none"
                      >
                        <option value="">카테고리 없음</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>

                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-gray-500">
                          $
                        </span>
                        <input
                          value={priceInputs[item.id] ?? ""}
                          onChange={(event) =>
                            setPriceInputs((current) => ({
                              ...current,
                              [item.id]: cleanPrice(event.target.value),
                            }))
                          }
                          inputMode="decimal"
                          placeholder="0.00"
                          className="w-full rounded-xl border border-gray-200 py-2 pl-7 pr-3 text-sm font-black outline-none focus:border-[#172033]"
                        />
                      </div>

                      <input
                        type="number"
                        value={item.display_order ?? 999}
                        onChange={(event) =>
                          updateItem(item.id, {
                            display_order: Number(event.target.value),
                          })
                        }
                        title="노출 순서"
                        className="rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-black outline-none"
                      />

                      <label className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold">
                        <input
                          type="checkbox"
                          checked={item.is_available}
                          onChange={(event) =>
                            updateItem(item.id, {
                              is_available: event.target.checked,
                            })
                          }
                        />
                        판매
                      </label>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8DED1] bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl gap-3">
          <button
            type="button"
            onClick={() => void loadMenu()}
            disabled={saving}
            className="rounded-xl border border-[#E8DED1] px-4 py-3 text-sm font-black disabled:opacity-50"
          >
            다시 불러오기
          </button>

          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={saving}
            className="flex-1 rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white shadow disabled:opacity-50"
          >
            {saving ? "저장 중..." : "카테고리 · 메뉴 전체 저장"}
          </button>
        </div>
      </div>
    </main>
  );
}
