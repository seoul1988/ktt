import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

type Region = "korea" | "us";

type ParsedNews = {
  region: Region;
  source: string;
  title: string;
  summary: string | null;
  article_url: string;
  image_url: string | null;
  published_at: string | null;
  fetched_at: string;
  active: boolean;
  updated_at: string;
};

type HtmlMetadata = {
  finalUrl: string;
  imageUrl: string | null;
  title: string | null;
  description: string | null;
};

const FEEDS: Array<{
  region: Region;
  source: string;
  url: string;
  limit: number;
}> = [
  {
    region: "korea",
    source: "매일경제",
    url: "https://www.mk.co.kr/rss/30000001/",
    limit: 12,
  },
  {
    region: "us",
    source: "Bloomberg",
    url: "https://news.google.com/rss/search?q=site%3Abloomberg.com&hl=en-US&gl=US&ceid=US%3Aen",
    limit: 12,
  },
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
}

function decodeJavascriptEscapes(value: string) {
  return value
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u003f/gi, "?")
    .replace(/\\u002f/gi, "/")
    .replace(/\\x26/gi, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&");
}

function stripHtml(value: string) {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block: string, tag: string) {
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );

  return match?.[1] ? decodeXml(match[1]) : "";
}

function getRssImage(block: string) {
  const media = block.match(
    /<(?:media:content|media:thumbnail)[^>]+url=["']([^"']+)["']/i,
  );

  if (media?.[1]) return decodeXml(media[1]);

  const enclosure = block.match(
    /<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i,
  );

  if (enclosure?.[1]) return decodeXml(enclosure[1]);

  const rawDescription = block.match(
    /<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i,
  )?.[1];

  const image = rawDescription?.match(/<img[^>]+src=["']([^"']+)["']/i);

  return image?.[1] ? decodeXml(image[1]) : null;
}

function absoluteUrl(value: string | null, baseUrl: string) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function getMetaContent(
  html: string,
  propertyName: string,
): string | null {
  const escaped = propertyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const match =
    html.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i",
      ),
    ) ||
    html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
        "i",
      ),
    );

  return match?.[1] ? decodeXml(match[1]) : null;
}

function isGoogleNewsUrl(url: string) {
  try {
    return new URL(url).hostname.endsWith("news.google.com");
  } catch {
    return false;
  }
}

function isBloombergUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname === "bloomberg.com" || hostname.endsWith(".bloomberg.com");
  } catch {
    return false;
  }
}

function cleanBloombergUrl(value: string) {
  let candidate = decodeJavascriptEscapes(decodeXml(value));

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // 이미 정상 URL이면 그대로 사용합니다.
  }

  candidate = candidate
    .replace(/^["']+|["']+$/g, "")
    .replace(/[),;\]}]+$/g, "");

  try {
    const parsed = new URL(candidate);

    parsed.hash = "";

    // 추적용 쿼리는 제거하되 기사에 필요한 쿼리는 유지할 수 있도록
    // 대표적인 추적 파라미터만 정리합니다.
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "cmpid",
      "srnd",
    ].forEach((key) => parsed.searchParams.delete(key));

    return parsed.toString();
  } catch {
    return candidate;
  }
}

