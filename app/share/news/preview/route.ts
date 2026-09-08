import { NextRequest, NextResponse } from "next/server";

function meta(html: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decode(match[1]);
    }
  }
  return "";
}

function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isBlockedHost(hostname: string) {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h)) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url") || "";
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "올바른 기사 URL이 아닙니다." }, { status: 400 });
  }

  if (!/^https?:$/.test(url.protocol) || isBlockedHost(url.hostname)) {
    return NextResponse.json({ error: "허용되지 않는 URL입니다." }, { status: 400 });
  }

  try {
    const response = await fetch(url.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KTownTriangle/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({
        title: url.hostname,
        source: url.hostname.replace(/^www\./, ""),
        description: "",
        imageUrl: "",
      });
    }

    const html = (await response.text()).slice(0, 1_500_000);
    const title =
      meta(html, ["og:title", "twitter:title"]) ||
      decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "") ||
      url.hostname;
    const description = meta(html, ["og:description", "twitter:description", "description"]);
    const imageUrl = meta(html, ["og:image", "twitter:image"]);
    const source = meta(html, ["og:site_name", "application-name"]) || url.hostname.replace(/^www\./, "");

    let normalizedImage = imageUrl;
    if (imageUrl) {
      try { normalizedImage = new URL(imageUrl, url).toString(); } catch {}
    }

    return NextResponse.json({ title, description, imageUrl: normalizedImage, source });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "기사 정보를 읽지 못했습니다." },
      { status: 502 },
    );
  }
}
