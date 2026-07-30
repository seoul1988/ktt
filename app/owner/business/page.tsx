"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type BusinessRow = {
  business_id: number;
  businesses:
    | {
        id: number;
        name: string | null;
        address: string | null;
        image_url: string | null;
      }
    | {
        id: number;
        name: string | null;
        address: string | null;
        image_url: string | null;
      }[]
    | null;
};

type Business = {
  id: number;
  name: string;
  address: string;
  imageUrl: string | null;
};

export default function OwnerBusinessesPage() {
  const [businesses, setBusinesses] =
    useState<Business[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let alive = true;

    async function loadBusinesses() {
      try {
        setLoading(true);
        setError("");

        const {
          data: {
            user,
          },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        const { data, error: queryError } =
          await supabase
            .from("business_owners")
            .select(`
              business_id,
              businesses (
                id,
                name,
                address,
                image_url
              )
            `)
            .eq("user_id", user.id);

        if (queryError) {
          throw queryError;
        }

        const rows =
          (data || []) as BusinessRow[];

        const nextBusinesses = rows
          .map((row) => {
            const joined = Array.isArray(
              row.businesses,
            )
              ? row.businesses[0]
              : row.businesses;

            if (!joined) {
              return null;
            }

            return {
              id: joined.id,
              name:
                joined.name ||
                `Business #${joined.id}`,
              address: joined.address || "",
              imageUrl:
                joined.image_url || null,
            };
          })
          .filter(
            (
              business,
            ): business is Business =>
              business !== null,
          );

        if (alive) {
          setBusinesses(nextBusinesses);
        }
      } catch (loadError) {
        console.error(loadError);

        if (alive) {
          setError(
            "비즈니스 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    loadBusinesses();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F5F0] px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="h-9 w-52 animate-pulse rounded-xl bg-gray-200" />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-40 animate-pulse rounded-3xl bg-white"
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F5F0] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#B64032]">
            Owner Dashboard
          </p>

          <h1 className="mt-2 text-3xl font-black text-[#172033]">
            내 비즈니스
          </h1>

          <p className="mt-2 text-sm font-medium text-[#667085]">
            관리할 비즈니스를 선택하세요.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        {!error && businesses.length === 0 && (
          <div className="mt-7 rounded-3xl border border-[#E9DED0] bg-white p-8 text-center shadow-sm">
            <div className="text-4xl">
              🏪
            </div>

            <h2 className="mt-4 text-xl font-black text-[#172033]">
              연결된 비즈니스가 없습니다
            </h2>

            <p className="mt-2 text-sm font-medium text-[#667085]">
              비즈니스 오너 승인이 완료되면 이곳에서 사이트를 관리할 수 있습니다.
            </p>

            <Link
              href="/business/new"
              className="mt-5 inline-flex rounded-xl bg-[#B64032] px-5 py-3 text-sm font-black text-white"
            >
              비즈니스 등록하기
            </Link>
          </div>
        )}

        <section className="mt-7 grid gap-4 sm:grid-cols-2">
          {businesses.map((business) => (
            <Link
              key={business.id}
              href={`/owner/businesses/${business.id}/manage`}
              className="overflow-hidden rounded-3xl border border-[#E9DED0] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex min-h-40">
                <div className="flex w-32 shrink-0 items-center justify-center bg-[#F1E8DD]">
                  {business.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={business.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">
                      🏪
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center p-5">
                  <div className="truncate text-lg font-black text-[#172033]">
                    {business.name}
                  </div>

                  {business.address && (
                    <div className="mt-2 line-clamp-2 text-sm font-medium text-[#667085]">
                      {business.address}
                    </div>
                  )}

                  <div className="mt-4 text-sm font-black text-[#B64032]">
                    사이트 관리 →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}