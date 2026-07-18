"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import ProfileButton from "@/app/components/ProfileButton";
import BackButton from "@/app/components/BackButton";
import CommunityBottomNav from "@/app/components/CommunityBottomNav";

type AdItem = {
  id: number;
  user_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  phone: string | null;
  website_url: string | null;
  images: string[] | null;
  video_url: string | null;
  status: string | null;
  lat: number | null;
  lng: number | null;
};

const IMAGE_BUCKET = "ads";
const VIDEO_BUCKET = "ads";

async function optimizeImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.78,
): Promise<File> {
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  let source: ImageBitmap | HTMLImageElement | null = null;
  let objectUrl = "";

  try {
    if ("createImageBitmap" in window) {
      source = await createImageBitmap(file);
    } else {
      objectUrl = URL.createObjectURL(file);

      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
        image.src = objectUrl;
      });
    }

    if (!source) return file;

    const originalWidth = source.width;
    const originalHeight = source.height;

    const scale = Math.min(
      1,
      maxWidth / originalWidth,
      maxHeight / originalHeight,
    );

    const targetWidth = Math.max(1, Math.round(originalWidth * scale));
    const targetHeight = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("이미지 변환 기능을 사용할 수 없습니다.");
    }

    context.drawImage(source, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });

    if (!blob) {
      throw new Error("WebP 이미지 변환에 실패했습니다.");
    }

    const baseName = file.name.replace(/\.[^/.]+$/, "") || "image";

    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    if (
      typeof ImageBitmap !== "undefined" &&
      source instanceof ImageBitmap
    ) {
      source.close();
    }
  }
}

