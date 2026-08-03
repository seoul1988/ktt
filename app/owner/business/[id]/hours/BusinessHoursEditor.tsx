"use client";

import {
  useMemo,
  useRef,
  useState,
} from "react";

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

type HoursState = Record<
  DayKey,
  DayHours
>;

type BusinessHoursEditorProps = {
  businessId: number;
  initialHours: unknown;
};

type GoogleHoursResponse = {
  ok?: boolean;
  error?: string;
  place_name?: string;
  hours?: unknown;
};

type SaveHoursResponse = {
  ok?: boolean;
  error?: string;
  hours?: unknown;
};

const DAYS: Array<{
  key: DayKey;
  short: string;
  label: string;
}> = [
  {
    key: "Monday",
    short: "Mon",
    label: "Monday",
  },
  {
    key: "Tuesday",
    short: "Tue",
    label: "Tuesday",
  },
  {
    key: "Wednesday",
    short: "Wed",
    label: "Wednesday",
  },
  {
    key: "Thursday",
    short: "Thu",
    label: "Thursday",
  },
  {
    key: "Friday",
    short: "Fri",
    label: "Friday",
  },
  {
    key: "Saturday",
    short: "Sat",
    label: "Saturday",
  },
  {
    key: "Sunday",
    short: "Sun",
    label: "Sunday",
  },
];

function createDefaultDay(): DayHours {
  return {
    closed: false,
    open: "10:00",
    close: "21:00",
    breakEnabled: false,
    breakStart: "15:00",
    breakEnd: "17:00",
  };
}

function createDefaultHours(): HoursState {
  return {
    Monday: createDefaultDay(),
    Tuesday: createDefaultDay(),
    Wednesday: createDefaultDay(),
    Thursday: createDefaultDay(),
    Friday: {
      ...createDefaultDay(),
      close: "22:00",
    },
    Saturday: {
      ...createDefaultDay(),
      open: "11:00",
      close: "22:00",
    },
    Sunday: {
      ...createDefaultDay(),
      open: "11:00",
      close: "20:00",
      closed: true,
    },
  };
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

function twelveHourToTwentyFour(
  value: string,
  fallback: string,
): string {
  const text = value.trim();

  const twentyFourMatch =
    text.match(/^(\d{1,2}):(\d{2})$/);

  if (twentyFourMatch) {
    const hour = Number(
      twentyFourMatch[1],
    );
    const minute = Number(
      twentyFourMatch[2],
    );

    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return `${String(hour).padStart(
        2,
        "0",
      )}:${String(minute).padStart(
        2,
        "0",
      )}`;
    }
  }

  const twelveHourMatch = text.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i,
  );

  if (!twelveHourMatch) {
    return fallback;
  }

  let hour = Number(
    twelveHourMatch[1],
  );

  const minute = Number(
    twelveHourMatch[2] ?? "00",
  );

  const period =
    twelveHourMatch[3].toUpperCase();

  if (
    hour < 1 ||
    hour > 12 ||
    minute < 0 ||
    minute > 59
  ) {
    return fallback;
  }

  if (hour === 12) {
    hour = 0;
  }

  if (period === "PM") {
    hour += 12;
  }

  return `${String(hour).padStart(
    2,
    "0",
  )}:${String(minute).padStart(
    2,
    "0",
  )}`;
}

function getObjectValue(
  source: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    if (key in source) {
      return source[key];
    }
  }

  return undefined;
}

