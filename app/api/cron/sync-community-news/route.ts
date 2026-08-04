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

const FEEDS: Array<{ region: Region; source: string; url: string; limit: number }> = [
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

async function fetchHtmlMetadata(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; KTownTriangleNewsBot/1.0; +https://www.ktowntriangle.com)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) return { finalUrl: url, imageUrl: null };

    const html = await response.text();
    const finalUrl = response.url || url;
    const imageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i);

    return {
      finalUrl,
      imageUrl: absoluteUrl(imageMatch?.[1] ?? null, finalUrl),
    };
  } catch {
    return { finalUrl: url, imageUrl: null };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function loadFeed(feed: (typeof FEEDS)[number]): Promise<ParsedNews[]> {
  const response = await fetch(feed.url, {
    cache: "no-store",
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; KTownTriangleNewsBot/1.0; +https://www.ktowntriangle.com)",
    },
  });

  if (!response.ok) {
    throw new Error(`${feed.source} RSS request failed: ${response.status}`);
  }

  const xml = await response.text();
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const now = new Date().toISOString();

  const candidates = blocks
    .map((block) => {
      const rawTitle = getTag(block, "title");
      const title = rawTitle.replace(/\s+-\s+Bloomberg$/i, "").trim();
      const articleUrl = getTag(block, "link") || getTag(block, "guid");
      const rawDescription = getTag(block, "description");
      const summary = stripHtml(rawDescription).slice(0, 400) || null;
      const source = getTag(block, "source") || feed.source;

      return {
        block,
        title,
        articleUrl,
        summary,
        source,
        publishedAt: normalizeDate(getTag(block, "pubDate")),
        rssImage: getRssImage(block),
      };
    })
    .filter((item) => item.title && item.articleUrl)
    // 중복을 제거한 뒤에도 12개를 확보할 수 있도록 여유 있게 읽습니다.
    .slice(0, feed.limit * 2);

  const resolved = await Promise.all(
    candidates.map(async (item) => {
      const metadata = await fetchHtmlMetadata(item.articleUrl);
      return {
        region: feed.region,
        source: feed.source === "Bloomberg" ? "Bloomberg" : item.source,
        title: item.title,
        summary: item.summary,
        article_url: metadata.finalUrl || item.articleUrl,
        image_url:
          absoluteUrl(item.rssImage, item.articleUrl) || metadata.imageUrl || null,
        published_at: item.publishedAt,
        fetched_at: now,
        active: true,
        updated_at: now,
      } satisfies ParsedNews;
    }),
  );

  return Array.from(
    new Map(resolved.map((item) => [item.article_url, item])).values(),
  ).slice(0, feed.limit);
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");
  return authorization === `Bearer ${secret}` || querySecret === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase server environment variables" },
      { status: 500 },
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const settled = await Promise.allSettled(FEEDS.map(loadFeed));
    const items = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const errors = settled.flatMap((result, index) =>
      result.status === "rejected"
        ? [`${FEEDS[index].source}: ${String(result.reason)}`]
        : [],
    );

    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, inserted: 0, errors },
        { status: 502 },
      );
    }

    // 수집에 성공한 지역만 교체합니다. 한쪽 RSS가 실패해도 다른 쪽과 기존 데이터는 보존됩니다.
    for (const region of ["korea", "us"] as const) {
      const regionResult = settled[FEEDS.findIndex((feed) => feed.region === region)];
      if (!regionResult || regionResult.status !== "fulfilled") continue;

      const regionItems = regionResult.value.slice(0, 12);
      if (regionItems.length === 0) continue;

      // 새 기사부터 upsert하여 페이지가 빈 상태가 되는 시간을 방지합니다.
      const { error: upsertError } = await admin
        .from("community_news")
        .upsert(regionItems, { onConflict: "article_url" });

      if (upsertError) throw upsertError;

      const currentUrls = regionItems.map((item) => item.article_url);
      const currentUrlSet = new Set(currentUrls);

      // 이번에 가져온 최신 12개를 제외한 해당 지역의 모든 기존 기사를 실제 삭제합니다.
      const { data: existingRows, error: existingRowsError } = await admin
        .from("community_news")
        .select("id, article_url")
        .eq("region", region);

      if (existingRowsError) throw existingRowsError;

      const deleteIds = (existingRows ?? [])
        .filter((row) => !currentUrlSet.has(row.article_url))
        .map((row) => row.id);

      if (deleteIds.length > 0) {
        const { error: deleteError } = await admin
          .from("community_news")
          .delete()
          .in("id", deleteIds);

        if (deleteError) throw deleteError;
      }

      // 현재 12개는 모두 활성 상태로 맞춥니다.
      const { error: activateError } = await admin
        .from("community_news")
        .update({ active: true })
        .eq("region", region)
        .in("article_url", currentUrls);

      if (activateError) throw activateError;
    }

    return NextResponse.json({
      ok: true,
      saved: items.length,
      korea: items.filter((item) => item.region === "korea").length,
      us: items.filter((item) => item.region === "us").length,
      errors,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("sync community news error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}