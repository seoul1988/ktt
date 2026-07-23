"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import ProfileButton from "@/app/components/ProfileButton";
import CommunityBottomNav from "@/app/components/CommunityBottomNav";
import { supabase } from "@/lib/supabase";

type NewsAttachment = {
  name: string;
  url: string;
  path?: string;
  type?: string;
  size?: number;
  external?: boolean;
};

type NewsItem = {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  images: string[] | null;
  attachments: NewsAttachment[] | null;
  source_url: string | null;
  published_at: string;
  published: boolean | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeStoredHtml(value: string) {
  if (typeof window === "undefined") return value;

  let html = String(value ?? "").trim();

  for (let index = 0; index < 2; index += 1) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = html;

    const decoded = textarea.value;

    if (decoded === html) break;

    html = decoded;
  }

  html = html
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  return html;
}

function sanitizeHtml(html: string) {
  if (typeof window === "undefined") return "";

  const template = document.createElement("template");
  template.innerHTML = normalizeStoredHtml(html);

  template.content
    .querySelectorAll(
      "script,iframe,object,embed,form,input,button,textarea,select,style,link,meta",
    )
    .forEach((element) => element.remove());

  template.content.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();

      if (
        name.startsWith("on") ||
        name === "srcdoc" ||
        (["href", "src"].includes(name) &&
          (value.startsWith("javascript:") ||
            value.startsWith("data:text/html")))
      ) {
        element.removeAttribute(attribute.name);
      }
    });

    if (element.tagName === "A") {
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
  });

  return template.innerHTML;
}