function normalizeObjectDay(
  value: unknown,
  fallback: DayHours,
): DayHours {
  if (!isPlainObject(value)) {
    return fallback;
  }

  const closed =
    getObjectValue(value, [
      "closed",
      "isClosed",
      "is_closed",
    ]) === true;

  const open = getObjectValue(
    value,
    [
      "open",
      "start",
      "openTime",
      "open_time",
    ],
  );

  const close = getObjectValue(
    value,
    [
      "close",
      "end",
      "closeTime",
      "close_time",
    ],
  );

  const breakEnabled =
    getObjectValue(value, [
      "breakEnabled",
      "hasBreak",
      "break_enabled",
      "has_break",
    ]) === true;

  const breakStart =
    getObjectValue(value, [
      "breakStart",
      "break_start",
    ]);

  const breakEnd =
    getObjectValue(value, [
      "breakEnd",
      "break_end",
    ]);

  return {
    closed,
    open:
      typeof open === "string"
        ? twelveHourToTwentyFour(
            open,
            fallback.open,
          )
        : fallback.open,
    close:
      typeof close === "string"
        ? twelveHourToTwentyFour(
            close,
            fallback.close,
          )
        : fallback.close,
    breakEnabled,
    breakStart:
      typeof breakStart === "string"
        ? twelveHourToTwentyFour(
            breakStart,
            fallback.breakStart,
          )
        : fallback.breakStart,
    breakEnd:
      typeof breakEnd === "string"
        ? twelveHourToTwentyFour(
            breakEnd,
            fallback.breakEnd,
          )
        : fallback.breakEnd,
  };
}

/**
 * 기존 businesses.hours 문자열 형식을 읽습니다.
 *
 * Mon 10:00 AM - 9:00 PM
 * Tue 10:00 AM - 9:00 PM / Break 3:00 PM - 5:00 PM
 * Wed Closed
 */
function parseStoredHours(
  value: unknown,
): HoursState {
  const defaults =
    createDefaultHours();

  if (
    typeof value === "string" &&
    value.trim()
  ) {
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const result =
      createDefaultHours();

    for (const day of DAYS) {
      const line = lines.find(
        (item) =>
          item === day.short ||
          item.startsWith(
            `${day.short} `,
          ),
      );

      if (!line) {
        continue;
      }

      if (
        /\bClosed\b/i.test(line)
      ) {
        result[day.key] = {
          ...result[day.key],
          closed: true,
          breakEnabled: false,
        };

        continue;
      }

      const [
        mainSection,
        breakSection,
      ] = line.split(
        /\s*\/\s*Break\s*/i,
      );

      const mainText = mainSection
        .replace(
          new RegExp(
            `^${day.short}\\s*`,
            "i",
          ),
          "",
        )
        .trim();

      const mainTimes =
        mainText.split(/\s+-\s+/);

      const open =
        mainTimes[0]?.trim();

      const close =
        mainTimes[1]?.trim();

      const breakTimes =
        breakSection
          ?.split(/\s+-\s+/)
          .map((item) =>
            item.trim(),
          ) ?? [];

      result[day.key] = {
        closed: false,
        open: open
          ? twelveHourToTwentyFour(
              open,
              result[day.key].open,
            )
          : result[day.key].open,
        close: close
          ? twelveHourToTwentyFour(
              close,
              result[day.key].close,
            )
          : result[day.key].close,
        breakEnabled:
          breakTimes.length >= 2,
        breakStart:
          breakTimes[0]
            ? twelveHourToTwentyFour(
                breakTimes[0],
                result[day.key]
                  .breakStart,
              )
            : result[day.key]
                .breakStart,
        breakEnd:
          breakTimes[1]
            ? twelveHourToTwentyFour(
                breakTimes[1],
                result[day.key]
                  .breakEnd,
              )
            : result[day.key]
                .breakEnd,
      };
    }

    return result;
  }

  /*
   * Google API가 반환한 객체 형식도 처리합니다.
   */
  if (isPlainObject(value)) {
    const result =
      createDefaultHours();

    for (const day of DAYS) {
      const source =
        value[day.key] ??
        value[
          day.key.toLowerCase()
        ] ??
        value[day.short] ??
        value[
          day.short.toLowerCase()
        ];

      if (source !== undefined) {
        result[day.key] =
          normalizeObjectDay(
            source,
            defaults[day.key],
          );
      }
    }

    return result;
  }

  return defaults;
}

async function readJsonResponse<T>(
  response: Response,
): Promise<T> {
  const contentType =
    response.headers.get(
      "content-type",
    ) ?? "";

  if (
    !contentType.includes(
      "application/json",
    )
  ) {
    const text =
      await response.text();

    throw new Error(
      `서버 응답이 JSON 형식이 아닙니다. HTTP ${response.status} · ${text.slice(0, 200)}`,
    );
  }

  return (await response.json()) as T;
}

