"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ProfileButton from "@/app/components/ProfileButton";
import CommunityBottomNav from "../../../components/CommunityBottomNav";
import { supabase } from "../../../../lib/supabase";

type NewsItem = {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
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

function sanitizeHtml(html: string) {
  if (typeof window === "undefined") return "";

  const template = document.createElement("template");
  template.innerHTML = html;

  const blockedElements = template.content.querySelectorAll(
    "script,iframe,object,embed,form,input,button,textarea,select,style,link,meta",
  );

  blockedElements.forEach((element) => element.remove());

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

  const safeContent = useMemo(
    () => sanitizeHtml(item?.content ?? ""),
    [item?.content],
  );

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      setLoading(true);

      const [newsResult, sessionResult] = await Promise.all([
        supabase
          .from("business_news")
          .select(
            "id,title,summary,content,category,image_url,source_url,published_at",
          )
          .eq("id", params.id)
          .eq("published", true)
          .maybeSingle(),
        supabase.auth.getSession(),
      ]);

      if (!mounted) return;

      if (newsResult.error || !newsResult.data) {
        console.error("Business news detail load error:", newsResult.error);
        setItem(null);
        setLoading(false);
        return;
      }

      setItem(newsResult.data as NewsItem);

      const user = sessionResult.data.session?.user;

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const role = String(profile?.role ?? "")
          .trim()
          .toLowerCase();

        if (mounted) {
          setIsAdmin(role === "admin" || role === "super_admin");
        }
      }

      if (mounted) {
        setLoading(false);
      }
    }

    loadPage();

    return () => {
      mounted = false;
    };
  }, [params.id]);

  async function handleDelete() {
    if (!item || !isAdmin || deleting) return;

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
        <h1 className="mt-3 text-lg font-bold">뉴스를 찾을 수 없습니다</h1>
        <Link
          href="/community/news"
          className="mt-4 rounded-xl bg-[#172033] px-4 py-2 text-sm font-semibold text-white"
        >
          뉴스 목록
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F7F7] text-[#172033]">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center px-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90 active:bg-gray-100"
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

          <h1 className="flex-1 text-center text-[15px] font-bold">
            Business News
          </h1>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center">
            <ProfileButton />
          </div>
        </div>
      </header>

      <article className="mx-auto w-full max-w-2xl px-3 py-4">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <img
            src={item.image_url || "/event.png"}
            alt={item.title}
            className="aspect-[16/9] w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = "/event.png";
            }}
          />

          <div className="p-5">
            <div className="text-[11px] font-medium text-gray-500">
              {item.category} · {formatDate(item.published_at)}
            </div>

            <h1 className="mt-2 text-[24px] font-bold leading-tight">
              {item.title}
            </h1>

            {item.summary && (
              <p className="mt-3 text-[14px] font-medium leading-6 text-gray-600">
                {item.summary}
              </p>
            )}

            <div
              className="
                mt-5 text-[15px] leading-7
                [&_a]:text-blue-600 [&_a]:underline
                [&_blockquote]:my-4 [&_blockquote]:border-l-4
                [&_blockquote]:border-gray-300 [&_blockquote]:pl-4
                [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-[26px] [&_h1]:font-bold
                [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-[22px] [&_h2]:font-bold
                [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-[18px] [&_h3]:font-semibold
                [&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl
                [&_li]:ml-5 [&_ol]:my-3 [&_ol]:list-decimal
                [&_p]:my-3 [&_table]:my-4 [&_table]:w-full
                [&_table]:border-collapse [&_td]:border [&_td]:p-2
                [&_th]:border [&_th]:bg-gray-50 [&_th]:p-2
                [&_ul]:my-3 [&_ul]:list-disc
              "
              dangerouslySetInnerHTML={{ __html: safeContent }}
            />

            {item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex rounded-xl bg-[#172033] px-4 py-2 text-sm font-semibold text-white"
              >
                원문 보기
              </a>
            )}

            {isAdmin && (
              <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-4">
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

      <CommunityBottomNav activeNav="hub" />
    </main>
  );
}
