// app/deals/[id]/page.tsx

import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../../components/BottomNav";
import ProfileButton from "../../components/ProfileButton";
import DealManageButtons from "./DealManageButtons";
import DealImageSlider from "./DealImageSlider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DealItem = {
  id: string;
  deal_id: string;
  name: string | null;
  original_price: number | null;
  sale_price: number | null;
  description: string | null;
  image_url: string | null;
  sort_order: number | null;
};

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: deal, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <p className="font-bold text-red-600">
          Deal 불러오기 실패: {error.message}
        </p>
      </main>
    );
  }

  if (!deal) {
    return (
      <main className="min-h-screen bg-[#F8F3EC] p-5 text-[#172033]">
        <div className="mx-auto max-w-md">
          <Link
            href="/deals"
            className="mb-5 inline-block rounded-full bg-white px-4 py-2 text-sm font-black shadow"
          >
            ← Back
          </Link>

          <div className="rounded-3xl bg-white p-8 text-center shadow">
            <p className="font-bold text-gray-500">Deal을 찾을 수 없습니다.</p>
            <p className="mt-2 text-xs text-gray-400">ID: {id}</p>
          </div>
        </div>

        <BottomNav />
      </main>
    );
  }

  const { data: business, error: businessError } = deal.business_id
    ? await supabase
        .from("businesses")
        .select("id, name, phone, address")
        .eq("id", deal.business_id)
        .maybeSingle()
    : { data: null, error: null };

  if (businessError) {
    console.log("BUSINESS ERROR:", businessError.message);
  }

  const { data: dealItemsData, error: dealItemsError } = await supabase
    .from("deal_items")
    .select(`
      id,
      deal_id,
      name,
      original_price,
      sale_price,
      description,
      image_url,
      sort_order
    `)
    .eq("deal_id", id)
    .order("sort_order", { ascending: true, nullsFirst: false });

  if (dealItemsError) {
    console.log("DEAL ITEMS ERROR:", dealItemsError.message);
  }

  const dealItems = (dealItemsData || []) as DealItem[];

  const itemImages = dealItems
    .map((item) => item.image_url)
    .filter((url): url is string => Boolean(url));

  const sliderImages = [
    ...(deal.image_url ? [deal.image_url] : []),
    ...itemImages,
  ];

  const finalSliderImages =
    sliderImages.length > 0 ? sliderImages : ["/event.png"];

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-28 text-[#172033]">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/deals"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black shadow"
          >
            ←
          </Link>

          <h1 className="text-2xl font-black">🔥 Deals</h1>

          <ProfileButton />
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-white shadow-xl">
          <DealImageSlider
            images={finalSliderImages}
            title={deal.title || "Deal"}
          />
        </div>

        <section className="pt-5">
          <div className="rounded-3xl bg-white p-5 shadow-xl">
            <div className="mb-4 rounded-2xl border border-gray-100 bg-[#F8F3EC] p-4">
              <h2 className="text-xl font-black">
                {business?.name || "Business"}
              </h2>

              {business?.address && (
                <p className="mt-1 text-sm text-gray-700">
                  📍 {business.address}
                </p>
              )}

              <div className="mt-3 flex gap-2">
                {business?.phone && (
                  <a
                    href={`tel:${business.phone}`}
                    className="flex-1 rounded-full bg-green-600 px-4 py-2 text-center text-xs font-black text-white"
                  >
                    📞 전화
                  </a>
                )}

                {business?.address && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      business.address
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-full bg-[#172033] px-4 py-2 text-center text-xs font-black text-white"
                  >
                    📍 길찾기
                  </a>
                )}
              </div>
            </div>

            <p className="text-sm font-bold text-[#C4483A]">
              {deal.start_date || "Available Now"}
              {deal.end_date ? ` ~ ${deal.end_date}` : ""}
            </p>

            <div className="mt-2 flex items-start justify-between gap-3">
              <h1 className="min-w-0 flex-1 text-2xl font-black leading-tight">
                {deal.title}
              </h1>

              <DealManageButtons
                dealId={deal.id}
                ownerId={deal.owner_id}
                businessId={deal.business_id}
                imageUrl={deal.image_url}
              />
            </div>

            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-gray-700">
              {deal.description || "No description"}
            </p>
          </div>
        </section>

        {dealItems.length > 0 && (
          <section className="pt-5">
            <div className="rounded-3xl bg-white p-5 shadow-xl">
              <h2 className="mb-4 text-xl font-black">Deal Menu</h2>

              <div className="space-y-4">
                {dealItems.map((item) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-3xl border border-[#EFE3D4] bg-white shadow-sm"
                  >
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.name || "Deal Menu"}
                        className="h-44 w-full object-cover"
                      />
                    )}

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 flex-1 text-lg font-black">
                          {item.name}
                        </h3>

                        <div className="shrink-0 text-right">
                          {item.original_price !== null && (
                            <p className="text-xs font-bold text-gray-400 line-through">
                              ${Number(item.original_price).toFixed(2)}
                            </p>
                          )}

                          {item.sale_price !== null && (
                            <p className="text-lg font-black text-[#C4483A]">
                              ${Number(item.sale_price).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>

                      {item.description && (
                        <div className="mt-3 rounded-2xl bg-[#F8F3EC] px-4 py-3">
                          <p className="whitespace-pre-line text-sm font-semibold leading-6 text-[#4F473F]">
                            {item.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      <BottomNav activeNav="deals" />
    </main>
  );
}