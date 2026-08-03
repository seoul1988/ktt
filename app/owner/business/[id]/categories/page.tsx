"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Category = {
  id: number;
  name: string;
  display_order: number | null;
  is_active: boolean | null;
};

type ApiResponse = {
  business?: {
    id: number;
    name: string | null;
  };
  categories?: Category[];
  category?: Category;
  error?: string;
};

export default function CategoryManagementPage() {
  const params = useParams<{ id: string }>();
  const businessId = Number(params.id);

  const [businessName, setBusinessName] = useState("Business");
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function getToken() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("로그인이 필요합니다.");
    }

    return session.access_token;
  }

  async function request(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ) {
    const token = await getToken();

    const response = await fetch(
      `/api/owner/business/${businessId}/categories`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      },
    );

    const data = (await response.json()) as ApiResponse;

    if (!response.ok) {
      throw new Error(
        data.error || "요청을 처리하지 못했습니다.",
      );
    }

    return data;
  }

  async function loadCategories() {
    setLoading(true);
    setMessage("");

    try {
      if (
        !Number.isInteger(businessId) ||
        businessId <= 0
      ) {
        throw new Error("잘못된 비즈니스 ID입니다.");
      }

      const data = await request("GET");

      setBusinessName(
        data.business?.name || `Business #${businessId}`,
      );

      setCategories(data.categories || []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "카테고리를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const orderA = a.display_order ?? 999;
      const orderB = b.display_order ?? 999;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  function updateCategory(
    id: number,
    patch: Partial<Category>,
  ) {
    setCategories((current) =>
      current.map((category) =>
        category.id === id
          ? { ...category, ...patch }
          : category,
      ),
    );

    setMessage("");
  }

  async function createCategory() {
    const name = newCategoryName.trim();

    if (!name) {
      alert("카테고리 이름을 입력하세요.");
      return;
    }

    setCreating(true);
    setMessage("");

    try {
      const data = await request("POST", { name });

      if (!data.category) {
        throw new Error(
          "추가된 카테고리 정보를 받지 못했습니다.",
        );
      }

      setCategories((current) => [
        ...current,
        data.category as Category,
      ]);

      setNewCategoryName("");
      setMessage("✓ 카테고리를 추가했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "카테고리 추가 실패",
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveCategory(category: Category) {
    const name = category.name.trim();

    if (!name) {
      alert("카테고리 이름은 비워둘 수 없습니다.");
      return;
    }

    setSavingId(category.id);
    setMessage("");

    try {
      const data = await request("PATCH", {
        id: category.id,
        name,
        display_order: Number(
          category.display_order ?? 999,
        ),
        is_active: category.is_active !== false,
      });

      if (!data.category) {
        throw new Error(
          "저장된 카테고리 정보를 받지 못했습니다.",
        );
      }

      setCategories((current) =>
        current.map((row) =>
          row.id === category.id
            ? (data.category as Category)
            : row,
        ),
      );

      setMessage("✓ 카테고리를 저장했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "카테고리 저장 실패",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function deleteCategory(category: Category) {
    const confirmed = window.confirm(
      `"${category.name}" 카테고리를 삭제할까요?\n\n해당 카테고리에 메뉴가 있으면 삭제되지 않습니다.`,
    );

    if (!confirmed) {
      return;
    }

    setSavingId(category.id);
    setMessage("");

    try {
      await request("DELETE", {
        id: category.id,
      });

      setCategories((current) =>
        current.filter(
          (row) => row.id !== category.id,
        ),
      );

      setMessage("✓ 카테고리를 삭제했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "카테고리 삭제 실패",
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F5F0] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[#E9DED0] bg-white p-6 font-bold shadow-sm">
          카테고리를 불러오는 중...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F5F0] px-4 pb-24 pt-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <Link
            href={`/owner/business/${businessId}/manage`}
            className="text-sm font-black text-[#B64032]"
          >
            ← 비즈니스 사이트 관리
          </Link>

          <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-[#B64032]">
            Business #{businessId}
          </p>

          <h1 className="mt-2 text-3xl font-black text-[#172033]">
            카테고리 관리
          </h1>

          <p className="mt-2 text-sm font-medium text-[#667085]">
            {businessName}의 기존 카테고리를 불러와
            이름, 순서와 노출 상태를 관리합니다.
          </p>
        </header>

        {message && (
          <div
            className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${
              message.startsWith("✓")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <section className="rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#172033]">
            새 카테고리 추가
          </h2>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={newCategoryName}
              onChange={(event) =>
                setNewCategoryName(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void createCategory();
                }
              }}
              placeholder="예: Burgers, Drinks, Lunch"
              className="min-w-0 flex-1 rounded-xl border border-[#D9CFC2] px-4 py-3 text-sm font-bold text-[#172033] outline-none focus:border-[#172033]"
            />

            <button
              type="button"
              onClick={() => void createCategory()}
              disabled={creating}
              className="rounded-xl bg-[#172033] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating
                ? "추가 중..."
                : "+ 카테고리 추가"}
            </button>
          </div>
        </section>

        <section className="mt-5 space-y-3">
          {sortedCategories.length === 0 ? (
            <div className="rounded-3xl border border-[#E9DED0] bg-white p-6 text-center shadow-sm">
              <p className="text-lg font-black text-[#172033]">
                등록된 카테고리가 없습니다.
              </p>

              <p className="mt-2 text-sm font-medium leading-6 text-[#667085]">
                도어대시에서 가져온 카테고리가
                business_menu_categories 테이블에
                저장되어 있어야 이곳에 표시됩니다.
              </p>
            </div>
          ) : (
            sortedCategories.map((category) => (
              <article
                key={category.id}
                className={`rounded-3xl border bg-white p-5 shadow-sm ${
                  category.is_active === false
                    ? "border-gray-300 opacity-70"
                    : "border-[#E9DED0]"
                }`}
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_110px_auto]">
                  <div>
                    <label className="mb-1 block text-xs font-black text-[#667085]">
                      카테고리 이름
                    </label>

                    <input
                      value={category.name}
                      onChange={(event) =>
                        updateCategory(category.id, {
                          name: event.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-[#D9CFC2] px-4 py-3 text-sm font-black text-[#172033] outline-none focus:border-[#172033]"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-black text-[#667085]">
                      노출 순서
                    </label>

                    <input
                      type="number"
                      value={
                        category.display_order ?? 999
                      }
                      onChange={(event) =>
                        updateCategory(category.id, {
                          display_order: Number(
                            event.target.value,
                          ),
                        })
                      }
                      className="w-full rounded-xl border border-[#D9CFC2] px-3 py-3 text-center text-sm font-black text-[#172033] outline-none focus:border-[#172033]"
                    />
                  </div>

                  <label className="flex items-end">
                    <span className="flex h-[46px] items-center gap-2 rounded-xl bg-[#F8F5F0] px-4 text-sm font-black text-[#172033]">
                      <input
                        type="checkbox"
                        checked={
                          category.is_active !== false
                        }
                        onChange={(event) =>
                          updateCategory(category.id, {
                            is_active:
                              event.target.checked,
                          })
                        }
                        className="h-4 w-4 accent-green-600"
                      />
                      노출
                    </span>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void saveCategory(category)
                    }
                    disabled={
                      savingId === category.id
                    }
                    className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingId === category.id
                      ? "처리 중..."
                      : "저장"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void deleteCategory(category)
                    }
                    disabled={
                      savingId === category.id
                    }
                    className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
