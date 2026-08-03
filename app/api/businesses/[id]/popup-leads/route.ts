import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
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

function validEmail(value: unknown) {
  const email = String(value || "")
    .trim()
    .toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? email
    : "";
}

function createCoupon(prefix: string) {
  const suffix = randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `${prefix || "WELCOME"}-${suffix}`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);
    const body = await request.json();
    const bannerId = Number(body?.banner_id);
    const email = validEmail(body?.email);

    if (
      !Number.isInteger(businessId) ||
      businessId <= 0 ||
      !Number.isInteger(bannerId) ||
      bannerId <= 0 ||
      !email
    ) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const supabase = getSupabase();

    const { data: banner, error: bannerError } =
      await supabase
        .from("business_website_banners")
        .select(
          "id,lead_capture_enabled,success_message,coupon_code_prefix,reward_signup_url",
        )
        .eq("business_id", businessId)
        .eq("id", bannerId)
        .eq("is_active", true)
        .maybeSingle();

    if (bannerError) throw bannerError;

    if (!banner || !banner.lead_capture_enabled) {
      return NextResponse.json(
        { error: "This offer is not available." },
        { status: 404 },
      );
    }

    const { data: existing, error: existingError } =
      await supabase
        .from("business_popup_leads")
        .select("coupon_code")
        .eq("business_id", businessId)
        .eq("banner_id", bannerId)
        .eq("email", email)
        .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        coupon_code: existing.coupon_code,
        message:
          banner.success_message ||
          "You are already signed up.",
      });
    }

    const prefix = String(
      banner.coupon_code_prefix || "WELCOME",
    )
      .replace(/[^A-Z0-9]/gi, "")
      .slice(0, 12)
      .toUpperCase();

    const couponCode = createCoupon(prefix);

    const { error } = await supabase
      .from("business_popup_leads")
      .insert({
        business_id: businessId,
        banner_id: bannerId,
        email,
        coupon_code: couponCode,
        marketing_consent: true,
        rewards_opt_in: Boolean(
          banner.reward_signup_url,
        ),
        source: "website_popup",
      });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      coupon_code: couponCode,
      message:
        banner.success_message ||
        "Check your email! 🎉",
      reward_signup_url:
        banner.reward_signup_url || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not save your email.",
      },
      { status: 500 },
    );
  }
}