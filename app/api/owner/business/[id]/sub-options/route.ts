import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type NormalizedSubOptionChoice = {
  name: string;
  price_delta: number;
  sort_order: number;
  active: boolean;
  sold_out: boolean;
  use_sub_option: boolean;
  sub_option_group_no: number | null;
};

function getSupabaseAdmin() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are missing.");
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

async function requireBusinessAccess(
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

  const supabase = getSupabaseAdmin();
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
    return {
      allowed: true,
      status: 200,
      error: "",
    };
  }

  const { data: owner, error: ownerError } =
    await supabase
      .from("business_owners")
      .select("business_id")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .maybeSingle();

  if (ownerError) throw ownerError;

  return owner
    ? { allowed: true, status: 200, error: "" }
    : {
        allowed: false,
        status: 403,
        error: "이 비즈니스를 관리할 권한이 없습니다.",
      };
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

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access =
      await requireBusinessAccess(request, businessId);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const body = await request.json();
    const template = body?.template || {};

    const name = String(template?.name || "").trim();
    const groupNo = Number(template?.subOptionGroupNo);

    if (!name) {
      return NextResponse.json(
        { error: "서브옵션 이름을 입력하세요." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(groupNo) || groupNo <= 0) {
      return NextResponse.json(
        { error: "서브옵션 그룹 번호가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const required = template?.required === true;
    const minSelect = Math.max(
      0,
      Math.floor(Number(template?.minSelect) || 0),
    );
    const rawMax = template?.maxSelect;
    const maxSelect =
      rawMax == null || rawMax === ""
        ? null
        : Math.max(0, Math.floor(Number(rawMax) || 0));

    const options = Array.isArray(template?.options)
      ? template.options
      : [];

    const normalizedOptions: NormalizedSubOptionChoice[] = options.map(
      (option: any, index: number): NormalizedSubOptionChoice => {
        const optionName = String(option?.name || "").trim();
        if (!optionName) {
          throw new Error(
            `서브옵션 ${index + 1}의 이름을 입력하세요.`,
          );
        }

        return {
          name: optionName,
          price_delta: Number(
            Number(option?.priceDelta || 0).toFixed(2),
          ),
          sort_order: index,
          active: option?.soldOut !== true,
          sold_out: option?.soldOut === true,
          use_sub_option: false,
          sub_option_group_no: null,
        };
      },
    );

    const supabase = getSupabaseAdmin();

    const {
      data: existingGroup,
      error: existingError,
    } = await supabase
      .from("menu_option_groups")
      .select("id")
      .eq("business_id", businessId)
      .eq("sub_option_group_no", groupNo)
      .eq("is_sub_option_only", true)
      .maybeSingle();

    if (existingError) throw existingError;

    let groupId: number;

    if (existingGroup?.id) {
      groupId = Number(existingGroup.id);

      const { error: updateError } = await supabase
        .from("menu_option_groups")
        .update({
          name,
          required,
          min_select: minSelect,
          max_select: maxSelect,
          active: true,
          is_sub_option_only: true,
          sub_option_group_no: groupNo,
        })
        .eq("id", groupId)
        .eq("business_id", businessId);

      if (updateError) throw updateError;
    } else {
      const { data: lastGroup } = await supabase
        .from("menu_option_groups")
        .select("sort_order")
        .eq("business_id", businessId)
        .order("sort_order", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(1)
        .maybeSingle();

      const nextSortOrder =
        Number(lastGroup?.sort_order || 0) + 1;

      const { data: insertedGroup, error: insertError } =
        await supabase
          .from("menu_option_groups")
          .insert({
            business_id: businessId,
            name,
            required,
            min_select: minSelect,
            max_select: maxSelect,
            sort_order: nextSortOrder,
            active: true,
            is_sub_option_only: true,
            sub_option_group_no: groupNo,
          })
          .select("id")
          .single();

      if (insertError) throw insertError;
      groupId = Number(insertedGroup.id);
    }

    const { error: deleteChoicesError } = await supabase
      .from("menu_option_choices")
      .delete()
      .eq("option_group_id", groupId);

    if (deleteChoicesError) throw deleteChoicesError;

    if (normalizedOptions.length > 0) {
      const { error: insertChoicesError } = await supabase
        .from("menu_option_choices")
        .insert(
          normalizedOptions.map((option: NormalizedSubOptionChoice) => ({
            option_group_id: groupId,
            ...option,
          })),
        );

      if (insertChoicesError) throw insertChoicesError;
    }

    return NextResponse.json({
      success: true,
      groupId,
      subOptionGroupNo: groupNo,
    });
  } catch (error) {
    console.error("SUB OPTION LIBRARY SAVE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "서브옵션 저장에 실패했습니다.",
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
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "잘못된 비즈니스 ID입니다." },
        { status: 400 },
      );
    }

    const access =
      await requireBusinessAccess(request, businessId);

    if (!access.allowed) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const body = await request.json();
    const groupNo = Number(body?.subOptionGroupNo);

    if (!Number.isInteger(groupNo) || groupNo <= 0) {
      return NextResponse.json(
        { error: "서브옵션 그룹 번호가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: group, error: groupError } =
      await supabase
        .from("menu_option_groups")
        .select("id")
        .eq("business_id", businessId)
        .eq("sub_option_group_no", groupNo)
        .eq("is_sub_option_only", true)
        .maybeSingle();

    if (groupError) throw groupError;

    if (group?.id) {
      const { error: choiceDeleteError } = await supabase
        .from("menu_option_choices")
        .delete()
        .eq("option_group_id", Number(group.id));

      if (choiceDeleteError) throw choiceDeleteError;

      const { error: groupDeleteError } = await supabase
        .from("menu_option_groups")
        .delete()
        .eq("id", Number(group.id))
        .eq("business_id", businessId);

      if (groupDeleteError) throw groupDeleteError;
    }

    return NextResponse.json({
      success: true,
      subOptionGroupNo: groupNo,
    });
  } catch (error) {
    console.error("SUB OPTION LIBRARY DELETE ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "서브옵션 삭제에 실패했습니다.",
      },
      { status: 500 },
    );
  }
}
