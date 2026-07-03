"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";

export default function CommunityEventManageButtons({
  eventId,
  ownerId,
}: {
  eventId: string;
  ownerId: string | null;
}) {
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    async function checkPermission() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const isAdmin = profile?.role === "admin";
      const isOwner = user.id === ownerId;

      setCanManage(isAdmin || isOwner);
    }

    checkPermission();
  }, [ownerId]);

  if (!canManage) return null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Link
        href={`/community/events/${eventId}/edit`}
        className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-[#172033] shadow-sm"
      >
        Edit
      </Link>

      <button
        type="button"
        onClick={() => {
          alert("삭제는 다음 단계에서 연결하세요.");
        }}
        className="rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-black text-white shadow-sm"
      >
        Delete
      </button>
    </div>
  );
}