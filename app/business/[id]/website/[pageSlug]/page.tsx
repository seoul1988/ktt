import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

import { PublicWebsiteRenderer } from "@/app/admin/businesses/[id]/website/WebsiteEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
    global: {
      fetch: (input, init = {}) =>
        fetch(input, {
          ...init,
          cache: "no-store",
        }),
    },
  });
}

export default async function BusinessWebsiteSubpage({ params }: Props) {
  const { id, pageSlug: rawPageSlug } = await params;
  const businessId = Number(id);
  const pageSlug = normalizePageSlug(rawPageSlug);

  if (!Number.isInteger(businessId) || businessId <= 0 || !pageSlug) {
    notFound();
  }

  const supabase = getServerSupabase();

  const [businessResult, sectionsResult] = await Promise.all([
    supabase
      .from("businesses")
      // 주소, 도시, 주, ZIP, 위도·경도를 지도에 전달하기 위해 전체 컬럼을 가져옵니다.
      .select("*")
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