function extractBloombergUrl(html: string) {
  const normalized = decodeJavascriptEscapes(html);

  const patterns = [
    /https?:\/\/(?:www\.)?bloomberg\.com\/news\/articles\/[^"'<>\\\s]+/gi,
    /https?:\/\/(?:www\.)?bloomberg\.com\/[^"'<>\\\s]+/gi,
    /https%3A%2F%2F(?:www\.)?bloomberg\.com%2F[^"'<>\\\s]+/gi,
  ];

  for (const pattern of patterns) {
    const matches = normalized.match(pattern) ?? [];

    for (const match of matches) {
      const cleaned = cleanBloombergUrl(match);

      if (
        isBloombergUrl(cleaned) &&
        !cleaned.includes("/account/") &&
        !cleaned.includes("/tos") &&
        !cleaned.includes("/privacy") &&
        !cleaned.includes("/company/")
      ) {
        return cleaned;
      }
    }
  }

  return null;
}

async function fetchText(url: string, timeoutMs = 7500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "user-agent": USER_AGENT,
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,ko;q=0.8",
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        finalUrl: response.url || url,
        text: "",
      };
    }

    return {
      ok: true,
      finalUrl: response.url || url,
      text: await response.text(),
    };
  } catch {
    return {
      ok: false,
      finalUrl: url,
      text: "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolvePublisherUrl(url: string, region: Region) {
  if (region !== "us" || !isGoogleNewsUrl(url)) {
    return url;
  }

  const googlePage = await fetchText(url, 7000);

  if (!googlePage.ok) {
    return url;
  }

  if (isBloombergUrl(googlePage.finalUrl)) {
    return cleanBloombergUrl(googlePage.finalUrl);
  }

  const bloombergUrl = extractBloombergUrl(googlePage.text);

  return bloombergUrl || url;
}

async function fetchHtmlMetadata(url: string): Promise<HtmlMetadata> {
  const result = await fetchText(url, 8500);

  if (!result.ok) {
    return {
      finalUrl: url,
      imageUrl: null,
      title: null,
      description: null,
    };
  }

  const finalUrl = result.finalUrl || url;
  const html = result.text;

  const image =
    getMetaContent(html, "og:image") ||
    getMetaContent(html, "twitter:image:src") ||
    getMetaContent(html, "twitter:image");

  const title =
    getMetaContent(html, "og:title") ||
    getMetaContent(html, "twitter:title");

  const description =
    getMetaContent(html, "og:description") ||
    getMetaContent(html, "twitter:description") ||
    getMetaContent(html, "description");

  return {
    finalUrl,
    imageUrl: absoluteUrl(image, finalUrl),
    title: title ? stripHtml(title) : null,
    description: description ? stripHtml(description) : null,
  };
}

function normalizeDate(value: string) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isGooglePlaceholderImage(url: string | null) {
  if (!url) return false;

  const lower = url.toLowerCase();

  return (
    lower.includes("gnews") ||
    lower.includes("news.google") ||
    lower.includes("googleusercontent.com") ||
    lower.includes("gstatic.com") ||
    lower.includes("google.com/images") ||
    lower.includes("google_news")
  );
}

async function resolveCandidate(
  feed: (typeof FEEDS)[number],
  item: {
    title: string;
    articleUrl: string;
    summary: string | null;
    source: string;
    publishedAt: string | null;
    rssImage: string | null;
  },
  now: string,
): Promise<ParsedNews> {
  /*
   * 미국 뉴스:
   * - Google News RSS 링크는 그대로 저장합니다.
   * - 사용자가 클릭하면 Google News가 Bloomberg 원문으로 연결합니다.
   * - Google News 페이지의 og:title / og:image는 읽지 않습니다.
   * - 제목은 RSS에 들어 있는 Bloomberg 기사 제목을 사용합니다.
   *
   * 한국 뉴스:
   * - 매일경제 원문 페이지에서 대표 이미지와 메타데이터를 읽습니다.
   */
  if (feed.region === "us") {
    const rssImage = absoluteUrl(
      item.rssImage,
      item.articleUrl,
    );

    const cleanTitle = item.title
      .replace(/\s+-\s+Bloomberg$/i, "")
      .replace(/^Google News$/i, "")
      .replace(/\s+/g, " ")
      .trim();

    return {
      region: "us",
      source: "Bloomberg",
      title: cleanTitle || "Bloomberg News",
      summary: item.summary,
      article_url: item.articleUrl,
      image_url:
        rssImage && !isGooglePlaceholderImage(rssImage)
          ? rssImage
          : null,
      published_at: item.publishedAt,
      fetched_at: now,
      active: true,
      updated_at: now,
    };
  }

  const metadata = await fetchHtmlMetadata(
    item.articleUrl,
  );

  const rssImage = absoluteUrl(
    item.rssImage,
    item.articleUrl,
  );

  const imageCandidate =
    metadata.imageUrl || rssImage;

  const resolvedImage =
    imageCandidate &&
    !isGooglePlaceholderImage(imageCandidate)
      ? imageCandidate
      : null;

  const resolvedTitle =
    metadata.title &&
    !/^Google News$/i.test(metadata.title.trim())
      ? metadata.title.trim()
      : item.title.trim();

  return {
    region: "korea",
    source: item.source || feed.source,
    title: resolvedTitle || "최신 뉴스",
    summary:
      metadata.description?.slice(0, 400) ||
      item.summary,
    article_url:
      metadata.finalUrl || item.articleUrl,
    image_url: resolvedImage,
    published_at: item.publishedAt,
    fetched_at: now,
    active: true,
    updated_at: now,
  };
}
async function loadFeed(
  feed: (typeof FEEDS)[number],
): Promise<ParsedNews[]> {
  const response = await fetch(feed.url, {
    cache: "no-store",
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/rss+xml,application/xml,text/xml,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(
      `${feed.source} RSS request failed: ${response.status}`,
    );
  }

  const xml = await response.text();
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const now = new Date().toISOString();

  const candidates = blocks
    .map((block) => {
      const rawTitle = getTag(block, "title");
      const title = rawTitle
        .replace(/\s+-\s+Bloomberg$/i, "")
        .trim();

      const articleUrl =
        getTag(block, "link") || getTag(block, "guid");

      const rawDescription = getTag(block, "description");
      const summary =
        stripHtml(rawDescription).slice(0, 400) || null;

      const source = getTag(block, "source") || feed.source;

      return {
        title,
        articleUrl,
        summary,
        source,
        publishedAt: normalizeDate(getTag(block, "pubDate")),
        rssImage: getRssImage(block),
      };
    })
    .filter((item) => item.title && item.articleUrl)
    // 일부 원문 주소나 이미지 확인이 실패해도 12개를 확보하도록
    // 최대 24개의 후보를 읽습니다.
    .slice(0, feed.limit * 2);

  // 외부 사이트에 한 번에 너무 많은 요청을 보내지 않도록
  // 4개씩 나누어 처리합니다.
  const resolved: ParsedNews[] = [];

  for (let index = 0; index < candidates.length; index += 4) {
    const batch = candidates.slice(index, index + 4);

    const batchResults = await Promise.all(
      batch.map((item) => resolveCandidate(feed, item, now)),
    );

    resolved.push(...batchResults);

    if (
      Array.from(
        new Map(
          resolved.map((news) => [news.article_url, news]),
        ).values(),
      ).length >= feed.limit
    ) {
      break;
    }
  }

  return Array.from(
    new Map(
      resolved.map((item) => [item.article_url, item]),
    ).values(),
  ).slice(0, feed.limit);
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");

  return (
    authorization === `Bearer ${secret}` ||
    querySecret === secret
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Missing Supabase server environment variables",
      },
      { status: 500 },
    );
  }

  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  try {
    const settled = await Promise.allSettled(
      FEEDS.map(loadFeed),
    );

    const items = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );

    const errors = settled.flatMap((result, index) =>
      result.status === "rejected"
        ? [
            `${FEEDS[index].source}: ${
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason)
            }`,
          ]
        : [],
    );

    if (items.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          inserted: 0,
          errors,
        },
        { status: 502 },
      );
    }

    for (const region of ["korea", "us"] as const) {
      const feedIndex = FEEDS.findIndex(
        (feed) => feed.region === region,
      );

      const regionResult = settled[feedIndex];

      // 해당 지역 수집이 실패하면 기존 DB 내용을 보존합니다.
      if (
        !regionResult ||
        regionResult.status !== "fulfilled"
      ) {
        continue;
      }

      const regionItems = regionResult.value.slice(0, 12);

      if (regionItems.length === 0) continue;

      // 최신 뉴스를 먼저 저장하여 페이지가 비는 시간을 방지합니다.
      const { error: upsertError } = await admin
        .from("community_news")
        .upsert(regionItems, {
          onConflict: "article_url",
        });

      if (upsertError) throw upsertError;

      const currentUrls = regionItems.map(
        (item) => item.article_url,
      );

      const currentUrlSet = new Set(currentUrls);

      const {
        data: existingRows,
        error: existingRowsError,
      } = await admin
        .from("community_news")
        .select("id, article_url")
        .eq("region", region);

      if (existingRowsError) throw existingRowsError;

      const deleteIds = (existingRows ?? [])
        .filter(
          (row) =>
            !currentUrlSet.has(row.article_url),
        )
        .map((row) => row.id);

      if (deleteIds.length > 0) {
        const { error: deleteError } = await admin
          .from("community_news")
          .delete()
          .in("id", deleteIds);

        if (deleteError) throw deleteError;
      }

      const { error: activateError } = await admin
        .from("community_news")
        .update({
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("region", region)
        .in("article_url", currentUrls);

      if (activateError) throw activateError;
    }

    return NextResponse.json({
      ok: true,
      saved: items.length,
      korea: items.filter(
        (item) => item.region === "korea",
      ).length,
      us: items.filter(
        (item) => item.region === "us",
      ).length,
      bloombergLinks: items.filter(
        (item) => item.region === "us",
      ).length,
      bloombergImages: items.filter(
        (item) =>
          item.region === "us" &&
          Boolean(item.image_url),
      ).length,
      googleNewsTitles: items.filter(
        (item) =>
          item.region === "us" &&
          /^Google News$/i.test(item.title.trim()),
      ).length,
      googlePlaceholderImages: items.filter(
        (item) =>
          item.region === "us" &&
          isGooglePlaceholderImage(item.image_url),
      ).length,
      errors,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("sync community news error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
}