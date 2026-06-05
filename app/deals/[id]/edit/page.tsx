// app/deals/[id]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import BottomNav from "../../../components/BottomNav";

type Deal = {
  id: string;
  owner_id: string | null;
  business_id: number | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
  start_date: string | null;
  end_date: string | null;
};

type DealItemForm = {
  id: string | null;
  name: string;
  originalPrice: string;
  salePrice: string;
  description: string;
  imageUrl: string | null;
  imageFile: File | null;
  imagePreview: string;
  deleteImage: boolean;
};

type Profile = {
  role: string | null;
  is_admin?: boolean | null;
};

function makeEmptyItem(): DealItemForm {
  return {
    id: null,
    name: "",
    originalPrice: "",
    salePrice: "",
    description: "",
    imageUrl: null,
    imageFile: null,
    imagePreview: "",
    deleteImage: false,
  };
}

function getStoragePathFromPublicUrl(url: string | null) {
  if (!url) return null;

  const marker = "/storage/v1/object/public/";
  const index = url.indexOf(marker);

  if (index === -1) return null;

  const fullPath = url.substring(index + marker.length);
  const parts = fullPath.split("/");

  const bucket = parts.shift();
  const path = parts.join("/");

  if (!bucket || !path) return null;

  return {
    bucket,
    path: decodeURIComponent(path),
  };
}

