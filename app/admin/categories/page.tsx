"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Category = {
  id: number;
  name: string;
  emoji: string | null;
  created_at: string | null;
};

export default function AdminCategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");

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

    setSaving(true);

    const { error } = await supabase.from("categories").insert({
      name: cleanName,
      emoji: cleanEmoji || null,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setEmoji("");
    await loadCategories();
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
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 text-[#172033]">
      <div className="mx-auto max-w-md">
        <button
          onClick={() => {
            window.location.href = "/map";
          }}
          className="mb-5 rounded-full bg-white px-4 py-2 text-sm font-bold shadow"
        >
          ← Back
        </button>

        <h1 className="mb-6 text-3xl font-black">Categories</h1>

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
			{categories.map((category) => (
			  <div
				key={category.id}
				className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow"
			  >
				<div className="flex min-w-0 items-center gap-2">
				  <span className="text-xl shrink-0">
					{category.emoji || "🏷️"}
				  </span>

				  <span className="truncate font-bold">
					{category.name}
				  </span>
				</div>

				<button
				  onClick={() => deleteCategory(category)}
				  className="
					ml-2
					shrink-0
					rounded-full
					bg-red-500
					px-2
					py-1
					text-[11px]
					font-bold
					text-white
				  "
				>
				  삭제
				</button>
			  </div>
			))}
		  </div>
</div>
      </div>
    </main>
  );
}