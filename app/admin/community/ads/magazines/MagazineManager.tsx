"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { supabase } from "../../../../../lib/supabase";
import type { MagazineIssue } from "./page";

type Props = {
  initialIssues: MagazineIssue[];
  initialError?: string | null;
};

type MagazineStatus = MagazineIssue["status"];

type CreateForm = {
  title: string;
  issueNumber: string;
  publicationDate: string;
  description: string;
};

const EMPTY_FORM: CreateForm = {
  title: "KTown Triangle Business Magazine",
  issueNumber: "",
  publicationDate: new Date().toISOString().slice(0, 10),
  description: "",
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getStatusLabel(status: MagazineStatus) {
  switch (status) {
    case "published":
      return "발행됨";
    case "archived":
      return "보관됨";
    default:
      return "초안";
  }
}

function getStatusClasses(status: MagazineStatus) {
  switch (status) {
    case "published":
      return "bg-emerald-100 text-emerald-800";
    case "archived":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

export default function MagazineManager({
  initialIssues,
  initialError = null,
}: Props) {
  const [issues, setIssues] =
    useState<MagazineIssue[]>(initialIssues);

  const [form, setForm] =
    useState<CreateForm>(EMPTY_FORM);

  const [showCreateForm, setShowCreateForm] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [busyIssueId, setBusyIssueId] =
    useState<number | null>(null);

  const [message, setMessage] =
    useState<string | null>(
      initialError
        ? `잡지 목록을 불러오지 못했습니다: ${initialError}`
        : null,
    );

  const publishedCount = useMemo(
    () =>
      issues.filter(
        (issue) => issue.status === "published",
      ).length,
    [issues],
  );

  const draftCount = useMemo(
    () =>
      issues.filter(
        (issue) => issue.status === "draft",
      ).length,
    [issues],
  );

  const createMagazine = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const title = form.title.trim();
    const issueNumber = form.issueNumber.trim();

    if (!title) {
      setMessage("잡지 제목을 입력하세요.");
      return;
    }

    if (!issueNumber) {
      setMessage("발행호를 입력하세요.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const baseSlug = slugify(
        `${title}-${issueNumber}`,
      );

      const slug = `${baseSlug}-${Date.now()}`;

      const { data, error } = await supabase
        .from("magazine_issues")
        .insert({
          title,
          issue_number: issueNumber,
          slug,
          description:
            form.description.trim() || null,
          publication_date:
            form.publicationDate || null,
          status: "draft",
          is_public: false,
        })
        .select(`
          id,
          title,
          issue_number,
          slug,
          description,
          publication_date,
          cover_image_url,
          back_cover_image_url,
          pdf_url,
          status,
          is_public,
          published_at,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        throw error;
      }

      setIssues((current) => [
        data as MagazineIssue,
        ...current,
      ]);

      setForm(EMPTY_FORM);
      setShowCreateForm(false);
      setMessage("새 잡지 호수를 만들었습니다.");
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "잡지를 만들지 못했습니다.";

      setMessage(`오류: ${text}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateIssueStatus = async (
    issue: MagazineIssue,
    nextStatus: MagazineStatus,
  ) => {
    setBusyIssueId(issue.id);
    setMessage(null);

    const shouldPublish =
      nextStatus === "published";

    try {
      const { data, error } = await supabase
        .from("magazine_issues")
        .update({
          status: nextStatus,
          is_public: shouldPublish,
          published_at: shouldPublish
            ? new Date().toISOString()
            : null,
        })
        .eq("id", issue.id)
        .select(`
          id,
          title,
          issue_number,
          slug,
          description,
          publication_date,
          cover_image_url,
          back_cover_image_url,
          pdf_url,
          status,
          is_public,
          published_at,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        throw error;
      }

      setIssues((current) =>
        current.map((item) =>
          item.id === issue.id
            ? (data as MagazineIssue)
            : item,
        ),
      );

      setMessage(
        nextStatus === "published"
          ? "잡지를 공개 발행했습니다."
          : nextStatus === "archived"
            ? "잡지를 보관 처리했습니다."
            : "잡지를 초안 상태로 변경했습니다.",
      );
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "상태를 변경하지 못했습니다.";

      setMessage(`오류: ${text}`);
    } finally {
      setBusyIssueId(null);
    }
  };

  const deleteIssue = async (
    issue: MagazineIssue,
  ) => {
    const confirmed = window.confirm(
      `"${issue.title} ${
        issue.issue_number || ""
      }" 잡지를 삭제할까요?\n\n페이지와 광고 배치 정보도 함께 삭제됩니다.`,
    );

    if (!confirmed) return;

    setBusyIssueId(issue.id);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("magazine_issues")
        .delete()
        .eq("id", issue.id);

      if (error) {
        throw error;
      }

      setIssues((current) =>
        current.filter(
          (item) => item.id !== issue.id,
        ),
      );

      setMessage("잡지 호수를 삭제했습니다.");
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "잡지를 삭제하지 못했습니다.";

      setMessage(`오류: ${text}`);
    } finally {
      setBusyIssueId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#F4EFE7] px-4 py-6 text-[#172033]">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-[28px] bg-[#172033] p-6 text-white shadow-xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#F4C95D]">
                KTown Publisher
              </p>

              <h1 className="mt-2 text-3xl font-black">
                잡지 관리
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-medium text-white/70">
                잡지 호수를 만들고 광고 페이지를
                편집한 뒤 플립북으로 발행합니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/community/ads"
                target="_blank"
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-black hover:bg-white/10"
              >
                공개 플립북 보기
              </Link>

              <button
                type="button"
                onClick={() =>
                  setShowCreateForm((current) => !current)
                }
                className="rounded-full bg-[#F4C95D] px-5 py-2 text-sm font-black text-[#172033] hover:brightness-95"
              >
                {showCreateForm
                  ? "작성 취소"
                  : "+ 새 잡지 만들기"}
              </button>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-[#807568]">
              전체 잡지
            </p>

            <p className="mt-2 text-3xl font-black">
              {issues.length}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-[#807568]">
              초안
            </p>

            <p className="mt-2 text-3xl font-black">
              {draftCount}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-[#807568]">
              발행됨
            </p>

            <p className="mt-2 text-3xl font-black">
              {publishedCount}
            </p>
          </div>
        </section>

        {message && (
          <div className="mb-6 rounded-2xl border border-black/10 bg-white px-5 py-4 text-sm font-bold shadow-sm">
            {message}
          </div>
        )}

        {showCreateForm && (
          <section className="mb-7 rounded-[28px] bg-white p-6 shadow-lg">
            <div className="mb-5">
              <h2 className="text-xl font-black">
                새 잡지 호수
              </h2>

              <p className="mt-1 text-sm font-medium text-[#756C61]">
                먼저 잡지 정보를 등록한 뒤 페이지를
                추가하고 광고를 배치합니다.
              </p>
            </div>

            <form
              onSubmit={createMagazine}
              className="grid gap-4 md:grid-cols-2"
            >
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider">
                  잡지 제목
                </span>

                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-black/15 bg-[#FAF8F4] px-4 py-3 font-bold outline-none focus:border-[#C4483A]"
                  placeholder="KTown Triangle Business Magazine"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider">
                  발행호
                </span>

                <input
                  type="text"
                  value={form.issueNumber}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      issueNumber:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-black/15 bg-[#FAF8F4] px-4 py-3 font-bold outline-none focus:border-[#C4483A]"
                  placeholder="Issue 002 또는 July 2026"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider">
                  발행 예정일
                </span>

                <input
                  type="date"
                  value={form.publicationDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      publicationDate:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-black/15 bg-[#FAF8F4] px-4 py-3 font-bold outline-none focus:border-[#C4483A]"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-wider">
                  설명
                </span>

                <input
                  type="text"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-black/15 bg-[#FAF8F4] px-4 py-3 font-bold outline-none focus:border-[#C4483A]"
                  placeholder="지역 비즈니스 광고 책자"
                />
              </label>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setForm(EMPTY_FORM);
                  }}
                  className="rounded-full border border-black/15 px-5 py-3 text-sm font-black"
                >
                  취소
                </button>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-full bg-[#C4483A] px-6 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving
                    ? "저장 중..."
                    : "잡지 만들기"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">
              잡지 목록
            </h2>

            <p className="text-sm font-bold text-[#756C61]">
              최신 등록 순
            </p>
          </div>

          {issues.length === 0 ? (
            <div className="rounded-[28px] border-2 border-dashed border-black/15 bg-white/50 p-12 text-center">
              <p className="text-lg font-black">
                등록된 잡지가 없습니다.
              </p>

              <p className="mt-2 text-sm font-medium text-[#756C61]">
                새 잡지 만들기를 눌러 첫 호수를
                만드세요.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {issues.map((issue) => {
                const busy =
                  busyIssueId === issue.id;

                return (
                  <article
                    key={issue.id}
                    className="overflow-hidden rounded-[28px] bg-white shadow-lg"
                  >
                    <div className="aspect-[1.414/1] bg-[#172033]">
                      {issue.cover_image_url ? (
                        <img
                          src={issue.cover_image_url}
                          alt={`${issue.title} 표지`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full flex-col justify-between p-6 text-white">
                          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#F4C95D]">
                            KTown Publisher
                          </p>

                          <div>
                            <h3 className="text-2xl font-black leading-tight">
                              {issue.title}
                            </h3>

                            <p className="mt-3 text-sm font-black text-white/70">
                              {issue.issue_number ||
                                "발행호 미정"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black">
                            {issue.title}
                          </h3>

                          <p className="mt-1 text-sm font-bold text-[#756C61]">
                            {issue.issue_number ||
                              "발행호 미정"}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${getStatusClasses(
                            issue.status,
                          )}`}
                        >
                          {getStatusLabel(
                            issue.status,
                          )}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between gap-3">
                          <span className="font-bold text-[#807568]">
                            발행일
                          </span>

                          <span className="font-black">
                            {formatDate(
                              issue.publication_date,
                            )}
                          </span>
                        </div>

                        <div className="flex justify-between gap-3">
                          <span className="font-bold text-[#807568]">
                            공개 여부
                          </span>

                          <span className="font-black">
                            {issue.is_public
                              ? "공개"
                              : "비공개"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <Link
                          href={`/admin/community/ads/magazines/${issue.id}/edit`}
                          className="rounded-2xl bg-[#172033] px-4 py-3 text-center text-sm font-black text-white"
                        >
                          페이지 편집
                        </Link>

                        {issue.status ===
                        "published" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              updateIssueStatus(
                                issue,
                                "draft",
                              )
                            }
                            className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-black text-amber-900 disabled:opacity-50"
                          >
                            발행 취소
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              updateIssueStatus(
                                issue,
                                "published",
                              )
                            }
                            className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-black text-emerald-900 disabled:opacity-50"
                          >
                            발행
                          </button>
                        )}
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            updateIssueStatus(
                              issue,
                              "archived",
                            )
                          }
                          className="rounded-2xl border border-black/10 px-4 py-3 text-sm font-black disabled:opacity-50"
                        >
                          보관
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            deleteIssue(issue)
                          }
                          className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-black text-red-700 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}