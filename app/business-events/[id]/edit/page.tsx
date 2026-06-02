"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { supabase } from "../../../../lib/supabase";
import ProfileButton from "../../../components/ProfileButton";
import BottomNav from "../../../components/BottomNav";

const libraries: "places"[] = ["places"];

export default function EditBusinessEventPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [externalVideoUrl, setExternalVideoUrl] = useState("");
  const [oldVideoUrlToDelete, setOldVideoUrlToDelete] = useState("");

  useEffect(() => {
    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    if (!place) return;

    const fullAddress = place.formatted_address || place.name || "";
    setLocation(fullAddress);

    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();

    setLatitude(typeof lat === "number" ? lat : null);
    setLongitude(typeof lng === "number" ? lng : null);
  }

  function handleImage(file: File | null) {
    if (!file) return;

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function removeImage() {
    if (imageUrl) {
      await deleteImageFromStorage(imageUrl);
    }

    setImageFile(null);
    setImagePreview("");
    setImageUrl("");
  }

  function handleVideo(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      alert("Please select a video file.");
      return;
    }

    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    setOldVideoUrlToDelete(videoUrl);
    setExternalVideoUrl("");
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  async function removeVideo() {
    if (videoUrl) {
      setOldVideoUrlToDelete(videoUrl);
    }

    setVideoFile(null);
    setVideoPreview("");
    setVideoUrl("");
    setExternalVideoUrl("");
  }

  async function uploadFile(file: File) {
    const ext = file.name.split(".").pop();
    const fileName = `images/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("event-images")
      .upload(fileName, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("event-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  async function uploadVideoFile(file: File) {
    const ext = file.name.split(".").pop();
    const fileName = `videos/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("event-videos")
      .upload(fileName, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from("event-videos")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  function getStoragePathFromPublicUrl(publicUrl: string, bucket: string) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = publicUrl.indexOf(marker);

    if (index === -1) return null;

    return decodeURIComponent(publicUrl.slice(index + marker.length));
  }

  async function deleteVideoFromStorage(publicUrl: string) {
    const path = getStoragePathFromPublicUrl(publicUrl, "event-videos");

    if (!path) return;

    const { error } = await supabase.storage.from("event-videos").remove([path]);

    if (error) {
      alert("Storage 영상 삭제 실패: " + error.message);
    }
  }

  async function deleteImageFromStorage(publicUrl: string) {
    const path = getStoragePathFromPublicUrl(publicUrl, "event-images");

    if (!path) return;

    const { error } = await supabase.storage.from("event-images").remove([path]);

    if (error) {
      alert("Storage 이미지 삭제 실패: " + error.message);
    }
  }

  async function loadEvent() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: event, error } = await supabase
      .from("business_events")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !event) {
      alert("이벤트를 찾을 수 없습니다.");
      router.push("/business-events");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, name, phone")
      .eq("id", user?.id)
      .maybeSingle();

    const isOwner = user?.id === event.owner_id;
    const isAdmin = profile?.role === "admin";

    if (!user || (!isOwner && !isAdmin)) {
      alert("수정 권한이 없습니다.");
      router.push(`/business-events/${id}`);
      return;
    }

    setCanManage(true);
    setTitle(event.title || "");
    setDescription(event.description || "");
    setEventDate(event.event_date || "");
    setLocation(event.location || "");
    setLatitude(event.latitude ?? null);
    setLongitude(event.longitude ?? null);
    setImageUrl(event.image_url || "");
    setVideoUrl(event.video_url || "");
    setExternalVideoUrl(event.external_video_url || "");

    setContactName(event.contact_name || profile?.name || "");
    setContactEmail(event.contact_email || user.email || "");
    setContactPhone(event.contact_phone || profile?.phone || "");

    setLoading(false);
  }

  async function saveEvent() {
    if (!canManage) return;

    if (!title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }

    setSaving(true);

    try {
      let finalImageUrl = imageUrl;
      let finalVideoUrl = videoUrl;

      if (imageFile) {
        finalImageUrl = await uploadFile(imageFile);
      }

      if (videoFile) {
        if (oldVideoUrlToDelete) {
          await deleteVideoFromStorage(oldVideoUrlToDelete);
        }

        finalVideoUrl = await uploadVideoFile(videoFile);
      }

      if (!videoFile && oldVideoUrlToDelete && !videoUrl) {
        await deleteVideoFromStorage(oldVideoUrlToDelete);
        finalVideoUrl = "";
      }

      const { error } = await supabase
        .from("business_events")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          event_date: eventDate || null,
          location: location.trim() || null,
          latitude,
          longitude,
          image_url: finalImageUrl || null,
          video_url: finalVideoUrl || null,
          external_video_url: finalVideoUrl
            ? null
            : externalVideoUrl.trim() || null,
          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          contact_phone: contactPhone.trim() || null,
        })
        .eq("id", id);

      if (error) {
        alert("수정 실패: " + error.message);
        setSaving(false);
        return;
      }

      alert("수정되었습니다.");
      router.push(`/business-events/${id}`);
      router.refresh();
    } catch (err: any) {
      alert("저장 실패: " + err.message);
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-[#F8F3EC] p-5">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-5 pb-28 text-[#172033]">
  <div className="mx-auto max-w-xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href={`/business-events/${id}`}
          className="rounded-full bg-white px-4 py-2 text-sm font-black shadow"
        >
          ← Back
        </Link>

        <h1 className="text-xl font-black text-[#172033]">Edit Event</h1>

        <div className="shrink-0">
          <ProfileButton />
        </div>
      </div>

      <div className="space-y-5 rounded-3xl bg-white p-5 shadow">
        <div>
          <label className="mb-2 block text-sm font-black text-[#172033]">
            제목
          </label>
          <input
            type="text"
            placeholder="이벤트 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-[#172033]">
            날짜
          </label>
          <input
            type="date"
            value={eventDate || ""}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-[#172033]">
            주소
          </label>

          {isLoaded ? (
            <Autocomplete
              options={{
                fields: [
                  "formatted_address",
                  "address_components",
                  "geometry",
                  "name",
                ],
              }}
              onLoad={(autocomplete) => {
                autocompleteRef.current = autocomplete;
              }}
              onPlaceChanged={onPlaceChanged}
            >
              <input
                type="text"
                placeholder="주소"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
              />
            </Autocomplete>
          ) : (
            <input
              type="text"
              placeholder="주소"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />
          )}

          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              type="number"
              value={latitude ?? ""}
              onChange={(e) =>
                setLatitude(e.target.value ? Number(e.target.value) : null)
              }
              placeholder="Latitude"
              className="w-full rounded-2xl border px-4 py-3 text-xs font-bold"
            />

            <input
              type="number"
              value={longitude ?? ""}
              onChange={(e) =>
                setLongitude(e.target.value ? Number(e.target.value) : null)
              }
              placeholder="Longitude"
              className="w-full rounded-2xl border px-4 py-3 text-xs font-bold"
            />
          </div>
        </div>

        <div>
  <label className="mb-2 block text-sm font-black text-[#172033]">
    연락처
  </label>

  <input
    value={contactName}
    onChange={(e) => setContactName(e.target.value)}
    placeholder="Contact Name"
    className="mb-2 w-full rounded-2xl border px-4 py-3 text-sm font-bold"
  />

  <input
    value={contactEmail}
    onChange={(e) => setContactEmail(e.target.value)}
    placeholder="Email"
    className="mb-2 w-full rounded-2xl border px-4 py-3 text-sm font-bold"
  />

  <input
    value={contactPhone}
    onChange={(e) => setContactPhone(e.target.value)}
    placeholder="Phone"
    className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
  />
</div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-black text-[#172033]">
              이미지
            </label>

            <label className="cursor-pointer rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white shadow">
              첨부

              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImage(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          {(imagePreview || imageUrl) && (
            <div className="relative mt-3 overflow-hidden rounded-2xl bg-white">
              <img
                src={imagePreview || imageUrl}
                alt="Preview"
                className="h-56 w-full object-contain"
              />

              <button
                type="button"
                onClick={removeImage}
                className="absolute right-3 top-3 z-[9999] flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-xl font-black text-white shadow-lg"
              >
                ×
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-black text-[#172033]">
              동영상
            </label>

            {!videoPreview && !videoUrl && !externalVideoUrl && (
              <label className="cursor-pointer rounded-full bg-[#172033] px-4 py-2 text-xs font-black text-white shadow">
                첨부

                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleVideo(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {(videoPreview || videoUrl) && (
            <div className="relative mt-3 overflow-hidden rounded-2xl bg-black">
              <video
                src={videoPreview || videoUrl}
                controls
                playsInline
                className="h-56 w-full object-contain"
              />

              <button
                type="button"
                onClick={removeVideo}
                className="absolute right-3 top-3 z-[9999] flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-xl font-black text-white shadow-lg"
              >
                ×
              </button>
            </div>
          )}

          {externalVideoUrl && !videoPreview && !videoUrl && (
            <div className="mt-3 rounded-2xl border bg-gray-50 p-3 text-sm font-bold">
              <p className="mb-2 text-xs text-gray-500">External video link</p>
              <a
                href={externalVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words text-[#2453A6] underline"
              >
                {externalVideoUrl}
              </a>
              <button
                type="button"
                onClick={() => setExternalVideoUrl("")}
                className="mt-3 w-full rounded-xl bg-red-600 py-3 font-black text-white"
              >
                Remove Link
              </button>
            </div>
          )}

          {!videoPreview && !videoUrl && (
            <input
              value={externalVideoUrl}
              onChange={(e) => setExternalVideoUrl(e.target.value)}
              placeholder="YouTube / Facebook / Instagram video link"
              className="mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-bold"
            />
          )}
        </div>

        <div>
          <label className="mb-2 block text-sm font-black text-[#172033]">
            설명
          </label>
          <textarea
            placeholder="이벤트 설명"
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-2xl border px-4 py-3 text-sm font-bold"
          />
        </div>

        <div className="pt-4">
          <button
            type="button"
            disabled={saving}
            onClick={saveEvent}
            className="w-full rounded-full bg-[#172033] py-4 text-sm font-black text-white shadow disabled:bg-gray-400"
          >
            {saving ? "Saving..." : "Save Event"}
          </button>
        </div>
      </div>
</div>
      <BottomNav />
    </main>
  );
}
