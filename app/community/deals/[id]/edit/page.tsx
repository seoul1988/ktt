"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../lib/supabase";
import CommunityBottomNav from "../../../../components/CommunityBottomNav";

declare global {
  interface Window {
    google: any;
  }
}

export default function EditCommunityDealPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const [checkingUser, setCheckingUser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);

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
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  useEffect(() => {
    loadDeal();
  }, []);

  useEffect(() => {
    if (checkingUser) return;
    if (!addressInputRef.current) return;

    const existingScript = document.getElementById("google-maps-script");

    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = initAutocomplete;
      document.body.appendChild(script);
    } else {
      initAutocomplete();
    }
  }, [checkingUser]);

  function getFirstImage(data: any) {
    if (data?.image_url) return data.image_url;

    if (Array.isArray(data?.images) && data.images.length > 0) {
      return data.images[0];
    }

    return "";
  }

  function initAutocomplete() {
    if (!addressInputRef.current) return;
    if (!window.google?.maps?.places) return;

    const autocomplete = new window.google.maps.places.Autocomplete(
      addressInputRef.current,
      {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["formatted_address", "geometry"],
      }
    );

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();

      if (!place.formatted_address || !place.geometry?.location) {
        alert("주소를 목록에서 선택해주세요.");
        return;
      }

      setAddress(place.formatted_address);
      setLat(place.geometry.location.lat());
      setLng(place.geometry.location.lng());
    });
  }

  async function loadDeal() {
    setCheckingUser(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .eq("id", id)
      .eq("deal_scope", "community")
      .single();

    if (error || !data) {
      console.error("community deal load error:", error);
      alert("딜을 찾을 수 없습니다.");
      router.push("/community/deals");
      return;
    }

    setOwnerId(data.user_id || null);

    if (data.user_id !== user.id) {
      alert("본인이 등록한 딜만 수정할 수 있습니다.");
      router.push(`/community/deals/${id}`);
      return;
    }

    setTitle(data.title || "");
    setBusinessName(data.business_name || "");
    setDescription(data.description || "");
    setDiscountText(data.discount_text || "");
    setPhone(data.phone || "");
    setAddress(data.address || "");
    setWebsite(data.website || "");
    setImageUrl(getFirstImage(data));
    setStartDate(data.start_date || "");
    setEndDate(data.end_date || "");
    setLat(data.lat ?? null);
    setLng(data.lng ?? null);

    setCheckingUser(false);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    if (!userId || ownerId !== userId) {
      alert("수정 권한이 없습니다.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    try {
      setUploading(true);

      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `community-deals/${id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("deal-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("deal-images")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;

      const { data: updatedDeal, error: dbError } = await supabase
        .from("deals")
        .update({
          image_url: publicUrl,
          images: [publicUrl],
        })
        .eq("id", id)
        .eq("user_id", userId)
        .eq("deal_scope", "community")
        .select("id,image_url,images")
        .single();

      if (dbError) throw dbError;

      setImageUrl(getFirstImage(updatedDeal) || publicUrl);
      alert("이미지가 변경되었습니다.");
    } catch (err: any) {
      console.error("image upload or db update error:", err);
      alert(err?.message || "이미지 변경 오류");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveImage() {
    if (!confirm("이미지를 삭제하시겠습니까?")) return;

    if (!userId || ownerId !== userId) {
      alert("삭제 권한이 없습니다.");
      return;
    }

    try {
      setDeletingImage(true);

      const { data, error } = await supabase
        .from("deals")
        .update({
          image_url: null,
          images: [],
        })
        .eq("id", id)
        .eq("user_id", userId)
        .eq("deal_scope", "community")
        .select("id,image_url,images")
        .single();

      console.log("DELETE IMAGE RESULT", data, error);

      if (error) throw error;

      setImageUrl("");
      alert("이미지가 삭제되었습니다.");
    } catch (err: any) {
      console.error("community deal image delete error:", err);
      alert(err?.message || "이미지 삭제 오류");
    } finally {
      setDeletingImage(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!userId || ownerId !== userId) {
      alert("수정 권한이 없습니다.");
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

    if (address.trim() && (!lat || !lng)) {
      alert("주소는 입력 후 Google 목록에서 선택해주세요.");
      return;
    }

    try {
      setLoading(true);

      const { data: updatedDeal, error } = await supabase
        .from("deals")
        .update({
          title: title.trim(),
          business_name: businessName.trim() || null,
          description: description.trim() || null,
          discount_text: discountText.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          lat,
          lng,
          website: website.trim() || null,
          image_url: imageUrl || null,
          images: imageUrl ? [imageUrl] : [],
          start_date: startDate || null,
          end_date: endDate,
          active: true,
          status: "approved",
          deal_scope: "community",
        })
        .eq("id", id)
        .eq("user_id", userId)
        .eq("deal_scope", "community")
        .select("id")
        .single();

      if (error) throw error;

      if (!updatedDeal) {
        alert("DB 수정된 데이터가 없습니다. RLS 권한을 확인하세요.");
        return;
      }

      router.push(`/community/deals/${id}`);
    } catch (err: any) {
      console.error("community deal update error:", err);
      alert(err?.message || "딜 수정 오류");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    if (!userId || ownerId !== userId) {
      alert("삭제 권한이 없습니다.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("deals")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .eq("deal_scope", "community");

      if (error) throw error;

      router.push("/community/deals");
    } catch (err: any) {
      console.error("community deal delete error:", err);
      alert(err?.message || "딜 삭제 오류");
    } finally {
      setLoading(false);
    }
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
        <p className="text-sm font-bold text-[#6B6257]">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-xl px-5 pb-28 pt-6">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/community/deals/${id}`}
              className="text-sm font-black text-[#C4483A]"
            >
              ← Back
            </Link>

            <span className="text-sm font-black text-[#C4483A]">
              EDIT COMMUNITY DEAL
            </span>
          </div>

          <h1 className="mt-2 text-3xl font-black tracking-tight">딜 수정</h1>
        </div>

        <form
          onSubmit={handleUpdate}
          className="space-y-4 rounded-3xl bg-white p-5 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-black">딜 제목 *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">업소명</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">할인 내용 *</label>
            <input
              value={discountText}
              onChange={(e) => setDiscountText(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">설명</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              <label className="mb-1 block text-sm font-black">종료일 *</label>
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
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">주소</label>
            <input
              ref={addressInputRef}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setLat(null);
                setLng(null);
              }}
              placeholder="주소를 입력하고 Google 목록에서 선택하세요"
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />

            {lat && lng && (
              <p className="mt-1 text-xs font-black text-green-700">
                위치 선택 완료
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">웹사이트</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-black">딜 이미지</label>

            <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-[#F8F3EC] px-4 py-5 text-sm font-black text-[#6B6257]">
              {uploading ? "업로드 중..." : "📷 이미지 변경"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading || deletingImage || loading}
                className="hidden"
              />
            </label>

            {imageUrl ? (
              <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                <img
                  src={imageUrl}
                  alt="preview"
                  className="h-48 w-full rounded-xl object-cover"
                />

                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={deletingImage || loading || uploading}
                  className="mt-3 rounded-full bg-gray-200 px-3 py-2 text-xs font-semibold text-[#172033] disabled:opacity-60"
                >
                  {deletingImage ? "삭제 중..." : "이미지 삭제"}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs font-bold text-[#6B6257]">
                현재 등록된 이미지가 없습니다.
              </p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="submit"
              disabled={loading || uploading || deletingImage}
              className="rounded-xl bg-[#C4483A] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60"
            >
              {loading ? "수정 중..." : "수정 저장"}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || uploading || deletingImage}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
            >
              삭제
            </button>
          </div>
        </form>
      </section>

      <CommunityBottomNav activeNav="community" />
    </main>
  );
}