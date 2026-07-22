"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ProfileButton from "@/app/components/ProfileButton";
import CommunityBottomNav from "@/app/components/CommunityBottomNav";
import { supabase } from "@/lib/supabase";

type NewsItem = {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  images: string[] | null;
  source_url: string | null;
  published_at: string;
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

  /*
   * 모바일에서 HTML이 일반 텍스트로 붙여넣어져
   * &lt;p&gt; 또는 <p> 코드 자체가 보이는 경우를 정리합니다.
   */
  for (let index = 0; index < 2; index += 1) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = html;
    const decoded = textarea.value;

    if (decoded === html) break;
    html = decoded;
  }

  // 코드펜스 안에 붙여넣은 HTML도 실제 HTML로 변환합니다.
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const safeContent = useMemo(
    () => sanitizeHtml(item?.content ?? ""),
    [item?.content],
  );

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      setLoading(true);

      try {
        const newsId = Number(params.id);

        if (!Number.isInteger(newsId) || newsId <= 0) {
          console.error("Invalid business news id:", params.id);

          if (mounted) {
            setItem(null);
          }

          return;
        }

        const { data: newsData, error: newsError } = await supabase
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
              source_url,
              published_at
            `,
          )
          .eq("id", newsId)
          .eq("published", true)
          .maybeSingle();

        if (!mounted) return;

        if (newsError) {
          console.error("Business news detail load error:", {
            message: newsError.message,
            code: newsError.code,
            details: newsError.details,
            hint: newsError.hint,
            id: newsId,
          });

          setItem(null);
          return;
        }

        if (!newsData) {
          console.error(
            "Business news not found or not published:",
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
  }, [params.id]);

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

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error("Admin role check error:", error);
          setIsAdmin(false);
          return;
        }

        const role = String(profile?.role ?? "")
          .trim()
          .toLowerCase();

        setIsAdmin(
          role === "admin" || role === "super_admin",
        );
      } catch (error) {
        console.error("Admin role check failed:", error);

        if (mounted) {
          setIsAdmin(false);
        }
      }
    }

    checkAdmin();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!previewImage) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImage]);

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
      window.alert(`삭제하지 못했습니다.\n${error.message}`);
      setDeleting(false);
      return;
    }

    router.replace("/community/news");
    router.refresh();
  }

  if (loading) {
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

  const galleryImages =
    Array.isArray(item.images) && item.images.length > 0
      ? item.images
      : item.image_url
        ? [item.image_url]
        : [];

  const representativeImage =
    item.image_url || galleryImages[0] || "/event.png";

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

      <article className="mx-auto w-full max-w-md px-3 py-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setPreviewImage(representativeImage)}
            className="group relative block w-full overflow-hidden"
            aria-label="대표 이미지 크게 보기"
          >
            <img
              src={representativeImage}
              alt={item.title}
              className="aspect-[16/9] w-full object-cover transition duration-200 group-active:scale-[0.99]"
              onError={(event) => {
                event.currentTarget.src = "/event.png";
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

          <div className="p-4">
            <div className="text-[10px] font-medium text-gray-500">
              {item.category} · {formatDate(item.published_at)}
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
              dangerouslySetInnerHTML={{ __html: safeContent }}
            />

            {galleryImages.length > 1 && (
              <div className="mt-5 grid grid-cols-2 gap-2">
                {galleryImages
                  .filter((imageUrl) => imageUrl !== representativeImage)
                  .map((imageUrl, index) => (
                    <button
                      key={`${imageUrl}-${index}`}
                      type="button"
                      onClick={() => setPreviewImage(imageUrl)}
                      className="group relative overflow-hidden rounded-xl bg-gray-100"
                      aria-label={`${index + 2}번 이미지 크게 보기`}
                    >
                      <img
                        src={imageUrl}
                        alt={`${item.title} 이미지 ${index + 2}`}
                        className="aspect-square w-full object-cover transition duration-200 group-active:scale-[0.98]"
                        onError={(event) => {
                          event.currentTarget.src = "/event.png";
                        }}
                      />

                      <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-3.5 w-3.5"
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
                  ))}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/community/news"
                className="rounded-xl border border-gray-300 px-4 py-2 text-[12px] font-semibold"
              >
                뉴스 목록
              </Link>

              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[#172033] px-4 py-2 text-[12px] font-semibold text-white"
                >
                  원문 보기
                </a>
              )}
            </div>

            {isAdmin && (
              <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-4">
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
                  {deleting ? "삭제 중..." : "삭제"}
                </button>
              </div>
            )}
          </div>
        </div>
      </article>

      {previewImage && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="이미지 크게 보기"
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            aria-label="이미지 닫기"
            className="
              absolute right-4 top-[max(1rem,env(safe-area-inset-top))]
              z-10 flex h-10 w-10 items-center justify-center
              rounded-full bg-white/15 text-2xl text-white
              backdrop-blur transition active:scale-90
            "
          >
            ×
          </button>

          <img
            src={previewImage}
            alt="확대 이미지"
            className="max-h-[92vh] max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
            onError={(event) => {
              event.currentTarget.src = "/event.png";
            }}
          />
        </div>
      )}

      <CommunityBottomNav activeNav="hub" />
    </main>
  );
}