export default function BusinessHoursEditor({
  businessId,
  initialHours,
}: BusinessHoursEditorProps) {
  /*
   * 페이지 진입 시 서버에서 전달된 businesses.hours 문자열을
   * 즉시 파싱해서 화면에 표시합니다.
   */
  const [hours, setHours] =
    useState<HoursState>(() =>
      parseStoredHours(
        initialHours,
      ),
    );

  const [saving, setSaving] =
    useState(false);

  const [
    loadingGoogleHours,
    setLoadingGoogleHours,
  ] = useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const googleRequestRef =
    useRef<AbortController | null>(
      null,
    );

  const saveRequestRef =
    useRef<AbortController | null>(
      null,
    );

  const openDays = useMemo(
    () =>
      DAYS.filter(
        (day) =>
          !hours[day.key].closed,
      ).length,
    [hours],
  );

  function updateDay(
    day: DayKey,
    patch: Partial<DayHours>,
  ) {
    setHours((current) => ({
      ...current,
      [day]: {
        ...current[day],
        ...patch,
      },
    }));

    setMessage("");
    setError("");
  }

  async function loadGoogleHours() {
    const confirmed = window.confirm(
      [
        "Google에 등록된 영업시간을 가져옵니다.",
        "",
        "현재 화면의 시간은 Google 시간으로 바뀝니다.",
        "가져온 뒤 저장 버튼을 눌러야 최종 저장됩니다.",
        "",
        "계속하시겠습니까?",
      ].join("\n"),
    );

    if (!confirmed) {
      return;
    }

    googleRequestRef.current?.abort();

    const controller =
      new AbortController();

    googleRequestRef.current =
      controller;

    setLoadingGoogleHours(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/owner/business/${businessId}/google-hours`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json",
          },
          cache: "no-store",
          signal:
            controller.signal,
        },
      );

      const result =
        await readJsonResponse<GoogleHoursResponse>(
          response,
        );

      if (
        !response.ok ||
        !result.ok ||
        !result.hours
      ) {
        throw new Error(
          result.error ||
            `Google 영업시간 조회 실패: HTTP ${response.status}`,
        );
      }

      if (
        controller.signal.aborted
      ) {
        return;
      }

      setHours(
        parseStoredHours(
          result.hours,
        ),
      );

      setMessage(
        `${
          result.place_name ||
          "Google Maps"
        }의 영업시간을 가져왔습니다. 확인 후 저장 버튼을 눌러주세요.`,
      );
    } catch (loadError) {
      if (
        controller.signal.aborted
      ) {
        return;
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Google 영업시간을 가져오지 못했습니다.",
      );
    } finally {
      if (
        !controller.signal.aborted
      ) {
        setLoadingGoogleHours(
          false,
        );
      }

      if (
        googleRequestRef.current ===
        controller
      ) {
        googleRequestRef.current =
          null;
      }
    }
  }

  async function saveHours() {
    saveRequestRef.current?.abort();

    const controller =
      new AbortController();

    saveRequestRef.current =
      controller;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `/api/owner/business/${businessId}/hours`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            hours,
          }),
          signal:
            controller.signal,
        },
      );

      const result =
        await readJsonResponse<SaveHoursResponse>(
          response,
        );

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.error ||
            `저장 실패: HTTP ${response.status}`,
        );
      }

      if (
        controller.signal.aborted
      ) {
        return;
      }

      if (result.hours) {
        setHours(
          parseStoredHours(
            result.hours,
          ),
        );
      }

      setMessage(
        "Business Hours가 저장되었습니다.",
      );
    } catch (saveError) {
      if (
        controller.signal.aborted
      ) {
        return;
      }

      setError(
        saveError instanceof Error
          ? saveError.message
          : "영업시간 저장에 실패했습니다.",
      );
    } finally {
      if (
        !controller.signal.aborted
      ) {
        setSaving(false);
      }

      if (
        saveRequestRef.current ===
        controller
      ) {
        saveRequestRef.current =
          null;
      }
    }
  }

  return (
    <div className="rounded-3xl border border-[#E9DED0] bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-[#172033]">
            요일별 영업시간
          </h2>

          <p className="mt-1 text-sm font-medium text-[#667085]">
            현재 {openDays}일 영업으로
            설정되어 있습니다.
          </p>
        </div>

        <button
          type="button"
          onClick={
            loadGoogleHours
          }
          disabled={
            loadingGoogleHours ||
            saving
          }
          className="inline-flex h-11 items-center justify-center rounded-xl border border-[#D9CFC2] bg-white px-4 text-sm font-black text-[#172033] shadow-sm transition hover:border-[#B64032] disabled:cursor-wait disabled:opacity-60"
        >
          {loadingGoogleHours
            ? "Google 시간 가져오는 중..."
            : "📍 Google 영업시간 가져오기"}
        </button>
      </div>

      <div className="space-y-4">
        {DAYS.map((day) => {
          const value =
            hours[day.key];

          return (
            <div
              key={day.key}
              className="rounded-2xl border border-[#E9DED0] bg-[#FFFCF8] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-black text-[#172033]">
                  {day.label}
                </h3>

                <label className="flex cursor-pointer items-center gap-2 text-sm font-black text-[#667085]">
                  <input
                    type="checkbox"
                    checked={
                      value.closed
                    }
                    onChange={(
                      event,
                    ) =>
                      updateDay(
                        day.key,
                        {
                          closed:
                            event
                              .target
                              .checked,
                        },
                      )
                    }
                    className="h-4 w-4 rounded border-[#B8B1A7]"
                  />

                  Closed
                </label>
              </div>

              {!value.closed && (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-[#667085]">
                        Open
                      </span>

                      <input
                        type="time"
                        value={
                          value.open
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDay(
                            day.key,
                            {
                              open:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        className="h-11 w-full rounded-xl border border-[#D9CFC2] bg-white px-3 text-sm font-bold text-[#172033] outline-none focus:border-[#B64032]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.08em] text-[#667085]">
                        Close
                      </span>

                      <input
                        type="time"
                        value={
                          value.close
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDay(
                            day.key,
                            {
                              close:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        className="h-11 w-full rounded-xl border border-[#D9CFC2] bg-white px-3 text-sm font-bold text-[#172033] outline-none focus:border-[#B64032]"
                      />
                    </label>
                  </div>

                  <div className="rounded-xl border border-[#E9DED0] bg-white p-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-black text-[#172033]">
                      <input
                        type="checkbox"
                        checked={
                          value.breakEnabled
                        }
                        onChange={(
                          event,
                        ) =>
                          updateDay(
                            day.key,
                            {
                              breakEnabled:
                                event
                                  .target
                                  .checked,
                            },
                          )
                        }
                        className="h-4 w-4 rounded border-[#B8B1A7]"
                      />

                      Break Time 사용
                    </label>

                    {value.breakEnabled && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-black text-[#667085]">
                            Break Start
                          </span>

                          <input
                            type="time"
                            value={
                              value.breakStart
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDay(
                                day.key,
                                {
                                  breakStart:
                                    event
                                      .target
                                      .value,
                                },
                              )
                            }
                            className="h-11 w-full rounded-xl border border-[#D9CFC2] bg-white px-3 text-sm font-bold text-[#172033] outline-none focus:border-[#B64032]"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1.5 block text-xs font-black text-[#667085]">
                            Break End
                          </span>

                          <input
                            type="time"
                            value={
                              value.breakEnd
                            }
                            onChange={(
                              event,
                            ) =>
                              updateDay(
                                day.key,
                                {
                                  breakEnd:
                                    event
                                      .target
                                      .value,
                                },
                              )
                            }
                            className="h-11 w-full rounded-xl border border-[#D9CFC2] bg-white px-3 text-sm font-bold text-[#172033] outline-none focus:border-[#B64032]"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {message && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={saveHours}
          disabled={
            saving ||
            loadingGoogleHours
          }
          className="inline-flex h-12 min-w-[190px] items-center justify-center rounded-xl bg-[#B64032] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#9F352A] disabled:cursor-wait disabled:opacity-60"
        >
          {saving
            ? "저장 중..."
            : "Business Hours 저장"}
        </button>
      </div>
    </div>
  );
}