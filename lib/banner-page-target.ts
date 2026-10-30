// Shared by owner API and public renderer. No browser globals during import.
export function normalizeBannerTarget(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > 2048 || (!text.startsWith("/") && !/^https?:\/\//i.test(text)) || text.startsWith("//")) {
    throw new Error("배너 표시 주소는 /로 시작하는 경로 또는 http/https 주소로 입력하세요.");
  }
  const url = new URL(text, "https://banner.invalid");
  if (url.username || url.password) throw new Error("사용자 정보가 포함된 주소는 사용할 수 없습니다.");
  return text;
}
export function bannerMatchesPage(target: unknown, current: string): boolean {
  if (!String(target ?? "").trim()) return true;
  try {
    const valid = normalizeBannerTarget(target)!;
    const page = new URL(current);
    const expected = new URL(valid, page.origin);
    const path = (v: string) => v.replace(/\/+$/, "") || "/";
    if (expected.origin !== page.origin || path(expected.pathname) !== path(page.pathname)) return false;
    for (const key of new Set(expected.searchParams.keys())) {
      if (JSON.stringify(expected.searchParams.getAll(key).sort()) !== JSON.stringify(page.searchParams.getAll(key).sort())) return false;
    }
    return !expected.hash || expected.hash === page.hash;
  } catch { return false; }
}
