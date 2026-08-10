import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { requireBusinessManagementAccess } from "@/lib/requireBusinessManagementAccess";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const BUCKET = "catering-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase 환경변수가 없습니다.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getBusinessId(context: RouteContext) {
  const { id } = await context.params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    throw new Error("잘못된 business id 입니다.");
  }

  await requireBusinessManagementAccess(businessId);
  return businessId;
}

function extensionFromFile(file: File) {
  const original = file.name.split(".").pop()?.toLowerCase();

  if (original && /^[a-z0-9]{2,5}$/.test(original)) {
    return original;
  }

  const mime = file.type.toLowerCase();

  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const businessId = await getBusinessId(context);
    const supabase = getSupabase();

    const formData = await request.formData();
    const fileValue = formData.get("file");
    const oldPathValue = formData.get("old_path");

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        { error: "이미지 파일이 없습니다." },
        { status: 400 },
      );
    }

    if (!fileValue.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "이미지 파일만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }

    if (fileValue.size <= 0 || fileValue.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "이미지는 8MB 이하로 올려주세요." },
        { status: 400 },
      );
    }

    const extension = extensionFromFile(fileValue);
    const imagePath =
      `${businessId}/${Date.now()}-${randomUUID()}.${extension}`;

    const bytes = Buffer.from(
      await fileValue.arrayBuffer(),
    );

    const uploaded = await supabase.storage
      .from(BUCKET)
      .upload(imagePath, bytes, {
        contentType: fileValue.type,
        upsert: false,
      });

    if (uploaded.error) {
      throw uploaded.error;
    }

    const publicUrl = supabase.storage
      .from(BUCKET)
      .getPublicUrl(imagePath);

    const oldPath =
      typeof oldPathValue === "string"
        ? oldPathValue.trim()
        : "";

    if (oldPath && oldPath !== imagePath) {
      const removeOld = await supabase.storage
        .from(BUCKET)
        .remove([oldPath]);

      if (removeOld.error) {
        console.warn(
          "OLD CATERING IMAGE REMOVE ERROR:",
          removeOld.error,
        );
      }
    }

    return NextResponse.json({
      image_url: publicUrl.data.publicUrl,
      image_path: imagePath,
    });
  } catch (error) {
    console.error("CATERING IMAGE UPLOAD ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "이미지를 업로드하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const businessId = await getBusinessId(context);
    const supabase = getSupabase();
    const body = await request.json();

    const imagePath = String(
      body?.image_path ?? "",
    ).trim();

    const itemId = Number(body?.item_id);

    if (imagePath) {
      if (!imagePath.startsWith(`${businessId}/`)) {
        return NextResponse.json(
          { error: "이 비즈니스의 이미지가 아닙니다." },
          { status: 403 },
        );
      }

      const removed = await supabase.storage
        .from(BUCKET)
        .remove([imagePath]);

      if (removed.error) throw removed.error;
    }

    if (Number.isInteger(itemId) && itemId > 0) {
      const updated = await supabase
        .from("business_catering_items")
        .update({
          image_url: null,
          image_path: null,
        })
        .eq("id", itemId)
        .eq("business_id", businessId);

      if (updated.error) throw updated.error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("CATERING IMAGE DELETE ERROR:", error);

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
