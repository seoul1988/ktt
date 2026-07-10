import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import MarketMediaSlider from "../../components/MarketMediaSlider";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import MarketManageButtons from "../../components/MarketManageButtons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  const { data: item, error } = await supabase
    .from("market_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8F3EC] p-6">
        상품 불러오기 실패: {error.message}
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#F8F3EC] p-6">
        상품을 찾을 수 없습니다.
      </div>
    );
  }

  const images = ((item.images || []) as string[]).filter(Boolean);

  const media = [
    ...images.map((url) => ({
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

  const phone = String(item.phone || "").trim();
  const email = String(item.email || "").trim();

  const hasPhone = Boolean(phone);
  const hasEmail = Boolean(email);

  const smsMessage = `안녕하세요. 벼룩시장에 올리신 "${item.title}" 보고 연락드립니다. 아직 구매 가능할까요?`;

  const dealMessage = `안녕하세요. "${item.title}" 가격 딜 가능할까요?`;

  const smsText = encodeURIComponent(smsMessage);
  const dealText = encodeURIComponent(dealMessage);

  const emailSubject = encodeURIComponent(
    `[KTown Triangle] ${item.title} 문의`
  );

  const emailBody = encodeURIComponent(smsMessage);

  const emailDealSubject = encodeURIComponent(
    `[KTown Triangle] ${item.title} 가격 문의`
  );

  const emailDealBody = encodeURIComponent(dealMessage);

  const statusLabel =
    item.status === "available"
      ? "판매중"
      : item.status === "reserved"
      ? "예약중"
      : item.status === "sold"
      ? "판매완료"
      : item.status || "판매중";

  const isFree =
    item.category === "무료나눔" ||
    item.price === null ||
    item.price === undefined ||
    Number(item.price) === 0;

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-3 py-4 pb-72 sm:px-5">
      {/* 상단 헤더 */}
      <div className="mx-auto mb-4 flex w-full max-w-xl items-center justify-between">
        <Link
          href="/market"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl font-black text-[#172033] shadow"
          aria-label="마켓 목록으로 돌아가기"
        >
          ←
        </Link>

        <h1 className="text-base font-black text-[#172033] sm:text-lg">
          상품 상세
        </h1>

        <details className="relative">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full bg-white text-2xl font-black text-[#172033] shadow">
            ⋯
          </summary>

          <div className="absolute right-0 top-12 z-[99999] w-44 overflow-hidden rounded-2xl bg-white text-sm font-bold shadow-xl">
            {item.seller_id && (
              <Link
                href={`/market/seller/${item.seller_id}`}
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

      {/* 상품 상세 카드 */}
      <div className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow">
        {media.length > 0 ? (
          <MarketMediaSlider media={media} />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-gray-100 text-sm font-bold text-gray-400 sm:aspect-video">
            등록된 사진이 없습니다.
          </div>
        )}

        <div className="p-5 sm:p-7">
          {/* 상태 및 카테고리 */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="rounded-full bg-[#172033] px-3 py-1 text-xs font-bold text-white">
              {statusLabel}
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
              {item.category || "기타"}
            </span>
          </div>

          {/* 제목 및 관리버튼 */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 flex-1 break-words text-2xl font-black leading-tight text-[#172033] sm:text-3xl">
              {item.title}
            </h1>

            <MarketManageButtons
              itemId={item.id}
              sellerId={item.seller_id || null}
              imageUrls={images}
              videoUrl={item.video_url || null}
            />
          </div>

          {/* 가격 */}
          <p className="mt-3 text-2xl font-black text-[#C2410C] sm:text-3xl">
            {isFree ? "무료나눔" : `$${Number(item.price).toLocaleString()}`}
          </p>

          {/* 지역 */}
          {item.location && (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-500 sm:text-base">
              <span>📍</span>
              <span>{item.location}</span>
            </p>
          )}

          {/* 상품 상태 */}
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-sm sm:px-5 sm:py-4">
            <span className="font-black text-[#172033]">상품 상태</span>

            <span className="rounded-full bg-[#172033] px-3 py-1 text-xs font-black text-white">
              {item.condition || "중고"}
            </span>
          </div>

          {/* 설명 */}
          {item.description && (
            <div className="mt-5 rounded-2xl border border-gray-100 bg-white">
              <h2 className="mb-2 text-sm font-black text-[#172033]">
                상품 설명
              </h2>

              <p className="whitespace-pre-line text-sm leading-7 text-gray-700 sm:text-base">
                {item.description}
              </p>
            </div>
          )}

          {/* 연락방법 표시 */}
          {(hasPhone || hasEmail) && (
            <div className="mt-5 rounded-2xl bg-[#F8F3EC] p-4">
              <h2 className="mb-3 text-sm font-black text-[#172033]">
                판매자 연락방법
              </h2>

              <div className="space-y-2 text-sm">
                {hasPhone && (
                  <div className="flex items-center gap-2">
                    <span>📞</span>

                    <a
                      href={`tel:${phone}`}
                      className="break-all font-bold text-[#172033]"
                    >
                      {phone}
                    </a>
                  </div>
                )}

                {hasEmail && (
                  <div className="flex items-center gap-2">
                    <span>📧</span>

                    <a
                      href={`mailto:${email}`}
                      className="break-all font-bold text-blue-700 underline"
                    >
                      {email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 판매자 상품 / 목록 */}
          <div className="mt-5 flex overflow-hidden rounded-full border border-[#172033]">
            {item.seller_id ? (
              <Link
                href={`/market/seller/${item.seller_id}`}
                className="flex-1 border-r border-[#172033] py-2.5 text-center text-sm font-black text-[#172033]"
              >
                판매자 상품
              </Link>
            ) : (
              <span className="flex-1 border-r border-[#172033] py-2.5 text-center text-sm font-black text-gray-400">
                판매자 정보 없음
              </span>
            )}

            <Link
              href="/market"
              className="flex-1 py-2.5 text-center text-sm font-black text-[#172033]"
            >
              목록으로
            </Link>
          </div>
        </div>
      </div>

      {/* 하단 연락 버튼 */}
      <div className="fixed bottom-24 left-1/2 z-[9999] w-[94%] max-w-xl -translate-x-1/2">
        <div className="rounded-3xl bg-white/95 p-3 shadow-2xl backdrop-blur">
          {hasPhone && hasEmail && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <a
                href={`tel:${phone}`}
                className="rounded-2xl bg-[#172033] py-3 text-center text-sm font-black text-white"
              >
                전화
              </a>

              <a
                href={`sms:${phone}?&body=${smsText}`}
                className="rounded-2xl bg-[#C2410C] py-3 text-center text-sm font-black text-white"
              >
                문자
              </a>

              <a
                href={`sms:${phone}?&body=${dealText}`}
                className="rounded-2xl bg-green-700 py-3 text-center text-sm font-black text-white"
              >
                딜하기
              </a>

              <a
                href={`mailto:${email}?subject=${emailSubject}&body=${emailBody}`}
                className="rounded-2xl bg-blue-700 py-3 text-center text-sm font-black text-white"
              >
                이메일
              </a>
            </div>
          )}

          {hasPhone && !hasEmail && (
            <div className="grid grid-cols-3 gap-2">
              <a
                href={`tel:${phone}`}
                className="rounded-2xl bg-[#172033] py-3 text-center text-sm font-black text-white"
              >
                전화
              </a>

              <a
                href={`sms:${phone}?&body=${smsText}`}
                className="rounded-2xl bg-[#C2410C] py-3 text-center text-sm font-black text-white"
              >
                문자
              </a>

              <a
                href={`sms:${phone}?&body=${dealText}`}
                className="rounded-2xl bg-green-700 py-3 text-center text-sm font-black text-white"
              >
                딜하기
              </a>
            </div>
          )}

          {!hasPhone && hasEmail && (
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`mailto:${email}?subject=${emailSubject}&body=${emailBody}`}
                className="rounded-2xl bg-blue-700 py-3 text-center text-sm font-black text-white"
              >
                이메일 문의
              </a>

              <a
                href={`mailto:${email}?subject=${emailDealSubject}&body=${emailDealBody}`}
                className="rounded-2xl bg-green-700 py-3 text-center text-sm font-black text-white"
              >
                이메일 딜하기
              </a>
            </div>
          )}

          {!hasPhone && !hasEmail && (
            <div className="rounded-2xl bg-gray-400 py-3 text-center text-sm font-black text-white">
              등록된 연락처가 없습니다.
            </div>
          )}
        </div>
      </div>

      <CommunityBottomNav activeNav="market" />
    </main>
  );
}