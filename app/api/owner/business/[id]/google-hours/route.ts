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

type GoogleFindPlaceResponse = {
  status?: string;
  error_message?: string;
  candidates?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
  }>;
};

type GooglePeriodTime = {
  day?: number;
  time?: string;
};

type GooglePeriod = {
  open?: GooglePeriodTime;
  close?: GooglePeriodTime;
};

type GooglePlaceDetailsResponse = {
  status?: string;
  error_message?: string;
  result?: {
    name?: string;
    formatted_address?: string;
    opening_hours?: {
      open_now?: boolean;
      periods?: GooglePeriod[];
      weekday_text?: string[];
    };
  };
};

const DAY_KEYS: DayKey[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const GOOGLE_DAY_MAP: Record<
  number,
  DayKey
> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

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

function createClosedDay(): DayHours {
  return {
    closed: true,
    open: "11:00",
    close: "21:00",
    breakEnabled: false,
    breakStart: "14:00",
    breakEnd: "17:00",
  };
}

function normalizeGoogleTime(
  value: string | undefined,
  fallback: string,
) {
  if (
    typeof value !== "string" ||
    !/^\d{4}$/.test(value)
  ) {
    return fallback;
  }

  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(2, 4));

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return fallback;
  }

  return `${String(hour).padStart(
    2,
    "0",
  )}:${String(minute).padStart(2, "0")}`;
}

function minutesFromGoogleTime(
  value: string | undefined,
) {
  if (
    typeof value !== "string" ||
    !/^\d{4}$/.test(value)
  ) {
    return 0;
  }

  return (
    Number(value.slice(0, 2)) * 60 +
    Number(value.slice(2, 4))
  );
}

function convertGooglePeriods(
  periods: GooglePeriod[],
): Record<DayKey, DayHours> {
  const hours = Object.fromEntries(
    DAY_KEYS.map((day) => [
      day,
      createClosedDay(),
    ]),
  ) as Record<DayKey, DayHours>;

  const grouped = new Map<
    DayKey,
    GooglePeriod[]
  >();

  for (const period of periods) {
    const openDay = period.open?.day;

    if (
      typeof openDay !== "number" ||
      !GOOGLE_DAY_MAP[openDay]
    ) {
      continue;
    }

    const dayKey =
      GOOGLE_DAY_MAP[openDay];

    const existing =
      grouped.get(dayKey) ?? [];

    existing.push(period);
    grouped.set(dayKey, existing);
  }

  for (const dayKey of DAY_KEYS) {
    const dayPeriods =
      grouped.get(dayKey) ?? [];

    if (dayPeriods.length === 0) {
      continue;
    }

    dayPeriods.sort(
      (left, right) =>
        minutesFromGoogleTime(
          left.open?.time,
        ) -
        minutesFromGoogleTime(
          right.open?.time,
        ),
    );

    const firstPeriod =
      dayPeriods[0];

    const lastPeriod =
      dayPeriods[
        dayPeriods.length - 1
      ];

    /*
     * Google이 24시간 영업을 close 없이 반환하는 경우
     */
    if (
      dayPeriods.length === 1 &&
      firstPeriod.open?.time ===
        "0000" &&
      !firstPeriod.close?.time
    ) {
      hours[dayKey] = {
        closed: false,
        open: "00:00",
        close: "23:59",
        breakEnabled: false,
        breakStart: "14:00",
        breakEnd: "17:00",
      };

      continue;
    }

    /*
     * 하루에 두 개 이상의 영업 구간이 있으면
     * 첫 구간 종료부터 두 번째 구간 시작까지를
     * Break Time으로 처리합니다.
     */
    const secondPeriod =
      dayPeriods[1];

    const breakEnabled =
      dayPeriods.length >= 2 &&
      Boolean(
        firstPeriod.close?.time &&
          secondPeriod?.open?.time,
      );

    hours[dayKey] = {
      closed: false,
      open: normalizeGoogleTime(
        firstPeriod.open?.time,
        "11:00",
      ),
      close: normalizeGoogleTime(
        lastPeriod.close?.time,
        "21:00",
      ),
      breakEnabled,
      breakStart: breakEnabled
        ? normalizeGoogleTime(
            firstPeriod.close?.time,
            "14:00",
          )
        : "14:00",
      breakEnd: breakEnabled
        ? normalizeGoogleTime(
            secondPeriod.open?.time,
            "17:00",
          )
        : "17:00",
    };
  }

  return hours;
}

