export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/BottomNav";
import ProfileButton from "../components/ProfileButton";

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function splitCategories(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();

        if (item && typeof item === "object") {
          return String(
            (item as any).name ??
              (item as any).category ??
              (item as any).category_name ??
              ""
          ).trim();
        }

        return "";
      })
      .filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isComingSoonBusiness(business: any) {
  const values = [
    ...splitCategories(business?.category),
    ...splitCategories(business?.category_name),
    ...splitCategories(business?.categories),
  ].map(normalize);

  return values.some(
    (value) =>
      value === "coming soon" ||
      value.includes("coming soon")
  );
}

export default async function ComingSoonPage() {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("hidden", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Coming Soon businesses load error:", error);
  }

  const businesses = (data || []).filter(isComingSoonBusiness);

  return (
    <main className="min-h-[100dvh] bg-[#F8F3EC] px-4 pb-32 pt-6 text-[#172033]">
      <div className="mx-auto max-w-xl">
        <div className="relative mb-5 flex min-h-[48px] items-center justify-center">
          <Link
            href="/"
            className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-xl font-black shadow-sm"
            aria-label="Back to home"
          >
            ‹
          </Link>

          <h1 className="text-center text-[24px] font-black leading-tight">
            Coming Soon
          </h1>

          <div className="absolute right-0">
            <ProfileButton />
          </div>
        </div>

        {businesses.length > 0 ? (
          <div className="overflow-hidden rounded-[22px] border border-[#E7E1D8] bg-white shadow-sm">
            {businesses.map((business: any, index: number) => {
              const image =
                business.thumbnail_url ||
                business.image_url ||
                "/event.png";

              return (
                <Link
                  key={business.id}
                  href={`/business/${business.id}`}
                  className={`flex min-h-[108px] items-center gap-3 px-3 py-3 transition hover:bg-[#FFFDF9] ${
                    index !== businesses.length - 1
                      ? "border-b border-[#EEE9E2]"
                      : ""
                  }`}
                >
                  <div className="h-[82px] w-[100px] shrink-0 overflow-hidden rounded-xl bg-gray-100">
                    <img
                      src={image}
                      alt={business.name || "Coming Soon"}
                      className="h-full w-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-600">
                      Coming Soon
                    </p>

                    <h2 className="mt-1 line-clamp-1 text-[17px] font-black text-[#071A3D]">
                      {business.name}
                    </h2>

                    <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-gray-500">
                      {business.city
                        ? `${business.category || "Coming Soon"} · ${business.city}`
                        : business.category || "Coming Soon"}
                    </p>
                  </div>

                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-black text-[#071A3D]">
                    ›
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[22px] border border-[#E7E1D8] bg-white px-5 py-12 text-center shadow-sm">
            <p className="font-black text-[#172033]">
              No Coming Soon businesses yet.
            </p>
          </div>
        )}
      </div>

      <BottomNav activeNav="home" />
    </main>
  );
}