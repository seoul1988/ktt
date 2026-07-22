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

type BusinessRow = {
  id: number | string;
  category: string | null;
};

function normalizeCategory(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLowerCase();
}

function splitCategoryItems(value: unknown) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasCategory(value: unknown, categoryName: string) {
  const normalizedTarget = normalizeCategory(categoryName);

  return splitCategoryItems(value).some(
    (item) => normalizeCategory(item) === normalizedTarget,
  );
}

function replaceCategoryItem(
  value: unknown,
  oldName: string,
  newName: string,
) {
  const normalizedOldName = normalizeCategory(oldName);

  const replacedItems = splitCategoryItems(value).map((item) =>
    normalizeCategory(item) === normalizedOldName
      ? newName.trim()
      : item,
  );

  /*
   * 카테고리 변경 후 같은 이름이 중복될 수 있으므로,
   * 원래 순서를 유지하면서 중복을 제거합니다.
   *
   * 예:
   * "패션, 잡화"에서 "패션"을 "잡화"로 변경
   * → "잡화, 잡화"
   * → 최종 "잡화"
   */
  const seen = new Set<string>();

  const uniqueItems = replacedItems.filter((item) => {
    const key = normalizeCategory(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  return uniqueItems.join(", ");
}

export default function EditCategoryPage() {
  const params = useParams();

  const rawCategoryId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const categoryId = Number(rawCategoryId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [showOnMainMap, setShowOnMainMap] = useState(true);
  const [showOnCommunityMap, setShowOnCommunityMap] =
    useState(false);

  useEffect(() => {
    void checkAdminAndLoad();
  }, [categoryId]);

  async function checkAdminAndLoad() {
    setLoading(true);

    try {
      if (
        !Number.isFinite(categoryId) ||
        categoryId <= 0
      ) {
        alert("Invalid category ID.");
        window.location.href = "/admin/categories";
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      if (
        profileError ||
        profile?.role !== "admin"
      ) {
        alert("Admin only.");
        window.location.href = "/map";
        return;
      }

      await loadCategory();
    } finally {
      setLoading(false);
    }
  }

  async function loadCategory() {
    const { data, error } = await supabase
      .from("categories")
      .select(
        "id,name,emoji,show_on_main_map,show_on_community_map",
      )
      .eq("id", categoryId)
      .maybeSingle();

    if (error || !data) {
      console.error("Category load error:", error);
      alert("Category not found.");
      window.location.href = "/admin/categories";
      return;
    }

    const category = data as Category;
    const loadedName = category.name || "";

    setName(loadedName);
    setOriginalName(loadedName);
    setEmoji(category.emoji || "");
    setShowOnMainMap(
      category.show_on_main_map !== false,
    );
    setShowOnCommunityMap(
      category.show_on_community_map === true,
    );
  }

  async function loadAllBusinesses() {
    const allBusinesses: BusinessRow[] = [];
    const pageSize = 500;

    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("businesses")
        .select("id,category")
        .range(from, from + pageSize - 1);

      if (error) {
        throw new Error(
          `Failed to load businesses: ${error.message}`,
        );
      }

      const rows = (data ?? []) as BusinessRow[];

      allBusinesses.push(...rows);

      if (rows.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return allBusinesses;
  }

  async function updateBusinessCategories(
    oldCategoryName: string,
    newCategoryName: string,
  ) {
    if (
      !oldCategoryName.trim() ||
      normalizeCategory(oldCategoryName) ===
        normalizeCategory(newCategoryName)
    ) {
      return 0;
    }

    const businesses = await loadAllBusinesses();

    const businessesToUpdate = businesses.filter(
      (business) =>
        hasCategory(
          business.category,
          oldCategoryName,
        ),
    );

    let updatedCount = 0;
    const batchSize = 20;

    for (
      let index = 0;
      index < businessesToUpdate.length;
      index += batchSize
    ) {
      const batch = businessesToUpdate.slice(
        index,
        index + batchSize,
      );

      const results = await Promise.all(
        batch.map(async (business) => {
          const nextCategory = replaceCategoryItem(
            business.category,
            oldCategoryName,
            newCategoryName,
          );

          const { error } = await supabase
            .from("businesses")
            .update({
              category: nextCategory,
            })
            .eq("id", business.id);

          if (error) {
            console.error(
              `Business ${business.id} update failed:`,
              error,
            );

            return {
              success: false,
              error: error.message,
            };
          }

          return {
            success: true,
          };
        }),
      );

      const failedResults = results.filter(
        (result) => !result.success,
      );

      if (failedResults.length > 0) {
        const firstError =
          failedResults[0]?.error ||
          "Unknown business update error.";

        throw new Error(
          `${failedResults.length} business updates failed. ${firstError}`,
        );
      }

      updatedCount += results.length;
    }

    return updatedCount;
  }

  async function saveCategory() {
    const cleanName = name.trim();
    const cleanOriginalName = originalName.trim();
    const cleanEmoji = emoji.trim();

    if (!cleanName) {
      alert("Please enter category name.");
      return;
    }

    if (!showOnMainMap && !showOnCommunityMap) {
      const ok = window.confirm(
        "Both maps are unchecked. This category will not show on any map. Continue?",
      );

      if (!ok) {
        return;
      }
    }

    const categoryNameChanged =
      normalizeCategory(cleanOriginalName) !==
      normalizeCategory(cleanName);

    if (categoryNameChanged) {
      const ok = window.confirm(
        `"${cleanOriginalName}" will be changed to "${cleanName}".\n\nAll businesses using this category will also be updated.\n\nContinue?`,
      );

      if (!ok) {
        return;
      }
    }

    setSaving(true);

    try {
      /*
       * 먼저 기존 비즈니스의 category 값을 변경합니다.
       *
       * 이렇게 하면 비즈니스 변경이 실패했는데 categories 테이블만
       * 먼저 바뀌는 불일치를 줄일 수 있습니다.
       */
      let updatedBusinessCount = 0;

      if (categoryNameChanged) {
        updatedBusinessCount =
          await updateBusinessCategories(
            cleanOriginalName,
            cleanName,
          );
      }

      const { error: categoryError } =
        await supabase
          .from("categories")
          .update({
            name: cleanName,
            emoji: cleanEmoji || null,
            show_on_main_map: showOnMainMap,
            show_on_community_map:
              showOnCommunityMap,
          })
          .eq("id", categoryId);

      if (categoryError) {
        throw new Error(categoryError.message);
      }

      setOriginalName(cleanName);

      if (categoryNameChanged) {
        alert(
          `Category updated.\n\n${updatedBusinessCount} businesses were updated from "${cleanOriginalName}" to "${cleanName}".`,
        );
      } else {
        alert("Category updated.");
      }

      window.location.href = "/admin/categories";
    } catch (error) {
      console.error(
        "Category update failed:",
        error,
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error occurred.";

      alert(
        `Update failed.\n\n${message}\n\nPlease check the businesses.category column and Supabase RLS policies.`,
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC] text-[#172033]">
        <p className="font-bold">Loading...</p>
      </main>
    );
  }

  const categoryNameChanged =
    normalizeCategory(originalName) !==
    normalizeCategory(name);

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-5 py-8 pb-28 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => {
                window.location.href =
                  "/admin/categories";
              }}
              disabled={saving}
              className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold shadow disabled:opacity-50"
            >
              ← Back
            </button>

            <h1 className="truncate text-3xl font-black">
              Edit Category
            </h1>
          </div>

          <ProfileButton />
        </div>

        <div className="rounded-[32px] bg-white p-5 shadow-2xl">
          <h2 className="text-lg font-black">
            Category Info
          </h2>

          <div className="mt-4 flex gap-2">
            <input
              value={emoji}
              onChange={(event) =>
                setEmoji(event.target.value)
              }
              placeholder="🏥"
              maxLength={4}
              disabled={saving}
              className="w-20 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-xl outline-none focus:border-[#172033] disabled:opacity-60"
            />

            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Health & Wellness"
              disabled={saving}
              className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-[#172033] disabled:opacity-60"
            />
          </div>

          {categoryNameChanged && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-extrabold text-amber-900">
                Existing business categories will also
                be changed.
              </p>

              <p className="mt-1 break-words text-xs font-semibold text-amber-700">
                {originalName || "Old category"} →{" "}
                {name.trim() || "New category"}
              </p>

              <p className="mt-2 text-[11px] leading-5 text-amber-700">
                Example: Chicken, Noodles,{" "}
                {originalName || "Sushi"}, Restaurant
                → Chicken, Noodles,{" "}
                {name.trim() || "BBQ"}, Restaurant
              </p>
            </div>
          )}

          <div className="mt-4 rounded-2xl bg-gray-50 p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wide text-gray-500">
              Show this category on
            </p>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-extrabold">
                <input
                  type="checkbox"
                  checked={showOnMainMap}
                  disabled={saving}
                  onChange={(event) =>
                    setShowOnMainMap(
                      event.target.checked,
                    )
                  }
                  className="h-5 w-5 accent-[#172033] disabled:opacity-60"
                />

                <span>Main App Map</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 text-sm font-extrabold">
                <input
                  type="checkbox"
                  checked={showOnCommunityMap}
                  disabled={saving}
                  onChange={(event) =>
                    setShowOnCommunityMap(
                      event.target.checked,
                    )
                  }
                  className="h-5 w-5 accent-[#172033] disabled:opacity-60"
                />

                <span>Community Map</span>
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void saveCategory();
            }}
            disabled={saving}
            className="mt-5 w-full rounded-2xl bg-[#172033] py-3 font-extrabold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Updating Category & Businesses..."
              : "Save Changes"}
          </button>
        </div>
      </div>

      <CommunityBottomNav />
    </main>
  );
}