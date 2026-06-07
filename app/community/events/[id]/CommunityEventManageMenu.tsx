"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type CommunityEvent = {
  id: string;
  owner_id?: string | null;
  title?: string | null;
  image_url?: string | null;
  video_url?: string | null;
};

export default function CommunityEventManageMenu({
  event,
}: {
  event: CommunityEvent;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  async function checkPermission() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCanManage(false);
      return;
    }

    if (event.owner_id && event.owner_id === user.id) {
      setCanManage(true);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role === "admin") {
      setCanManage(true);
    }
  }

  function getStorageFile(url: string | null | undefined) {
    if (!url) return null;

    const marker = "/storage/v1/object/public/";
    const index = url.indexOf(marker);

    if (index === -1) return null;

    const path = url.substring(index + marker.length);
    const [bucket, ...fileParts] = path.split("/");
    const filePath = fileParts.join("/");

    if (!bucket || !filePath) return null;

    return { bucket, filePath };
  }

  async function deleteStorageFile(url: string | null | undefined) {
    const file = getStorageFile(url);
    if (!file) return;

    await supabase.storage.from(file.bucket).remove([file.filePath]);
  }

  async function handleDelete() {
    if (!canManage) return;

    const ok = confirm("정말 이 이벤트를 삭제할까요?");
    if (!ok) return;

    setDeleting(true);

    await deleteStorageFile(event.image_url);
    await deleteStorageFile(event.video_url);

    const { error } = await supabase
      .from("community_events")
      .delete()
      .eq("id", event.id);

    if (error) {
      alert("삭제 실패: " + error.message);
      setDeleting(false);
      return;
    }

    router.push("/community");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black shadow"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-40 overflow-hidden rounded-2xl bg-white shadow-lg">
          {canManage ? (
            <>
              <Link
                href={`/community/events/${event.id}/edit`}
                className="block px-4 py-3 text-sm font-black text-[#172033] hover:bg-gray-100"
              >
                Edit
              </Link>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="block w-full px-4 py-3 text-left text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </>
          ) : (
            <div className="px-4 py-3 text-sm font-bold text-gray-400">
              No permission
            </div>
          )}
        </div>
      )}
    </div>
  );
}