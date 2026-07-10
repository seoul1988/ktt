"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type MarketManageButtonsProps = {
  itemId: string | number;
  sellerId: string | null;
  imageUrls?: string[];
  videoUrl?: string | null;
};

export default function MarketManageButtons({
  itemId,
  sellerId,
  imageUrls = [],
  videoUrl = null,
}: MarketManageButtonsProps) {
  const router = useRouter();

  const [canManage, setCanManage] = useState(false);
  const [checking, setChecking] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkPermission();
  }, [sellerId]);

  async function checkPermission() {
    setChecking(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCanManage(false);
      setChecking(false);
      return;
    }

    // 상품 등록자 본인인지 확인
    if (sellerId && user.id === sellerId) {
      setCanManage(true);
      setChecking(false);
      return;
    }

    // profiles 테이블에서 관리자 권한 확인
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin =
      profile?.role === "admin" ||
      profile?.role === "super_admin";

    setCanManage(isAdmin);
    setChecking(false);
  }

  function getStoragePath(publicUrl: string) {
    const marker = "/storage/v1/object/public/market/";
    const index = publicUrl.indexOf(marker);

    if (index === -1) {
      return null;
    }

    return decodeURIComponent(
      publicUrl.substring(index + marker.length)
    );
  }

  async function deleteStorageFiles() {
    const urls = [
      ...imageUrls,
      ...(videoUrl ? [videoUrl] : []),
    ];

    const storagePaths = urls
      .map(getStoragePath)
      .filter((path): path is string => Boolean(path));

    if (storagePaths.length === 0) {
      return;
    }

    const { error } = await supabase.storage
      .from("market")
      .remove(storagePaths);

    if (error) {
      console.error("상품 이미지 삭제 실패:", error);
    }
  }

  async function deleteItem() {
    if (deleting) return;

    const confirmed = window.confirm(
      "이 상품을 삭제하시겠습니까?\n삭제한 상품은 복구할 수 없습니다."
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("로그인이 필요합니다.");
        router.push("/login");
        return;
      }

      // 삭제 직전에 다시 권한 확인
      const isOwner = sellerId === user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const isAdmin =
        profile?.role === "admin" ||
        profile?.role === "super_admin";

      if (!isOwner && !isAdmin) {
        alert("상품을 삭제할 권한이 없습니다.");
        return;
      }

      const { error: deleteError } = await supabase
        .from("market_items")
        .delete()
        .eq("id", itemId);

      if (deleteError) {
        throw deleteError;
      }

      // DB 삭제 후 Storage 파일도 삭제
      await deleteStorageFiles();

      alert("상품이 삭제되었습니다.");

      router.replace("/market");
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "알 수 없는 오류가 발생했습니다.";

      alert("삭제 실패: " + message);
    } finally {
      setDeleting(false);
    }
  }

  if (checking || !canManage) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href={`/market/${itemId}/edit`}
        className="rounded-full border border-[#172033] bg-white px-3 py-1.5 text-[11px] font-black text-[#172033] shadow-sm"
      >
        수정
      </Link>

      <button
        type="button"
        disabled={deleting}
        onClick={deleteItem}
        className="rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm disabled:opacity-50"
      >
        {deleting ? "삭제 중" : "삭제"}
      </button>
    </div>
  );
}