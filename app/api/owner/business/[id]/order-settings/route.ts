import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DeliveryFeeShareRule = {
  maxSubtotal: number | null;
  customerPercent: number;
};

type DeliveryFeePolicyMode =
  | "customer_100"
  | "order_amount"
  | "restaurant_100";

function normalizeDeliveryFeePolicyMode(value: unknown): DeliveryFeePolicyMode {
  return value === "customer_100" || value === "restaurant_100"
    ? value
    : "order_amount";
}

const DEFAULT_DELIVERY_FEE_SHARE_RULES: DeliveryFeeShareRule[] = [
  { maxSubtotal: 19.99, customerPercent: 100 },
  { maxSubtotal: 29.99, customerPercent: 70 },
  { maxSubtotal: 39.99, customerPercent: 50 },
  { maxSubtotal: 49.99, customerPercent: 30 },
  { maxSubtotal: null, customerPercent: 0 },
];

function normalizeDeliveryFeeShareRules(
  value: unknown,
): DeliveryFeeShareRule[] {
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_DELIVERY_FEE_SHARE_RULES;
  }

  const normalized: DeliveryFeeShareRule[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index] as any;
    const isLast = index === value.length - 1;

    const customerPercent = Number(raw?.customerPercent);

    if (
      !Number.isFinite(customerPercent) ||
      customerPercent < 0 ||
      customerPercent > 100
    ) {
      return DEFAULT_DELIVERY_FEE_SHARE_RULES;
    }

    if (isLast) {
      normalized.push({
        maxSubtotal: null,
        customerPercent: Number(
          customerPercent.toFixed(2),
        ),
      });
      continue;
    }

    const maxSubtotal = Number(raw?.maxSubtotal);

    if (
      !Number.isFinite(maxSubtotal) ||
      maxSubtotal < 0
    ) {
      return DEFAULT_DELIVERY_FEE_SHARE_RULES;
    }

    normalized.push({
      maxSubtotal: Number(maxSubtotal.toFixed(2)),
      customerPercent: Number(
        customerPercent.toFixed(2),
      ),
    });
  }

  for (
    let index = 1;
    index < normalized.length - 1;
    index += 1
  ) {
    const previous = normalized[index - 1].maxSubtotal;
    const current = normalized[index].maxSubtotal;

    if (
      previous == null ||
      current == null ||
      current <= previous
    ) {
      return DEFAULT_DELIVERY_FEE_SHARE_RULES;
    }
  }

  return normalized;
}

function adminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase server environment variables are missing.",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function requireAccess(
  request: Request,
  businessId: number,
) {
  const auth =
    request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ")
    ? auth.slice(7).trim()
    : "";

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      error: "로그인이 필요합니다.",
    };
  }

  const supabase = adminClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      ok: false as const,
      status: 401,
      error: "로그인 세션이 올바르지 않습니다.",
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) throw profileError;

  if (
    String(profile?.role || "").toLowerCase() ===
    "admin"
  ) {
    return { ok: true as const, supabase };
  }

  const { data: owner, error: ownerError } =
    await supabase
      .from("business_owners")
      .select("business_id,status")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .maybeSingle();

  if (ownerError) throw ownerError;

  // Existing KTown owner records may have approved/active status.
  const status = String(
    owner?.status || "",
  ).toLowerCase();

  if (
    !owner ||
    !["approved", "active"].includes(status)
  ) {
    return {
      ok: false as const,
      status: 403,
      error:
        "이 비즈니스를 관리할 권한이 없습니다.",
    };
  }

  return { ok: true as const, supabase };
}

function normalizeModes(row: any) {
  const menu =
    row?.restaurant_menu_menu_enabled !== false;
  const pickup =
    row?.restaurant_menu_pickup_enabled === true;
  const delivery =
    row?.restaurant_menu_delivery_enabled === true;

  return !menu && !pickup && !delivery
    ? {
        menu: true,
        pickup: false,
        delivery: false,
      }
    : { menu, pickup, delivery };
}

