import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are missing.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const [{ data: categories, error: categoryError }, { data: items, error: itemError }] =
      await Promise.all([
        supabase
          .from("business_menu_categories")
          .select("id,name,display_order")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("id", { ascending: true }),
        supabase
          .from("business_menu_items")
          .select("id,category_id,name,description,price,thumbnail_path,image_path,display_order")
          .eq("business_id", businessId)
          .eq("is_available", true)
          .order("display_order", { ascending: true })
          .order("id", { ascending: true }),
      ]);

    if (categoryError) throw categoryError;
    if (itemError) throw itemError;

    const withUrls = (items || []).map((item) => {
      const thumbnailUrl = item.thumbnail_path
        ? supabase.storage.from("menu-images").getPublicUrl(item.thumbnail_path).data.publicUrl
        : null;
      const imageUrl = item.image_path
        ? supabase.storage.from("menu-images").getPublicUrl(item.image_path).data.publicUrl
        : null;
      return {
        id: item.id,
        category_id: item.category_id,
        name: item.name,
        description: item.description,
        price: item.price,
        display_order: item.display_order,
        thumbnail_url: thumbnailUrl,
        image_url: imageUrl,
      };
    });

    return NextResponse.json(
      { categories: categories || [], items: withUrls },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Menu load failed" },
      { status: 500 },
    );
  }
}