export default function EditAdPage() {
  const newImageInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef<string[]>([]);
  const params = useParams();
  const router = useRouter();
  const adId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optimizingImages, setOptimizingImages] = useState(false);

  const [ad, setAd] = useState<AdItem | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [status, setStatus] = useState("active");

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [newVideo, setNewVideo] = useState<File | null>(null);

  const [deletedImages, setDeletedImages] = useState<string[]>([]);
  const [deletedVideoUrl, setDeletedVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    loadAd();
  }, []);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((preview) =>
        URL.revokeObjectURL(preview),
      );
      previewUrlsRef.current = [];
    };
  }, []);

  async function loadAd() {
    setLoading(true);

    const { data, error } = await supabase
      .from("ads")
      .select("*")
      .eq("id", adId)
      .single();

    if (error || !data) {
      alert("Ad not found or you do not have permission.");
      router.push("/ads");
      return;
    }

    const item = data as AdItem;

    setAd(item);
    setTitle(item.title || "");
    setDescription(item.description || "");
    setCategory(item.category || "");
    setLocation(item.location || "");
    setPhone(item.phone || "");
    setWebsiteUrl(item.website_url || "");
    setStatus(item.status || "active");
    setLat(item.lat !== null ? String(item.lat) : "");
    setLng(item.lng !== null ? String(item.lng) : "");
    setImages(Array.isArray(item.images) ? item.images : []);
    setVideoUrl(item.video_url || null);

    setLoading(false);
  }

  async function geocodeAddress() {
    if (!location.trim()) {
      alert("Please enter an address first.");
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          location,
        )}&limit=1`,
      );

      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        alert("Address not found.");
        return;
      }

      setLat(data[0].lat);
      setLng(data[0].lon);
      alert("Latitude and longitude added.");
    } catch {
      alert("Failed to get latitude and longitude.");
    }
  }

  function getUploadFolder() {
    return ad?.user_id || String(adId);
  }

  function getFileExtension(fileName: string, fallback: string) {
    const extension = fileName.split(".").pop()?.toLowerCase();
    return extension && extension !== fileName ? extension : fallback;
  }

  function getStoragePathFromUrl(url: string, bucket: string) {
    try {
      const decodedUrl = decodeURIComponent(url);
      const publicMarker = `/storage/v1/object/public/${bucket}/`;
      const signedMarker = `/storage/v1/object/sign/${bucket}/`;

      const publicIndex = decodedUrl.indexOf(publicMarker);
      if (publicIndex !== -1) {
        return decodedUrl.slice(publicIndex + publicMarker.length).split("?")[0];
      }

      const signedIndex = decodedUrl.indexOf(signedMarker);
      if (signedIndex !== -1) {
        return decodedUrl.slice(signedIndex + signedMarker.length).split("?")[0];
      }

      return null;
    } catch {
      return null;
    }
  }

  async function handleNewImages(files: File[]) {
    const selectedFiles = files.filter((file) =>
      file.type.startsWith("image/"),
    );

    if (selectedFiles.length === 0) return;

    setOptimizingImages(true);

    try {
      const optimizedFiles = await Promise.all(
        selectedFiles.map((file) => optimizeImage(file)),
      );

      const previews = optimizedFiles.map((file) =>
        URL.createObjectURL(file),
      );

      previewUrlsRef.current.push(...previews);
      setNewImages((prev) => [...prev, ...optimizedFiles]);
      setNewImagePreviews((prev) => [...prev, ...previews]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "이미지 변환에 실패했습니다.";
      alert(message);
    } finally {
      setOptimizingImages(false);
    }
  }

  async function uploadImages() {
    const uploadedUrls: string[] = [];
    const folder = getUploadFolder();

    for (const file of newImages) {
      const ext = getFileExtension(file.name, "webp");
      const fileName = `${folder}/images/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(fileName, file, {
          cacheControl: "3600",
          contentType: file.type || "image/webp",
          upsert: false,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from(IMAGE_BUCKET)
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  }

  async function uploadVideo() {
    if (!newVideo) return videoUrl;

    const folder = getUploadFolder();
    const ext = getFileExtension(newVideo.name, "mp4");
    const fileName = `${folder}/videos/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(fileName, newVideo, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from(VIDEO_BUCKET)
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((img) => img !== url));
    setDeletedImages((prev) =>
      prev.includes(url) ? prev : [...prev, url],
    );
  }

  function removeNewImage(index: number) {
    setNewImages((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

    setNewImagePreviews((prev) => {
      const target = prev[index];

      if (target) {
        URL.revokeObjectURL(target);
        previewUrlsRef.current = previewUrlsRef.current.filter(
          (preview) => preview !== target,
        );
      }

      return prev.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function removeVideo() {
    if (videoUrl) {
      setDeletedVideoUrl(videoUrl);
    }

    setVideoUrl(null);
    setNewVideo(null);
  }

  async function deleteStorageFiles(
    bucket: string,
    urls: Array<string | null>,
  ) {
    const paths = urls
      .filter((url): url is string => Boolean(url))
      .map((url) => getStoragePathFromUrl(url, bucket))
      .filter((path): path is string => Boolean(path));

    if (paths.length === 0) return;

    const { error } = await supabase.storage.from(bucket).remove(paths);

    if (error) {
      throw new Error(`Storage deletion failed: ${error.message}`);
    }
  }

  async function saveAd() {
    if (!title.trim()) {
      alert("Title is required.");
      return;
    }

    if (optimizingImages) {
      alert("이미지 축소 작업이 끝날 때까지 기다려 주세요.");
      return;
    }

    setSaving(true);

    try {
      const uploadedImages = await uploadImages();
      const finalImages = [...images, ...uploadedImages];
      const finalVideoUrl = await uploadVideo();

      const { error } = await supabase
        .from("ads")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          category: category.trim() || null,
          location: location.trim() || null,
          phone: phone.trim() || null,
          website_url: websiteUrl.trim() || null,
          status,
          lat: lat ? Number(lat) : null,
          lng: lng ? Number(lng) : null,
          images: finalImages,
          video_url: finalVideoUrl,
        })
        .eq("id", adId);

      if (error) {
        throw new Error("Failed to update ad: " + error.message);
      }

      await deleteStorageFiles(IMAGE_BUCKET, deletedImages);

      if (deletedVideoUrl && deletedVideoUrl !== finalVideoUrl) {
        await deleteStorageFiles(VIDEO_BUCKET, [deletedVideoUrl]);
      }

      newImagePreviews.forEach((preview) =>
        URL.revokeObjectURL(preview),
      );
      previewUrlsRef.current = [];

      router.push(`/ads/${adId}`);
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred.";

      alert("Save failed: " + message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-4">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 font-bold shadow">
          Loading...
        </div>
      </main>
    );
  }

  if (!ad) return null;

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24">
      <div className="mx-auto w-full max-w-xl">
        <div className="relative mb-5 flex h-10 items-center border-b border-[#E8DED1] pb-3">
          <BackButton />

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xl font-black text-[#172033]">
            Edit Ad
          </h1>

          <div className="ml-auto">
            <ProfileButton />
          </div>
        </div>

        <div className="space-y-4 rounded-3xl bg-white p-5 shadow">
          <div>
            <label className="mb-1 block text-xs font-black text-gray-500">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-gray-500">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-gray-500">
              Category
            </label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-gray-500">
              Address
            </label>
            <div className="flex gap-2">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex-1 rounded-xl border px-4 py-3 text-sm font-bold"
              />
              <button
                type="button"
                onClick={geocodeAddress}
                className="rounded-xl bg-[#172033] px-3 text-xs font-black text-white"
              >
                Get GPS
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-black text-gray-500">
                Latitude
              </label>
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-black text-gray-500">
                Longitude
              </label>
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-gray-500">
              Phone
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-gray-500">
              Website / Link
            </label>
            <input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              inputMode="url"
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
            />
            <p className="mt-1 text-[11px] font-bold text-gray-400">
              웹사이트, 인스타그램, 페이스북 등의 링크를 입력하세요.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-gray-500">
              Current Images
            </label>

            {images.length === 0 ? (
              <p className="text-xs font-bold text-gray-400">No images</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <div key={img} className="relative overflow-hidden rounded-xl">
                    <img
                      src={img}
                      alt="Current advertisement"
                      className="h-24 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(img)}
                      className="absolute right-1 top-1 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-gray-500">
              Add Images
            </label>

            <input
              ref={newImageInputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={optimizingImages}
              onChange={async (e) => {
                // FileList는 input 값을 비우면 함께 사라질 수 있으므로
                // 먼저 독립된 File 배열로 복사해야 합니다.
                const selectedFiles = Array.from(e.currentTarget.files || []);
                e.currentTarget.value = "";

                await handleNewImages(selectedFiles);
              }}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50"
            />

            <p className="mt-1 text-[11px] font-bold text-gray-400">
              새 이미지는 최대 1600px, WebP 품질 78%로 자동 축소됩니다.
            </p>

            {optimizingImages && (
              <p className="mt-2 text-xs font-black text-blue-600">
                이미지를 축소하고 있습니다...
              </p>
            )}

            {newImages.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {newImages.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="relative overflow-hidden rounded-xl"
                  >
                    <img
                      src={newImagePreviews[index]}
                      alt={file.name}
                      className="h-24 w-full object-cover"
                    />

                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      WebP
                    </span>

                    <button
                      type="button"
                      onClick={() => removeNewImage(index)}
                      className="absolute right-1 top-1 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-black text-gray-500">
              Current Video
            </label>

            {videoUrl ? (
              <div className="space-y-2">
                <video
                  src={videoUrl}
                  controls
                  className="h-48 w-full rounded-xl bg-black object-contain"
                />
                <button
                  type="button"
                  onClick={removeVideo}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white"
                >
                  Remove Video
                </button>
              </div>
            ) : (
              <p className="text-xs font-bold text-gray-400">No video</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-gray-500">
              Replace / Add Video
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setNewVideo(e.target.files?.[0] || null)}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-black text-gray-500">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
            >
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          <button
            onClick={saveAd}
            disabled={saving || optimizingImages}
            className="w-full rounded-2xl bg-[#172033] py-4 text-sm font-black text-white disabled:opacity-50"
          >
            {optimizingImages
              ? "Optimizing Images..."
              : saving
                ? "Saving..."
                : "Save Changes"}
          </button>
        </div>
      </div>

      <CommunityBottomNav activeNav="admin" />
    </main>
  );
}