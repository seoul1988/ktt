import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.",
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function parseBusinessId(value: string) {
  const businessId = Number(value);

  if (
    !Number.isInteger(businessId) ||
    businessId <= 0
  ) {
    return null;
  }

  return businessId;
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
      error:
        "로그인 정보를 확인할 수 없습니다.",
    };
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (profile?.role === "admin") {
    return {
      allowed: true,
      status: 200,
      error: "",
    };
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

  if (ownerError) {
    throw ownerError;
  }

  if (businessError) {
    throw businessError;
  }

  if (!owner) {
    return {
      allowed: false,
      status: 403,
      error:
        "이 비즈니스를 관리할 권한이 없습니다.",
    };
  }

  if (business?.website_enabled !== true) {
    return {
      allowed: false,
      status: 403,
      error:
        "사이트 관리가 활성화되지 않았습니다.",
    };
  }

  return {
    allowed: true,
    status: 200,
    error: "",
  };
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = parseBusinessId(id);

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

    const supabase = getAdminClient();

    const [
      { data: business, error: businessError },
      { data: categories, error: categoryError },
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select("id,name")
        .eq("id", businessId)
        .maybeSingle(),

      supabase
        .from("business_menu_categories")
        .select(
          "id,name,display_order,is_active",
        )
        .eq("business_id", businessId)
        .order("display_order", {
          ascending: true,
          nullsFirst: false,
        })
        .order("id", {
          ascending: true,
        }),
    ]);

    if (businessError) {
      throw businessError;
    }

    if (categoryError) {
      throw categoryError;
    }

    return NextResponse.json(
      {
        business,
        categories: categories || [],
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "카테고리를 불러오지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = parseBusinessId(id);

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
    const name = String(
      body?.name || "",
    ).trim();

    if (!name) {
      return NextResponse.json(
        {
          error:
            "카테고리 이름을 입력하세요.",
        },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();

    const {
      data: duplicate,
      error: duplicateError,
    } = await supabase
      .from("business_menu_categories")
      .select("id")
      .eq("business_id", businessId)
      .ilike("name", name)
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      throw duplicateError;
    }

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "같은 이름의 카테고리가 이미 있습니다.",
        },
        { status: 409 },
      );
    }

    const { data: lastCategory } =
      await supabase
        .from("business_menu_categories")
        .select("display_order")
        .eq("business_id", businessId)
        .order("display_order", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(1)
        .maybeSingle();

    const nextOrder =
      Number(
        lastCategory?.display_order || 0,
      ) + 1;

    const {
      data: category,
      error: insertError,
    } = await supabase
      .from("business_menu_categories")
      .insert({
        business_id: businessId,
        name,
        display_order: nextOrder,
        is_active: true,
      })
      .select(
        "id,name,display_order,is_active",
      )
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      category,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "카테고리를 추가하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { id } = await context.params;
    const businessId = parseBusinessId(id);

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
    const categoryId = Number(body?.id);
    const name = String(
      body?.name || "",
    ).trim();

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "잘못된 카테고리 ID입니다.",
        },
        { status: 400 },
      );
    }

    if (!name) {
      return NextResponse.json(
        {
          error:
            "카테고리 이름을 입력하세요.",
        },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();

    const {
      data: duplicate,
      error: duplicateError,
    } = await supabase
      .from("business_menu_categories")
      .select("id")
      .eq("business_id", businessId)
      .ilike("name", name)
      .neq("id", categoryId)
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      throw duplicateError;
    }

    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "같은 이름의 카테고리가 이미 있습니다.",
        },
        { status: 409 },
      );
    }

    const {
      data: category,
      error: updateError,
    } = await supabase
      .from("business_menu_categories")
      .update({
        name,
        display_order: Number(
          body?.display_order ?? 999,
        ),
        is_active:
          body?.is_active !== false,
      })
      .eq("business_id", businessId)
      .eq("id", categoryId)
      .select(
        "id,name,display_order,is_active",
      )
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!category) {
      return NextResponse.json(
        {
          error:
            "카테고리를 찾지 못했습니다.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      category,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "카테고리를 저장하지 못했습니다.",
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
    const businessId = parseBusinessId(id);

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
    const categoryId = Number(body?.id);

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "잘못된 카테고리 ID입니다.",
        },
        { status: 400 },
      );
    }

    const supabase = getAdminClient();

    const {
      count,
      error: countError,
    } = await supabase
      .from("business_menu_items")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("business_id", businessId)
      .eq("category_id", categoryId);

    if (countError) {
      throw countError;
    }

    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          error:
            "이 카테고리에 메뉴 품목이 있습니다. 먼저 해당 품목을 다른 카테고리로 옮겨주세요.",
        },
        { status: 409 },
      );
    }

    const {
      data,
      error: deleteError,
    } = await supabase
      .from("business_menu_categories")
      .delete()
      .eq("business_id", businessId)
      .eq("id", categoryId)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      throw deleteError;
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "카테고리를 찾지 못했습니다.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "카테고리를 삭제하지 못했습니다.",
      },
      { status: 500 },
    );
  }
}
