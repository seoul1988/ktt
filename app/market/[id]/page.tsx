import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import MarketMediaSlider from "../../components/MarketMediaSlider";

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id) {
    return <div className="p-6">상품 주소가 잘못되었습니다.</div>;
  }

  const { data: item, error } = await supabase
    .from("market_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <div className="p-6">상품 불러오기 실패: {error.message}</div>;
  }

  if (!item) {
    return <div className="p-6">상품을 찾을 수 없습니다.</div>;
  }

  const media = [
    ...((item.images || []) as string[]).map((url) => ({
      type: "image" as const,
      url,
    })),
    ...(item.video_url
      ? [
          {
            type: "video" as const,
            url: item.video_url as string,
          },
        ]
      : []),
  ];

  const smsText = encodeURIComponent(
    `안녕하세요. 벼룩시장에 올리신 "${item.title}" 보고 연락드립니다. 아직 구매 가능할까요?`
  );

  const dealText = encodeURIComponent(
    `안녕하세요. "${item.title}" 가격 딜 가능할까요?`
  );

  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-28">
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl bg-white shadow">
        <MarketMediaSlider media={media} />

        <div className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-[#172033] px-3 py-1 text-xs font-bold text-white">
              {item.status === "available" ? "판매중" : item.status}
            </span>

            <span className="text-xs font-bold text-gray-500">
              {item.category}
            </span>
          </div>

          <h1 className="text-2xl font-black text-[#172033]">
            {item.title}
          </h1>

          <p className="mt-2 text-2xl font-black text-[#C2410C]">
            ${item.price}
          </p>

          <p className="mt-2 text-sm text-gray-500">{item.location}</p>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm">
  <span className="font-black text-[#172033]">
    상품 상태
  </span>

  <span className="rounded-full bg-[#172033] px-3 py-1 text-xs font-black text-white">
    {item.condition}
  </span>
</div>

          {item.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-6">
              {item.description}
            </p>
          )}

     <div className="mt-5 flex overflow-hidden rounded-full border border-[#172033]">
  <Link
    href={`/market/seller/${item.seller_id}`}
    className="flex-1 border-r border-[#172033] py-3 text-center text-sm font-black text-[#172033]"
  >
    판매자 상품
  </Link>

  <Link
    href="/market"
    className="flex-1 py-3 text-center text-sm font-black text-[#172033]"
  >
    목록으로
  </Link>
</div>
        </div>
      </div>

      <div className="fixed bottom-4 left-1/2 z-[9999] grid w-[92%] max-w-md -translate-x-1/2 grid-cols-3 gap-2">
        {item.phone ? (
          <>
            <a
              href={`tel:${item.phone}`}
              className="rounded-2xl bg-[#172033] py-2.5 text-center text-sm font-black text-white shadow-xl"
            >
              전화
            </a>

            <a
              href={`sms:${item.phone}?&body=${smsText}`}
              className="rounded-2xl bg-[#C2410C] py-2.5 text-center text-sm font-black text-white shadow-xl"
            >
              문자
            </a>

            <a
              href={`sms:${item.phone}?&body=${dealText}`}
              className="rounded-2xl bg-green-700 py-2.5 text-center text-sm font-black text-white shadow-xl"
            >
              딜하기
            </a>
          </>
        ) : (
          <div className="col-span-3 rounded-2xl bg-gray-400 py-3 text-center text-sm font-black text-white shadow-xl">
            연락처 없음
          </div>
        )}
      </div>
    </main>
  );
}