function jsonError(
  error: unknown,
  fallback: string,
  status = 500,
) {
  const message =
    error instanceof Error
      ? error.message
      : fallback;

  console.error("[owner order-settings]", error);

  return NextResponse.json(
    { error: message },
    { status },
  );
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (
      !Number.isInteger(businessId) ||
      businessId <= 0
    ) {
      return NextResponse.json(
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access = await requireAccess(
      request,
      businessId,
    );

    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const {
      data: business,
      error: businessError,
    } = await access.supabase
      .from("businesses")
      .select(
        "restaurant_menu_menu_enabled,restaurant_menu_pickup_enabled,restaurant_menu_delivery_enabled",
      )
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) throw businessError;

    if (!business) {
      return NextResponse.json(
        { error: "비즈니스를 찾지 못했습니다." },
        { status: 404 },
      );
    }

    const {
      data: settings,
      error: settingsError,
    } = await access.supabase
      .from("restaurant_order_settings")
      .select(
        "tax_rate,delivery_fee_policy_mode,delivery_fee_share_rules",
      )
      .eq("business_id", businessId)
      .maybeSingle();

    if (settingsError) throw settingsError;

    const {
      data: privateSettings,
      error: privateError,
    } = await access.supabase
      .from("restaurant_order_private_settings")
      .select("payment_provider")
      .eq("business_id", businessId)
      .maybeSingle();

    if (privateError) throw privateError;

    return NextResponse.json(
      {
        orderModes: normalizeModes(business),
        taxRate: Math.max(
          0,
          Math.min(
            1,
            Number(settings?.tax_rate || 0),
          ),
        ),
        paymentProvider:
          privateSettings?.payment_provider ===
          "square"
            ? "square"
            : "stripe",
        deliveryFeePolicyMode:
          normalizeDeliveryFeePolicyMode(
            settings?.delivery_fee_policy_mode,
          ),
        deliveryFeeShareRules:
          normalizeDeliveryFeeShareRules(
            settings?.delivery_fee_share_rules,
          ),
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    return jsonError(
      error,
      "설정을 불러오지 못했습니다.",
    );
  }
}

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (
      !Number.isInteger(businessId) ||
      businessId <= 0
    ) {
      return NextResponse.json(
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access = await requireAccess(
      request,
      businessId,
    );

    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const body = await request.json();

    const hasModes = [
      "menu",
      "pickup",
      "delivery",
    ].some((key) =>
      Object.prototype.hasOwnProperty.call(
        body || {},
        key,
      ),
    );

    const hasTax =
      Object.prototype.hasOwnProperty.call(
        body || {},
        "taxRate",
      );

    const hasProvider =
      Object.prototype.hasOwnProperty.call(
        body || {},
        "paymentProvider",
      );

    const hasDeliveryFeePolicyMode =
      Object.prototype.hasOwnProperty.call(
        body || {},
        "deliveryFeePolicyMode",
      );

    const hasDeliveryFeeShareRules =
      Object.prototype.hasOwnProperty.call(
        body || {},
        "deliveryFeeShareRules",
      );

    if (
      !hasModes &&
      !hasTax &&
      !hasProvider &&
      !hasDeliveryFeePolicyMode &&
      !hasDeliveryFeeShareRules
    ) {
      return NextResponse.json(
        { error: "저장할 설정이 없습니다." },
        { status: 400 },
      );
    }

    let orderModes:
      | {
          menu: boolean;
          pickup: boolean;
          delivery: boolean;
        }
      | undefined;

    let taxRate: number | undefined;

    let paymentProvider:
      | "stripe"
      | "square"
      | undefined;

    let deliveryFeePolicyMode:
      | DeliveryFeePolicyMode
      | undefined;

    let deliveryFeeShareRules:
      | DeliveryFeeShareRule[]
      | undefined;

    if (hasDeliveryFeePolicyMode) {
      const rawMode = String(body.deliveryFeePolicyMode || "");
      if (!["customer_100", "order_amount", "restaurant_100"].includes(rawMode)) {
        return NextResponse.json(
          { error: "배달료 부담 정책이 올바르지 않습니다." },
          { status: 400 },
        );
      }

      const { data: savedMode, error: modeError } = await access.supabase
        .from("restaurant_order_settings")
        .upsert(
          {
            business_id: businessId,
            delivery_fee_policy_mode: rawMode,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "business_id" },
        )
        .select("delivery_fee_policy_mode")
        .single();

      if (modeError) throw modeError;
      deliveryFeePolicyMode = normalizeDeliveryFeePolicyMode(
        savedMode?.delivery_fee_policy_mode,
      );
    }

    if (hasModes) {
      const {
        data: current,
        error: currentError,
      } = await access.supabase
        .from("businesses")
        .select(
          "restaurant_menu_menu_enabled,restaurant_menu_pickup_enabled,restaurant_menu_delivery_enabled",
        )
        .eq("id", businessId)
        .maybeSingle();

      if (currentError) throw currentError;

      if (!current) {
        return NextResponse.json(
          { error: "비즈니스를 찾지 못했습니다." },
          { status: 404 },
        );
      }

      const currentModes =
        normalizeModes(current);

      const menu =
        typeof body.menu === "boolean"
          ? body.menu
          : currentModes.menu;

      const pickup =
        typeof body.pickup === "boolean"
          ? body.pickup
          : currentModes.pickup;

      const delivery =
        typeof body.delivery === "boolean"
          ? body.delivery
          : currentModes.delivery;

      if (!menu && !pickup && !delivery) {
        return NextResponse.json(
          {
            error:
              "MENU / PICKUP / DELIVERY 중 하나 이상은 선택해야 합니다.",
          },
          { status: 400 },
        );
      }

      const {
        data: savedBusiness,
        error: saveBusinessError,
      } = await access.supabase
        .from("businesses")
        .update({
          restaurant_menu_menu_enabled: menu,
          restaurant_menu_pickup_enabled:
            pickup,
          restaurant_menu_delivery_enabled:
            delivery,
        })
        .eq("id", businessId)
        .select(
          "restaurant_menu_menu_enabled,restaurant_menu_pickup_enabled,restaurant_menu_delivery_enabled",
        )
        .single();

      if (saveBusinessError) {
        throw saveBusinessError;
      }

      const { error: orderSettingsError } =
        await access.supabase
          .from("restaurant_order_settings")
          .upsert(
            {
              business_id: businessId,
              pickup_enabled: pickup,
              delivery_enabled: delivery,
              updated_at:
                new Date().toISOString(),
            },
            { onConflict: "business_id" },
          );

      if (orderSettingsError) {
        throw orderSettingsError;
      }

      orderModes =
        normalizeModes(savedBusiness);
    }

    if (hasTax) {
      const rate = Number(body.taxRate);

      if (
        !Number.isFinite(rate) ||
        rate < 0 ||
        rate > 1
      ) {
        return NextResponse.json(
          {
            error:
              "Tax rate는 0에서 1 사이 값이어야 합니다.",
          },
          { status: 400 },
        );
      }

      const {
        data: savedTax,
        error: taxError,
      } = await access.supabase
        .from("restaurant_order_settings")
        .upsert(
          {
            business_id: businessId,
            tax_rate: rate,
            updated_at:
              new Date().toISOString(),
          },
          { onConflict: "business_id" },
        )
        .select("tax_rate")
        .single();

      if (taxError) throw taxError;

      taxRate = Number(
        savedTax?.tax_rate || 0,
      );
    }

    if (hasDeliveryFeeShareRules) {
      if (
        !Array.isArray(
          body.deliveryFeeShareRules,
        ) ||
        body.deliveryFeeShareRules.length < 1
      ) {
        return NextResponse.json(
          {
            error:
              "배달료 분담 규칙이 올바르지 않습니다.",
          },
          { status: 400 },
        );
      }

      const rawRules =
        body.deliveryFeeShareRules as any[];

      const normalizedRules: DeliveryFeeShareRule[] =
        [];

      for (
        let index = 0;
        index < rawRules.length;
        index += 1
      ) {
        const raw = rawRules[index];
        const isLast =
          index === rawRules.length - 1;

        const customerPercent = Number(
          raw?.customerPercent,
        );

        if (
          !Number.isFinite(customerPercent) ||
          customerPercent < 0 ||
          customerPercent > 100
        ) {
          return NextResponse.json(
            {
              error:
                "고객 배달료 부담률은 0%에서 100% 사이여야 합니다.",
            },
            { status: 400 },
          );
        }

        if (isLast) {
          normalizedRules.push({
            maxSubtotal: null,
            customerPercent: Number(
              customerPercent.toFixed(2),
            ),
          });
          continue;
        }

        const maxSubtotal = Number(
          raw?.maxSubtotal,
        );

        if (
          !Number.isFinite(maxSubtotal) ||
          maxSubtotal < 0
        ) {
          return NextResponse.json(
            {
              error:
                "주문금액 기준은 0 이상이어야 합니다.",
            },
            { status: 400 },
          );
        }

        if (
          index > 0 &&
          normalizedRules[index - 1]
            ?.maxSubtotal != null &&
          maxSubtotal <=
            Number(
              normalizedRules[index - 1]
                .maxSubtotal,
            )
        ) {
          return NextResponse.json(
            {
              error:
                "주문금액 기준은 작은 금액부터 큰 금액 순서여야 합니다.",
            },
            { status: 400 },
          );
        }

        normalizedRules.push({
          maxSubtotal: Number(
            maxSubtotal.toFixed(2),
          ),
          customerPercent: Number(
            customerPercent.toFixed(2),
          ),
        });
      }

      const {
        data: savedRules,
        error: rulesError,
      } = await access.supabase
        .from("restaurant_order_settings")
        .upsert(
          {
            business_id: businessId,
            delivery_fee_share_rules:
              normalizedRules,
            updated_at:
              new Date().toISOString(),
          },
          { onConflict: "business_id" },
        )
        .select("delivery_fee_share_rules")
        .single();

      if (rulesError) throw rulesError;

      deliveryFeeShareRules =
        normalizeDeliveryFeeShareRules(
          savedRules?.delivery_fee_share_rules,
        );
    }

    if (hasProvider) {
      const provider =
        body.paymentProvider === "square"
          ? "square"
          : body.paymentProvider === "stripe"
            ? "stripe"
            : null;

      if (!provider) {
        return NextResponse.json(
          {
            error:
              "Payment Provider는 stripe 또는 square만 가능합니다.",
          },
          { status: 400 },
        );
      }

      const {
        data: savedPrivate,
        error: providerError,
      } = await access.supabase
        .from(
          "restaurant_order_private_settings",
        )
        .upsert(
          {
            business_id: businessId,
            payment_provider: provider,
            updated_at:
              new Date().toISOString(),
          },
          { onConflict: "business_id" },
        )
        .select("payment_provider")
        .single();

      if (providerError) {
        throw providerError;
      }

      paymentProvider =
        savedPrivate?.payment_provider ===
        "square"
          ? "square"
          : "stripe";
    }

    return NextResponse.json(
      {
        success: true,
        ...(orderModes
          ? { orderModes }
          : {}),
        ...(taxRate !== undefined
          ? { taxRate }
          : {}),
        ...(paymentProvider
          ? { paymentProvider }
          : {}),
        ...(deliveryFeePolicyMode
          ? { deliveryFeePolicyMode }
          : {}),
        ...(deliveryFeeShareRules
          ? { deliveryFeeShareRules }
          : {}),
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    return jsonError(
      error,
      "설정 저장에 실패했습니다.",
    );
  }
}
