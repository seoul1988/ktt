export const ORDER_WEEKDAYS = [
  { value: 1, label: "월요일" },
  { value: 2, label: "화요일" },
  { value: 3, label: "수요일" },
  { value: 4, label: "목요일" },
  { value: 5, label: "금요일" },
  { value: 6, label: "토요일" },
  { value: 0, label: "일요일" },
] as const;

export function normalizeClosedWeekdays(value: unknown, strict = false): number[] {
  if (!Array.isArray(value)) {
    if (strict) throw new Error("주문 제외 요일은 배열로 입력하세요.");
    return [];
  }
  if (strict && value.some(day => typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error("주문 제외 요일은 0(일요일)~6(토요일)만 선택할 수 있습니다.");
  }
  return [...new Set(value.filter((day): day is number =>
    typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6,
  ))].sort((a, b) => a - b);
}

// Use the same timezone as the existing business-hours checks.
export function getOrderWeekdayGate(value: unknown, now = new Date()) {
  const english = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short",
  }).format(now);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(english);
  if (weekday < 0) throw new Error("Unable to determine restaurant weekday.");
  const blocked = normalizeClosedWeekdays(value).includes(weekday);
  return { blocked, weekday, reason: blocked ? "Online ordering is unavailable today." : "" };
}
