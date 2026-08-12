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
    .replace(/^www\./, "")
    .replace(/\.$/, "");
}

function shouldIgnorePath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/business/") ||
    pathname.startsWith("/businesses/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2|ttf|otf)$/i.test(
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

export async function proxy(request: NextRequest) {
  const rawHost =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host");

  const host = normalizeHost(rawHost);
  const pathname = request.nextUrl.pathname;

  if (
    !host ||
    PRIMARY_HOSTS.has(host) ||
    host.endsWith(".vercel.app") ||
    host === "localhost" ||
    shouldIgnorePath(pathname)
  ) {
    return NextResponse.next();
  }

  const businessId = await findBusinessIdByDomain(host);

  if (!businessId) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();

  if (pathname === "/") {
    url.pathname = `/business/${businessId}/website`;
  } else {
    const cleanPath = pathname.replace(/^\/+|\/+$/g, "");

    url.pathname = `/business/${businessId}/website/${cleanPath}`;
  }

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)",
  ],
};