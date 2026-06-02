// app/deals/[id]/DealManageButtons.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Props = {
  dealId: string;
  ownerId: string | null;
  businessId?: number | string | null;
  imageUrl?: string | null;
};

function getStoragePathFromPublicUrl(url: string | null | undefined) {
  if (!url) return null;

  const marker = "/storage/v1/object/public/";
  const index = url.indexOf(marker);

  if (index === -1) return null;

  const fullPath = url.substring(index + marker.length);
  const parts = fullPath.split("/");

  const bucket = parts.shift();
  const path = parts.join("/");

  if (!bucket || !path) return null;

  return {
    bucket,
    path: decodeURIComponent(path),
  };
}

export default function DealManageButtons({
  dealId,
  ownerId,
  businessId,
  imageUrl,
}: Props) {
  const [canManage, setCanManage] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkPermission();
  }, [dealId, ownerId, businessId]);

  async function checkPermission() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCanManage(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,is_admin")
      .eq("id", user.id)
      .maybeSingle();

    const role = String(profile?.role || "").trim().toLowerCase();
    const isAdmin = role === "admin" || profile?.is_admin === true;
    const isDirectOwner = ownerId === user.id;

    let isBusinessOwner = false;

    if (businessId) {
      const { data: ownerRow } = await supabase
        .from("business_owners")
        .select("business_id")
        .eq("business_id", businessId)
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();

      isBusinessOwner = !!ownerRow;
    }

    setCanManage(isAdmin || isDirectOwner || isBusinessOwner);
  }

  async function deleteDeal() {
    if (!confirm("이 Deal을 삭제할까요?")) return;

    setDeleting(true);

    const file = getStoragePathFromPublicUrl(imageUrl);

    if (file) {
      await supabase.storage.from(file.bucket).remove([file.path]);
    }

    const { error } = await supabase.from("deals").delete().eq("id", dealId);

    if (error) {
      alert("삭제 실패: " + error.message);
      setDeleting(false);
      return;
    }

    window.location.href = "/deals";
  }

  if (!canManage) return null;

  return (
    <div className="flex gap-2">
      <Link
        href={`/deals/${dealId}/edit`}
        className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#172033] shadow"
      >
        수정
      </Link>

      <button
        type="button"
        disabled={deleting}
        onClick={deleteDeal}
        className="rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white shadow disabled:bg-gray-400"
      >
        {deleting ? "삭제 중" : "삭제"}
      </button>
    </div>
  );
}
