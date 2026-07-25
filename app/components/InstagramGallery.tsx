"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

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
  if (!postedAt) return false;

  const postedTime = new Date(postedAt).getTime();

  if (Number.isNaN(postedTime)) return false;

  return postedTime >= Date.now() - THREE_DAYS_MS;
}

export default function InstagramGallery({ posts }: Props) {
  const [selectedPost, setSelectedPost] =
    useState<InstagramPost | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        post.business?.id ?? post.business?.name ?? post.id;

      if (!uniqueByBusiness.has(businessKey)) {
        uniqueByBusiness.set(businessKey, post);
      }
    }

    return Array.from(uniqueByBusiness.values());
  }, [posts]);

  useEffect(() => {
    if (!selectedPost) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow =
      document.documentElement.style.overflow;
    const previousBodyTouchAction =
      document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedPost(null);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.touchAction = previousBodyTouchAction;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedPost]);

  useEffect(() => {
    if (!selectedPost) return;

    const stillVisible = normalizedPosts.some(
      (post) => post.id === selectedPost.id,
    );

    if (!stillVisible) {
      setSelectedPost(null);
    }
  }, [normalizedPosts, selectedPost]);

  const modal =
    mounted && selectedPost
      ? createPortal(
          <div
            className="fixed inset-0 z-[99999] flex min-h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black px-3 pb-[max(88px,calc(env(safe-area-inset-bottom)+72px))] pt-[max(68px,calc(env(safe-area-inset-top)+56px))]"
            role="dialog"
            aria-modal="true"
            aria-label="Instagram post preview"
            onClick={() => setSelectedPost(null)}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedPost(null);
              }}
              className="fixed right-4 top-[max(14px,env(safe-area-inset-top))] z-[100001] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/75 text-2xl font-black text-white shadow-xl backdrop-blur transition active:scale-95"
              aria-label="Close"
            >
              ×
            </button>

            <a
              href={selectedPost.instagram_post_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="fixed bottom-[max(18px,calc(env(safe-area-inset-bottom)+12px))] right-4 z-[100001] flex h-12 items-center justify-center gap-2 rounded-full bg-[#C44873] px-4 text-sm font-black text-white shadow-xl transition active:scale-95"
              aria-label="Open on Instagram"
            >
              <InstagramLogo />
              <span>Instagram</span>
            </a>

            <div
              className="flex h-full max-h-[calc(100dvh-156px)] w-full items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              <img
                src={selectedPost.stored_image_url}
                alt={
                  selectedPost.caption ||
                  `${
                    selectedPost.business?.name || "Local Business"
                  } Instagram post`
                }
                className="block max-h-[calc(100dvh-156px)] max-w-full select-none object-contain"
                draggable={false}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

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
            const video = isVideoPost(post.instagram_post_url);

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
                        post.business?.name || "Local Business"
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
                    {post.business?.name || "Local Business"}
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

      {modal}
    </>
  );
}