import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import CommunityBottomNav from "../../../components/CommunityBottomNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SellerMarketPage({
  params,
}: {
  params: Promise<{ seller_id: string }>;
}) {
  const { seller_id } = await params;

  const { data: items, error } = await supabase
    .from("market_items")
    .select("*")
    .eq("seller_id", seller_id)
    .neq("status", "hidden")
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-6">상품 불러오기 실패: {error.message}</div>;
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-28">
      <div className="mx-auto mb-4 flex max-w-2xl items-center justify-between">
        <Link
          href="/market"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black text-[#172033] shadow"
        >
          ←
        </Link>

        <h1 className="text-base font-black text-[#172033]">
          판매자의 다른 상품
        </h1>

        <div className="h-10 w-10" />
      </div>

      <div className="mx-auto max-w-md">
        {!items || items.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center font-bold text-gray-500 shadow">
            이 판매자의 상품이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/market/${item.id}`}
                className="overflow-hidden rounded-2xl bg-white shadow"
              >
                <div className="h-32 bg-gray-200">
                  {item.images?.[0] ? (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs font-bold text-gray-400">
                      No Image
                    </div>
                  )}
                </div>

                <div className="p-3">
                  <h2 className="line-clamp-1 text-sm font-black text-[#172033]">
                    {item.title}
                  </h2>

                  <p className="text-sm font-bold text-[#C2410C]">
                    ${item.price}
                  </p>

                  <p className="text-xs text-gray-500">
                    {item.status === "available" ? "판매중" : item.status}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <CommunityBottomNav />
    </main>
  );
}