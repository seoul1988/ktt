"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Props = {
  eventId: string;
  ownerId?: string | null;
};

export default function BusinessEventManageButtons({
  eventId,
  ownerId,
}: Props) {
  const router = useRouter();
  const [canManage, setCanManage] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkPermission() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setCanManage(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const isAdmin = profile?.role === "admin";

      // 관리자에게 항상 보이고, 기존 이벤트 소유자에게도 보이게 하려면
      // 아래 isOwner 조건을 유지합니다.
      const isOwner = Boolean(ownerId && user.id === ownerId);

      if (!cancelled) {
        setCanManage(isAdmin || isOwner);
      }
    }

    void checkPermission();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void checkPermission();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [ownerId]);

  async function deleteEvent() {
    if (deleting) return;

    const ok = window.confirm(
      "이 비즈니스 이벤트를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.",
    );

    if (!ok) return;

    setDeleting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("로그인이 필요합니다.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const isAdmin = profile?.role === "admin";
      const isOwner = Boolean(ownerId && user.id === ownerId);

      if (!isAdmin && !isOwner) {
        alert("삭제 권한이 없습니다.");
        return;
      }

      const { error } = await supabase
        .from("business_events")
        .delete()
        .eq("id", eventId);

      if (error) {
        throw error;
      }

      router.push("/business-events");
      router.refresh();
    } catch (error) {
      alert(
        "삭제하지 못했습니다.\n" +
          (error instanceof Error ? error.message : "Unknown error"),
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!canManage) {
    return null;
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Link
        href={`/business-events/${eventId}/edit`}
        className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#172033] shadow-sm transition hover:bg-[#F5F1EB] active:scale-[0.98]"
      >
        Edit
      </Link>

      <button
        type="button"
        onClick={deleteEvent}
        disabled={deleting}
        className="rounded-full bg-red-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {deleting ? "Deleting..." : "Delete"}
      </button>
    </div>
  );
}