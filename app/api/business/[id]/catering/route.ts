import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase public 환경변수가 없습니다.");
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "잘못된 business id 입니다." },
        { status: 400 },
      );
    }

    const supabase = getPublicSupabase();

    const settingsResult = await supabase
      .from("business_catering_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (settingsResult.error) throw settingsResult.error;

    // RLS 정책상 공개 활성화되지 않은 캐터링은 조회되지 않습니다.
    if (!settingsResult.data?.is_enabled) {
      return NextResponse.json({
        settings: settingsResult.data ?? null,
        categories: [],
        items: [],
      });
    }

    const [
      categoryResult,
      itemResult,
      packageResult,
      groupResult,
      choiceResult,
    ] = await Promise.all([
      supabase
        .from("business_catering_categories")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),

      supabase
        .from("business_catering_items")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),

      supabase
        .from("business_catering_packages")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),

      supabase
        .from("business_catering_option_groups")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),

      supabase
        .from("business_catering_option_choices")
        .select("*")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
    ]);

    if (categoryResult.error) throw categoryResult.error;
    if (itemResult.error) throw itemResult.error;
    if (packageResult.error) throw packageResult.error;
    if (groupResult.error) throw groupResult.error;
    if (choiceResult.error) throw choiceResult.error;

    const packagesByItem = new Map<number, any[]>();
    for (const pkg of packageResult.data ?? []) {
      const list = packagesByItem.get(Number(pkg.item_id)) ?? [];
      list.push(pkg);
      packagesByItem.set(Number(pkg.item_id), list);
    }

    const choicesByGroup = new Map<number, any[]>();
    for (const choice of choiceResult.data ?? []) {
      const list = choicesByGroup.get(Number(choice.group_id)) ?? [];
      list.push(choice);
      choicesByGroup.set(Number(choice.group_id), list);
    }

    const groupsByItem = new Map<number, any[]>();
    for (const group of groupResult.data ?? []) {
      const list = groupsByItem.get(Number(group.item_id)) ?? [];
      list.push({
        ...group,
        choices: choicesByGroup.get(Number(group.id)) ?? [],
      });
      groupsByItem.set(Number(group.item_id), list);
    }

    const items = (itemResult.data ?? []).map((item) => ({
      ...item,
      packages: packagesByItem.get(Number(item.id)) ?? [],
      option_groups: groupsByItem.get(Number(item.id)) ?? [],
    }));

    return NextResponse.json({
      settings: settingsResult.data,
      categories: categoryResult.data ?? [],
      items,
    });
  } catch (error) {
    console.error("PUBLIC CATERING GET ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "캐터링 메뉴를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
