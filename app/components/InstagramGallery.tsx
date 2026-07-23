"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Business = {
  id?: string | number;
  name?: string | null;
};

type InstagramPost = {
  id: string | number;
  stored_image_url: string;
  instagram_post_url: string;
  caption?: string | null;
  posted_at?: string | null;
  fetched_at?: string | null;
  business?: Business | null;
};

type Props = {
  posts: InstagramPost[];
};

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function InstagramLogo() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="17.4" cy="6.7" r="1.2" fill="currentColor" />
    </svg>
  );
}

function isVideoPost(url: string) {
  return /\/reel(?:s)?\//i.test(url);
}

function isWithinLastThreeDays(postedAt?: string | null) {
  if (!postedAt) {
    return false;
  }

  const postedTime = new Date(postedAt).getTime();

  if (Number.isNaN(postedTime)) {
    return false;
  }

  return postedTime >= Date.now() - THREE_DAYS_MS;
}

export default function InstagramGallery({ posts }: Props) {
  const [selectedPost, setSelectedPost] =
    useState<InstagramPost | null>(null);

  /**
   * 서버에서 최근 3일 자료만 보내더라도 클라이언트에서 한 번 더
   * posted_at 기준으로 검사합니다.
   *
   * fetched_at은 수집 확인 날짜이므로 표시 판단에 사용하지 않습니다.
   * 같은 게시물이 다시 확인되어 fetched_at이 갱신되어도 posted_at이
   * 3일보다 오래되면 자동으로 숨겨집니다.
   *
   * 또한 가게별 최신 게시물 하나만 남깁니다.
   */
  const normalizedPosts = useMemo(() => {
    const recentPosts = (posts ?? [])
      .filter((post) => {
        return (
          Boolean(post.stored_image_url) &&
          Boolean(post.instagram_post_url) &&
          isWithinLastThreeDays(post.posted_at)
        );
      })
      .sort((left, right) => {
        const leftTime = left.posted_at
          ? new Date(left.posted_at).getTime()
          : 0;

        const rightTime = right.posted_at
          ? new Date(right.posted_at).getTime()
          : 0;

        return rightTime - leftTime;
      });

    const uniqueByBusiness = new Map<
      string | number,
      InstagramPost
    >();

    for (const post of recentPosts) {
      const businessKey =
        post.business?.id ??
        post.business?.name ??
        post.id;

      if (!uniqueByBusiness.has(businessKey)) {
        uniqueByBusiness.set(businessKey, post);
      }
    }

    return Array.from(uniqueByBusiness.values());
  }, [posts]);

  useEffect(() => {
    if (!selectedPost) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedPost(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedPost]);

  /**
   * 게시물이 3일을 지나 목록에서 제거된 상태에서 모달이 열려 있다면
   * 모달도 자동으로 닫습니다.
   */
  useEffect(() => {
    if (!selectedPost) {
      return;
    }

    const stillVisible = normalizedPosts.some(
      (post) => post.id === selectedPost.id,
    );

    if (!stillVisible) {
      setSelectedPost(null);
    }
  }, [normalizedPosts, selectedPost]);

  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#C44873]">
            Social
          </p>

          <h1 className="text-2xl font-black tracking-tight">
            Today&apos;s Instagram
          </h1>
        </div>

        <Link
          href="/community"
          className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm"
        >
          Back
        </Link>
      </div>

      {normalizedPosts.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {normalizedPosts.map((post) => {
            const video = isVideoPost(
              post.instagram_post_url,
            );

            return (
              <article
                key={post.id}
                className="overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setSelectedPost(post)}
                  className="relative block aspect-square w-full overflow-hidden bg-[#E8DED1] text-left"
                  aria-label={`Open ${
                    post.business?.name || "Instagram"
                  } post`}
                >
                  <img
                    src={post.stored_image_url}
                    alt={
                      post.caption ||
                      `${
                        post.business?.name ||
                        "Local Business"
                      } Instagram post`
                    }
                    className="h-full w-full object-cover"
                  />

                  {video && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-xl text-white shadow-lg">
                        ▶
                      </span>
                    </span>
                  )}
                </button>

                <div className="flex items-center justify-between gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPost(post)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-black text-[#172033]"
                  >
                    {post.business?.name ||
                      "Local Business"}
                  </button>

                  <a
                    href={post.instagram_post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open this post on Instagram"
                    className="flex shrink-0 items-center gap-1 rounded-full bg-[#FFF0F5] px-2.5 py-1.5 text-xs font-black text-[#C44873]"
                  >
                    <InstagramLogo />
                    <span>Instagram</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-6 text-center text-sm font-bold text-[#6B6257] shadow-sm">
          No Instagram posts from the last 3 days.
        </div>
      )}

      {selectedPost && (
        <div
          className="fixed inset-0 z-[100] bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Instagram post preview"
          onClick={() => setSelectedPost(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedPost(null)}
            className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-2xl font-black text-white shadow-lg"
            aria-label="Close"
          >
            ×
          </button>

          <a
            href={selectedPost.instagram_post_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="absolute bottom-5 right-5 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-[#C44873] text-white shadow-xl"
            aria-label="Open on Instagram"
          >
            <InstagramLogo />
          </a>

          <div className="flex h-full w-full items-center justify-center">
            <img
              src={selectedPost.stored_image_url}
              alt={
                selectedPost.caption ||
                `${
                  selectedPost.business?.name ||
                  "Local Business"
                } Instagram post`
              }
              onClick={(event) => event.stopPropagation()}
              className="block max-h-screen max-w-full object-contain"
              style={{
                width: "auto",
                height: "auto",
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}