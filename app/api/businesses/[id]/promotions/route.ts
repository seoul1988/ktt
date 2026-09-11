import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function safeAssignments(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const db = adminClient();

    const { data, error } = await db
      .from("restaurant_promotion_state")
      .select("promotions,assignments,updated_at")
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) throw error;

    const promotions = Array.isArray(data?.promotions)
      ? data.promotions.filter((row: any) => row?.active !== false)
      : [];

    const activeIds = new Set(
      promotions.map((row: any) => String(row?.id || "")).filter(Boolean),
    );

    const rawAssignments = safeAssignments(data?.assignments);
    const assignments: Record<string, any> = {};

    for (const [itemId, value] of Object.entries(rawAssignments)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;

      const filtered: Record<string, any> = {};
      for (const [promotionId, assignment] of Object.entries(
        value as Record<string, any>,
      )) {
        if (activeIds.has(promotionId)) {
          filtered[promotionId] = assignment;
        }
      }

      if (Object.keys(filtered).length > 0) {
        assignments[itemId] = filtered;
      }
    }

    return NextResponse.json(
      {
        promotions,
        assignments,
        updatedAt: data?.updated_at || null,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("[public promotions GET]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "딜 정보를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
