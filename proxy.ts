import { NextRequest, NextResponse } from "next/server";

const PRIMARY_HOSTS = new Set([
  "ktowntriangle.com",
  "www.ktowntriangle.com",
]);

function normalizeHost(value: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .split(":")[0]
    .replace(/\.$/, "");
}

function shouldIgnorePath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/orders/track/") ||
    pathname.startsWith("/restaurant-order/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/.well-known/") ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/business/") ||
    pathname.startsWith("/businesses/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|map|txt|xml|woff|woff2|ttf|otf)$/i.test(
      pathname,
    )
  );
}

async function findBusinessIdByDomain(domain: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase environment variables");
    return null;
  }

  const query = new URL(`${supabaseUrl}/rest/v1/businesses`);

  query.searchParams.set("select", "id");
  query.searchParams.set("custom_domain", `eq.${domain}`);
  query.searchParams.set("website_enabled", "eq.true");
  query.searchParams.set("website_status", "eq.published");
  query.searchParams.set("limit", "1");

  const response = await fetch(query, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.error(
      "Custom-domain lookup failed:",
      response.status,
      await response.text(),
    );

    return null;
  }

  const rows = (await response.json()) as Array<{ id: number }>;

  return rows[0]?.id ?? null;
}

async function findOrderBusinessByDomain(domain: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  const url = new URL(`${base}/rest/v1/restaurant_order_domains`);
  url.searchParams.set("select", "business_id,brand_code");
  url.searchParams.set("hostname", `eq.${domain}`);
  url.searchParams.set("status", "eq.verified");
  url.searchParams.set("enabled", "eq.true");
  url.searchParams.set("limit", "1");
  try {
    const response = await fetch(url, {headers:{apikey:key,Authorization:`Bearer ${key}`},cache:"no-store",signal:AbortSignal.timeout(5000)});
    if (!response.ok) return null;
    const rows = await response.json() as Array<{business_id:number|null;brand_code?:string|null}>;
    return rows[0] || null;
  } catch { return null; }
}

export async function proxy(request: NextRequest) {
  const rawHost =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host");

  const host = normalizeHost(rawHost);
  const pathname = request.nextUrl.pathname;

  /*
   * KTown 기본 도메인과 Vercel/localhost는
   * 기존 라우팅을 그대로 사용합니다.
   */
  if (
    !host ||
    PRIMARY_HOSTS.has(host) ||
    host.endsWith(".vercel.app") ||
    host === "localhost"
  ) {
    return NextResponse.next();
  }

  /*
   * API, 관리자, 주문추적 등의 경로는
   * 커스텀 비즈니스 사이트로 rewrite하지 않습니다.
   */
  if (shouldIgnorePath(pathname)) {
    return NextResponse.next();
  }

  const orderTarget = await findOrderBusinessByDomain(host);
  if (orderTarget) {
    if (["/", "/order", "/order/", "/menu", "/menu/"].includes(pathname)) {
      const orderUrl = request.nextUrl.clone();
      if (orderTarget.brand_code) {
        orderUrl.pathname = "/order";
        orderUrl.searchParams.set("brandId", orderTarget.brand_code);
      } else if (orderTarget.business_id) {
        orderUrl.pathname = `/restaurant-order/${orderTarget.business_id}`;
      } else return NextResponse.next();
      return NextResponse.rewrite(orderUrl);
    }
    // Keep the order host in the address bar; never send its paths to a website renderer.
    return NextResponse.next();
  }
  const businessId = await findBusinessIdByDomain(host.replace(/^www\./, ""));

  if (!businessId) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();

  /*
   * 커스텀 도메인의 PWA manifest
   *
   * bunsofchapelhill.com/manifest.webmanifest
   * ->
   * /business/90/website/manifest.webmanifest
   */
  if (pathname === "/manifest.webmanifest") {
    url.pathname =
      `/business/${businessId}/website/manifest.webmanifest`;

    return NextResponse.rewrite(url);
  }

  /*
   * 커스텀 도메인의 Service Worker
   *
   * bunsofchapelhill.com/sw.js
   * ->
   * /business/90/website/sw.js
   */
  if (pathname === "/sw.js") {
    url.pathname =
      `/business/${businessId}/website/sw.js`;

    return NextResponse.rewrite(url);
  }

  /*
   * 커스텀 도메인의 홈페이지
   */
  if (pathname === "/") {
    url.pathname =
      `/business/${businessId}/website`;

    return NextResponse.rewrite(url);
  }

  /*
   * 나머지 비즈니스 웹사이트 페이지
   */
  const cleanPath = pathname.replace(/^\/+|\/+$/g, "");

  url.pathname =
    `/business/${businessId}/website/${cleanPath}`;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};