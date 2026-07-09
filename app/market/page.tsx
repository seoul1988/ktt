import Link from "next/link";
import { supabase } from "../../lib/supabase";
import CommunityBottomNav from "../components/CommunityBottomNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MarketItem = {
  id: number;
  title: string;
  price: number | null;
  status: string | null;
  location: string | null;
  category: string | null;
  condition: string | null;
  description: string | null;
  images: string[] | null;
  video_url?: string | null;
};

function statusLabel(status: string | null) {
  if (status === "available") return "판매중";
  if (status === "reserved") return "예약중";
  if (status === "sold") return "판매완료";
  return status || "상태없음";
}

function statusClass(status: string | null) {
  if (status === "available") return "bg-green-600";
  if (status === "reserved") return "bg-yellow-500";
  if (status === "sold") return "bg-gray-500";
  return "bg-gray-400";
}

export default async function MarketPage() {
  const { data, error } = await supabase
    .from("market_items")
    .select("*")
    .or("status.is.null,status.neq.hidden")
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-6">상품 불러오기 실패: {error.message}</div>;
  }

  const items = (data || []) as MarketItem[];

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#172033]">벼룩시장</h1>

          <div className="flex gap-2">
            <Link
              href="/market/my"
              className="rounded-full border border-[#172033] px-4 py-2 text-sm font-bold text-[#172033]"
            >
              내 물품
            </Link>

            <Link
              href="/market/new"
              className="rounded-full bg-[#172033] px-4 py-2 text-sm font-bold text-white"
            >
              + 등록
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow">
            <p className="text-sm font-bold text-gray-500">
              등록된 상품이 없습니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item) => {
              const isSold = item.status === "sold";

              const card = (
                <div
                  className={`flex h-[285px] flex-col overflow-hidden rounded-2xl bg-white shadow ${
                    isSold ? "cursor-not-allowed opacity-70" : ""
                  }`}
                >
                  <div className="relative h-52 bg-gray-200">
                    {item.images?.[0] ? (
                      <img
                        src={item.images[0]}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-gray-400">
                        이미지 없음
                      </div>
                    )}

                    <div className="absolute left-2 top-2 z-20">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black text-white ${statusClass(
                          item.status
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    {item.video_url && (
                      <div className="absolute right-2 top-2 z-20 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">
                        VIDEO
                      </div>
                    )}

                    {Array.isArray(item.images) && item.images.length > 1 && (
                      <div className="absolute right-2 top-9 z-20 rounded-full bg-black/80 px-2 py-1 text-[10px] font-black text-white">
                        1/{item.images.length}
                      </div>
                    )}

                    <div className="absolute -bottom-19 left-0 right-0 z-20 bg-black/85 px-3 py-1.5 text-white">
                      <h2 className="line-clamp-1 text-sm font-black leading-tight">
                        {item.title}
                      </h2>

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-red-400">
						  ${Number(item.price || 0).toLocaleString()}
						</p>

                        {item.location && (
                          <span className="line-clamp-1 text-[10px] font-bold leading-tight text-white/90">
                            {item.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSold && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45">
                        <span className="rounded-xl bg-white px-4 py-2 text-sm font-black text-red-600">
                          판매완료
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-3">
                    <div className="flex items-center justify-between gap-2">
                      {item.category && (
                        <span className="rounded-full bg-[#172033]/10 px-2 py-1 text-[10px] font-black text-[#172033]">
                          {item.category}
                        </span>
                      )}

                      <span className="line-clamp-1 text-[11px] font-bold text-gray-500">
                        {item.condition || ""}
                      </span>
                    </div>

                    <div className="mt-2 min-h-[34px]">
                      {item.description && (
                        <p className="line-clamp-2 text-xs text-gray-600">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );

              if (isSold) {
                return <div key={item.id}>{card}</div>;
              }

              return (
                <Link key={item.id} href={`/market/${item.id}`}>
                  {card}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <CommunityBottomNav activeNav="market" />
    </main>
  );
}

