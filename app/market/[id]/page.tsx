import Link from "next/link";
import { supabase } from "../../../lib/supabase";

export default async function MarketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: item } = await supabase
    .from("market_items")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!item) {
    return <div className="p-6">상품을 찾을 수 없습니다.</div>;
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-24">
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl bg-white shadow">
        <div className="h-72 bg-gray-200">
          {item.images?.[0] && (
            <img
              src={item.images[0]}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          )}
        </div>

        <div className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-[#172033] px-3 py-1 text-xs font-bold text-white">
              {item.status === "available" ? "판매중" : item.status}
            </span>

            <span className="text-xs font-bold text-gray-500">
              {item.category}
            </span>
          </div>

          <h1 className="text-2xl font-black text-[#172033]">{item.title}</h1>

          <p className="mt-2 text-xl font-black text-[#C2410C]">
            ${item.price}
          </p>

          <p className="mt-2 text-sm text-gray-500">{item.location}</p>

          <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm">
            <p className="font-bold">상태</p>
            <p>{item.condition}</p>
          </div>

          <div className="mt-4 whitespace-pre-line text-sm leading-6">
            {item.description}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {item.phone && (
              <a
                href={`tel:${item.phone}`}
                className="rounded-full bg-[#172033] py-4 text-center text-sm font-black text-white"
              >
                전화하기
              </a>
            )}

            {item.phone && (
              <a
                href={`sms:${item.phone}`}
                className="rounded-full bg-[#C2410C] py-4 text-center text-sm font-black text-white"
              >
                문자하기
              </a>
            )}
          </div>

          <Link
            href={`/market/seller/${item.seller_id}`}
            className="mt-4 block rounded-full border py-4 text-center text-sm font-black"
          >
            판매자의 다른 상품 보기
          </Link>
        </div>
      </div>
    </main>
  );
}