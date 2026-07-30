import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AccessResult = {
  userId: string;
  businessId: number;
  isAdmin: boolean;
};

export async function checkBusinessManagementAccess(
  businessId: number,
): Promise<AccessResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin =
    profile?.role === "admin";

  /*
   * 전체 관리자는 모든 비즈니스에 접근할 수 있습니다.
   */
  if (isAdmin) {
    return {
      userId: user.id,
      businessId,
      isAdmin: true,
    };
  }

  const { data: ownerLink } = await supabase
    .from("business_owners")
    .select(`
      business_id,
      businesses!inner (
        id,
        website_enabled
      )
    `)
    .eq("user_id", user.id)
    .eq("business_id", businessId)
    .eq(
      "businesses.website_enabled",
      true,
    )
    .maybeSingle();

  if (!ownerLink) {
    redirect("/owner/business?access=denied");
  }

  return {
    userId: user.id,
    businessId,
    isAdmin: false,
  };
}