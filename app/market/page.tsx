import Link from "next/link";
import { supabase } from "../../lib/supabase";
import CommunityBottomNav from "../components/CommunityBottomNav";
import ProfileButton from "../components/ProfileButton";

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
  listing_type?: "individual" | "bundle" | null;
  bundle_id?: string | null;
  created_at?: string | null;
};

type MarketListEntry = {
  key: string;
  representative: MarketItem;
  items: MarketItem[];
  isBundle: boolean;
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

function getBundleStatus(items: MarketItem[]) {
  if (items.length === 0) return null;

  if (items.every((item) => item.status === "sold")) {
    return "sold";
  }

  if (
    items.some(
      (item) =>
        !item.status ||
        item.status === "available",
    )
  ) {
    return "available";
  }

  if (
    items.some(
      (item) => item.status === "reserved",
    )
  ) {
    return "reserved";
  }

  return items[0].status;
}

function buildMarketEntries(
  items: MarketItem[],
): MarketListEntry[] {
  const bundleGroups =
    new Map<string, MarketItem[]>();

  const individualEntries:
    MarketListEntry[] = [];

  for (const item of items) {
    const bundleId =
      typeof item.bundle_id === "string"
        ? item.bundle_id.trim()
        : "";

    if (bundleId) {
      const currentGroup =
        bundleGroups.get(bundleId) || [];

      currentGroup.push(item);

      bundleGroups.set(
        bundleId,
        currentGroup,
      );

      continue;
    }

    individualEntries.push({
      key: `item-${item.id}`,
      representative: item,
      items: [item],
      isBundle: false,
    });
  }

  const bundleEntries:
    MarketListEntry[] = Array.from(
      bundleGroups.entries(),
    ).map(
      ([bundleId, bundleItems]) => {
        const sortedBundleItems = [
          ...bundleItems,
        ].sort((a, b) => {
          const aTime = new Date(
            a.created_at || 0,
          ).getTime();

          const bTime = new Date(
            b.created_at || 0,
          ).getTime();

          return aTime - bTime;
        });

        return {
          key: `bundle-${bundleId}`,
          representative:
            sortedBundleItems[0],
          items: sortedBundleItems,
          isBundle: true,
        };
      },
    );

  const allEntries = [
    ...bundleEntries,
    ...individualEntries,
  ];

  allEntries.sort((a, b) => {
    const aTimes = a.items.map(
      (item) =>
        new Date(
          item.created_at || 0,
        ).getTime(),
    );

    const bTimes = b.items.map(
      (item) =>
        new Date(
          item.created_at || 0,
        ).getTime(),
    );

    const aNewest =
      aTimes.length > 0
        ? Math.max(...aTimes)
        : 0;

    const bNewest =
      bTimes.length > 0
        ? Math.max(...bTimes)
        : 0;

    return bNewest - aNewest;
  });

  return allEntries;
}

export default async function MarketPage() {
  const { data, error } = await supabase
    .from("market_items")
    .select(
      `
        id,
        title,
        price,
        status,
        location,
        category,
        condition,
        description,
        images,
        video_url,
        listing_type,
        bundle_id,
        created_at
      `,
    )
    .or("status.is.null,status.neq.hidden")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-6">
        상품 불러오기 실패: {error.message}
      </div>
    );
  }

  const items = (data || []) as MarketItem[];
  const entries = buildMarketEntries(items);
  return (
    <main className="min-h-screen bg-[#F8F3EC] p-4 pb-28">
      <div className="mx-auto w-full max-w-xl">
        <div className="relative mb-5 flex items-center">
<Link
            href="/community/hub"
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033] shadow"
          >
            ← Back
          </Link>

          <h1 className="absolute left-1/2 -translate-x-1/2 text-2xl font-black text-[#172033]">
            벼룩시장
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/market/my"
              className="rounded-full border border-[#172033] px-2.5 py-1 text-[11px] font-bold text-[#172033]"
            >
              내 물품
            </Link>

            <Link
              href="/market/new"
              className="rounded-full bg-[#172033] px-2.5 py-1 text-[11px] font-bold text-white"
            >
              + 등록
            </Link>

            <ProfileButton />
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow">
            <p className="text-sm font-bold text-gray-500">
              등록된 상품이 없습니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {entries.map((entry) => {
              const item = entry.representative;

              const displayStatus = entry.isBundle
                ? getBundleStatus(entry.items)
                : item.status;

              const isSold = displayStatus === "sold";

              const firstImage = Array.isArray(item.images)
                ? item.images[0]
                : null;

              const firstItemImageCount = Array.isArray(
                item.images,
              )
                ? item.images.length
                : 0;

              const totalBundleImages = entry.items.reduce(
                (total, bundleItem) =>
                  total +
                  (Array.isArray(bundleItem.images)
                    ? bundleItem.images.length
                    : 0),
                0,
              );

              const card = (
                <div
                  className={`flex h-[380px] flex-col overflow-hidden rounded-2xl bg-white shadow ${
                    isSold
                      ? "cursor-not-allowed opacity-70"
                      : ""
                  }`}
                >
                  <div className="relative h-[255px] shrink-0 overflow-hidden bg-gray-200">
                    {firstImage ? (
                      <img
                        src={firstImage}
                        alt={
                          entry.isBundle
                            ? `${item.title} 묶음 대표사진`
                            : item.title
                        }
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-gray-400">
                        이미지 없음
                      </div>
                    )}

                    <div className="absolute left-2 top-2 z-20">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black text-white ${statusClass(
                          displayStatus,
                        )}`}
                      >
                        {statusLabel(displayStatus)}
                      </span>
                    </div>

                    {entry.isBundle ? (
                      <div className="absolute right-2 top-2 z-20 rounded-full bg-purple-700 px-2 py-1 text-[10px] font-black text-white">
                        묶음 {entry.items.length}개
                      </div>
                    ) : (
                      item.video_url && (
                        <div className="absolute right-2 top-2 z-20 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white">
                          VIDEO
                        </div>
                      )
                    )}

                    {entry.isBundle ? (
                      totalBundleImages > 1 && (
                        <div className="absolute right-2 top-9 z-20 rounded-full bg-black/80 px-2 py-1 text-[10px] font-black text-white">
                          사진 {totalBundleImages}장
                        </div>
                      )
                    ) : (
                      firstItemImageCount > 1 && (
                        <div className="absolute right-2 top-9 z-20 rounded-full bg-black/80 px-2 py-1 text-[10px] font-black text-white">
                          1/{firstItemImageCount}
                        </div>
                      )
                    )}

                    <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/85 px-3 py-2 text-white">
                      <h2 className="line-clamp-1 text-sm font-black leading-tight">
                        {item.title}
                      </h2>

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-sm font-black text-red-400">
                          $
                          {Number(
                            item.price || 0,
                          ).toLocaleString()}
                        </p>

                        {entry.isBundle ? (
                          <span className="line-clamp-1 text-[10px] font-black leading-tight text-purple-200">
                            상품 {entry.items.length}개 보기
                          </span>
                        ) : (
                          item.location && (
                            <span className="line-clamp-1 text-[10px] font-bold leading-tight text-white/90">
                              {item.location}
                            </span>
                          )
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
                      {entry.isBundle ? (
                        <span className="rounded-full bg-purple-100 px-2 py-1 text-[10px] font-black text-purple-700">
                          묶음상품
                        </span>
                      ) : (
                        item.category && (
                          <span className="rounded-full bg-[#172033]/10 px-2 py-1 text-[10px] font-black text-[#172033]">
                            {item.category}
                          </span>
                        )
                      )}

                      <span className="line-clamp-1 text-[11px] font-bold text-gray-500">
                        {entry.isBundle
                          ? `${entry.items.length}개 상품`
                          : item.condition || ""}
                      </span>
                    </div>

                    <div className="mt-2 min-h-[34px]">
                      {entry.isBundle ? (
                        <p className="line-clamp-2 text-xs text-gray-600">
                          클릭하면 묶음에 포함된 모든 상품을 확인할 수 있습니다.
                        </p>
                      ) : (
                        item.description && (
                          <p className="line-clamp-2 text-xs text-gray-600">
                            {item.description}
                          </p>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );

              if (isSold) {
                return (
                  <div key={entry.key}>
                    {card}
                  </div>
                );
              }

              return (
                <Link
                  key={entry.key}
                  href={`/market/${item.id}`}
                >
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