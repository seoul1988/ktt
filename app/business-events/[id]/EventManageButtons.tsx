"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function EventManageButtons({
  eventId,
  ownerId,
}: {
  eventId: string;
  ownerId: string | null;
}) {
  const router = useRouter();
  const [canManage, setCanManage] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCanManage(false);
        setChecking(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const isOwner = ownerId === user.id;
      const isAdmin = profile?.role === "admin";

      setCanManage(isOwner || isAdmin);
      setChecking(false);
    }

    checkUser();
  }, [ownerId]);

  async function deleteEvent() {
    if (!canManage) return;

    if (!confirm("정말 삭제할까요?")) return;

    const { error } = await supabase
      .from("business_events")
      .delete()
      .eq("id", eventId);

    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }

    router.push("/business-events");
    router.refresh();
  }

  if (checking) return null;
  if (!canManage) return null;

  return (
    <div className="flex gap-2">
      <Link
        href={`/business-events/${eventId}/edit`}
        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white shadow"
      >
        Edit
      </Link>

      <button
        type="button"
        onClick={deleteEvent}
        className="rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white shadow"
      >
        Delete
      </button>
    </div>
  );
}