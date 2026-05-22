"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function SaveButton({
  businessId,
}: {
  businessId: string;
}) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);

  async function loadLike() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { count } = await supabase
      .from("business_likes")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId);

    setCount(count || 0);

    if (!user) return;

    const { data } = await supabase
      .from("business_likes")
      .select("id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

    setLiked(!!data);
  }

  useEffect(() => {
    loadLike();
  }, []);

  async function toggleLike() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("Please login first.");
      window.location.href = "/login";
      return;
    }

    if (liked) {
      await supabase
        .from("business_likes")
        .delete()
        .eq("business_id", businessId)
        .eq("user_id", user.id);

      setLiked(false);
      setCount((prev) => Math.max(prev - 1, 0));
    } else {
      await supabase.from("business_likes").insert({
        business_id: businessId,
        user_id: user.id,
      });

      setLiked(true);
      setCount((prev) => prev + 1);
    }
  }

  return (
    <button onClick={toggleLike} className="text-center">
      <div className={`text-3xl ${liked ? "text-red-500" : "text-gray-800"}`}>
        {liked ? "♥" : "♡"}
      </div>
      <div>Save</div>
      <div className="text-[11px] text-gray-500">{count}</div>
    </button>
  );
}