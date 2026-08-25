"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";
import BottomNav from "../../components/BottomNav";

const libraries: "places"[] = ["places"];

const MAX_IMAGES = 5;
const MAX_IMAGE_WIDTH = 1600;
const MAX_IMAGE_HEIGHT = 1600;
const WEBP_QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`이미지를 읽을 수 없습니다: ${file.name}`));
    };

    image.src = objectUrl;
  });
}

async function optimizeImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} 파일은 이미지가 아닙니다.`);
  }

  const image = await loadImage(file);

  const scale = Math.min(
    1,
    MAX_IMAGE_WIDTH / image.naturalWidth,
    MAX_IMAGE_HEIGHT / image.naturalHeight,
  );

  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

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

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error(`${file.name} WebP 변환에 실패했습니다.`));
        }
      },
      "image/webp",
      WEBP_QUALITY,
    );
  });

  const originalName = file.name.replace(/\.[^.]+$/, "") || "image";
  const safeName = originalName.replace(/[^a-zA-Z0-9_-]/g, "-");

  return new File([blob], `${safeName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

export default function NewGrandOpeningPage() {
  const router = useRouter();

  const autocompleteRef =
    useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [openingDate, setOpeningDate] = useState("");
    const [endDate, setEndDate] = useState("");
const [linkUrl, setLinkUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [optimizingImages, setOptimizingImages] = useState(false);
  const [showOnMain, setShowOnMain] = useState(true);
  const [showOnCommunity, setShowOnCommunity] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);
    }

    loadUser();
  }, [router]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [imagePreviews, videoPreview]);

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

  async function handleImages(files: FileList | null) {
    if (!files) return;

    const remainingCount = MAX_IMAGES - imageFiles.length;

    if (remainingCount <= 0) {
      alert(`이미지는 최대 ${MAX_IMAGES}개까지 등록할 수 있습니다.`);
      return;
    }

    const selected = Array.from(files).slice(0, remainingCount);

    if (selected.length === 0) return;

    setOptimizingImages(true);

    try {
      const optimizedFiles: File[] = [];

      for (const file of selected) {
        try {
          const optimized = await optimizeImageFile(file);
          optimizedFiles.push(optimized);
        } catch (error) {
          console.error(error);
          alert(
            error instanceof Error
              ? error.message
              : `${file.name} 이미지 처리에 실패했습니다.`,
          );
        }
      }

      if (optimizedFiles.length === 0) return;

      const merged = [...imageFiles, ...optimizedFiles].slice(0, MAX_IMAGES);

      imagePreviews.forEach((url) => URL.revokeObjectURL(url));

      setImageFiles(merged);
      setImagePreviews(merged.map((file) => URL.createObjectURL(file)));
    } finally {
      setOptimizingImages(false);
    }
  }

  function removeImage(index: number) {
    const nextFiles = imageFiles.filter((_, i) => i !== index);

    imagePreviews.forEach((url) => URL.revokeObjectURL(url));

    setImageFiles(nextFiles);
    setImagePreviews(nextFiles.map((file) => URL.createObjectURL(file)));
  }

  function handleVideo(file: File | null) {
    if (!file) return;

    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  function removeVideo() {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }

    setVideoFile(null);
    setVideoPreview(null);
  }

  async function uploadImages(grandOpeningId: string) {
    const uploadedUrls: string[] = [];

    for (const file of imageFiles) {
      const fileName = `${userId}/${grandOpeningId}/images/${crypto.randomUUID()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from("grand-openings")
        .upload(fileName, file, {
          cacheControl: "31536000",
          contentType: "image/webp",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("grand-openings")
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  }

  async function uploadVideo(grandOpeningId: string) {
    if (!videoFile) return null;

    const ext = videoFile.name.split(".").pop() || "mp4";
    const fileName = `${userId}/${grandOpeningId}/video/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("grand-openings")
      .upload(fileName, videoFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("grand-openings")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  async function submitGrandOpening(e: React.FormEvent) {
    e.preventDefault();

    if (!userId) return alert("Please login first.");
    if (!businessName.trim()) return alert("Business name is required.");
    if (!title.trim()) return alert("Title is required.");
        if (openingDate && endDate && endDate < openingDate) {
      return alert("End date cannot be earlier than the opening date.");
    }
if (optimizingImages) return alert("이미지를 처리하고 있습니다. 잠시만 기다려주세요.");

    setSaving(true);

    try {
      const grandOpeningId = crypto.randomUUID();
      const imageUrls = await uploadImages(grandOpeningId);
      const uploadedVideoUrl = await uploadVideo(grandOpeningId);

      const { error } = await supabase.from("grand_openings").insert({
        id: grandOpeningId,
        user_id: userId,
        title: title.trim(),
        business_name: businessName.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        lat,
        lng,
        phone: phone.trim() || null,
        opening_date: openingDate || null,
                end_date: endDate || null,
images: imageUrls,
        video_url: uploadedVideoUrl || videoUrl.trim() || null,
        link_url: linkUrl.trim() || null,
        show_on_main: showOnMain,
        show_on_community: showOnCommunity,
        status: "pending",
      });

      if (error) throw error;

      alert("Grand Opening submitted for approval.");
      router.push("/");
    } catch (err: unknown) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to submit Grand Opening.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] text-[#172033]">
      <section className="mx-auto max-w-xl px-5 pb-28 pt-6">
        <div className="mb-5 flex items-center justify-between border-b border-[#E8DED1] pb-3">
          <Link href="/" className="text-sm font-black">
            ← Back
          </Link>

          <h1 className="text-lg font-black">Grand Opening</h1>

          <ProfileButton />
        </div>

        <form
          onSubmit={submitGrandOpening}
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
              placeholder="Example: Seoul BBQ"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
              placeholder="Grand Opening Special"
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
            <label className="mb-1 block text-sm font-black">
              Sale / Event End Date
              <span className="ml-2 text-xs font-bold text-gray-400">
                Optional
              </span>
            </label>

            <input
              type="date"
              value={endDate}
              min={openingDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
            />

            <p className="mt-1 text-xs font-semibold text-gray-500">
              Grand Opening과 함께 할인·프로모션을 진행하는 경우 종료일을 입력하세요.
            </p>
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
                  placeholder="Start typing address..."
                />
              </Autocomplete>
            ) : (
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
                placeholder="Loading Google Maps..."
              />
            )}

            {lat !== null && lng !== null && (
              <p className="mt-1 text-xs font-bold text-green-700">
                Address selected
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-[#E8DED1] px-4 py-3 text-sm outline-none"
              placeholder="Phone number"
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
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-black">Video</label>

            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
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

              <span className="text-xs font-bold text-gray-500">
                Optional
              </span>
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
              <label
                className={`inline-flex items-center justify-center rounded-xl border border-[#E8DED1] bg-[#F8F3EC] px-4 py-3 text-sm font-black text-[#172033] ${
                  optimizingImages
                    ? "cursor-wait opacity-60"
                    : "cursor-pointer active:scale-95"
                }`}
              >
                {optimizingImages ? "⏳ Optimizing..." : "📷 Attach Images"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={optimizingImages}
                  onChange={async (e) => {
                    const input = e.currentTarget;
                    const files = input.files;

                    if (!files || files.length === 0) return;

                    try {
                      await handleImages(files);
                    } finally {
                      input.value = "";
                    }
                  }}
                  className="hidden"
                />
              </label>

              <span className="text-xs font-bold text-gray-500">
                {imageFiles.length}/{MAX_IMAGES} Images
              </span>
            </div>

            <p className="mt-2 text-xs font-bold text-gray-500">
              업로드 전에 최대 1600×1600px, WebP 품질 82%로 자동 최적화됩니다.
            </p>

            {imagePreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {imagePreviews.map((src, index) => (
                  <div
                    key={src}
                    className="relative aspect-square overflow-hidden rounded-xl border border-[#E8DED1]"
                  >
                    <img
                      src={src}
                      alt={`Preview ${index + 1}`}
                      className="h-full w-full object-cover"
                    />

                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-1 text-xs font-black text-white"
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
              placeholder="Tell people about the grand opening, special offers, hours, etc."
            />
          </div>

          <div className="rounded-2xl border border-[#E8DED1] bg-[#F8F3EC] p-4">
            <p className="text-sm font-black text-[#172033]">
              표시 위치
            </p>

            <p className="mt-1 text-xs font-semibold text-gray-500">
              체크한 곳에만 이 Grand Opening을 표시합니다.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-black transition ${
                  showOnMain
                    ? "border-[#172033] bg-white text-[#172033]"
                    : "border-[#E8DED1] bg-[#FFFDF8] text-gray-500"
                }`}
              >
                <input
                  type="checkbox"
                  checked={showOnMain}
                  onChange={(e) => setShowOnMain(e.target.checked)}
                  className="h-5 w-5 accent-[#172033]"
                />
                메인에 표시
              </label>

              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-black transition ${
                  showOnCommunity
                    ? "border-[#172033] bg-white text-[#172033]"
                    : "border-[#E8DED1] bg-[#FFFDF8] text-gray-500"
                }`}
              >
                <input
                  type="checkbox"
                  checked={showOnCommunity}
                  onChange={(e) => setShowOnCommunity(e.target.checked)}
                  className="h-5 w-5 accent-[#172033]"
                />
                커뮤니티에 표시
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || optimizingImages}
            className="w-full rounded-xl bg-[#172033] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {saving
              ? "Submitting..."
              : optimizingImages
                ? "Optimizing Images..."
                : "Submit Grand Opening"}
          </button>
        </form>
      </section>

      <BottomNav activeNav="home" />
    </main>
  );
}