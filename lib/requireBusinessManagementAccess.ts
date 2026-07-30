import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AccessResult = {
  userId: string;
  businessId: number;
  isAdmin: boolean;
};

type ProfileRow = {
  role: string | null;
};

type BusinessAccessRow = {
  business_id: number;
  businesses:
    | {
        id: number;
        website_enabled: boolean | null;
      }
    | {
        id: number;
        website_enabled: boolean | null;
      }[]
    | null;
};

export async function requireBusinessManagementAccess(
  businessId: number,
): Promise<AccessResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      `/login?next=${encodeURIComponent(
        `/owner/business/${businessId}/manage`,
      )}`,
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    console.error(
      "Failed to load management profile:",
      profileError,
    );

    redirect(
      "/owner/business?access=profile-error",
    );
  }

  const isAdmin =
    profile?.role === "admin";

  if (isAdmin) {
    return {
      userId: user.id,
      businessId,
      isAdmin: true,
    };
  }

  if (profile?.role !== "owner") {
    redirect(
      "/owner/business?access=forbidden",
    );
  }

  const {
    data: ownerLink,
    error: ownerLinkError,
  } = await supabase
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
    .maybeSingle<BusinessAccessRow>();

  if (ownerLinkError) {
    console.error(
      "Failed to verify business management access:",
      ownerLinkError,
    );

    redirect(
      "/owner/business?access=check-error",
    );
  }

  if (!ownerLink) {
    redirect(
      "/owner/business?access=pending",
    );
  }

  return {
    userId: user.id,
    businessId,
    isAdmin: false,
  };
}