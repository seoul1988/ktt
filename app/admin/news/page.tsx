"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type NewsItem = {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  source_url: string | null;
  published: boolean;
  published_at: string;
};

const emptyForm = {
  title: "",
  summary: "",
  content: "",
  category: "Local",
  image_url: "",
  source_url: "",
  published: true,
  published_at: new Date().toISOString().slice(0, 16),
};

export default function AdminBusinessNewsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadItems() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      alert("관리자만 이용할 수 있습니다.");
      router.push("/");
      return;
    }

    const { data, error } = await supabase
      .from("business_news")
      .select("*")
      .order("published_at", { ascending: false });

    if (error) {
      console.error("News admin load error:", error);
      alert(error.message);
    } else {
      setItems((data ?? []) as NewsItem[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadItems();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      published_at: new Date().toISOString().slice(0, 16),
    });
  }

  function startEdit(item: NewsItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      summary: item.summary || "",
      content: item.content || "",
      category: item.category,
      image_url: item.image_url || "",
      source_url: item.source_url || "",
      published: item.published,
      published_at: new Date(item.published_at).toISOString().slice(0, 16),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!form.title.trim()) {
      alert("제목을 입력하세요.");
      return;
    }

    setSaving(true);

    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      content: form.content.trim(),
      category: form.category,
      image_url: form.image_url.trim() || null,
      source_url: form.source_url.trim() || null,
      published: form.published,
      published_at: new Date(form.published_at).toISOString(),
    };

    const result = editingId
      ? await supabase
          .from("business_news")
          .update(payload)
          .eq("id", editingId)
      : await supabase.from("business_news").insert(payload);

    setSaving(false);

    if (result.error) {
      console.error("News save error:", result.error);
      alert(result.error.message);
      return;
    }

    resetForm();
    await loadItems();
  }

  async function deleteItem(id: number) {
    if (!window.confirm("이 뉴스를 삭제하시겠습니까?")) return;

    const { error } = await supabase
      .from("business_news")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    if (editingId === id) resetForm();
    await loadItems();
  }

  return (
    <main className="min-h-screen bg-[#F7F7F7] px-3 py-4 text-[#172033]">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold">Business News 관리</h1>
            <p className="mt-1 text-xs text-gray-500">
              가장 최근 게시일의 뉴스가 Featured로 자동 표시됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border bg-white px-3 py-2 text-sm font-bold"
          >
            Back
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <h2 className="mb-3 text-base font-extrabold">
            {editingId ? "뉴스 수정" : "새 뉴스 등록"}
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-bold">제목 *</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="h-11 w-full rounded-xl border px-3"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold">카테고리</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="h-11 w-full rounded-xl border px-3"
              >
                  <option>Local Business News</option>
                <option>Chamber News</option>
              </select>
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold">게시일</span>
              <input
                type="datetime-local"
                value={form.published_at}
                onChange={(e) =>
                  setForm({ ...form, published_at: e.target.value })
                }
                className="h-11 w-full rounded-xl border px-3"
              />
            </label>

            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-bold">요약</span>
              <textarea
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                rows={3}
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>

            <label className="md:col-span-2">
              <span className="mb-1 block text-xs font-bold">본문</span>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={7}
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold">이미지 URL</span>
              <input
                value={form.image_url}
                onChange={(e) =>
                  setForm({ ...form, image_url: e.target.value })
                }
                placeholder="https://..."
                className="h-11 w-full rounded-xl border px-3"
              />
            </label>

            <label>
              <span className="mb-1 block text-xs font-bold">원문 링크</span>
              <input
                value={form.source_url}
                onChange={(e) =>
                  setForm({ ...form, source_url: e.target.value })
                }
                placeholder="https://..."
                className="h-11 w-full rounded-xl border px-3"
              />
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) =>
                  setForm({ ...form, published: e.target.checked })
                }
                className="h-4 w-4"
              />
              <span className="text-sm font-bold">공개</span>
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#172033] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
            >
              {saving ? "저장 중..." : editingId ? "수정 저장" : "뉴스 등록"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border px-5 py-2.5 text-sm font-bold"
              >
                취소
              </button>
            )}
          </div>
        </form>

        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="font-extrabold">등록된 뉴스</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              불러오는 중...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs">
                  <tr>
                    <th className="px-3 py-3">ID</th>
                    <th className="px-3 py-3">제목</th>
                    <th className="px-3 py-3">카테고리</th>
                    <th className="px-3 py-3">게시일</th>
                    <th className="px-3 py-3">상태</th>
                    <th className="px-3 py-3">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-3">{item.id}</td>
                      <td className="max-w-[360px] px-3 py-3 font-bold">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-2">{item.title}</span>
                          {index === 0 && item.published && (
                            <span className="shrink-0 rounded-full bg-[#F7A928] px-2 py-0.5 text-[9px] font-extrabold">
                              LATEST
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">{item.category}</td>
                      <td className="px-3 py-3">
                        {new Date(item.published_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        {item.published ? "공개" : "비공개"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteItem(item.id)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                        등록된 뉴스가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
