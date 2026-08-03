import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BUCKET = "menu-images";
const MAX_DETAIL_SIZE = 3 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = 800 * 1024;

function getAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get("authorization") || "";

  return authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
}

function positiveInteger(value: unknown) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0
    ? number
    : null;
}

async function ensureBucket(
  supabase: ReturnType<typeof getAdminClient>,
) {
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();

  if (listError) throw listError;

  const existing = buckets.find(
    (bucket) => bucket.name === BUCKET,
  );

  if (!existing) {
    const { error: createError } =
      await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: "5MB",
        allowedMimeTypes: ["image/webp"],
      });

    if (createError) throw createError;
    return;
  }

  if (!existing.public) {
    const { error: updateError } =
      await supabase.storage.updateBucket(BUCKET, {
        public: true,
        fileSizeLimit: "5MB",
        allowedMimeTypes: ["image/webp"],
      });

    if (updateError) throw updateError;
  }
}

async function requireAccess(
  request: Request,
  businessId: number,
) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      allowed: false,
      status: 401,
      error: "로그인이 필요합니다.",
    };
  }

  const supabase = getAdminClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      allowed: false,
      status: 401,
      error: "로그인 정보를 확인할 수 없습니다.",
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) throw profileError;

  if (profile?.role === "admin") {
    return { allowed: true, status: 200, error: "" };
  }

  const [
    { data: owner, error: ownerError },
    { data: business, error: businessError },
  ] = await Promise.all([
    supabase
      .from("business_owners")
      .select("business_id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("website_enabled")
      .eq("id", businessId)
      .maybeSingle(),
  ]);

  if (ownerError) throw ownerError;
  if (businessError) throw businessError;

  if (!owner) {
    return {
      allowed: false,
      status: 403,
      error: "이 비즈니스를 관리할 권한이 없습니다.",
    };
  }

  if (business?.website_enabled !== true) {
    return {
      allowed: false,
      status: 403,
      error: "사이트 관리가 활성화되지 않았습니다.",
    };
  }

  return { allowed: true, status: 200, error: "" };
}

async function removePaths(
  supabase: ReturnType<typeof getAdminClient>,
  paths: Array<string | null | undefined>,
) {
  const validPaths = Array.from(
    new Set(
      paths.filter(
        (path): path is string =>
          Boolean(path) &&
          !String(path).startsWith("http://") &&
          !String(path).startsWith("https://"),
      ),
    ),
  );

  if (validPaths.length === 0) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(validPaths);

  if (error) {
    console.error("Old image delete failed:", error);
  }
}

function getPublicUrl(
  supabase: ReturnType<typeof getAdminClient>,
  path: string,
) {
  return supabase.storage
    .from(BUCKET)
    .getPublicUrl(path).data.publicUrl;
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = positiveInteger(id);

    if (!businessId) {
      return NextResponse.json(
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access = await requireAccess(
      request,
      businessId,
    );

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const formData = await request.formData();
    const itemId = positiveInteger(
      formData.get("itemId"),
    );
    const detail = formData.get("detail");
    const thumbnail = formData.get("thumbnail");

    if (!itemId) {
      return NextResponse.json(
        { error: "잘못된 메뉴 ID입니다." },
        { status: 400 },
      );
    }

    if (
      !(detail instanceof File) ||
      !(thumbnail instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            "상세 이미지 또는 썸네일 파일이 없습니다.",
        },
        { status: 400 },
      );
    }

    if (
      detail.type !== "image/webp" ||
      thumbnail.type !== "image/webp"
    ) {
      return NextResponse.json(
        { error: "변환된 WEBP 이미지만 등록할 수 있습니다." },
        { status: 400 },
      );
    }

    if (
      detail.size <= 0 ||
      detail.size > MAX_DETAIL_SIZE
    ) {
      return NextResponse.json(
        { error: "상세 이미지 크기가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    if (
      thumbnail.size <= 0 ||
      thumbnail.size > MAX_THUMBNAIL_SIZE
    ) {
      return NextResponse.json(
        { error: "썸네일 크기가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    await ensureBucket(supabase);

    const { data: item, error: itemError } =
      await supabase
        .from("business_menu_items")
        .select("id,image_path,thumbnail_path")
        .eq("business_id", businessId)
        .eq("id", itemId)
        .maybeSingle();

    if (itemError) throw itemError;

    if (!item) {
      return NextResponse.json(
        { error: "메뉴 품목을 찾지 못했습니다." },
        { status: 404 },
      );
    }

    const version = `${Date.now()}-${randomUUID()}`;
    const detailPath =
      `${businessId}/${itemId}/${version}-detail.webp`;
    const thumbnailPath =
      `${businessId}/${itemId}/${version}-thumb.webp`;

    const [detailBuffer, thumbnailBuffer] =
      await Promise.all([
        detail.arrayBuffer(),
        thumbnail.arrayBuffer(),
      ]);

    const { error: detailUploadError } =
      await supabase.storage
        .from(BUCKET)
        .upload(detailPath, detailBuffer, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });

    if (detailUploadError) throw detailUploadError;

    const { error: thumbnailUploadError } =
      await supabase.storage
        .from(BUCKET)
        .upload(thumbnailPath, thumbnailBuffer, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: false,
        });

    if (thumbnailUploadError) {
      await supabase.storage
        .from(BUCKET)
        .remove([detailPath]);

      throw thumbnailUploadError;
    }

    const { data: updated, error: updateError } =
      await supabase
        .from("business_menu_items")
        .update({
          image_path: detailPath,
          thumbnail_path: thumbnailPath,
        })
        .eq("business_id", businessId)
        .eq("id", itemId)
        .select("id")
        .maybeSingle();

    if (updateError || !updated) {
      await supabase.storage
        .from(BUCKET)
        .remove([detailPath, thumbnailPath]);

      throw (
        updateError ||
        new Error("이미지 경로를 저장하지 못했습니다.")
      );
    }

    await removePaths(supabase, [
      item.image_path,
      item.thumbnail_path,
    ]);

    return NextResponse.json({
      success: true,
      image_url: getPublicUrl(
        supabase,
        detailPath,
      ),
      thumbnail_url: getPublicUrl(
        supabase,
        thumbnailPath,
      ),
      image_path: detailPath,
      thumbnail_path: thumbnailPath,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "이미지를 등록하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = positiveInteger(id);

    if (!businessId) {
      return NextResponse.json(
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access = await requireAccess(
      request,
      businessId,
    );

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const body = await request.json();
    const itemId = positiveInteger(body?.itemId);

    if (!itemId) {
      return NextResponse.json(
        { error: "잘못된 메뉴 ID입니다." },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();
    await ensureBucket(supabase);

    const { data: item, error: itemError } =
      await supabase
        .from("business_menu_items")
        .select("id,image_path,thumbnail_path")
        .eq("business_id", businessId)
        .eq("id", itemId)
        .maybeSingle();

    if (itemError) throw itemError;

    if (!item) {
      return NextResponse.json(
        { error: "메뉴 품목을 찾지 못했습니다." },
        { status: 404 },
      );
    }

    const { data: updated, error: updateError } =
      await supabase
        .from("business_menu_items")
        .update({
          image_path: null,
          thumbnail_path: null,
        })
        .eq("business_id", businessId)
        .eq("id", itemId)
        .select("id")
        .maybeSingle();

    if (updateError) throw updateError;

    if (!updated) {
      return NextResponse.json(
        { error: "메뉴 품목을 찾지 못했습니다." },
        { status: 404 },
      );
    }

    await removePaths(supabase, [
      item.image_path,
      item.thumbnail_path,
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "이미지를 삭제하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
