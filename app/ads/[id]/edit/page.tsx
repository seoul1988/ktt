"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  images: string[] | null;
  video_url: string | null;
  status: string | null;
  lat: number | null;
  lng: number | null;
};

const IMAGE_BUCKET = "ad-images";
const VIDEO_BUCKET = "ad-videos";

export default function EditAdPage() {
  const params = useParams();
  const router = useRouter();
  const adId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ad, setAd] = useState<AdItem | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("active");

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [newImages, setNewImages] = useState<File[]>([]);
  const [newVideo, setNewVideo] = useState<File | null>(null);

  useEffect(() => {
    loadAd();
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
    setStatus(item.status || "active");
    setLat(item.lat ? String(item.lat) : "");
    setLng(item.lng ? String(item.lng) : "");
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
          location
        )}&limit=1`
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

  async function uploadImages() {
    const uploadedUrls: string[] = [];

    for (const file of newImages) {
      const ext = file.name.split(".").pop();
      const fileName = `${adId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(fileName, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
    }

    return uploadedUrls;
  }

  async function uploadVideo() {
    if (!newVideo) return videoUrl;

    const ext = newVideo.name.split(".").pop();
    const fileName = `${adId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(fileName, newVideo, { upsert: true });

    if (error) throw error;

    const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(fileName);
    return data.publicUrl;
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((img) => img !== url));
  }

  function removeVideo() {
    setVideoUrl(null);
    setNewVideo(null);
  }

  async function saveAd() {
    if (!title.trim()) {
      alert("Title is required.");
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
          status,
          lat: lat ? Number(lat) : null,
          lng: lng ? Number(lng) : null,
          images: finalImages,
          video_url: finalVideoUrl,
        })
        .eq("id", adId);

      if (error) {
        alert("Failed to update ad: " + error.message);
        setSaving(false);
        return;
      }

      router.push(`/ads/${adId}`);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
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
  {/* 왼쪽 */}
  <BackButton />

  {/* 가운데 */}
  <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xl font-black text-[#172033]">
    Edit Ad
  </h1>

  {/* 오른쪽 */}
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
            <label className="mb-2 block text-xs font-black text-gray-500">
              Current Images
            </label>

            {images.length === 0 ? (
              <p className="text-xs font-bold text-gray-400">No images</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((img) => (
                  <div key={img} className="relative overflow-hidden rounded-xl">
                    <img src={img} className="h-24 w-full object-cover" />
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
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setNewImages(Array.from(e.target.files || []))}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
            />
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
            disabled={saving}
            className="w-full rounded-2xl bg-[#172033] py-4 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
	  <CommunityBottomNav activeNav="admin" />
    </main>
  );
}