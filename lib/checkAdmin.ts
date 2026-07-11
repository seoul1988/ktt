import "server-only";

import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function checkAdmin() {
  const cookieStore = await cookies();

  const cookieRole =
    cookieStore.get("ktt_admin")?.value ||
    cookieStore.get("kacc_admin")?.value ||
    cookieStore.get("admin")?.value ||
    "";

  if (
    cookieRole === "admin" ||
    cookieRole === "super_admin"
  ) {
    return true;
  }

  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    if (userError) {
      console.error(
        "관리자 사용자 확인 오류:",
        userError,
      );
    }

    return false;
  }

  const { data: profile, error: profileError } =
    await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    console.error(
      "관리자 프로필 확인 오류:",
      profileError,
    );

    return false;
  }

  return (
    profile?.role === "admin" ||
    profile?.role === "super_admin"
  );
}