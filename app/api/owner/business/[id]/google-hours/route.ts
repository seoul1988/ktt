import { NextRequest, NextResponse } from "next/server";

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

type GooglePeriodTime = {
  day?: number;
  hour?: number;
  minute?: number;
};

type GooglePeriod = {
  open?: GooglePeriodTime;
  close?: GooglePeriodTime;
};

type GoogleDisplayName = {
  text?: string;
};

type GooglePlace = {
  id?: string;
  displayName?: GoogleDisplayName;
  formattedAddress?: string;
  regularOpeningHours?: {
    openNow?: boolean;
    periods?: GooglePeriod[];
    weekdayDescriptions?: string[];
  };
};

type GoogleTextSearchResponse = {
  places?: GooglePlace[];
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

const GOOGLE_DAY_MAP: Record<number, DayKey> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

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
  value: GooglePeriodTime | undefined,
  fallback: string,
) {
  if (typeof value?.hour !== "number" || !Number.isInteger(value.hour)) {
    return fallback;
  }

  const hour = value.hour;
  const minute = value.minute ?? 0;

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

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function minutesFromGoogleTime(value: GooglePeriodTime | undefined) {
  if (typeof value?.hour !== "number" || !Number.isInteger(value.hour)) {
    return 0;
  }

  return value.hour * 60 + (value.minute ?? 0);
}

function convertGooglePeriods(
  periods: GooglePeriod[],
): Record<DayKey, DayHours> {
  const hours = Object.fromEntries(
    DAY_KEYS.map((day) => [day, createClosedDay()]),
  ) as Record<DayKey, DayHours>;

  const grouped = new Map<DayKey, GooglePeriod[]>();

  for (const period of periods) {
    const openDay = period.open?.day;

    if (typeof openDay !== "number" || !GOOGLE_DAY_MAP[openDay]) {
      continue;
    }

    const dayKey = GOOGLE_DAY_MAP[openDay];

    const existing = grouped.get(dayKey) ?? [];

    existing.push(period);
    grouped.set(dayKey, existing);
  }

  for (const dayKey of DAY_KEYS) {
    const dayPeriods = grouped.get(dayKey) ?? [];

    if (dayPeriods.length === 0) {
      continue;
    }

    dayPeriods.sort(
      (left, right) =>
        minutesFromGoogleTime(left.open) - minutesFromGoogleTime(right.open),
    );

    const firstPeriod = dayPeriods[0];

    const lastPeriod = dayPeriods[dayPeriods.length - 1];

    /*
     * Google이 24시간 영업을 close 없이 반환하는 경우
     */
    if (
      dayPeriods.length === 1 &&
      firstPeriod.open?.hour === 0 &&
      (firstPeriod.open?.minute ?? 0) === 0 &&
      (!firstPeriod.close ||
        (firstPeriod.close.day === firstPeriod.open.day &&
          firstPeriod.close.hour === 0 &&
          (firstPeriod.close.minute ?? 0) === 0))
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
    const secondPeriod = dayPeriods[1];

    const breakEnabled =
      dayPeriods.length >= 2 &&
      Boolean(firstPeriod.close && secondPeriod?.open);

    hours[dayKey] = {
      closed: false,
      open: normalizeGoogleTime(firstPeriod.open, "11:00"),
      close: normalizeGoogleTime(lastPeriod.close, "21:00"),
      breakEnabled,
      breakStart: breakEnabled
        ? normalizeGoogleTime(firstPeriod.close, "14:00")
        : "14:00",
      breakEnd: breakEnabled
        ? normalizeGoogleTime(secondPeriod.open, "17:00")
        : "17:00",
    };
  }

  return hours;
}

async function fetchGoogleJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20000,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Google API HTTP 오류: ${response.status} · ${errorText.slice(0, 300)}`,
    );
  }

  return (await response.json()) as T;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const businessId = Number(id);

  if (!Number.isInteger(businessId) || businessId <= 0) {
    return json(
      {
        ok: false,
        error: "잘못된 business ID입니다.",
      },
      400,
    );
  }

  const access = await requireBusinessApiAccess(businessId);

  if (!access.ok) {
    return access.response;
  }

  const googleKey = process.env.GOOGLE_PLACES_API_KEY?.trim();

  if (!googleKey) {
    return json(
      {
        ok: false,
        error: "GOOGLE_PLACES_API_KEY 환경변수가 없습니다.",
      },
      500,
    );
  }

  try {
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id, name, address, city, google_place_id")
      .eq("id", businessId)
      .maybeSingle();

    if (businessError) {
      throw new Error(`비즈니스 조회 실패: ${businessError.message}`);
    }

    if (!business) {
      return json(
        {
          ok: false,
          error: "비즈니스를 찾을 수 없습니다.",
        },
        404,
      );
    }

    let placeId =
      typeof business.google_place_id === "string"
        ? business.google_place_id.trim()
        : "";

    let googlePlaceName = business.name?.trim() || "";

    /*
     * 저장된 Google Place ID가 없으면
     * 이름과 주소로 Places API (New)의 Text Search를 호출합니다.
     */
    if (!placeId) {
      const searchText = [business.name, business.address, business.city, "NC"]
        .filter(Boolean)
        .map((value) => String(value).trim())
        .filter(Boolean)
        .join(" ");

      if (!searchText) {
        return json(
          {
            ok: false,
            error: "Google에서 검색할 비즈니스 이름이나 주소가 없습니다.",
          },
          400,
        );
      }

      const findData = await fetchGoogleJson<GoogleTextSearchResponse>(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": googleKey,
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress",
          },
          body: JSON.stringify({
            textQuery: searchText,
            languageCode: "en",
            regionCode: "US",
          }),
        },
      );

      const candidate = findData.places?.[0];

      placeId = candidate?.id?.trim() || "";

      googlePlaceName = candidate?.displayName?.text?.trim() || googlePlaceName;

      if (!placeId) {
        return json(
          {
            ok: false,
            error: "Google에서 Place ID를 찾지 못했습니다.",
          },
          404,
        );
      }

      /*
       * 다음 요청부터 다시 검색하지 않도록 Place ID 저장
       */
      const { error: savePlaceIdError } = await supabaseAdmin
        .from("businesses")
        .update({
          google_place_id: placeId,
        })
        .eq("id", businessId);

      if (savePlaceIdError) {
        console.error("Google Place ID 저장 실패:", savePlaceIdError);
      }
    }

    const detailUrl =
      "https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId);

    const detailData = await fetchGoogleJson<GooglePlace>(detailUrl, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": googleKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,regularOpeningHours",
      },
    });

    const openingHours = detailData.regularOpeningHours;

    const periods = openingHours?.periods ?? [];

    if (periods.length === 0) {
      return json(
        {
          ok: false,
          error: "Google에 등록된 영업시간이 없습니다.",
          place_id: placeId,
          place_name: detailData.displayName?.text || googlePlaceName,
        },
        404,
      );
    }

    const hours = convertGooglePeriods(periods);

    return json({
      ok: true,
      place_id: placeId,
      place_name: detailData.displayName?.text || googlePlaceName,
      formatted_address: detailData.formattedAddress || null,
      hours,
      weekday_descriptions: openingHours?.weekdayDescriptions ?? [],
    });
  } catch (error) {
    console.error("Google 영업시간 조회 실패:", error);

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
