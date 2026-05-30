"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";
import CommunityBottomNav from "../../components/CommunityBottomNav";

type Category = {
  id: number;
  name: string;
  emoji: string | null;
  created_at: string | null;
  show_on_main_map: boolean | null;
  show_on_community_map: boolean | null;
};

export default function AdminCategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
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

    if (profileError) {
      alert(profileError.message);
      window.location.href = "/map";
      return;
    }

    if (profile?.role !== "admin") {
      alert("Admin only.");
      window.location.href = "/map";
      return;
    }

    await loadCategories();
    setLoading(false);
  }

  async function loadCategories() {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.log("Categories load error:", error);
      alert("Categories load error: " + error.message);
      setCategories([]);
      return;
    }

    setCategories((data || []) as Category[]);
  }

  async function addCategory() {
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

    const { error } = await supabase.from("categories").insert({
      name: cleanName,
      emoji: cleanEmoji || null,
      show_on_main_map: showOnMainMap,
      show_on_community_map: showOnCommunityMap,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setEmoji("");
    setShowOnMainMap(true);
    setShowOnCommunityMap(false);
    await loadCategories();
  }

  async function updateCategoryVisibility(
    category: Category,
    field: "show_on_main_map" | "show_on_community_map",
    value: boolean
  ) {
    const nextCategory = {
      ...category,
      [field]: value,
    };

    setCategories((prev) =>
      prev.map((item) => (item.id === category.id ? nextCategory : item))
    );

    const { error } = await supabase
      .from("categories")
      .update({
        [field]: value,
      })
      .eq("id", category.id);

    if (error) {
      alert(error.message);
      await loadCategories();
    }
  }

  async function deleteCategory(category: Category) {
    const ok = window.confirm(`Delete "${category.name}" category?`);
    if (!ok) return;

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadCategories();
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
                window.location.href = "/admin";
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
            >
              ← Back
            </button>

            <h1 className="text-3xl font-black">Categories</h1>
          </div>

          <ProfileButton />
        </div>

        <div className="rounded-[32px] bg-white p-5 shadow-2xl">
          <h2 className="text-lg font-black">Add Category</h2>

          <div className="mt-4 flex gap-2">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="🍜"
              maxLength={4}
              className="w-20 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-xl outline-none"
            />

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Noodles"
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
            onClick={addCategory}
            disabled={saving}
            className="mt-4 w-full rounded-2xl bg-[#172033] py-3 font-extrabold text-white disabled:opacity-60"
          >
            {saving ? "Adding..." : "Add Category"}
          </button>
        </div>

        <div className="mt-5">
          {categories.length === 0 && (
            <div className="rounded-3xl bg-white p-5 font-bold shadow">
              No categories yet.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {categories.map((category) => {
              const checkedMain = category.show_on_main_map !== false;
              const checkedCommunity = category.show_on_community_map === true;

              return (
                <div
                  key={category.id}
                  className="rounded-2xl bg-white p-4 shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-xl">
                        {category.emoji || "🏷️"}
                      </span>

                      <div className="min-w-0">
                        <div className="truncate font-bold">{category.name}</div>
                        <div className="mt-1 text-[10px] font-bold text-gray-500">
                          {checkedMain && "📍 Main"}
                          {checkedMain && checkedCommunity && " • "}
                          {checkedCommunity && "👥 Community"}
                          {!checkedMain && !checkedCommunity && "Hidden"}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteCategory(category)}
                      className="shrink-0 rounded-full bg-red-500 px-2 py-1 text-[11px] font-bold text-white"
                    >
                      삭제
                    </button>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] font-extrabold">
                      <input
                        type="checkbox"
                        checked={checkedMain}
                        onChange={(e) =>
                          updateCategoryVisibility(
                            category,
                            "show_on_main_map",
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 accent-[#172033]"
                      />
                      Main
                    </label>

                    <label className="flex cursor-pointer items-center gap-2 text-[11px] font-extrabold">
                      <input
                        type="checkbox"
                        checked={checkedCommunity}
                        onChange={(e) =>
                          updateCategoryVisibility(
                            category,
                            "show_on_community_map",
                            e.target.checked
                          )
                        }
                        className="h-4 w-4 accent-[#172033]"
                      />
                      Community
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <CommunityBottomNav />
    </main>
  );
}
