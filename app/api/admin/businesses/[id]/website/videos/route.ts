import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BUCKET = "business-website-media";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.",
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return json(
        { error: "잘못된 business id입니다." },
        400,
      );
    }

    const access =
      await requireBusinessApiAccess(businessId);

    if (!access.ok) return access.response;

    const supabase = getSupabaseAdmin();
    const folder = `${businessId}/videos`;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(folder, {
        limit: 100,
        offset: 0,
        sortBy: {
          column: "created_at",
          order: "desc",
        },
      });

    if (error) {
      if (/not found/i.test(error.message)) {
        return json({ videos: [] });
      }

      throw error;
    }

    const videos = (data ?? [])
      .filter((item) =>
        /\.(mp4|webm)$/i.test(item.name),
      )
      .map((item) => {
        const path = `${folder}/${item.name}`;

        const { data: publicUrlData } =
          supabase.storage
            .from(BUCKET)
            .getPublicUrl(path);

        return {
          name: item.name,
          path,
          url: publicUrlData.publicUrl,
          size:
            item.metadata &&
            typeof item.metadata === "object" &&
            "size" in item.metadata
              ? Number(item.metadata.size) || null
              : null,
          created_at: item.created_at || null,
        };
      });

    return json({ videos });
  } catch (error) {
    console.error(
      "website video list error",
      error,
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "동영상 목록을 불러오지 못했습니다.",
      },
      500,
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return json(
        { error: "잘못된 business id입니다." },
        400,
      );
    }

    const access =
      await requireBusinessApiAccess(businessId);

    if (!access.ok) return access.response;

    const body = await request.json();
    const path = String(body?.path || "").trim();

    const expectedPrefix = `${businessId}/videos/`;

    if (
      !path ||
      !path.startsWith(expectedPrefix) ||
      !/\.(mp4|webm)$/i.test(path)
    ) {
      return json(
        { error: "삭제할 동영상 경로가 올바르지 않습니다." },
        400,
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([path]);

    if (error) throw error;

    return json({
      ok: true,
      deleted_path: path,
    });
  } catch (error) {
    console.error(
      "website video delete error",
      error,
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "동영상을 삭제하지 못했습니다.",
      },
      500,
    );
  }
}
