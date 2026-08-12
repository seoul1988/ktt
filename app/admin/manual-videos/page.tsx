"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type ManualVideo = {
  id: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  youtube_url: string;
  display_order: number;
  active: boolean;
};

type FormState = {
  title: string;
  subtitle: string;
  description: string;
  youtube_url: string;
  display_order: string;
  active: boolean;
};

const emptyForm: FormState = {
  title: "",
  subtitle: "",
  description: "",
  youtube_url: "",
  display_order: "0",
  active: true,
};

export default function AdminManualVideosPage() {
  const [videos, setVideos] = useState<ManualVideo[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const loadVideos = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("manual_videos")
      .select("*")
      .order("display_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      setMessage(`불러오기 실패: ${error.message}`);
      setVideos([]);
    } else {
      setVideos((data || []) as ManualVideo[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  function startEdit(video: ManualVideo) {
    setEditingId(video.id);
    setForm({
      title: video.title || "",
      subtitle: video.subtitle || "",
      description: video.description || "",
      youtube_url: video.youtube_url || "",
      display_order: String(video.display_order ?? 0),
      active: video.active !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!form.title.trim()) {
      setMessage("제목을 입력해주세요.");
      return;
    }

    if (!form.youtube_url.trim()) {
      setMessage("YouTube 링크를 입력해주세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      description: form.description.trim() || null,
      youtube_url: form.youtube_url.trim(),
      display_order: Number(form.display_order || 0),
      active: form.active,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase.from("manual_videos").update(payload).eq("id", editingId)
      : await supabase.from("manual_videos").insert(payload);

    if (result.error) {
      setMessage(`저장 실패: ${result.error.message}`);
      setSaving(false);
      return;
    }

    setMessage(editingId ? "수정되었습니다." : "등록되었습니다.");
    setEditingId(null);
    setForm(emptyForm);
    await loadVideos();
    setSaving(false);
  }

  async function deleteVideo(id: number) {
    if (!window.confirm("이 매뉴얼 영상을 삭제할까요?")) return;

    const { error } = await supabase
      .from("manual_videos")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(`삭제 실패: ${error.message}`);
      return;
    }

    setMessage("삭제되었습니다.");
    await loadVideos();
  }

  async function toggleActive(video: ManualVideo) {
    const { error } = await supabase
      .from("manual_videos")
      .update({
        active: !video.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", video.id);

    if (error) {
      setMessage(`상태 변경 실패: ${error.message}`);
      return;
    }

    await loadVideos();
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-[#172033]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
            Admin
          </p>
          <h1 className="mt-1 text-3xl font-black">이용 매뉴얼 관리</h1>
          <p className="mt-2 text-sm text-gray-500">
            YouTube 링크를 등록하면 이용 매뉴얼 페이지에 자동으로 표시됩니다.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-extrabold">제목 *</span>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="예: 회원가입 방법"
                className="rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-extrabold">영문/부제목</span>
              <input
                value={form.subtitle}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, subtitle: e.target.value }))
                }
                placeholder="예: Sign Up"
                className="rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-extrabold">YouTube 링크 *</span>
              <input
                value={form.youtube_url}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, youtube_url: e.target.value }))
                }
                placeholder="https://youtu.be/..."
                className="rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-extrabold">설명</span>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
                placeholder="영상에 대한 간단한 설명"
                className="rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-extrabold">표시 순서</span>
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      display_order: e.target.value,
                    }))
                  }
                  className="rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="flex items-end gap-2 pb-3 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      active: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                공개
              </label>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold">
              {message}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#172033] px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {saving
                ? "저장 중..."
                : editingId
                  ? "수정 저장"
                  : "영상 등록"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-black"
              >
                취소
              </button>
            )}
          </div>
        </form>

        <section className="mt-6">
          <h2 className="mb-3 text-lg font-black">등록된 매뉴얼</h2>

          {loading ? (
            <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400">
              불러오는 중...
            </div>
          ) : (
            <div className="space-y-3">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black">
                          순서 {video.display_order}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-black ${
                            video.active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {video.active ? "공개" : "숨김"}
                        </span>
                      </div>

                      <h3 className="mt-2 font-black">{video.title}</h3>
                      {video.subtitle && (
                        <p className="mt-1 text-xs font-bold text-gray-500">
                          {video.subtitle}
                        </p>
                      )}
                      <p className="mt-2 break-all text-xs text-blue-600">
                        {video.youtube_url}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(video)}
                      className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-black"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(video)}
                      className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-black"
                    >
                      {video.active ? "숨기기" : "공개"}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVideo(video.id)}
                      className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}

              {videos.length === 0 && (
                <div className="rounded-2xl bg-white p-6 text-center text-sm font-bold text-gray-400">
                  아직 등록된 영상이 없습니다.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}