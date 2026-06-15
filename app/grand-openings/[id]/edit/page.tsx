"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { supabase } from "../../../../lib/supabase";
import ProfileButton from "../../../components/ProfileButton";

const libraries: "places"[] = ["places"];

export default function EditGrandOpeningPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id);

  const autocompleteRef =
    useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const [oldImages, setOldImages] = useState<string[]>([]);
  const [deletedImages, setDeletedImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  useEffect(() => {
    loadItem();
  }, [id]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [imagePreviews, videoPreview]);

  async function loadItem() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

    const { data, error } = await supabase
      .from("grand_openings")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      alert("정보를 불러오지 못했습니다.");
      router.push("/grand-openings");
      return;
    }

    setTitle(data.title || "");
    setBusinessName(data.business_name || "");
    setDescription(data.description || "");
    setAddress(data.address || "");
    setLat(data.lat || null);
    setLng(data.lng || null);
    setPhone(data.phone || "");
    setOpeningDate(data.opening_date || "");
    setLinkUrl(data.link_url || "");
    setVideoUrl(data.video_url || "");
    setOldImages(Array.isArray(data.images) ? data.images.filter(Boolean) : []);
    setDeletedImages([]);
    setImageFiles([]);
    setImagePreviews([]);
    setVideoFile(null);
    setVideoPreview(null);

    setLoading(false);
  }

  function handlePlaceChanged() {
    const place = autocompleteRef.current?.getPlace();

    if (place?.formatted_address) {
      setAddress(place.formatted_address);
    }

    const location = place?.geometry?.location;

    if (location) {
      setLat(location.lat());
      setLng(location.lng());
    }
  }

  function handleImages(files: FileList | null) {
    if (!files) return;

    const selected = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    );

    const remain = 5 - oldImages.length - imageFiles.length;

    if (remain <= 0) {
      alert("이미지는 최대 5장까지 가능합니다.");
      return;
    }

    const addFiles = selected.slice(0, remain);

    setImageFiles((prev) => [...prev, ...addFiles]);
    setImagePreviews((prev) => [
      ...prev,
      ...addFiles.map((file) => URL.createObjectURL(file)),
    ]);
  }

  function removeOldImage(index: number) {
    const target = oldImages[index];

    if (!target) return;

    setDeletedImages((prev) =>
      prev.includes(target) ? prev : [...prev, target]
    );

    setOldImages((prev) => prev.filter((_, i) => i !== index));
  }

  function removeNewImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));

    setImagePreviews((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleVideo(file: File | null) {
    if (!file) return;

    if (videoPreview) URL.revokeObjectURL(videoPreview);

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setVideoUrl("");
  }

  function removeVideo() {
    if (videoPreview) URL.revokeObjectURL(videoPreview);

    setVideoFile(null);
    setVideoPreview(null);
  }

  function getStoragePathFromPublicUrl(url: string) {
  const marker = "/storage/v1/object/public/grand-openings/";
  const index = url.indexOf(marker);

  if (index === -1) {
    console.log("STORAGE PATH NOT FOUND:", url);
    return null;
  }

  return decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
}

async function deleteStorageImages(urls: string[]) {
  const paths = urls
    .map(getStoragePathFromPublicUrl)
    .filter(Boolean) as string[];

  console.log("DELETE STORAGE PATHS:", paths);

  if (paths.length === 0) return;

  const { data, error } = await supabase.storage
    .from("grand-openings")
    .remove(paths);

  console.log("STORAGE DELETE DATA:", data);
  console.log("STORAGE DELETE ERROR:", error);

  if (error) {
    alert("DB에서는 삭제됐지만 Storage 파일 삭제 권한 문제가 있습니다.");
  }
}

  async function uploadImages() {
    if (!userId) return [];

    const uploadedUrls: string[] = [];

    for (const file of imageFiles) {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${userId}/${id}/images/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("grand-openings")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("grand-openings")
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  }

  async function uploadVideo() {
    if (!userId || !videoFile) return null;

    const ext = videoFile.name.split(".").pop() || "mp4";
    const fileName = `${userId}/${id}/video/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("grand-openings")
      .upload(fileName, videoFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("grand-openings")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  async function updateGrandOpening(e: React.FormEvent) {
  e.preventDefault();

  if (!businessName.trim()) return alert("Business name is required.");
  if (!title.trim()) return alert("Title is required.");

  setSaving(true);

  try {
    const newImages = await uploadImages();
    const uploadedVideoUrl = await uploadVideo();

    const finalImages = [...oldImages, ...newImages]
      .filter(Boolean)
      .slice(0, 5);

    console.log("FINAL IMAGES TO DB:", finalImages);
    console.log("DELETED IMAGES:", deletedImages);

    const { data: updated, error } = await supabase
      .from("grand_openings")
      .update({
        title: title.trim(),
        business_name: businessName.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        lat,
        lng,
        phone: phone.trim() || null,
        opening_date: openingDate || null,
        images: finalImages,
        video_url: uploadedVideoUrl || videoUrl.trim() || null,
        link_url: linkUrl.trim() || null,
      })
      .eq("id", id)
      .select("id, images")
      .single();

    if (error) throw error;

    console.log("UPDATED DB RESULT:", updated);

    if (deletedImages.length > 0) {
      await deleteStorageImages(deletedImages);
    }

    setDeletedImages([]);
    setImageFiles([]);
    setImagePreviews([]);

    alert("수정되었습니다.");
    router.replace(`/grand-openings/${id}?updated=${Date.now()}`);
    router.refresh();
  } catch (err: any) {
    console.error("UPDATE GRAND OPENING ERROR:", err);
    alert(err?.message || "수정 실패");
    setSaving(false);
  }
}

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
        <section className="mx-auto max-w-xl px-5 py-8">
          <p className="font-bold">Loading...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-xl px-5 pb-28 pt-6">
        <div className="mb-5 flex items-center justify-between border-b border-[#E8DED1] pb-3">
          <Link href={`/grand-openings/${id}`} className="text-sm font-black">
            ← Back
          </Link>

          <h1 className="text-lg font-black">Edit Grand Opening</h1>

          <ProfileButton />
        </div>

        <form
          onSubmit={updateGrandOpening}
          className="space-y-4 rounded-3xl border border-[#E8DED1] bg-white p-5 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-black">
              Business Name *
            </label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">
              Opening Date
            </label>
            <input
              type="date"
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">Address</label>

            {isLoaded ? (
              <Autocomplete
                onLoad={(autocomplete) => {
                  autocompleteRef.current = autocomplete;
                }}
                onPlaceChanged={handlePlaceChanged}
              >
                <input
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setLat(null);
                    setLng(null);
                  }}
                  className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
                />
              </Autocomplete>
            ) : (
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">
              Website / Link URL
            </label>
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">Video</label>

            <input
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value);
                if (e.target.value.trim()) removeVideo();
              }}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
              placeholder="YouTube, Instagram, TikTok, or video link"
            />

            <div className="mt-2 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#E8DED1] bg-[#F8F3EC] px-4 py-3 text-sm font-black text-[#172033] active:scale-95">
                🎥 Attach Video
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleVideo(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            {videoPreview && (
              <div className="mt-3 overflow-hidden rounded-2xl border border-[#E8DED1]">
                <video src={videoPreview} controls className="w-full bg-black" />

                <button
                  type="button"
                  onClick={removeVideo}
                  className="block w-full bg-red-50 px-4 py-3 text-sm font-black text-red-600"
                >
                  Remove Video
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#E8DED1] bg-[#F8F3EC] px-4 py-3 text-sm font-black text-[#172033] active:scale-95">
                📷 Attach Images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleImages(e.target.files)}
                  className="hidden"
                />
              </label>

              <span className="text-xs font-bold text-gray-500">
                {oldImages.length + imageFiles.length}/5 Images
              </span>
            </div>

            {(oldImages.length > 0 || imagePreviews.length > 0) && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {oldImages.map((src, index) => (
                  <div
                    key={`${src}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-xl border border-[#E8DED1]"
                  >
                    <img
                      src={src}
                      alt={`Current ${index + 1}`}
                      className="h-full w-full object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => removeOldImage(index)}
                      className="absolute right-1 top-1 rounded-full bg-red-600 px-2 py-1 text-xs font-black text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {imagePreviews.map((src, index) => (
                  <div
                    key={`${src}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-xl border border-[#E8DED1]"
                  >
                    <img
                      src={src}
                      alt={`Preview ${index + 1}`}
                      className="h-full w-full object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => removeNewImage(index)}
                      className="absolute right-1 top-1 rounded-full bg-red-600 px-2 py-1 text-xs font-black text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-[#172033] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Grand Opening"}
          </button>
        </form>
      </section>
    </main>
  );
}