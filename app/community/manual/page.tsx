"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import CommunityBottomNav from "../../components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
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

function getYoutubeEmbedUrl(url: string) {
  const value = String(url || "").trim();
  if (!value) return "";

  try {
    const parsed = new URL(value);

    if (parsed.hostname === "youtu.be") {
      const id = parsed.pathname.replace(/^\/+/, "").split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }

    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtube-nocookie.com")
    ) {
      if (parsed.pathname.startsWith("/shorts/")) {
        const id = parsed.pathname.split("/shorts/")[1]?.split("/")[0];
        return id ? `https://www.youtube.com/embed/${id}` : "";
      }

      if (parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.split("/embed/")[1]?.split("/")[0];
        return id ? `https://www.youtube.com/embed/${id}` : "";
      }

      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : "";
    }
  } catch {
    return "";
  }

  return "";
}

export default function CommunityManualPage() {
  const router = useRouter();

  const [videos, setVideos] = useState<ManualVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [showAdminEditor, setShowAdminEditor] = useState(false);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const checkAdmin = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setAdminChecked(true);
        return false;
      }

      // 1) 먼저 로그인 사용자 metadata의 관리자 role을 확인합니다.
      const metadataRole = String(
        user.app_metadata?.role ?? user.user_metadata?.role ?? ""
      )
        .trim()
        .toLowerCase();

      if (
        metadataRole === "admin" ||
        metadataRole === "administrator" ||
        metadataRole === "super_admin" ||
        metadataRole === "superadmin"
      ) {
        setIsAdmin(true);
        setAdminChecked(true);
        return true;
      }

      // 2) 이 프로젝트에서 실제 사용하는 profiles.role을 확인합니다.
      // is_admin 컬럼이 없는 프로젝트에서도 오류가 나지 않도록 role만 조회합니다.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Admin profile check error:", profileError.message);
      }

      const role = String(profile?.role || "")
        .trim()
        .toLowerCase();

      const admin =
        role === "admin" ||
        role === "administrator" ||
        role === "super_admin" ||
        role === "superadmin";

      setIsAdmin(admin);
      setAdminChecked(true);
      return admin;
    } catch (error) {
      console.error("Admin check error:", error);
      setIsAdmin(false);
      setAdminChecked(true);
      return false;
    }
  }, []);

  const loadVideos = useCallback(
    async (adminOverride?: boolean) => {
      setLoading(true);

      const admin =
        typeof adminOverride === "boolean"
          ? adminOverride
          : isAdmin;

      let query = supabase
        .from("manual_videos")
        .select(
          "id, title, subtitle, description, youtube_url, display_order, active",
        )
        .order("display_order", { ascending: true })
        .order("id", { ascending: true });

      if (!admin) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Manual videos load error:", error.message);
        setVideos([]);
      } else {
        setVideos((data || []) as ManualVideo[]);
      }

      setLoading(false);
    },
    [isAdmin],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const admin = await checkAdmin();
      if (cancelled) return;
      await loadVideos(admin);
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [checkAdmin, loadVideos]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
  }

  function startEdit(video: ManualVideo) {
    if (!isAdmin) return;

    setEditingId(video.id);
    setForm({
      title: video.title || "",
      subtitle: video.subtitle || "",
      description: video.description || "",
      youtube_url: video.youtube_url || "",
      display_order: String(video.display_order ?? 0),
      active: video.active !== false,
    });

    setShowAdminEditor(true);
    setMessage("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!isAdmin) {
      setMessage("관리자만 등록할 수 있습니다.");
      return;
    }

    if (!form.title.trim()) {
      setMessage("제목을 입력해주세요.");
      return;
    }

    if (!form.youtube_url.trim()) {
      setMessage("YouTube 링크를 입력해주세요.");
      return;
    }

    if (!getYoutubeEmbedUrl(form.youtube_url)) {
      setMessage("올바른 YouTube 링크를 입력해주세요.");
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
      ? await supabase
          .from("manual_videos")
          .update(payload)
          .eq("id", editingId)
      : await supabase.from("manual_videos").insert(payload);

    if (result.error) {
      setMessage(`저장 실패: ${result.error.message}`);
      setSaving(false);
      return;
    }

    setMessage(editingId ? "수정되었습니다." : "등록되었습니다.");
    setEditingId(null);
    setForm(emptyForm);

    await loadVideos(true);
    setSaving(false);
  }

  async function deleteVideo(id: number) {
    if (!isAdmin) return;
    if (!window.confirm("이 매뉴얼 영상을 삭제할까요?")) return;

    const { error } = await supabase
      .from("manual_videos")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(`삭제 실패: ${error.message}`);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    setMessage("삭제되었습니다.");
    await loadVideos(true);
  }

  async function toggleActive(video: ManualVideo) {
    if (!isAdmin) return;

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

    await loadVideos(true);
  }

  return (
    <main className="min-h-[100dvh] bg-[#F7F7F7] pb-24 text-[#172033]">
      <section className="mx-auto w-full max-w-xl px-4 pt-4">
        <header className="border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="flex h-14 w-full items-center justify-between px-1">
            <button
              type="button"
              onClick={() => router.push("/community/hub")}
              aria-label="Go back"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#172033] transition active:scale-90 active:bg-gray-100"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <div className="text-center">
              <h1 className="text-[15px] font-extrabold leading-none">
                이용 매뉴얼
              </h1>
              <p className="mt-1 text-[9px] font-medium text-gray-500">
                KTown Triangle 사용 방법
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center">
              <ProfileButton />
            </div>
          </div>
        </header>

        <section className="mt-4 overflow-hidden rounded-3xl bg-[#172033] px-5 py-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">
                Video Guide
              </p>
              <h2 className="mt-1 text-[22px] font-black leading-tight">
                동영상 이용 안내
              </h2>
              <p className="mt-2 text-[12px] font-medium leading-relaxed text-slate-300">
                회원가입, 비즈니스 오너 신청, 사이트 관리 방법을
                영상으로 확인하세요.
              </p>
            </div>

            {adminChecked && isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setShowAdminEditor((prev) => !prev);
                  if (showAdminEditor) resetForm();
                }}
                className="shrink-0 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-[#172033] shadow-sm"
              >
                {showAdminEditor ? "관리 닫기" : "＋ 등록/관리"}
              </button>
            )}
          </div>
        </section>

        {isAdmin && showAdminEditor && (
          <section className="mt-4 rounded-3xl border-2 border-blue-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-600">
                  ADMIN
                </p>
                <h2 className="mt-1 text-lg font-black">
                  {editingId ? "매뉴얼 수정" : "매뉴얼 영상 등록"}
                </h2>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-[11px] font-black"
                >
                  새로 등록
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-[11px] font-extrabold">제목 *</span>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder="예: 회원가입 방법"
                  className="rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[11px] font-extrabold">부제목</span>
                <input
                  value={form.subtitle}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      subtitle: e.target.value,
                    }))
                  }
                  placeholder="예: Sign Up"
                  className="rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[11px] font-extrabold">
                  YouTube 링크 *
                </span>
                <input
                  value={form.youtube_url}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      youtube_url: e.target.value,
                    }))
                  }
                  placeholder="https://youtu.be/..."
                  className="rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[11px] font-extrabold">설명</span>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="영상에 대한 간단한 설명"
                  className="rounded-xl border border-gray-300 px-3 py-3 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-[11px] font-extrabold">
                    표시 순서
                  </span>
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

              {message && (
                <div className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              >
                {saving
                  ? "저장 중..."
                  : editingId
                    ? "수정 저장"
                    : "영상 등록"}
              </button>
            </form>
          </section>
        )}

        <div className="mt-4 space-y-4">
          {loading && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm font-bold text-gray-400">
              불러오는 중...
            </div>
          )}

          {!loading && videos.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
              <p className="text-sm font-extrabold text-gray-500">
                등록된 매뉴얼 영상이 없습니다.
              </p>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setShowAdminEditor(true)}
                  className="mt-4 rounded-xl bg-[#172033] px-4 py-2.5 text-xs font-black text-white"
                >
                  ＋ 첫 영상 등록
                </button>
              )}
            </div>
          )}

          {videos.map((video, index) => {
            const embedUrl = getYoutubeEmbedUrl(video.youtube_url);

            return (
              <article
                key={video.id}
                className={`overflow-hidden rounded-3xl border bg-white shadow-[0_2px_10px_rgba(23,32,51,0.06)] ${
                  video.active
                    ? "border-gray-200"
                    : "border-dashed border-gray-300 opacity-70"
                }`}
              >
                <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#172033] text-[13px] font-black text-white">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-extrabold leading-tight text-[#172033]">
                        {video.title}
                      </h3>

                      {isAdmin && !video.active && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[8px] font-black text-gray-600">
                          숨김
                        </span>
                      )}
                    </div>

                    {video.subtitle && (
                      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400">
                        {video.subtitle}
                      </p>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(video)}
                        className="rounded-lg bg-blue-50 px-2.5 py-2 text-[10px] font-black text-blue-700"
                      >
                        수정
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteVideo(video.id)}
                        className="rounded-lg bg-red-50 px-2.5 py-2 text-[10px] font-black text-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>

                {embedUrl ? (
                  <div className="aspect-video w-full overflow-hidden bg-black">
                    <iframe
                      src={embedUrl}
                      title={video.title}
                      className="h-full w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-gray-100 text-sm font-bold text-gray-400">
                    올바른 YouTube 링크가 아닙니다.
                  </div>
                )}

                <div className="p-4">
                  {video.description && (
                    <p className="text-[12px] font-medium leading-relaxed text-gray-600">
                      {video.description}
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <a
                      href={video.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-[12px] font-black text-white transition hover:bg-red-700 active:scale-[0.98]"
                    >
                      ▶ YouTube에서 보기
                    </a>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => toggleActive(video)}
                        className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-[11px] font-black"
                      >
                        {video.active ? "숨기기" : "공개"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <section className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <h3 className="text-[13px] font-extrabold text-[#172033]">
            도움이 더 필요하신가요?
          </h3>
          <Link
            href="/community/inquiries"
            className="mt-3 inline-flex items-center text-[11px] font-extrabold text-blue-700"
          >
            문의하기 →
          </Link>
        </section>
      </section>

      <CommunityBottomNav activeNav="hub" />
    </main>
  );
}