import { createClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import InstallAppButton from "@/app/components/InstallAppButton";
import { PublicWebsiteRenderer } from "@/app/admin/businesses/[id]/website/WebsiteEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type Props = {
  params: Promise<{ id: string }>;
};

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase 환경변수가 설정되어 있지 않습니다.");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export default async function BusinessWebsitePage({ params }: Props) {
  noStore();

  const { id } = await params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    notFound();
  }

  const supabase = getServerSupabase();

  const [businessResult, sectionsResult] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "id, name, image_url, hours, website_enabled, website_slug, website_status, website_settings",
      )
      .eq("id", businessId)
      .maybeSingle(),

    supabase
      .from("business_sections")
      .select(
        "id, business_id, section_type, title, content, settings, sort_order, is_visible",
      )
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (businessResult.error) {
    throw new Error(businessResult.error.message);
  }

  if (sectionsResult.error) {
    throw new Error(sectionsResult.error.message);
  }

  if (!businessResult.data) {
    notFound();
  }

  return (
    <>
      <InstallAppButton />

      <PublicWebsiteRenderer
        business={businessResult.data}
        sections={sectionsResult.data || []}
        pageSlug="home"
      />
    </>
  );
}