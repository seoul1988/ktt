"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";

type EventItem = {
  id: string;
  owner_id: string | null;
  image_url: string | null;
  video_url: string | null;
};

type Props = {
  event: EventItem;
  mode?: "menu" | "buttons";
};

export default function BusinessEventManageMenu({
  event,
  mode = "menu",
}: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkPermission();

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isOwner =
      !!event.owner_id && String(event.owner_id) === String(user.id);

    const isAdmin = profile?.role === "admin";

    setCanManage(Boolean(isOwner || isAdmin));
  }

  function getStorageFile(url: string | null) {
    if (!url) return null;

    const marker = "/storage/v1/object/public/";
    const index = url.indexOf(marker);

    if (index === -1) return null;

    const fullPath = url.substring(index + marker.length);
    const parts = fullPath.split("/");
    const bucket = parts.shift();
    const path = parts.join("/");

    if (!bucket || !path) return null;

    return { bucket, path: decodeURIComponent(path) };
  }

  async function deleteStorageFile(url: string | null) {
    const file = getStorageFile(url);
    if (!file) return;

    await supabase.storage.from(file.bucket).remove([file.path]);
  }

  async function handleDelete() {
    if (!canManage) {
      alert("삭제 권한이 없습니다.");
      return;
    }

    if (!confirm("정말 삭제할까요?")) return;

    setDeleting(true);

    await deleteStorageFile(event.image_url);
    await deleteStorageFile(event.video_url);

    const { error } = await supabase
      .from("business_events")
      .delete()
      .eq("id", event.id);

    if (error) {
      alert("삭제 실패: " + error.message);
      setDeleting(false);
      return;
    }

    window.location.href = "/business-events";
  }

  if (mode === "buttons") {
    if (!canManage) return null;

    return (
      <div className="flex items-center gap-2">
        <Link
          href={`/business-events/${event.id}/edit`}
          className="rounded-full bg-[#172033] px-3 py-2 text-xs font-black text-white"
        >
          Edit
        </Link>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-full bg-red-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
        >
          {deleting ? "Deleting" : "Delete"}
        </button>
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl font-black leading-none text-[#172033] shadow"
      >
        ⋮
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-[9999] w-56 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
          {canManage && (
            <>
              <Link
                href={`/business-events/${event.id}/edit`}
                className="block px-4 py-4 text-sm font-black text-[#172033] hover:bg-gray-50"
              >
                Edit Event
              </Link>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="block w-full px-4 py-4 text-left text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Event"}
              </button>
            </>
          )}

          <Link
            href="/profile"
            className="block px-4 py-4 text-sm font-black text-[#172033] hover:bg-gray-50"
          >
            Edit Profile
          </Link>

          <Link
            href="/my-coupons"
            className="block px-4 py-4 text-sm font-black text-[#172033] hover:bg-gray-50"
          >
            My Coupons
          </Link>

          <Link
            href="/owner"
            className="block px-4 py-4 text-sm font-black text-[#172033] hover:bg-gray-50"
          >
            My Business
          </Link>

          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="block w-full px-4 py-4 text-left text-sm font-black text-red-600 hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}