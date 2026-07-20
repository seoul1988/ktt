"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Business = {
  id: number | string;
  name?: string | null;
  business_name?: string | null;
  category?: string | null;
  category_name?: string | null;
  city?: string | null;
  address?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  hidden?: boolean | null;
};

function normalizeSearchText(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\\s+/g, " ")
    .trim();
}

function getBusinessName(business: Business) {
  return business.name || business.business_name || "Business";
}

function getBusinessImage(business: Business) {
  if (Array.isArray(business.images) && business.images.length > 0) {
    return business.images[0];
  }

  return business.image_url || "/event.png";
}

export default function BusinessSearchBookmark() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function closeSearch() {
    setIsOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 250);

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeSearch();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || hasLoaded) return;

    let cancelled = false;

    async function loadBusinesses() {
      setIsLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("hidden", false)
        .order("name", { ascending: true })
        .limit(1000);

      if (cancelled) return;

      if (error) {
        console.error("Business search load error:", error);
        setBusinesses([]);
        setErrorMessage(error.message);
        setHasLoaded(true);
        setIsLoading(false);
        return;
      }

      setBusinesses((data || []) as Business[]);
      setHasLoaded(true);
      setIsLoading(false);
    }

    loadBusinesses();

    return () => {
      cancelled = true;
    };
  }, [isOpen, hasLoaded]);

  const results = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) return [];

    const searchWords = normalizedQuery
      .split(" ")
      .map((word) => word.trim())
      .filter(Boolean);

    return businesses
      .filter((business) => {
        const searchableText = normalizeSearchText(
          [
            business.name,
            business.business_name,
            business.category,
            business.category_name,
            business.city,
            business.address,
          ]
            .filter(Boolean)
            .join(" "),
        );

        return searchWords.every((word) =>
          searchableText.includes(word),
        );
      })
      .slice(0, 50);
  }, [businesses, query]);

  return (
    <>
<button
  type="button"
  onClick={() => setIsOpen(true)}
  aria-label="Search businesses"
  className="
    fixed
    right-0
    bottom-[calc(8rem+env(safe-area-inset-bottom,0px))]
    z-[900]
    flex
    h-9
    w-9
    items-center
    justify-center
    rounded-full
    bg-[#C4483A]
    text-white
    shadow-xl
    transition
    duration-200
    hover:scale-105
    active:scale-95
  "
>
  <span className="text-lg">🔍</span>
</button>

      <div
        onPointerDown={closeSearch}
        className={`fixed inset-0 z-[2000] bg-black/40 backdrop-blur-md transition-opacity duration-300 ${
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Business search"
          onPointerDown={(event) => event.stopPropagation()}
          className={`absolute right-0 top-0 flex h-full w-[92%] max-w-md flex-col bg-[#F8F3EC] pt-[calc(env(safe-area-inset-top,0px)+1rem)] shadow-2xl transition-transform duration-300 ease-out ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
		
		<div className="px-5 pb-3">
  <h2 className="text-2xl font-black text-[#172033]">
    Search
  </h2>

  <p className="mt-1 text-sm text-gray-500">
    Find businesses, restaurants, services and more
  </p>
</div>
          <div className="flex items-center gap-3 px-4">
            <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-white px-4 shadow-sm">
              <span className="mr-2 text-lg">🔍</span>

              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search businesses..."
                autoComplete="off"
                className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold text-[#172033] outline-none placeholder:font-normal placeholder:text-gray-400"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-500 active:bg-gray-100"
                >
                  ×
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={closeSearch}
              aria-label="Close search"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#172033] text-xl text-white transition active:scale-90 active:bg-[#2A3650]"
            >
              →
            </button>
          </div>

          <div className="mt-4 flex-1 overflow-y-auto px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
            {isLoading ? (
              <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#C4483A]" />
                <p className="mt-3 text-sm font-bold text-gray-500">Loading businesses...</p>
              </div>
            ) : errorMessage ? (
              <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
                <p className="font-black text-red-600">Unable to load businesses.</p>
                <p className="mt-2 break-words text-sm text-gray-500">{errorMessage}</p>
              </div>
            ) : !query.trim() ? (
              <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
                <div className="text-4xl">🏪</div>
                <p className="mt-3 font-black">Find a business</p>
                <p className="mt-2 text-sm text-gray-500">
                  Search by business name, category, city, or address.
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
                <div className="text-4xl">🔎</div>
                <p className="mt-3 font-black">No businesses found</p>
                <p className="mt-2 text-sm text-gray-500">
                  Try another business name or category.
                </p>
              </div>
            ) : (
              <>
                <p className="mb-3 px-1 text-sm font-bold text-gray-500">
                  {results.length} result{results.length === 1 ? "" : "s"}
                </p>

                <div className="space-y-3">
                  {results.map((business) => {
                    const businessName = getBusinessName(business);
                    const businessImage = getBusinessImage(business);

                    return (
                      <Link
                        key={business.id}
                        href={`/business/${business.id}`}
                        onClick={closeSearch}
                        className="flex w-full items-center gap-4 rounded-2xl bg-white p-3 shadow-sm transition active:scale-[0.97] active:bg-gray-100"
                      >
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1">
						  <img
							src={businessImage}
							alt={businessName}
							loading="lazy"
							decoding="async"
							className="h-full w-full object-contain"
							onError={(event) => {
							  event.currentTarget.src = "/event.png";
							}}
						  />
						</div>

                        <div className="min-w-0 flex-1 text-left">
                          <h3 className="truncate text-base font-black text-[#172033]">
                            {businessName}
                          </h3>

                          {(business.category || business.category_name || business.city) && (
                            <p className="mt-1 truncate text-sm text-gray-500">
                              {[
                                business.category || business.category_name,
                                business.city,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}

                          {business.address && (
                            <p className="mt-1 line-clamp-1 text-xs text-gray-400">
                              {business.address}
                            </p>
                          )}
                        </div>

                        <span className="text-xl text-gray-300">›</span>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </>
  );
}