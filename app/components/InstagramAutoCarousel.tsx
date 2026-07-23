"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type InstagramBusiness = {
  id?: string | number;
  name?: string | null;
};

type InstagramPost = {
  id: string | number;
  stored_image_url: string;
  instagram_post_url: string;
  posted_at?: string | null;
  business?: InstagramBusiness | InstagramBusiness[] | null;
};

type Props = {
  posts: InstagramPost[];
};

const CARD_SIZE = 160;
const CARD_GAP = 12;
const AUTO_SCROLL_MS = 2000;
const SCROLL_STEP = CARD_SIZE + CARD_GAP;

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

      <circle
        cx="17.4"
        cy="6.7"
        r="1.2"
        fill="currentColor"
      />
    </svg>
  );
}

export default function InstagramAutoCarousel({
  posts,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [isInteracting, setIsInteracting] =
    useState(false);

  const [selectedPost, setSelectedPost] =
    useState<InstagramPost | null>(null);

  const normalizedPosts = useMemo(
    () =>
      (posts ?? []).map((post) => ({
        ...post,
        business: Array.isArray(post.business)
          ? post.business[0]
          : post.business,
      })),
    [posts],
  );

  useEffect(() => {
    const container = scrollRef.current;

    if (
      !container ||
      normalizedPosts.length < 2 ||
      isInteracting ||
      selectedPost
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      const maxScrollLeft =
        container.scrollWidth - container.clientWidth;

      const nextScrollLeft =
        container.scrollLeft + SCROLL_STEP;

      if (nextScrollLeft >= maxScrollLeft - 4) {
        container.scrollTo({
          left: 0,
          behavior: "smooth",
        });
      } else {
        container.scrollTo({
          left: nextScrollLeft,
          behavior: "smooth",
        });
      }
    }, AUTO_SCROLL_MS);

    return () => window.clearInterval(timer);
  }, [
    normalizedPosts.length,
    isInteracting,
    selectedPost,
  ]);

  useEffect(() => {
    if (!selectedPost) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setSelectedPost(null);
      }
    };

    window.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, [selectedPost]);

  const stopAutoScroll = () => {
    setIsInteracting(true);
  };

  const restartAutoScroll = () => {
    window.setTimeout(() => {
      setIsInteracting(false);
    }, 1200);
  };

  const scrollCarousel = (
    direction: "left" | "right",
  ) => {
    const container = scrollRef.current;

    if (!container) {
      return;
    }

    setIsInteracting(true);

    container.scrollBy({
      left:
        direction === "left"
          ? -SCROLL_STEP
          : SCROLL_STEP,
      behavior: "smooth",
    });

    window.setTimeout(() => {
      setIsInteracting(false);
    }, 1200);
  };

  return (
    <>
      <section className="mb-8 overflow-hidden rounded-3xl border border-[#F2D3DE] bg-[#FFF7FA] p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#F2D3DE] bg-white text-xl shadow-sm">
              📷
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-[#C44873]">
                Social
              </p>

              <h2 className="text-lg font-black text-[#172033]">
                Today&apos;s Instagram
              </h2>
            </div>
          </div>

          <Link
            href="/community/instagram"
            className="rounded-full bg-white px-3 py-1.5 text-xs font-black text-[#C44873] shadow-sm"
          >
            View All →
          </Link>
        </div>

        {normalizedPosts.length > 0 ? (
          <div className="relative">
            <button
              type="button"
              onClick={() =>
                scrollCarousel("left")
              }
              className="absolute left-1 top-[68px] z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-2xl font-black text-[#C44873] shadow-lg ring-1 ring-[#F2D3DE] transition active:scale-95"
              aria-label="Previous Instagram posts"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() =>
                scrollCarousel("right")
              }
              className="absolute right-1 top-[68px] z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-2xl font-black text-[#C44873] shadow-lg ring-1 ring-[#F2D3DE] transition active:scale-95"
              aria-label="Next Instagram posts"
            >
              ›
            </button>

            <div
              ref={scrollRef}
              className="overflow-x-auto pb-2"
              style={{
                paddingLeft: "4px",
                paddingRight: "4px",
                scrollBehavior: "smooth",
                scrollbarWidth: "none",
                WebkitOverflowScrolling: "touch",
                scrollSnapType: "x mandatory",
                touchAction: "pan-x",
                overscrollBehaviorX: "contain",
              }}
              onTouchStart={stopAutoScroll}
              onTouchEnd={restartAutoScroll}
              onTouchCancel={restartAutoScroll}
              onMouseEnter={stopAutoScroll}
              onMouseLeave={restartAutoScroll}
              onPointerDown={stopAutoScroll}
              onPointerUp={restartAutoScroll}
              onPointerCancel={restartAutoScroll}
            >
              <div
                style={{
                  display: "flex",
                  width: "max-content",
                  gap: `${CARD_GAP}px`,
                  flexWrap: "nowrap",
                }}
              >
                {normalizedPosts.map(
                  (post) => {
                    const business =
                      post.business as
                        | InstagramBusiness
                        | null;

                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() =>
                          setSelectedPost(post)
                        }
                        style={{
                          display: "block",
                          width: `${CARD_SIZE}px`,
                          minWidth: `${CARD_SIZE}px`,
                          maxWidth: `${CARD_SIZE}px`,
                          flex: `0 0 ${CARD_SIZE}px`,
                          textDecoration: "none",
                          scrollSnapAlign: "start",
                          textAlign: "left",
                          background: "transparent",
                          border: 0,
                          padding: 0,
                        }}
                        aria-label={`Open ${
                          business?.name ||
                          "Instagram"
                        } image`}
                      >
                        <div
                          style={{
                            width: `${CARD_SIZE}px`,
                            height: `${CARD_SIZE}px`,
                            overflow: "hidden",
                            borderRadius: "22px",
                            background: "#E8DED1",
                            boxShadow:
                              "0 1px 3px rgba(0,0,0,0.12)",
                          }}
                        >
                          <img
                            src={
                              post.stored_image_url
                            }
                            alt={`${
                              business?.name ||
                              "KTownTriangle business"
                            } Instagram post`}
                            style={{
                              display: "block",
                              width: `${CARD_SIZE}px`,
                              height: `${CARD_SIZE}px`,
                              objectFit: "cover",
                            }}
                          />
                        </div>

                        <p
                          style={{
                            marginTop: "8px",
                            overflow: "hidden",
                            textOverflow:
                              "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "14px",
                            fontWeight: 900,
                            color: "#172033",
                          }}
                        >
                          {business?.name ||
                            "Local Business"}
                        </p>
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white px-4 py-5 text-center text-sm font-bold text-[#6B6257]">
            No Instagram posts from the last
            3 days.
          </div>
        )}
      </section>

      {selectedPost && (
        <div
          className="fixed inset-0 z-[100] bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Instagram image preview"
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
            href={
              selectedPost.instagram_post_url
            }
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) =>
              event.stopPropagation()
            }
            className="absolute bottom-5 right-5 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-[#C44873] text-white shadow-xl"
            aria-label="Open on Instagram"
          >
            <InstagramLogo />
          </a>

          <div className="flex h-full w-full items-center justify-center">
            <img
              src={
                selectedPost.stored_image_url
              }
              alt="Instagram post"
              onClick={(event) =>
                event.stopPropagation()
              }
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