export default function BusinessNewsDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<NewsItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [showLoginModal, setShowLoginModal] =
    useState(false);

  const [deleting, setDeleting] = useState(false);
  const [activeImageIndex, setActiveImageIndex] =
    useState(0);
  const [previewImageIndex, setPreviewImageIndex] =
    useState<number | null>(null);

  const newsId = Number(params.id);

  const isPrivateNews = item?.published !== true;
  const isLocked = Boolean(
    item && isPrivateNews && !isLoggedIn,
  );

  const safeContent = useMemo(() => {
    if (isLocked) return "";

    return sanitizeHtml(item?.content ?? "");
  }, [item?.content, isLocked]);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setIsLoggedIn(Boolean(session?.user));
      } catch (error) {
        console.error("Session load error:", error);

        if (mounted) {
          setIsLoggedIn(false);
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        setIsLoggedIn(Boolean(session?.user));
        setAuthLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      setLoading(true);

      try {
        if (
          !Number.isInteger(newsId) ||
          newsId <= 0
        ) {
          console.error(
            "Invalid business news id:",
            params.id,
          );

          if (mounted) {
            setItem(null);
          }

          return;
        }

        const { data: newsData, error: newsError } =
          await supabase
            .from("business_news")
            .select(
              `
                id,
                title,
                summary,
                content,
                category,
                image_url,
                images,
                attachments,
                source_url,
                published_at,
                published
              `,
            )
            .eq("id", newsId)
            .maybeSingle();

        if (!mounted) return;

        if (newsError) {
          console.error(
            "Business news detail load error:",
            {
              message: newsError.message,
              code: newsError.code,
              details: newsError.details,
              hint: newsError.hint,
              id: newsId,
            },
          );

          setItem(null);
          return;
        }

        if (!newsData) {
          console.error(
            "Business news not found:",
            newsId,
          );

          setItem(null);
          return;
        }

        setItem(newsData as NewsItem);
      } catch (error) {
        console.error(
          "Business news detail unexpected error:",
          error,
        );

        if (mounted) {
          setItem(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      mounted = false;
    };
  }, [newsId, params.id]);

  useEffect(() => {
    if (
      loading ||
      authLoading ||
      !item
    ) {
      return;
    }

    const privateNews = item.published !== true;

    if (privateNews && !isLoggedIn) {
      setShowLoginModal(true);
    } else {
      setShowLoginModal(false);
    }
  }, [
    item,
    loading,
    authLoading,
    isLoggedIn,
  ]);

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const user = session?.user;

        if (!user) {
          if (mounted) {
            setIsAdmin(false);
          }

          return;
        }

        const { data: profile, error } =
          await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error(
            "Admin role check error:",
            error,
          );

          setIsAdmin(false);
          return;
        }

        const role = String(profile?.role ?? "")
          .trim()
          .toLowerCase();

        setIsAdmin(
          role === "admin" ||
            role === "super_admin",
        );
      } catch (error) {
        console.error(
          "Admin role check failed:",
          error,
        );

        if (mounted) {
          setIsAdmin(false);
        }
      }
    }

    checkAdmin();

    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (previewImageIndex === null && !showLoginModal) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      if (previewImageIndex !== null) {
        setPreviewImageIndex(null);
        return;
      }

      if (showLoginModal) {
        router.replace("/community/news");
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    previewImageIndex,
    showLoginModal,
    router,
  ]);

  async function handleDelete() {
    if (!item || deleting || !isAdmin) return;

    const confirmed = window.confirm(
      "이 뉴스를 삭제하시겠습니까?\n삭제한 뉴스는 복구할 수 없습니다.",
    );

    if (!confirmed) return;

    setDeleting(true);

    const { error } = await supabase
      .from("business_news")
      .delete()
      .eq("id", item.id);

    if (error) {
      window.alert(
        `삭제하지 못했습니다.\n${error.message}`,
      );

      setDeleting(false);
      return;
    }

    router.replace("/community/news");
    router.refresh();
  }

  function goToLogin() {
    const redirectPath =
      Number.isInteger(newsId) && newsId > 0
        ? `/community/news/${newsId}`
        : "/community/news";

    router.push(
      `/login?redirect=${encodeURIComponent(
        redirectPath,
      )}`,
    );
  }

  function closeLoginModal() {
    setShowLoginModal(false);
    router.replace("/community/news");
  }

  const pageLoading = loading || authLoading;

  if (pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F7] text-sm font-semibold text-gray-500">
        뉴스 불러오는 중...
      </main>
    );
  }

  if (!item) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F7] px-4 text-center text-[#172033]">
        <div className="text-4xl">📰</div>

        <h1 className="mt-3 text-lg font-bold">
          뉴스를 찾을 수 없습니다
        </h1>

        <Link
          href="/community/news"
          className="mt-4 rounded-xl bg-[#172033] px-4 py-2 text-sm font-semibold text-white"
        >
          뉴스 목록
        </Link>
      </main>
    );
  }

  const galleryImages = Array.from(
    new Set(
      [
        item.image_url || "",
        ...(Array.isArray(item.images)
          ? item.images
          : []),
      ].filter(Boolean),
    ),
  );

  const displayImages =
    galleryImages.length > 0
      ? galleryImages
      : ["/event.png"];

  const safeActiveImageIndex =
    activeImageIndex >= 0 &&
    activeImageIndex < displayImages.length
      ? activeImageIndex
      : 0;

  const activeImage =
    displayImages[safeActiveImageIndex];

  const attachments = Array.isArray(item.attachments)
    ? item.attachments.filter(
        (attachment) =>
          attachment &&
          typeof attachment.url === "string" &&
          attachment.url.trim(),
      )
    : [];

  function showPreviousImage() {
    setActiveImageIndex((current) =>
      current <= 0
        ? displayImages.length - 1
        : current - 1,
    );
  }

  function showNextImage() {
    setActiveImageIndex((current) =>
      current >= displayImages.length - 1
        ? 0
        : current + 1,
    );
  }

  function showPreviousPreviewImage() {
    setPreviewImageIndex((current) => {
      if (current === null) return null;

      return current <= 0
        ? displayImages.length - 1
        : current - 1;
    });
  }

  function showNextPreviewImage() {
    setPreviewImageIndex((current) => {
      if (current === null) return null;

      return current >= displayImages.length - 1
        ? 0
        : current + 1;
    });
  }

  function formatFileSize(size?: number) {
    if (!size || size <= 0) return "";

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <main className="min-h-screen bg-[#F7F7F7] text-[#172033]">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center px-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="
              flex h-9 w-9 shrink-0 items-center justify-center
              rounded-full transition
              active:scale-90 active:bg-gray-100
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <h1 className="min-w-0 flex-1 truncate px-2 text-center text-[15px] font-bold">
            Business News
          </h1>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            <ProfileButton />
          </div>
        </div>
      </header>

      {!isLocked && (
        <article className="mx-auto w-full max-w-md px-3 py-4">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="relative overflow-hidden bg-gray-100">
              <button
                type="button"
                onClick={() =>
                  setPreviewImageIndex(
                    safeActiveImageIndex,
                  )
                }
                className="group relative block w-full overflow-hidden"
                aria-label="이미지 크게 보기"
              >
                <img
                  src={activeImage}
                  alt={`${item.title} 이미지 ${safeActiveImageIndex + 1}`}
                  className="aspect-[16/9] w-full object-cover transition duration-200 group-active:scale-[0.99]"
                  onError={(event) => {
                    event.currentTarget.src =
                      "/event.png";
                  }}
                />

                <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-sm">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="6" />
                    <path d="M16 16l4 4" />
                    <path d="M11 8v6" />
                    <path d="M8 11h6" />
                  </svg>
                </span>
              </button>

              {displayImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      showPreviousImage();
                    }}
                    aria-label="이전 이미지"
                    className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl text-white shadow-lg backdrop-blur-sm transition active:scale-90"
                  >
                    ‹
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      showNextImage();
                    }}
                    aria-label="다음 이미지"
                    className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-2xl text-white shadow-lg backdrop-blur-sm transition active:scale-90"
                  >
                    ›
                  </button>

                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                    {safeActiveImageIndex + 1} / {displayImages.length}
                  </div>
                </>
              )}
            </div>

            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium text-gray-500">
                  {item.category} ·{" "}
                  {formatDate(
                    item.published_at,
                  )}
                </span>

                {isPrivateNews && (
                  <span className="rounded-full bg-[#172033] px-2.5 py-1 text-[9px] font-bold text-white">
                    회원 전용
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-[22px] font-bold leading-tight">
                {item.title}
              </h1>

              {item.summary && (
                <p className="mt-3 text-[13px] font-medium leading-6 text-gray-600">
                  {item.summary}
                </p>
              )}

              <div
                className="
                  mt-5 text-[14px] leading-7
                  [&_a]:text-blue-600 [&_a]:underline
                  [&_blockquote]:my-4 [&_blockquote]:border-l-4
                  [&_blockquote]:border-gray-300 [&_blockquote]:pl-4
                  [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-[24px] [&_h1]:font-bold
                  [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-[20px] [&_h2]:font-bold
                  [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-[17px] [&_h3]:font-semibold
                  [&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl
                  [&_li]:ml-5 [&_ol]:my-3 [&_ol]:list-decimal
                  [&_p]:my-3 [&_table]:my-4 [&_table]:w-full
                  [&_table]:border-collapse [&_td]:border [&_td]:p-2
                  [&_th]:border [&_th]:bg-gray-50 [&_th]:p-2
                  [&_ul]:my-3 [&_ul]:list-disc
                "
                dangerouslySetInnerHTML={{
                  __html: safeContent,
                }}
              />

              {attachments.length > 0 && (
                <section className="mt-6 border-t border-gray-100 pt-5">
                  <h2 className="text-[14px] font-bold">
                    첨부파일
                  </h2>

                  <div className="mt-3 space-y-2">
                    {attachments.map(
                      (attachment, index) => (
                        <div
                          key={`${attachment.url}-${index}`}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                        >
                          <div className="flex min-w-0 items-start gap-2">
                            <span
                              className="text-xl"
                              aria-hidden="true"
                            >
                              📎
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="break-all text-[12px] font-semibold text-[#172033]">
                                {attachment.name ||
                                  `첨부파일 ${index + 1}`}
                              </p>

                              {(attachment.type ||
                                attachment.size) && (
                                <p className="mt-0.5 text-[9px] text-gray-500">
                                  {attachment.type || "File"}
                                  {attachment.size
                                    ? ` · ${formatFileSize(
                                        attachment.size,
                                      )}`
                                    : ""}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 flex gap-2">
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-9 flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white text-[11px] font-semibold text-[#172033]"
                            >
                              바로 보기
                            </a>

                            <a
                              href={attachment.url}
                              download={
                                attachment.name || true
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-9 flex-1 items-center justify-center rounded-lg bg-[#172033] text-[11px] font-semibold text-white"
                            >
                              다운로드
                            </a>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </section>
              )}

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Link
                    href="/community/news"
                    className="shrink-0 rounded-xl border border-gray-300 px-4 py-2 text-[12px] font-semibold"
                  >
                    뉴스 목록
                  </Link>

                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-xl bg-[#172033] px-4 py-2 text-[12px] font-semibold text-white"
                    >
                      원문 보기
                    </a>
                  )}
                </div>

                {isAdmin && (
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/news?edit=${item.id}`}
                      className="rounded-xl bg-blue-50 px-4 py-2 text-[12px] font-medium text-blue-700"
                    >
                      수정
                    </Link>

                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-xl bg-red-50 px-4 py-2 text-[12px] font-medium text-red-600 disabled:opacity-50"
                    >
                      {deleting
                        ? "삭제 중..."
                        : "삭제"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </article>
      )}

      {previewImageIndex !== null && !isLocked && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="이미지 크게 보기"
          onClick={() =>
            setPreviewImageIndex(null)
          }
        >
          <button
            type="button"
            onClick={() =>
              setPreviewImageIndex(null)
            }
            aria-label="이미지 닫기"
            className="
              absolute right-4 top-[max(1rem,env(safe-area-inset-top))]
              z-20 flex h-10 w-10 items-center justify-center
              rounded-full bg-white/15 text-2xl text-white
              backdrop-blur transition active:scale-90
            "
          >
            ×
          </button>

          {displayImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showPreviousPreviewImage();
                }}
                aria-label="이전 확대 이미지"
                className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-4xl text-white backdrop-blur transition active:scale-90"
              >
                ‹
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showNextPreviewImage();
                }}
                aria-label="다음 확대 이미지"
                className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-4xl text-white backdrop-blur transition active:scale-90"
              >
                ›
              </button>

              <div className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white">
                {previewImageIndex + 1} / {displayImages.length}
              </div>
            </>
          )}

          <img
            src={
              displayImages[
                Math.min(
                  Math.max(previewImageIndex, 0),
                  displayImages.length - 1,
                )
              ]
            }
            alt="확대 이미지"
            className="max-h-[92vh] max-w-full object-contain"
            onClick={(event) =>
              event.stopPropagation()
            }
            onError={(event) => {
              event.currentTarget.src =
                "/event.png";
            }}
          />
        </div>
      )}

      {showLoginModal && isLocked && (
        <div
          role="presentation"
          onClick={closeLoginModal}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-5 backdrop-blur-[3px]"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-required-title"
            onClick={(event) =>
              event.stopPropagation()
            }
            className="w-full max-w-[330px] rounded-[24px] bg-white p-5 text-center shadow-2xl"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F8F3EC] text-[25px]">
              🔒
            </div>

            <h2
              id="login-required-title"
              className="mt-4 text-[18px] font-extrabold text-[#172033]"
            >
              로그인이 필요합니다
            </h2>

            <p className="mt-2 text-[12px] font-medium leading-relaxed text-gray-500">
              이 뉴스는 로그인한 회원만
              볼 수 있습니다.
              <br />
              로그인 후 전체 내용을
              확인해 주세요.
            </p>

            <button
              type="button"
              onClick={goToLogin}
              className="mt-5 h-12 w-full rounded-xl bg-[#172033] text-[14px] font-bold text-white shadow-sm transition active:scale-[0.98]"
            >
              로그인하기
            </button>

            <p className="mt-3 text-[10px] font-medium text-gray-400">
              창 바깥을 누르면 뉴스 목록으로
              돌아갑니다
            </p>
          </div>
        </div>
      )}

      <CommunityBottomNav activeNav="hub" />
    </main>
  );
}