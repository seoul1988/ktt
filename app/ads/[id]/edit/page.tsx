"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

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
};

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

    setAd(data as AdItem);
    setTitle(data.title || "");
    setDescription(data.description || "");
    setCategory(data.category || "");
    setLocation(data.location || "");
    setPhone(data.phone || "");
    setStatus(data.status || "active");

    setLoading(false);
  }

  async function saveAd() {
    if (!title.trim()) {
      alert("Title is required.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("ads")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        location: location.trim() || null,
        phone: phone.trim() || null,
        status,
      })
      .eq("id", adId);

    setSaving(false);

    if (error) {
      alert("Failed to update ad: " + error.message);
      return;
    }

    router.push(`/ads/${adId}`);
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
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link href={`/ads/${adId}`} className="text-sm font-bold text-gray-600">
            ← Back
          </Link>

          <h1 className="text-xl font-black text-[#172033]">Edit Ad</h1>

          <div className="w-12" />
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
              Location
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm font-bold"
            />
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
    </main>
  );
}