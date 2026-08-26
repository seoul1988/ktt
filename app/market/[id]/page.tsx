import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import MarketMediaSlider from "../../components/MarketMediaSlider";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import MarketItemActions from "../../components/MarketItemActions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MarketItem = {
  id: number;
  seller_id: string | null;
  title: string;
  price: number | null;
  status: string | null;
  location: string | null;
  category: string | null;
  condition: string | null;
  description: string | null;
  images: string[] | null;
  video_url: string | null;
  phone: string | number | null;
  email: string | null;
  listing_type: string | null;
  bundle_id: string | null;
  created_at: string | null;
};

function getStatusLabel(status: string | null) {
  if (status === "available") return "판매중";
  if (status === "reserved") return "예약중";
  if (status === "sold") return "판매완료";
  return status || "판매중";
}

function getStatusClass(status: string | null) {
  if (status === "available") return "bg-green-600";
  if (status === "reserved") return "bg-yellow-500";
  if (status === "sold") return "bg-gray-500";
  return "bg-[#172033]";
}

function isFreeItem(item: MarketItem) {
  return (
    item.category === "무료나눔" ||
    item.price === null ||
    item.price === undefined ||
    Number(item.price) === 0
  );
}

function getItemMedia(item: MarketItem) {
  const images = (
    Array.isArray(item.images) ? item.images : []
  ).filter(Boolean);

  return {
    images,
    media: [
      ...images.map((url) => ({
        type: "image" as const,
        url,
      })),
      ...(item.video_url
        ? [
            {
              type: "video" as const,
              url: item.video_url,
            },
          ]
        : []),
    ],
  };
}

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id) {
    return (
      <div className="min-h-screen bg-[#F8F3EC] p-6">
        상품 주소가 잘못되었습니다.
      </div>
    );
  }

  const {
    data: selectedItemData,
    error: selectedItemError,
  } = await supabase
    .from("market_items")
    .select(
      "id,seller_id,title,price,status,location,category,condition,description,images,video_url,phone,email,listing_type,bundle_id,created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (selectedItemError) {
    return (
      <div className="min-h-screen bg-[#F8F3EC] p-6">
        상품 불러오기 실패: {selectedItemError.message}
      </div>
    );
  }

  if (!selectedItemData) {
    return (
      <div className="min-h-screen bg-[#F8F3EC] p-6">
        상품을 찾을 수 없습니다.
      </div>
    );
  }

  const selectedItem = selectedItemData as MarketItem;

  // 현재 로그인 사용자 및 관리자 여부 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("role,is_admin")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const role = String(profile?.role || "")
    .trim()
    .toLowerCase();

  const isAdmin =
    role === "admin" ||
    role === "super_admin" ||
    profile?.is_admin === true;

  const canManageSelectedItem =
    !!user &&
    (
      selectedItem.seller_id === user.id ||
      isAdmin
    );

  const bundleId =
    typeof selectedItem.bundle_id === "string"
      ? selectedItem.bundle_id.trim()
      : "";

  let detailItems: MarketItem[] = [selectedItem];

  if (bundleId) {
    const { data: bundleData, error: bundleError } =
      await supabase
        .from("market_items")
        .select(
          "id,seller_id,title,price,status,location,category,condition,description,images,video_url,phone,email,listing_type,bundle_id,created_at",
        )
        .eq("bundle_id", bundleId)
        .or("status.is.null,status.neq.hidden")
        .order("created_at", { ascending: true });

    if (bundleError) {
      return (
        <div className="min-h-screen bg-[#F8F3EC] p-6">
          묶음 상품 불러오기 실패: {bundleError.message}
        </div>
      );
    }

    if (Array.isArray(bundleData) && bundleData.length > 0) {
      detailItems = bundleData as MarketItem[];
    }
  }

  const isBundle =
    bundleId.length > 0 && detailItems.length > 1;

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-3 py-4 pb-72 sm:px-5">
      <div className="mx-auto mb-4 flex w-full max-w-xl items-center justify-between">
        <Link
          href="/market"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl font-black text-[#172033] shadow"
          aria-label="마켓 목록으로 돌아가기"
        >
          ←
        </Link>

        <div className="text-center">
          <h1 className="text-base font-black text-[#172033] sm:text-lg">
            {isBundle ? "묶음 상품 상세" : "상품 상세"}
          </h1>

          {isBundle && (
            <p className="mt-0.5 text-[11px] font-bold text-purple-700">
              총 {detailItems.length}개 상품
            </p>
          )}
        </div>

        <details className="relative">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-white text-2xl font-black text-[#172033] shadow">
            ⋯
          </summary>

          <div className="absolute right-0 top-12 z-[99999] w-44 overflow-hidden rounded-2xl bg-white text-sm font-bold shadow-xl">
            {canManageSelectedItem && (
              <Link
                href={`/market/${selectedItem.id}/edit`}
                className="block px-4 py-3 text-blue-600 hover:bg-blue-50"
              >
                ✏️ 상품 수정
              </Link>
            )}

            {selectedItem.seller_id && (
              <Link
                href={`/market/seller/${selectedItem.seller_id}`}
                className="block px-4 py-3 text-[#172033] hover:bg-gray-100"
              >
                판매자 상품
              </Link>
            )}

            <Link
              href="/market"
              className="block px-4 py-3 text-[#172033] hover:bg-gray-100"
            >
              목록으로
            </Link>
          </div>
        </details>
      </div>

      {isBundle && (
        <div className="mx-auto mb-4 w-full max-w-xl rounded-3xl border border-purple-200 bg-purple-50 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-purple-800">
                묶음 상품
              </p>
              <p className="mt-1 text-xs leading-5 text-purple-700">
                아래 상품들은 한 번에 함께 등록된 묶음입니다.
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-purple-700 px-3 py-1 text-xs font-black text-white">
              {detailItems.length}개
            </span>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-xl space-y-5">
        {detailItems.map((item, itemIndex) => {
          const { images, media } = getItemMedia(item);
          const statusLabel = getStatusLabel(item.status);
          const isFree = isFreeItem(item);

          return (
            <section
              key={item.id}
              className="overflow-hidden rounded-3xl bg-white shadow"
            >
              {isBundle && (
                <div className="flex items-center justify-between bg-[#172033] px-4 py-3 text-white">
                  <div>
                    <p className="text-[10px] font-bold text-white/70">
                      BUNDLE ITEM
                    </p>
                    <p className="text-sm font-black">
                      상품 {itemIndex + 1}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-black text-white ${getStatusClass(
                      item.status,
                    )}`}
                  >
                    {statusLabel}
                  </span>
                </div>
              )}

              {media.length > 0 ? (
                <MarketMediaSlider media={media} />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 text-sm font-bold text-gray-400 sm:aspect-video">
                  등록된 사진이 없습니다.
                </div>
              )}

              <div className="p-5 sm:p-7">
                {!isBundle && (
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold text-white ${getStatusClass(
                        item.status,
                      )}`}
                    >
                      {statusLabel}
                    </span>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                      {item.category || "기타"}
                    </span>
                  </div>
                )}

                {isBundle && (
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-700">
                      상품 {itemIndex + 1}/{detailItems.length}
                    </span>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                      {item.category || "기타"}
                    </span>
                  </div>
                )}

                <h2 className="break-words text-2xl font-black leading-tight text-[#172033] sm:text-3xl">
                  {item.title}
                </h2>

                <p className="mt-3 text-2xl font-black text-[#C2410C] sm:text-3xl">
                  {isFree
                    ? "무료나눔"
                    : `$${Number(item.price).toLocaleString()}`}
                </p>

                {item.location && (
                  <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-500 sm:text-base">
                    <span>📍</span>
                    <span>{item.location}</span>
                  </p>
                )}

                <div className="mt-5 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm sm:px-5 sm:py-4">
                  <span className="font-black text-[#172033]">
                    상품 상태
                  </span>

                  <span className="rounded-full bg-[#172033] px-3 py-1 text-xs font-black text-white">
                    {item.condition || "중고"}
                  </span>
                </div>

                {item.description && (
                  <div className="mt-5 rounded-2xl border border-gray-100 bg-white">
                    <h3 className="mb-2 text-sm font-black text-[#172033]">
                      상품 설명
                    </h3>

                    <p className="whitespace-pre-line text-sm leading-7 text-gray-700 sm:text-base">
                      {item.description}
                    </p>
                  </div>
                )}

                {!!user &&
                  (item.seller_id === user.id || isAdmin) && (
                    <Link
                      href={`/market/${item.id}/edit`}
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3.5 text-base font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
                    >
                      <span aria-hidden="true">✏️</span>
                      <span>상품 수정</span>
                    </Link>
                  )}

                <MarketItemActions
                  itemId={item.id}
                  sellerId={item.seller_id}
                  title={item.title}
                  phone={item.phone}
                  email={item.email}
                  imageUrls={images}
                  videoUrl={item.video_url}
                  currentStatus={item.status}
                />
              </div>
            </section>
          );
        })}
      </div>

      <CommunityBottomNav activeNav="market" />
    </main>
  );
}
