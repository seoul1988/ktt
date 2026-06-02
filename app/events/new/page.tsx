"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { supabase } from "../../../lib/supabase";
import CommunityBottomNav from "../../components/CommunityBottomNav";

const libraries: "places"[] = ["places"];

export default function NewEventPage() {
  const router = useRouter();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const [saving, setSaving] = useState(false);

  function onPlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    if (!place) return;

    setLocation(place.formatted_address || place.name || "");

    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();

    if (lat && lng) {
      setLatitude(lat);
      setLongitude(lng);
    }
  }

  function handleImage(file: File | null) {
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleVideo(file: File | null) {
    if (!file) return;

    const maxSize = 50 * 1024 * 1024;

    if (file.size > maxSize) {
      alert("영상 파일이 너무 큽니다. 50MB 이하로 올려주세요.");
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  async function uploadFile(file: File, bucket: string, folder: string) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
    const fileName = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      console.error("UPLOAD ERROR:", error);
      throw new Error(`${bucket} 업로드 실패: ${error.message}`);
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  }

  async function submitEvent() {
    if (!title.trim()) {
      alert("이벤트 제목을 입력하세요.");
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

      let businessId: number | null = null;

      const { data: ownerRow } = await supabase
        .from("business_owners")
        .select("business_id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();

      if (ownerRow?.business_id) {
        businessId = ownerRow.business_id;
      }

      let uploadedImageUrl = "";
      let uploadedVideoUrl = "";

      if (imageFile) {
        uploadedImageUrl = await uploadFile(
          imageFile,
          "event-images",
          "images"
        );
      }

      if (videoFile) {
        uploadedVideoUrl = await uploadFile(
          videoFile,
          "event-videos",
          "videos"
        );
      }

      const { data: insertedEvent, error } = await supabase
        .from("event_requests")
        .insert({
          owner_id: user.id,
          business_id: businessId,
          title: title.trim(),
          description: description.trim(),
          image_url: uploadedImageUrl || null,
          video_url: uploadedVideoUrl || null,
          external_video_url: videoUrl.trim() || null,
          event_date: eventDate || null,
          location: location.trim(),
          latitude,
          longitude,
          status: "pending",
        })
        .select("id, title")
        .single();

      if (error) {
        alert("이벤트 등록 실패: " + error.message);
        setSaving(false);
        return;
      }

     try {
  const pushRes = await fetch("/api/push/admin-event-request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId: insertedEvent.id,
      title: insertedEvent.title,
    }),
  });

  const pushData = await pushRes.json();

  console.log("ADMIN PUSH RESULT:", pushData);

  if (!pushRes.ok) {
    alert(
      "이벤트는 등록됐지만 푸시알림 실패:\n" +
        (pushData.error || "Unknown Error")
    );
  } else {
    console.log(
      `Push Success - Sent: ${pushData.sent}, Failed: ${pushData.failed}`
    );
  }
} catch (pushError: any) {
  console.error("푸시알림 발송 실패:", pushError);

  alert(
    "이벤트는 등록됐지만 푸시알림 요청 실패:\n" +
      (pushError?.message || "Unknown Error")
  );
}

      alert("이벤트가 등록되었습니다. 관리자 승인 후 노출됩니다.");
      router.push("/");
    } catch (err: any) {
      alert("저장 실패: " + err.message);
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-32">
      <div className="mx-auto max-w-md">
        <div className="relative mb-5 flex items-center justify-center">
          <Link
            href="/"
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black text-[#172033] shadow"
          >
            ←
          </Link>

          <h1 className="text-2xl font-black text-[#172033]">
            Create Event
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

  <Link href="/coupon/new" className="block px-4 py-3 hover:bg-gray-100">
    Register Coupon
  </Link>

  <button
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

        <div className="space-y-4 rounded-3xl bg-white p-5 shadow">
          <input
            type="text"
            placeholder="Event Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          {isLoaded ? (
            <Autocomplete
              onLoad={(autocomplete) => {
                autocompleteRef.current = autocomplete;
              }}
              onPlaceChanged={onPlaceChanged}
            >
              <input
                type="text"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
              />
            </Autocomplete>
          ) : (
            <input
              type="text"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={latitude ?? ""}
              onChange={(e) => setLatitude(Number(e.target.value))}
              placeholder="Latitude"
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />

            <input
              type="number"
              value={longitude ?? ""}
              onChange={(e) => setLongitude(Number(e.target.value))}
              placeholder="Longitude"
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm font-black text-[#172033]">
                Event Image
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
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-3 h-40 w-full rounded-2xl object-cover"
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm font-black text-[#172033]">
                Event Video
              </span>

              <label className="cursor-pointer rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white shadow">
                첨부

                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleVideo(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            {videoFile && (
              <p className="mt-2 text-xs font-bold text-gray-500">
                {videoFile.name}
              </p>
            )}

            {videoPreview && (
              <video
                src={videoPreview}
                controls
                className="mt-3 h-48 w-full rounded-2xl object-cover"
              />
            )}
          </div>

          <input
            type="text"
            placeholder="Video Link URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <textarea
            placeholder="Event Description"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />

          <button
            type="button"
            disabled={saving}
            onClick={submitEvent}
            className="w-full rounded-full bg-[#172033] py-4 text-sm font-black text-white disabled:bg-gray-400"
          >
            {saving ? "등록 중..." : "이벤트 등록"}
          </button>

          <p className="text-center text-xs font-bold text-gray-500">
            등록 후 관리자가 Business Event 또는 Community Event로 승인합니다.
          </p>
        </div>
      </div>

      <CommunityBottomNav />
    </main>
  );
}