import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default async function MarketPage() {
  const { data: items } = await supabase
    .from("market_items")
    .select("*")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#172033]">벼룩시장</h1>

          <Link
            href="/market/new"
            className="rounded-full bg-[#172033] px-4 py-2 text-sm font-bold text-white"
          >
            + 등록
          </Link>
        </div>

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

                <p className="mt-1 text-sm font-bold text-[#C2410C]">
                  ${item.price}
                </p>

                <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                  {item.location}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}