import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ id: string }>;
};

type UnknownRecord = Record<string, unknown>;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

export async function GET(_request: Request, { params }: Props) {
  const { id } = await params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return NextResponse.json(
      { error: "Invalid business ID" },
      { status: 400 },
    );
  }

  const { data: business, error } = await getServerSupabase()
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  if (!business) {
    return NextResponse.json(
      { error: "Business not found" },
      { status: 404 },
    );
  }

  const businessName = text(business.name) || "Business";

  /*
   * 실제 접속 주소와 scope를 완전히 동일하게 사용합니다.
   * 끝의 /를 한쪽에만 붙이면 scope ignored 경고가 발생할 수 있습니다.
   */
  const startUrl = `/business/${businessId}/website`;

  return NextResponse.json(
    {
      id: startUrl,
      name: businessName,
      short_name: businessName.slice(0, 12).trim(),
      description: `${businessName} official website`,
      start_url: startUrl,
      scope: startUrl,
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#ffffff",
      theme_color: "#ffffff",
      icons: [
        {
          src: `/business/${businessId}/website/icon/192`,
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: `/business/${businessId}/website/icon/512`,
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: `/business/${businessId}/website/icon/512?purpose=maskable`,
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
