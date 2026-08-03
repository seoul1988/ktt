import {
  NextRequest,
  NextResponse,
} from "next/server";

import { requireBusinessApiAccess } from "@/lib/requireBusinessApiAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type DayKey =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

type DayHours = {
  closed: boolean;
  open: string;
  close: string;
  breakEnabled: boolean;
  breakStart: string;
  breakEnd: string;
};

const DAYS: Array<{
  key: DayKey;
  short: string;
}> = [
  {
    key: "Monday",
    short: "Mon",
  },
  {
    key: "Tuesday",
    short: "Tue",
  },
  {
    key: "Wednesday",
    short: "Wed",
  },
  {
    key: "Thursday",
    short: "Thu",
  },
  {
    key: "Friday",
    short: "Fri",
  },
  {
    key: "Saturday",
    short: "Sat",
  },
  {
    key: "Sunday",
    short: "Sun",
  },
];

function json(
  data: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function isValidTime(
  value: unknown,
): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{2}:\d{2}$/.test(value)
  ) {
    return false;
  }

  const [hour, minute] =
    value.split(":").map(Number);

  return (
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

function sanitizeDay(
  value: unknown,
  day: DayKey,
): DayHours {
  if (!isPlainObject(value)) {
    throw new Error(
      `${day} 영업시간이 올바르지 않습니다.`,
    );
  }

  return {
    closed:
      value.closed === true,
    open: isValidTime(value.open)
      ? value.open
      : "10:00",
    close: isValidTime(value.close)
      ? value.close
      : "21:00",
    breakEnabled:
      value.breakEnabled === true,
    breakStart: isValidTime(
      value.breakStart,
    )
      ? value.breakStart
      : "15:00",
    breakEnd: isValidTime(
      value.breakEnd,
    )
      ? value.breakEnd
      : "17:00",
  };
}

function sanitizeHours(
  value: unknown,
): Record<DayKey, DayHours> {
  if (!isPlainObject(value)) {
    throw new Error(
      "영업시간 데이터가 올바르지 않습니다.",
    );
  }

  const result =
    {} as Record<
      DayKey,
      DayHours
    >;

  for (const day of DAYS) {
    result[day.key] =
      sanitizeDay(
        value[day.key],
        day.key,
      );
  }

  return result;
}

function twentyFourToTwelve(
  value: string,
): string {
  const [rawHour, rawMinute] =
    value.split(":");

  const hour24 =
    Number(rawHour);

  const minute =
    Number(rawMinute);

  const period =
    hour24 >= 12
      ? "PM"
      : "AM";

  const hour12 =
    hour24 % 12 || 12;

  return `${hour12}:${String(
    minute,
  ).padStart(2, "0")} ${period}`;
}

/**
 * 기존 Edit Business 페이지와 동일한 DB 문자열로 변환합니다.
 */
function formatHoursForDatabase(
  hours: Record<
    DayKey,
    DayHours
  >,
): string {
  return DAYS.map((day) => {
    const value =
      hours[day.key];

    if (value.closed) {
      return `${day.short} Closed`;
    }

    const base =
      `${day.short} ` +
      `${twentyFourToTwelve(
        value.open,
      )} - ` +
      `${twentyFourToTwelve(
        value.close,
      )}`;

    if (value.breakEnabled) {
      return (
        `${base} / Break ` +
        `${twentyFourToTwelve(
          value.breakStart,
        )} - ` +
        `${twentyFourToTwelve(
          value.breakEnd,
        )}`
      );
    }

    return base;
  }).join("\n");
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { id } =
    await context.params;

  const businessId =
    Number(id);

  if (
    !Number.isInteger(
      businessId,
    ) ||
    businessId <= 0
  ) {
    return json(
      {
        error:
          "잘못된 business ID입니다.",
      },
      400,
    );
  }

  const access =
    await requireBusinessApiAccess(
      businessId,
    );

  if (!access.ok) {
    return access.response;
  }

  const { data, error } =
    await supabaseAdmin
      .from("businesses")
      .select("id, hours")
      .eq("id", businessId)
      .maybeSingle();

  if (error) {
    return json(
      {
        error:
          `영업시간 조회 실패: ${error.message}`,
      },
      500,
    );
  }

  if (!data) {
    return json(
      {
        error:
          "비즈니스를 찾을 수 없습니다.",
      },
      404,
    );
  }

  return json({
    ok: true,
    hours:
      data.hours ?? "",
  });
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  const { id } =
    await context.params;

  const businessId =
    Number(id);

  if (
    !Number.isInteger(
      businessId,
    ) ||
    businessId <= 0
  ) {
    return json(
      {
        error:
          "잘못된 business ID입니다.",
      },
      400,
    );
  }

  const access =
    await requireBusinessApiAccess(
      businessId,
    );

  if (!access.ok) {
    return access.response;
  }

  try {
    const body =
      (await request.json()) as {
        hours?: unknown;
      };

    const sanitized =
      sanitizeHours(
        body.hours,
      );

    const hoursText =
      formatHoursForDatabase(
        sanitized,
      );

    const { data, error } =
      await supabaseAdmin
        .from("businesses")
        .update({
          hours: hoursText,
        })
        .eq("id", businessId)
        .select("id, hours")
        .single();

    if (error) {
      throw new Error(
        `영업시간 저장 실패: ${error.message}`,
      );
    }

    return json({
      ok: true,
      hours: data.hours,
    });
  } catch (error) {
    console.error(
      "Business hours save failed:",
      error,
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "영업시간 저장에 실패했습니다.",
      },
      500,
    );
  }
}