export default function EditDealPage() {
  const params = useParams();
  const id = String(params.id);

  const [deal, setDeal] = useState<Deal | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState("");

  const [items, setItems] = useState<DealItemForm[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);

  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDeal();
  }, []);

  async function loadDeal() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: dealData, error } = await supabase
      .from("deals")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !dealData) {
      alert("Deal을 찾을 수 없습니다.");
      window.location.href = "/deals";
      return;
    }

    if (!user) {
      alert("로그인이 필요합니다.");
      window.location.href = "/login";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,is_admin")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    const role = String(profile?.role || "").trim().toLowerCase();
    const isAdmin = role === "admin" || profile?.is_admin === true;
    const isDirectOwner = dealData.owner_id === user.id;

    let isBusinessOwner = false;

    if (dealData.business_id) {
      const { data: ownerRow } = await supabase
        .from("business_owners")
        .select("business_id")
        .eq("business_id", dealData.business_id)
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();

      isBusinessOwner = !!ownerRow;
    }

    if (!isDirectOwner && !isBusinessOwner && !isAdmin) {
      alert("수정 권한이 없습니다.");
      window.location.href = `/deals/${id}`;
      return;
    }

    const { data: itemRows } = await supabase
      .from("deal_items")
      .select("*")
      .eq("deal_id", id)
      .order("sort_order", { ascending: true });

    const loadedItems: DealItemForm[] = (itemRows || []).map((item: any) => ({
      id: item.id,
      name: item.name || "",
      originalPrice:
        item.original_price !== null && item.original_price !== undefined
          ? String(item.original_price)
          : "",
      salePrice:
        item.sale_price !== null && item.sale_price !== undefined
          ? String(item.sale_price)
          : "",
      description: item.description || "",
      imageUrl: item.image_url || null,
      imageFile: null,
      imagePreview: "",
      deleteImage: false,
    }));

    setDeal(dealData as Deal);
    setTitle(dealData.title || "");
    setDescription(dealData.description || "");
    setStartDate(dealData.start_date || "");
    setEndDate(dealData.end_date || "");
    setCurrentImageUrl(dealData.image_url || null);
    setItems(loadedItems.length > 0 ? loadedItems : [makeEmptyItem()]);
    setCanManage(true);
    setLoading(false);
  }

  function handleNewImage(file: File | null) {
    if (!file) return;

    setNewImageFile(file);
    setNewImagePreview(URL.createObjectURL(file));
  }

  function removeNewImage() {
    setNewImageFile(null);
    setNewImagePreview("");
  }

  async function removeCurrentImage() {
    const ok = confirm("현재 대표 이미지를 삭제할까요?");
    if (!ok) return;

    if (currentImageUrl) {
      const imageFile = getStoragePathFromPublicUrl(currentImageUrl);

      if (imageFile) {
        await supabase.storage
          .from(imageFile.bucket)
          .remove([imageFile.path]);
      }
    }

    const { error } = await supabase
      .from("deals")
      .update({ image_url: null })
      .eq("id", id);

    if (error) {
      alert("이미지 삭제 실패: " + error.message);
      return;
    }

    setCurrentImageUrl(null);
  }

  function updateItem(
    index: number,
    field: keyof DealItemForm,
    value: string | File | boolean | null
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
            deleteImage: false,
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
    const target = items[index];

    if (target?.id) {
      setDeletedItemIds((prev) => [...prev, target.id as string]);
    }

    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [makeEmptyItem()];
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
              imageUrl: null,
              deleteImage: true,
            }
          : item
      )
    );
  }

  async function removeStorageImage(url: string | null) {
    const imageFile = getStoragePathFromPublicUrl(url);

    if (imageFile) {
      await supabase.storage.from(imageFile.bucket).remove([imageFile.path]);
    }
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

  async function saveDeal(e: React.FormEvent) {
    e.preventDefault();

    if (!canManage || !deal) return;

    if (!title.trim()) {
      alert("제목을 입력하세요.");
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

      let imageUrl = currentImageUrl;

      if (newImageFile) {
        if (currentImageUrl) {
          await removeStorageImage(currentImageUrl);
        }

        imageUrl = await uploadImage(newImageFile, user.id);
      }

      const { error } = await supabase
        .from("deals")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          image_url: imageUrl,
        })
        .eq("id", id);

      if (error) {
        alert("Deal 수정 실패: " + error.message);
        setSaving(false);
        return;
      }

      if (deletedItemIds.length > 0) {
        const { data: deleteTargets } = await supabase
          .from("deal_items")
          .select("id,image_url")
          .in("id", deletedItemIds);

        for (const target of deleteTargets || []) {
          await removeStorageImage(target.image_url);
        }

        const { error: deleteError } = await supabase
          .from("deal_items")
          .delete()
          .in("id", deletedItemIds);

        if (deleteError) {
          alert("메뉴 삭제 실패: " + deleteError.message);
          setSaving(false);
          return;
        }
      }

      const validItems = items.filter((item) => item.name.trim());

      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        let itemImageUrl = item.imageUrl;

        if (item.deleteImage && item.imageUrl) {
          await removeStorageImage(item.imageUrl);
          itemImageUrl = null;
        }

        if (item.imageFile) {
          if (item.imageUrl) {
            await removeStorageImage(item.imageUrl);
          }

          itemImageUrl = await uploadImage(item.imageFile, user.id);
        }

        const row = {
          deal_id: id,
          name: item.name.trim(),
          original_price: item.originalPrice ? Number(item.originalPrice) : null,
          sale_price: item.salePrice ? Number(item.salePrice) : null,
          description: item.description.trim() || null,
          image_url: itemImageUrl,
          sort_order: i,
        };

        if (item.id) {
          const { error: itemUpdateError } = await supabase
            .from("deal_items")
            .update(row)
            .eq("id", item.id);

          if (itemUpdateError) {
            alert("메뉴 수정 실패: " + itemUpdateError.message);
            setSaving(false);
            return;
          }
        } else {
          const { error: itemInsertError } = await supabase
            .from("deal_items")
            .insert(row);

          if (itemInsertError) {
            alert("메뉴 추가 실패: " + itemInsertError.message);
            setSaving(false);
            return;
          }
        }
      }

      alert("Deal이 수정되었습니다.");
      window.location.href = `/deals/${id}`;
    } catch (err: any) {
      alert("저장 실패: " + (err?.message || "Unknown Error"));
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] text-[#172033]">
        <p className="font-bold text-gray-500">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-28 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="relative mb-5 flex items-center justify-center">
          <Link
            href={`/deals/${id}`}
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black shadow"
          >
            ←
          </Link>

          <h1 className="text-2xl font-black">
            Edit Deal
          </h1>

          <details className="absolute right-0">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-white text-2xl font-black text-[#172033] shadow">
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
          onSubmit={saveDeal}
          className="space-y-4 rounded-3xl bg-white p-5 shadow-xl"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Deal Title"
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={startDate || ""}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />

            <input
              type="date"
              value={endDate || ""}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm font-black">
                대표 이미지
              </span>

              {currentImageUrl && (
                <button
                  type="button"
                  onClick={removeCurrentImage}
                  className="rounded-full bg-red-600 px-3 py-1 text-xs font-black text-white"
                >
                  삭제
                </button>
              )}
            </div>

            {currentImageUrl ? (
              <div className="relative mt-3 overflow-hidden rounded-2xl border bg-white">
                <img
                  src={currentImageUrl}
                  alt="Current Deal"
                  className="h-44 w-full object-cover"
                />

                <button
                  type="button"
                  onClick={removeCurrentImage}
                  className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-sm font-black text-white"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border bg-gray-50 p-6 text-center text-sm font-bold text-gray-400">
                대표 이미지 없음
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm font-black">
                새 대표 이미지
              </span>

              <label className="cursor-pointer rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white shadow">
                파일 첨부

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleNewImage(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            {newImagePreview && (
              <div className="relative mt-3 overflow-hidden rounded-2xl border bg-white">
                <button
                  type="button"
                  onClick={removeNewImage}
                  className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-sm font-black text-white"
                >
                  ×
                </button>

                <img
                  src={newImagePreview}
                  alt="New Deal Preview"
                  className="h-44 w-full object-cover"
                />
              </div>
            )}
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Deal Description"
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black">Deal 메뉴</h2>

              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, makeEmptyItem()])}
                className="rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white shadow"
              >
                + 메뉴 추가
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="rounded-3xl bg-white p-4 shadow">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-black">메뉴 {index + 1}</p>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-600"
                    >
                      삭제
                    </button>
                  </div>

                  <input
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    placeholder="메뉴명"
                    className="mb-2 w-full rounded-2xl border px-4 py-3 text-sm font-bold"
                  />

                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={item.originalPrice}
                      onChange={(e) =>
                        updateItem(index, "originalPrice", e.target.value)
                      }
                      placeholder="원가"
                      className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
                    />

                    <input
                      type="number"
                      step="0.01"
                      value={item.salePrice}
                      onChange={(e) =>
                        updateItem(index, "salePrice", e.target.value)
                      }
                      placeholder="할인가"
                      className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
                    />
                  </div>

                  <textarea
                    value={item.description}
                    onChange={(e) =>
                      updateItem(index, "description", e.target.value)
                    }
                    rows={3}
                    placeholder="메뉴 설명"
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

                  {(item.imagePreview || item.imageUrl) && (
                    <div className="relative mt-3 overflow-hidden rounded-2xl border bg-white">
                      <button
                        type="button"
                        onClick={() => removeItemImage(index)}
                        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-sm font-black text-white"
                      >
                        ×
                      </button>

                      <img
                        src={item.imagePreview || item.imageUrl || ""}
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
            className="w-full rounded-full bg-[#172033] py-4 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Deal"}
          </button>
        </form>
      </div>

      <BottomNav />
    </main>
  );
}
