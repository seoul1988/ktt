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

type BusinessCategoryObject = {
  name?: unknown;
  category?: unknown;
  category_name?: unknown;
  [key: string]: unknown;
};

type BusinessRow = {
  id: number | string;
  category?: unknown;
  category_name?: unknown;
  categories?: unknown;
};

function normalizeCategory(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLowerCase();
}

function isSameCategory(value: unknown, categoryName: string) {
  return (
    normalizeCategory(value) === normalizeCategory(categoryName)
  );
}

function hasCategory(
  value: unknown,
  categoryName: string,
): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => {
      if (typeof item === "string") {
        return isSameCategory(item, categoryName);
      }

      if (item && typeof item === "object") {
        const categoryObject =
          item as BusinessCategoryObject;

        return (
          isSameCategory(
            categoryObject.name,
            categoryName,
          ) ||
          isSameCategory(
            categoryObject.category,
            categoryName,
          ) ||
          isSameCategory(
            categoryObject.category_name,
            categoryName,
          )
        );
      }

      return false;
    });
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .some((item) =>
        isSameCategory(item, categoryName),
      );
  }

  return false;
}

function replaceCategoryValue(
  value: unknown,
  oldName: string,
  newName: string,
): unknown {
  /*
   * 배열 형식
   *
   * ["Chicken", "Noodles", "Sushi", "Restaurant"]
   *
   * 또는
   *
   * [
   *   { name: "Chicken" },
   *   { name: "Sushi" }
   * ]
   */
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") {
        return isSameCategory(item, oldName)
          ? newName
          : item;
      }

      if (item && typeof item === "object") {
        const categoryObject =
          item as BusinessCategoryObject;

        const updatedObject: BusinessCategoryObject = {
          ...categoryObject,
        };

        if (
          isSameCategory(
            categoryObject.name,
            oldName,
          )
        ) {
          updatedObject.name = newName;
        }

        if (
          isSameCategory(
            categoryObject.category,
            oldName,
          )
        ) {
          updatedObject.category = newName;
        }

        if (
          isSameCategory(
            categoryObject.category_name,
            oldName,
          )
        ) {
          updatedObject.category_name = newName;
        }

        return updatedObject;
      }

      return item;
    });
  }

  /*
   * 쉼표 문자열 형식
   *
   * "Chicken, Noodles, Sushi, Restaurant"
   *
   * Sushi만 BBQ로 변경:
   *
   * "Chicken, Noodles, BBQ, Restaurant"
   */
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => {
        const trimmedItem = item.trim();

        if (isSameCategory(trimmedItem, oldName)) {
          return newName;
        }

        return trimmedItem;
      })
      .filter(Boolean)
      .join(", ");
  }

  return value;
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
  const [showOnMainMap, setShowOnMainMap] =
    useState(true);
  const [
    showOnCommunityMap,
    setShowOnCommunityMap,
  ] = useState(false);

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

      const {
        data: profile,
        error: profileError,
      } = await supabase
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
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("businesses")
        .select(
          "id,category,category_name,categories",
        )
        .range(from, from + pageSize - 1);

      if (error) {
        throw new Error(
          `Failed to load businesses: ${error.message}`,
        );
      }

      const rows = (data ?? []) as BusinessRow[];

      allBusinesses.push(...rows);

      if (rows.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    }

    return allBusinesses;
  }

  async function updateBusinessCategories(
    oldCategoryName: string,
    newCategoryName: string,
  ) {
    if (
      !oldCategoryName.trim() ||
      isSameCategory(
        oldCategoryName,
        newCategoryName,
      )
    ) {
      return 0;
    }

    const businesses = await loadAllBusinesses();

    const businessesToUpdate =
      businesses.filter((business) => {
        return (
          hasCategory(
            business.category,
            oldCategoryName,
          ) ||
          hasCategory(
            business.category_name,
            oldCategoryName,
          ) ||
          hasCategory(
            business.categories,
            oldCategoryName,
          )
        );
      });

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
          const updateData: Record<
            string,
            unknown
          > = {};

          if (
            hasCategory(
              business.category,
              oldCategoryName,
            )
          ) {
            updateData.category =
              replaceCategoryValue(
                business.category,
                oldCategoryName,
                newCategoryName,
              );
          }

          if (
            hasCategory(
              business.category_name,
              oldCategoryName,
            )
          ) {
            updateData.category_name =
              replaceCategoryValue(
                business.category_name,
                oldCategoryName,
                newCategoryName,
              );
          }

          if (
            hasCategory(
              business.categories,
              oldCategoryName,
            )
          ) {
            updateData.categories =
              replaceCategoryValue(
                business.categories,
                oldCategoryName,
                newCategoryName,
              );
          }

          if (
            Object.keys(updateData).length === 0
          ) {
            return {
              success: true,
              updated: false,
            };
          }

          const { error } = await supabase
            .from("businesses")
            .update(updateData)
            .eq("id", business.id);

          if (error) {
            console.error(
              `Business ${business.id} update failed:`,
              error,
            );

            return {
              success: false,
              updated: false,
              error: error.message,
            };
          }

          return {
            success: true,
            updated: true,
          };
        }),
      );

      const failedResults = results.filter(
        (result) => !result.success,
      );

      if (failedResults.length > 0) {
        const firstError =
          failedResults[0]?.error ||
          "Unknown update error.";

        throw new Error(
          `${failedResults.length} business updates failed. ${firstError}`,
        );
      }

      updatedCount += results.filter(
        (result) => result.updated,
      ).length;
    }

    return updatedCount;
  }

  async function saveCategory() {
    const cleanName = name.trim();
    const cleanOriginalName =
      originalName.trim();
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
      cleanOriginalName !== cleanName;

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
       * 카테고리 이름을 먼저 변경합니다.
       */
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

      let updatedBusinessCount = 0;

      /*
       * 이름이 변경됐을 때만 기존 비즈니스를 변경합니다.
       */
      if (categoryNameChanged) {
        updatedBusinessCount =
          await updateBusinessCategories(
            cleanOriginalName,
            cleanName,
          );
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
        `Update failed.\n\n${message}\n\nThe category may have been updated, but some business records may not have changed. Please check the businesses table and Supabase RLS policies.`,
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
    originalName.trim() !== name.trim();

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
                Existing business categories will
                also be changed.
              </p>

              <p className="mt-1 break-words text-xs font-semibold text-amber-700">
                {originalName || "Old category"} →{" "}
                {name.trim() || "New category"}
              </p>

              <p className="mt-2 text-[11px] leading-5 text-amber-700">
                Example: Chicken, Noodles,{" "}
                {originalName || "Sushi"},
                Restaurant → Chicken, Noodles,{" "}
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