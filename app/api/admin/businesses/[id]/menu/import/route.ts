import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function isAuthorized(request: NextRequest) {
  const supplied = request.headers.get("x-admin-key") || "";
  const expected =
    process.env.WEBSITE_BUILDER_ADMIN_KEY ||
    process.env.ADMIN_SECRET ||
    process.env.ADMIN_API_KEY ||
    "";

  return Boolean(expected && supplied && supplied === expected);
}

function safeFileStem(value: string) {
  return String(value || "menu")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9가-힣-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "menu";
}

async function uploadWebp(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  businessId: number,
  folder: "thumbnails" | "display",
  file: File | null,
  stem: string,
) {
  if (!file || file.size === 0) return null;

  const path = `${businessId}/${folder}/${Date.now()}-${stem}.webp`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from("menu-images")
    .upload(path, bytes, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) throw new Error(`${folder} upload failed: ${error.message}`);
  return path;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const businessId = Number(id);
    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }

    const formData = await request.formData();
    const category = String(formData.get("category") || "Menu").trim() || "Menu";
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const rawPrice = String(formData.get("price") || "").trim();
    const price = rawPrice ? Number(rawPrice) : null;
    const displayOrder = Math.max(0, Number(formData.get("displayOrder") || 0) || 0);
    const replaceExisting = String(formData.get("replaceExisting") || "false") === "true";
    const thumbnail = formData.get("thumbnail") instanceof File ? formData.get("thumbnail") as File : null;
    const displayImage = formData.get("displayImage") instanceof File ? formData.get("displayImage") as File : null;

    if (!name) {
      return NextResponse.json({ error: "Menu name is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (replaceExisting) {
      const { data: oldItems } = await supabase
        .from("business_menu_items")
        .select("thumbnail_path,image_path")
        .eq("business_id", businessId);

      const oldPaths = (oldItems || [])
        .flatMap((item) => [item.thumbnail_path, item.image_path])
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      if (oldPaths.length) {
        await supabase.storage.from("menu-images").remove(oldPaths);
      }

      const { error: deleteError } = await supabase
        .from("business_menu_categories")
        .delete()
        .eq("business_id", businessId);
      if (deleteError) throw deleteError;
    }

    const { data: categoryRow, error: categoryError } = await supabase
      .from("business_menu_categories")
      .upsert(
        {
          business_id: businessId,
          name: category,
          display_order: displayOrder,
          is_active: true,
        },
        { onConflict: "business_id,name" },
      )
      .select("id")
      .single();

    if (categoryError || !categoryRow) {
      throw new Error(categoryError?.message || "Category save failed");
    }

    const stem = safeFileStem(name);
    let thumbnailPath: string | null = null;
    let imagePath: string | null = null;

    try {
      thumbnailPath = await uploadWebp(supabase, businessId, "thumbnails", thumbnail, stem);
      imagePath = await uploadWebp(supabase, businessId, "display", displayImage, stem);
    } catch (error) {
      const uploaded = [thumbnailPath, imagePath].filter((value): value is string => Boolean(value));
      if (uploaded.length) await supabase.storage.from("menu-images").remove(uploaded);
      throw error;
    }

    const { data: menuItem, error: menuError } = await supabase
      .from("business_menu_items")
      .insert({
        business_id: businessId,
        category_id: categoryRow.id,
        name,
        description,
        price: Number.isFinite(price) ? price : null,
        thumbnail_path: thumbnailPath,
        image_path: imagePath,
        display_order: displayOrder,
        is_available: true,
      })
      .select("id")
      .single();

    if (menuError || !menuItem) {
      const uploaded = [thumbnailPath, imagePath].filter((value): value is string => Boolean(value));
      if (uploaded.length) await supabase.storage.from("menu-images").remove(uploaded);
      throw new Error(menuError?.message || "Menu item save failed");
    }

    return NextResponse.json({
      ok: true,
      itemId: menuItem.id,
      categoryId: categoryRow.id,
      thumbnailPath,
      imagePath,
      originalUploaded: false,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Menu import failed" },
      { status: 500 },
    );
  }
}
