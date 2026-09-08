import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function getMeta(html: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        "i",
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtml(match[1].trim());
    }
  }

  return "";
}

function isBlockedHost(hostname: string) {
  const h = hostname.toLowerCase();

  if (h === "localhost" || h.endsWith(".local")) return true;
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(h)) return true;

  const match = h.match(/^172\.(\d+)\./);
  if (match) {
    const second = Number(match[1]);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url")?.trim() || "";

  let articleUrl: URL;

  try {
    articleUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json(
      { error: "올바른 기사 URL이 아닙니다." },
      { status: 400 },
    );
  }

  if (
    !["http:", "https:"].includes(articleUrl.protocol) ||
    isBlockedHost(articleUrl.hostname)
  ) {
    return NextResponse.json(
      { error: "허용되지 않는 URL입니다." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(articleUrl.toString(), {
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `기사 사이트 응답 오류: HTTP ${response.status}`,
          title: articleUrl.hostname,
          source: articleUrl.hostname.replace(/^www\./, ""),
        },
        { status: 502 },
      );
    }

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("text/html")) {
      return NextResponse.json({
        title: articleUrl.hostname,
        source: articleUrl.hostname.replace(/^www\./, ""),
        description: "",
        imageUrl: "",
      });
    }

    const html = (await response.text()).slice(0, 1_500_000);

    const title =
      getMeta(html, ["og:title", "twitter:title"]) ||
      decodeHtml(
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "",
      ) ||
      articleUrl.hostname;

    const description = getMeta(html, [
      "og:description",
      "twitter:description",
      "description",
    ]);

    let imageUrl = getMeta(html, ["og:image", "twitter:image"]);
    if (imageUrl) {
      try {
        imageUrl = new URL(imageUrl, articleUrl).toString();
      } catch {
        imageUrl = "";
      }
    }

    const source =
      getMeta(html, ["og:site_name", "application-name"]) ||
      articleUrl.hostname.replace(/^www\./, "");

    return NextResponse.json(
      {
        title,
        description,
        imageUrl,
        source,
        url: articleUrl.toString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "기사 정보를 읽지 못했습니다.",
        title: articleUrl.hostname,
        source: articleUrl.hostname.replace(/^www\./, ""),
      },
      { status: 502 },
    );
  }
}
