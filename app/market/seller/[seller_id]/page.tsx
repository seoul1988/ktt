import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

export default async function SellerMarketPage({
  params,
}: {
  params: { seller_id: string };
}) {
  const { data: items } = await supabase
    .from("market_items")
    .select("*")
    .eq("seller_id", params.seller_id)
    .neq("status", "hidden")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24">
      <div className="mx-auto max-w-md">
        <h1 className="mb-4 text-2xl font-black text-[#172033]">
          판매자의 다른 상품
        </h1>

        <div className="grid grid-cols-2 gap-3">
          {items?.map((item) => (
            <Link
              key={item.id}
              href={`/market/${item.id}`}
              className="overflow-hidden rounded-2xl bg-white shadow"
            >
              <div className="h-32 bg-gray-200">
                {item.images?.[0] && (
                  <img
                    src={item.images[0]}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>

              <div className="p-3">
                <h2 className="line-clamp-1 text-sm font-black">
                  {item.title}
                </h2>
                <p className="text-sm font-bold text-[#C2410C]">
                  ${item.price}
                </p>
                <p className="text-xs text-gray-500">{item.status}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}