async function fetchGoogleJson<T>(
  url: string,
  timeoutMs = 20000,
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(
      `Google API HTTP 오류: ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const { id } = await context.params;
  const businessId = Number(id);

  if (
    !Number.isInteger(businessId) ||
    businessId <= 0
  ) {
    return json(
      {
        ok: false,
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

  const googleKey =
    process.env
      .GOOGLE_PLACES_API_KEY
      ?.trim();

  if (!googleKey) {
    return json(
      {
        ok: false,
        error:
          "GOOGLE_PLACES_API_KEY 환경변수가 없습니다.",
      },
      500,
    );
  }

  try {
    const {
      data: business,
      error: businessError,
    } = await supabaseAdmin
      .from("businesses")
      .select(
        "id, name, address, city, google_place_id",
      )
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      throw new Error(
        `비즈니스 조회 실패: ${businessError.message}`,
      );
    }

    if (!business) {
      return json(
        {
          ok: false,
          error:
            "비즈니스를 찾을 수 없습니다.",
        },
        404,
      );
    }

    let placeId =
      typeof business.google_place_id ===
      "string"
        ? business.google_place_id.trim()
        : "";

    let googlePlaceName =
      business.name?.trim() || "";

    /*
     * 저장된 Google Place ID가 없으면
     * 이름과 주소로 기존 Find Place API를 호출합니다.
     */
    if (!placeId) {
      const searchText = [
        business.name,
        business.address,
        business.city,
        "NC",
      ]
        .filter(Boolean)
        .map((value) =>
          String(value).trim(),
        )
        .filter(Boolean)
        .join(" ");

      if (!searchText) {
        return json(
          {
            ok: false,
            error:
              "Google에서 검색할 비즈니스 이름이나 주소가 없습니다.",
          },
          400,
        );
      }

      const findUrl =
        "https://maps.googleapis.com/maps/api/place/findplacefromtext/json" +
        `?input=${encodeURIComponent(
          searchText,
        )}` +
        "&inputtype=textquery" +
        "&fields=place_id,name,formatted_address" +
        `&key=${encodeURIComponent(
          googleKey,
        )}`;

      const findData =
        await fetchGoogleJson<GoogleFindPlaceResponse>(
          findUrl,
        );

      if (
        findData.status !== "OK"
      ) {
        return json(
          {
            ok: false,
            error:
              findData.error_message ||
              `Google 장소 검색 실패: ${
                findData.status ||
                "UNKNOWN_ERROR"
              }`,
          },
          502,
        );
      }

      const candidate =
        findData.candidates?.[0];

      placeId =
        candidate?.place_id?.trim() ||
        "";

      googlePlaceName =
        candidate?.name?.trim() ||
        googlePlaceName;

      if (!placeId) {
        return json(
          {
            ok: false,
            error:
              "Google에서 Place ID를 찾지 못했습니다.",
          },
          404,
        );
      }

      /*
       * 다음 요청부터 다시 검색하지 않도록 Place ID 저장
       */
      const { error: savePlaceIdError } =
        await supabaseAdmin
          .from("businesses")
          .update({
            google_place_id: placeId,
          })
          .eq("id", businessId);

      if (savePlaceIdError) {
        console.error(
          "Google Place ID 저장 실패:",
          savePlaceIdError,
        );
      }
    }

    const detailUrl =
      "https://maps.googleapis.com/maps/api/place/details/json" +
      `?place_id=${encodeURIComponent(
        placeId,
      )}` +
      "&fields=name,formatted_address,opening_hours" +
      `&key=${encodeURIComponent(
        googleKey,
      )}`;

    const detailData =
      await fetchGoogleJson<GooglePlaceDetailsResponse>(
        detailUrl,
      );

    if (
      detailData.status !== "OK"
    ) {
      return json(
        {
          ok: false,
          error:
            detailData.error_message ||
            `Google 장소 상세 조회 실패: ${
              detailData.status ||
              "UNKNOWN_ERROR"
            }`,
          place_id: placeId,
        },
        502,
      );
    }

    const openingHours =
      detailData.result
        ?.opening_hours;

    const periods =
      openingHours?.periods ?? [];

    if (periods.length === 0) {
      return json(
        {
          ok: false,
          error:
            "Google에 등록된 영업시간이 없습니다.",
          place_id: placeId,
          place_name:
            detailData.result?.name ||
            googlePlaceName,
        },
        404,
      );
    }

    const hours =
      convertGooglePeriods(periods);

    return json({
      ok: true,
      place_id: placeId,
      place_name:
        detailData.result?.name ||
        googlePlaceName,
      formatted_address:
        detailData.result
          ?.formatted_address ||
        null,
      hours,
      weekday_descriptions:
        openingHours
          ?.weekday_text ?? [],
    });
  } catch (error) {
    console.error(
      "Google 영업시간 조회 실패:",
      error,
    );

    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Google 영업시간을 가져오지 못했습니다.",
      },
      500,
    );
  }
}