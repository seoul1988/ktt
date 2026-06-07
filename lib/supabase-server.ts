import { createSupabaseServerClient } from "../lib/supabase-server";

export default async function Home() {
  const supabase = await createSupabaseServerClient();

  const { data: communityCategories } = await supabase
    .from("categories")
    .select("name")
    .eq("show_on_community_map", true);

  // 아래 기존 return JSX 그대로 유지
}