/** Strict hostname input, shared by admin API and routing tests. */
export function normalizeOrderHostname(input: unknown): string {
  const host = String(input || "").trim().toLowerCase().replace(/\.$/, "");
  if (host.length > 253 || !host.includes(".") || host.split(".").some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error("주소만 입력하세요. https://, 경로, 포트, 공백은 넣지 마세요.");
  }
  if (/^\d+(\.\d+){3}$/.test(host) || host.endsWith(".localhost") || host.endsWith(".vercel.app")) throw new Error("사용할 수 없는 주문 주소입니다.");
  return host;
}
export function orderRootDomain() {
  return normalizeOrderHostname(process.env.ORDER_ROOT_DOMAIN || "ktowntriangle.com");
}
export function domainKind(host: string, root: string): "platform" | "custom" {
  if (host === root || host === `www.${root}`) throw new Error("KTown 기본 홈페이지 주소는 주문용으로 등록할 수 없습니다.");
  if (host.endsWith(`.${root}`)) {
    const label = host.slice(0, -(root.length + 1));
    if (label.includes(".") || ["www", "api", "admin", "mail", "support", "auth", "assets", "cdn"].includes(label)) throw new Error("이 KTown 하위 주소는 사용할 수 없습니다.");
    return "platform";
  }
  return "custom";
}
