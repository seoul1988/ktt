"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Props = {
  itemId: number;
  sellerId: string | null;
  title: string;
  phone: string | number | null;
  email: string | null;
  imageUrls: string[];
  videoUrl: string | null;
  currentStatus: string | null;
};

function normalizePhone(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeEmail(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function getStoragePath(url: string) {
  const marker = "/storage/v1/object/public/market/";
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return decodeURIComponent(url.substring(index + marker.length));
}

export default function MarketItemActions({
  itemId,
  sellerId,
  title,
  phone,
  email,
  imageUrls,
  videoUrl,
  currentStatus,
}: Props) {
  const router = useRouter();

  const [authChecking, setAuthChecking] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState(currentStatus || "available");

  useEffect(() => {
    let mounted = true;

    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setCurrentUserId(user?.id ?? null);
      setAuthChecking(false);
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setCurrentUserId(session?.user?.id ?? null);
      setAuthChecking(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isOwner =
    currentUserId !== null &&
    sellerId !== null &&
    currentUserId === sellerId;

  const displayPhone = normalizePhone(phone);
  const phoneForLink = displayPhone.replace(/[^\d+]/g, "");
  const cleanEmail = normalizeEmail(email);

  const hasPhone = phoneForLink.length > 0;
  const hasEmail = cleanEmail.length > 0;
  const hasContact = hasPhone || hasEmail;

  const inquiryMessage = encodeURIComponent(
    `안녕하세요. 벼룩시장에 올리신 "${title}" 보고 연락드립니다. 아직 구매 가능할까요?`,
  );

  const dealMessage = encodeURIComponent(
    `안녕하세요. 벼룩시장에 올리신 "${title}" 가격 조정이 가능할까요?`,
  );

  const emailSubject = encodeURIComponent(
    `[KTown Triangle] ${title} 문의`,
  );

  async function updateStatus(
    nextStatus: "available" | "reserved" | "sold",
  ) {
    if (working || !isOwner) return;

    setWorking(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || user.id !== sellerId) {
        alert("본인이 등록한 상품만 변경할 수 있습니다.");
        return;
      }

      const { error } = await supabase
        .from("market_items")
        .update({ status: nextStatus })
        .eq("id", itemId)
        .eq("seller_id", user.id);

      if (error) throw error;

      setStatus(nextStatus);
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`상태 변경 실패: ${message}`);
    } finally {
      setWorking(false);
    }
  }

  async function deleteItem() {
    if (working || !isOwner) return;

    const confirmed = window.confirm(
      `"${title}" 상품을 삭제하시겠습니까?\n삭제한 상품은 복구할 수 없습니다.`,
    );

    if (!confirmed) return;

    setWorking(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user || user.id !== sellerId) {
        alert("본인이 등록한 상품만 삭제할 수 있습니다.");
        return;
      }

      const storagePaths = [
        ...imageUrls,
        ...(videoUrl ? [videoUrl] : []),
      ]
        .map(getStoragePath)
        .filter((path): path is string => Boolean(path));

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("market")
          .remove(storagePaths);

        if (storageError) {
          console.warn("파일 삭제 경고:", storageError.message);
        }
      }

      const { error: deleteError } = await supabase
        .from("market_items")
        .delete()
        .eq("id", itemId)
        .eq("seller_id", user.id);

      if (deleteError) throw deleteError;

      alert("상품이 삭제되었습니다.");
      router.replace("/market");
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "알 수 없는 오류";
      alert(`상품 삭제 실패: ${message}`);
    } finally {
      setWorking(false);
    }
  }

  async function shareItem() {
    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: `${title} 상품을 확인해 보세요.`,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      alert("상품 주소가 복사되었습니다.");
    } catch (error) {
      console.error("공유 오류:", error);
    }
  }

  if (authChecking) {
    return (
      <div className="mt-5">
        <div className="h-16 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      {!isOwner && (
        <div className="rounded-2xl bg-[#F8F3EC] p-3">
          <p className="mb-2 text-xs font-black text-[#172033]">
            이 상품 판매자에게 연락
          </p>

          {hasContact ? (
            <div
              className={`grid gap-2 ${
                hasPhone && hasEmail
                  ? "grid-cols-2 sm:grid-cols-4"
                  : hasPhone
                    ? "grid-cols-3"
                    : "grid-cols-1"
              }`}
            >
              {hasPhone && (
                <>
                  <a
                    href={`tel:${phoneForLink}`}
                    className="rounded-xl bg-[#172033] py-2.5 text-center text-xs font-black text-white"
                  >
                    전화
                  </a>

                  <a
                    href={`sms:${phoneForLink}?&body=${inquiryMessage}`}
                    className="rounded-xl bg-[#C2410C] py-2.5 text-center text-xs font-black text-white"
                  >
                    문자
                  </a>

                  <a
                    href={`sms:${phoneForLink}?&body=${dealMessage}`}
                    className="rounded-xl bg-green-700 py-2.5 text-center text-xs font-black text-white"
                  >
                    딜하기
                  </a>
                </>
              )}

              {hasEmail && (
                <a
                  href={`mailto:${cleanEmail}?subject=${emailSubject}&body=${inquiryMessage}`}
                  className="rounded-xl bg-blue-700 py-2.5 text-center text-xs font-black text-white"
                >
                  이메일
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-gray-200 py-3 text-center text-xs font-black text-gray-600">
              판매자 연락처가 등록되지 않았습니다.
            </div>
          )}
        </div>
      )}

      {isOwner && (
        <div className="rounded-2xl border border-[#172033]/10 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-black text-[#172033]">
              내 상품 관리
            </p>

            <span className="text-[10px] font-bold text-gray-500">
              현재 상태:{" "}
              {status === "available"
                ? "판매중"
                : status === "reserved"
                  ? "예약"
                  : status === "sold"
                    ? "판매완료"
                    : status}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-[11px] font-black">
            <button
              type="button"
              disabled={working}
              onClick={() => updateStatus("available")}
              className={`rounded-xl py-2.5 ${
                status === "available"
                  ? "bg-green-600 text-white"
                  : "bg-green-100 text-green-700"
              } disabled:opacity-50`}
            >
              판매중
            </button>

            <button
              type="button"
              disabled={working}
              onClick={() => updateStatus("reserved")}
              className={`rounded-xl py-2.5 ${
                status === "reserved"
                  ? "bg-yellow-500 text-white"
                  : "bg-yellow-100 text-yellow-700"
              } disabled:opacity-50`}
            >
              예약
            </button>

            <button
              type="button"
              disabled={working}
              onClick={() => updateStatus("sold")}
              className={`rounded-xl py-2.5 ${
                status === "sold"
                  ? "bg-gray-700 text-white"
                  : "bg-gray-200 text-gray-700"
              } disabled:opacity-50`}
            >
              판매완료
            </button>

            <button
              type="button"
              disabled={working}
              onClick={deleteItem}
              className="rounded-xl bg-red-100 py-2.5 text-red-600 disabled:opacity-50"
            >
              {working ? "처리 중" : "삭제"}
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={shareItem}
        className="w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm font-black text-[#172033]"
      >
        상품 공유하기
      </button>
    </div>
  );
}