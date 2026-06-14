"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import ProfileButton from "../../../../components/ProfileButton";
import CommunityBottomNav from "../../../../components/CommunityBottomNav";

export const dynamic = "force-dynamic";

type Category = {
  id: number;
  name: string;
  emoji: string | null;
  show_on_main_map: boolean | null;
  show_on_community_map: boolean | null;
};

export default function EditCategoryPage() {
  const params = useParams();
  const categoryId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [showOnMainMap, setShowOnMainMap] = useState(true);
  const [showOnCommunityMap, setShowOnCommunityMap] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  async function checkAdminAndLoad() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "admin") {
      alert("Admin only.");
      window.location.href = "/map";
      return;
    }

    await loadCategory();
    setLoading(false);
  }

  async function loadCategory() {
    const { data, error } = await supabase
      .from("categories")
      .select("id,name,emoji,show_on_main_map,show_on_community_map")
      .eq("id", categoryId)
      .maybeSingle();

    if (error || !data) {
      alert("Category not found.");
      window.location.href = "/admin/categories";
      return;
    }

    const category = data as Category;

    setName(category.name || "");
    setEmoji(category.emoji || "");
    setShowOnMainMap(category.show_on_main_map !== false);
    setShowOnCommunityMap(category.show_on_community_map === true);
  }

  async function saveCategory() {
    const cleanName = name.trim();
    const cleanEmoji = emoji.trim();

    if (!cleanName) {
      alert("Please enter category name.");
      return;
    }

    if (!showOnMainMap && !showOnCommunityMap) {
      const ok = window.confirm(
        "Both maps are unchecked. This category will not show on any map. Continue?"
      );
      if (!ok) return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("categories")
      .update({
        name: cleanName,
        emoji: cleanEmoji || null,
        show_on_main_map: showOnMainMap,
        show_on_community_map: showOnCommunityMap,
      })
      .eq("id", categoryId);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Category updated.");
    window.location.href = "/admin/categories";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] text-[#172033]">
        <p className="font-bold">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 pb-28 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                window.location.href = "/admin/categories";
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
            >
              ← Back
            </button>

            <h1 className="text-3xl font-black">Edit Category</h1>
          </div>

          <ProfileButton />
        </div>

        <div className="rounded-[32px] bg-white p-5 shadow-2xl">
          <h2 className="text-lg font-black">Category Info</h2>

          <div className="mt-4 flex gap-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🏥"
              maxLength={4}
              className="w-20 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-xl outline-none"
            />

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Health & Wellness"
              className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none"
            />
          </div>

          <div className="mt-4 rounded-2xl bg-gray-50 p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-gray-500">
              Show this category on
            </p>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-extrabold">
                <input
                  type="checkbox"
                  checked={showOnMainMap}
                  onChange={(e) => setShowOnMainMap(e.target.checked)}
                  className="h-5 w-5 accent-[#172033]"
                />
                <span>Main App Map</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 text-sm font-extrabold">
                <input
                  type="checkbox"
                  checked={showOnCommunityMap}
                  onChange={(e) => setShowOnCommunityMap(e.target.checked)}
                  className="h-5 w-5 accent-[#172033]"
                />
                <span>Community Map</span>
              </label>
            </div>
          </div>

          <button
            onClick={saveCategory}
            disabled={saving}
            className="mt-5 w-full rounded-2xl bg-[#172033] py-3 font-extrabold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <CommunityBottomNav />
    </main>
  );
}