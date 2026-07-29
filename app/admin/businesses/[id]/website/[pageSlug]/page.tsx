import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

import { PublicWebsiteRenderer } from "@/app/admin/businesses/[id]/website/WebsiteEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string; pageSlug: string }>;
};

function normalizePageSlug(value: string) {
  let decoded = "";
  try {
    decoded = decodeURIComponent(String(value || ""));
  } catch {
    decoded = String(value || "");
  }

  return decoded
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

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

export default async function BusinessWebsiteSubpage({ params }: Props) {
  const { id, pageSlug: rawPageSlug } = await params;
  const businessId = Number(id);
  const pageSlug = normalizePageSlug(rawPageSlug);

  if (!Number.isInteger(businessId) || businessId <= 0 || !pageSlug) notFound();

  const supabase = getServerSupabase();
  const [businessResult, sectionsResult] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "id, name, image_url, website_enabled, website_slug, website_status, website_settings",
      )
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("business_sections")
      .select(
        "id, business_id, section_type, title, content, settings, sort_order, is_visible",
      )
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true }),
  ]);

  if (businessResult.error) throw new Error(businessResult.error.message);
  if (sectionsResult.error) throw new Error(sectionsResult.error.message);
  if (!businessResult.data) notFound();

  return (
    <PublicWebsiteRenderer
      business={businessResult.data}
      sections={sectionsResult.data || []}
      pageSlug={pageSlug}
    />
  );
}
