import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

type Region = "korea" | "us";

type FeedDefinition = {
  region: Region;
  source: string;
  url: string;
  candidateLimit: number;
};

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

type ExistingNewsRow = {
  article_url: string;
  title: string | null;
  summary: string | null;
  image_url: string | null;
};

type TranslationInput = {
  article_url: string;
  title: string;
  summary: string | null;
};

type TranslationOutput = {
  article_url: string;
  title: string;
  summary: string | null;
};

type AdminClient = {
  from: (table: string) => any;
};

const NEWS_LIMIT = 12;

const FEEDS: FeedDefinition[] = [
  {
    region: "korea",
    source: "매일경제",
    url: "https://www.mk.co.kr/rss/30000001/",
    candidateLimit: 20,
  },

  // MarketWatch 직접 RSS
  {
    region: "us",
    source: "MarketWatch",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    candidateLimit: 15,
  },
  {
    region: "us",
    source: "MarketWatch",
    url: "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines",
    candidateLimit: 15,
  },
  {
    region: "us",
    source: "MarketWatch",
    url: "https://feeds.content.dowjones.io/public/rss/mw_marketpulse",
    candidateLimit: 15,
  },

  // CNBC 직접 RSS
  {
    region: "us",
    source: "CNBC",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    candidateLimit: 15,
  },
  {
    region: "us",
    source: "CNBC",
    url: "https://www.cnbc.com/id/10000664/device/rss/rss.html",
    candidateLimit: 15,
  },
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(Number(code)),
    )
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
    new RegExp(
      `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
      "i",
    ),
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

  const description = block.match(
    /<description(?:\s[^>]*)?>([\s\S]*?)<\/description>/i,
  )?.[1];

  const image = description?.match(
    /<img[^>]+src=["']([^"']+)["']/i,
  );

  return image?.[1] ? decodeXml(image[1]) : null;
}

function absoluteUrl(
  value: string | null,
  baseUrl: string,
) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeDate(value: string) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function cleanArticleUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";

    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "mod",
      "siteid",
      "link",
    ].forEach((key) =>
      url.searchParams.delete(key),
    );

    return url.toString();
  } catch {
    return value;
  }
}

function cleanTitle(value: string) {
  return stripHtml(value)
    .replace(/\s+-\s+(CNBC|MarketWatch)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getMetaContent(
  html: string,
  propertyName: string,
) {
  const escaped = propertyName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

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

  return match?.[1]
    ? decodeXml(match[1])
    : null;
}

async function fetchText(
  url: string,
  timeoutMs = 10000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "user-agent": USER_AGENT,
        accept:
          "text/html,application/xhtml+xml,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
        "accept-language":
          "en-US,en;q=0.9,ko;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}`,
      );
    }

    return {
      finalUrl: response.url || url,
      text: await response.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchArticleMetadata(
  articleUrl: string,
) {
  try {
    const result = await fetchText(
      articleUrl,
      7000,
    );

    const image =
      getMetaContent(result.text, "og:image") ||
      getMetaContent(
        result.text,
        "twitter:image:src",
      ) ||
      getMetaContent(
        result.text,
        "twitter:image",
      );

    const title =
      getMetaContent(result.text, "og:title") ||
      getMetaContent(
        result.text,
        "twitter:title",
      );

    const description =
      getMetaContent(
        result.text,
        "og:description",
      ) ||
      getMetaContent(
        result.text,
        "twitter:description",
      ) ||
      getMetaContent(
        result.text,
        "description",
      );

    return {
      finalUrl: cleanArticleUrl(
        result.finalUrl,
      ),
      imageUrl: absoluteUrl(
        image,
        result.finalUrl,
      ),
      title: title
        ? cleanTitle(title)
        : null,
      description: description
        ? stripHtml(description)
        : null,
    };
  } catch {
    return {
      finalUrl: cleanArticleUrl(articleUrl),
      imageUrl: null,
      title: null,
      description: null,
    };
  }
}

async function loadFeed(
  feed: FeedDefinition,
): Promise<ParsedNews[]> {
  const { text: xml } = await fetchText(
    feed.url,
    12000,
  );

  const blocks =
    xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  const now = new Date().toISOString();

  const candidates = blocks
    .map((block) => {
      const title = cleanTitle(
        getTag(block, "title"),
      );

      const articleUrl = cleanArticleUrl(
        getTag(block, "link") ||
          getTag(block, "guid"),
      );

      const description =
        getTag(block, "description") ||
        getTag(block, "content:encoded");

      return {
        title,
        articleUrl,
        summary:
          stripHtml(description).slice(0, 400) ||
          null,
        publishedAt: normalizeDate(
          getTag(block, "pubDate") ||
            getTag(block, "dc:date") ||
            getTag(block, "published"),
        ),
        rssImage: getRssImage(block),
      };
    })
    .filter(
      (item) =>
        Boolean(item.title) &&
        /^https?:\/\//i.test(item.articleUrl),
    )
    .slice(0, feed.candidateLimit);

  const resolved: ParsedNews[] = [];

  // 원문 서버 부담을 줄이기 위해 4개씩 처리합니다.
  for (
    let index = 0;
    index < candidates.length;
    index += 4
  ) {
    const batch = candidates.slice(
      index,
      index + 4,
    );

    const batchItems = await Promise.all(
      batch.map(async (item) => {
        const metadata =
          await fetchArticleMetadata(
            item.articleUrl,
          );

        const rssImage = absoluteUrl(
          item.rssImage,
          item.articleUrl,
        );

        return {
          region: feed.region,
          source: feed.source,
          title:
            metadata.title || item.title,
          summary:
            metadata.description?.slice(0, 400) ||
            item.summary,
          article_url:
            metadata.finalUrl ||
            item.articleUrl,
          image_url:
            metadata.imageUrl ||
            rssImage ||
            null,
          published_at: item.publishedAt,
          fetched_at: now,
          active: true,
          updated_at: now,
        } satisfies ParsedNews;
      }),
    );

    resolved.push(...batchItems);
  }

  return Array.from(
    new Map(
      resolved.map((item) => [
        item.article_url,
        item,
      ]),
    ).values(),
  );
}

function sortNewest(
  a: ParsedNews,
  b: ParsedNews,
) {
  const aTime = a.published_at
    ? new Date(a.published_at).getTime()
    : 0;

  const bTime = b.published_at
    ? new Date(b.published_at).getTime()
    : 0;

  return bTime - aTime;
}

function containsKorean(
  value: string | null | undefined,
) {
  return Boolean(
    value && /[가-힣]/.test(value),
  );
}

function extractOpenAIText(payload: any) {
  if (
    typeof payload?.output_text === "string"
  ) {
    return payload.output_text;
  }

  const parts: string[] = [];

  for (const output of payload?.output ?? []) {
    for (
      const content of output?.content ?? []
    ) {
      if (
        content?.type === "output_text" &&
        typeof content?.text === "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}

function parseTranslationJson(
  value: string,
): TranslationOutput[] {
  const cleaned = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error(
      "Translation response is not an array",
    );
  }

  return parsed
    .map((item) => ({
      article_url: String(
        item?.article_url ?? "",
      ).trim(),
      title: String(
        item?.title ?? "",
      ).trim(),
      summary:
        item?.summary === null ||
        item?.summary === undefined
          ? null
          : String(item.summary).trim(),
    }))
    .filter(
      (item) =>
        item.article_url &&
        item.title,
    );
}

async function translateToKorean(
  items: TranslationInput[],
) {
  if (items.length === 0) {
    return [] as TranslationOutput[];
  }

  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing",
    );
  }

  const model =
    process.env.OPENAI_TRANSLATION_MODEL ||
    "gpt-5-mini";

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "Translate US business and financial news into natural Korean. " +
              "Return JSON only. Do not add facts or opinions. " +
              "Keep company and product names recognizable. " +
              "Use concise Korean financial-news wording. " +
              "Keep titles under about 55 Korean characters. " +
              "Keep summaries under 220 Korean characters.",
          },
          {
            role: "user",
            content:
              "Translate every item below. " +
              "Return one JSON array using exactly this shape: " +
              '[{"article_url":"...","title":"...","summary":"... or null"}].\n\n' +
              JSON.stringify(items),
          },
        ],
      }),
    },
  );

  const payload =
    await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        `OpenAI translation failed: HTTP ${response.status}`,
    );
  }

  const outputText =
    extractOpenAIText(payload);

  if (!outputText) {
    throw new Error(
      "OpenAI translation returned empty output",
    );
  }

  return parseTranslationJson(outputText);
}

async function translateUsNews(
  admin: AdminClient,
  items: ParsedNews[],
) {
  if (items.length === 0) {
    return {
      items,
      translated: 0,
      reused: 0,
      warning: null as string | null,
    };
  }

  const urls = items.map(
    (item) => item.article_url,
  );

  const {
    data: existingRows,
    error: existingError,
  } = await admin
    .from("community_news")
    .select(
      "article_url, title, summary, image_url",
    )
    .eq("region", "us")
    .in("article_url", urls);

  if (existingError) {
    throw existingError;
  }

  const typedRows =
    (existingRows ?? []) as ExistingNewsRow[];

  const existingMap = new Map(
    typedRows.map((row) => [
      row.article_url,
      row,
    ]),
  );

  const pending: TranslationInput[] = [];
  let reused = 0;

  for (const item of items) {
    const existing =
      existingMap.get(item.article_url);

    if (
      existing &&
      containsKorean(existing.title)
    ) {
      reused += 1;
      continue;
    }

    pending.push({
      article_url: item.article_url,
      title: item.title,
      summary: item.summary,
    });
  }

  let translatedMap = new Map<
    string,
    TranslationOutput
  >();

  let warning: string | null = null;

  if (pending.length > 0) {
    try {
      const translated =
        await translateToKorean(pending);

      translatedMap = new Map(
        translated.map((item) => [
          item.article_url,
          item,
        ]),
      );
    } catch (error) {
      warning =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        "community news translation error:",
        warning,
      );
    }
  }

  const merged = items.map((item) => {
    const existing =
      existingMap.get(item.article_url);

    if (
      existing &&
      containsKorean(existing.title)
    ) {
      return {
        ...item,
        title: existing.title || item.title,
        summary:
          existing.summary ?? item.summary,
        image_url:
          item.image_url ||
          existing.image_url ||
          null,
      };
    }

    const translated =
      translatedMap.get(item.article_url);

    return translated
      ? {
          ...item,
          title:
            translated.title || item.title,
          summary:
            translated.summary ??
            item.summary,
        }
      : item;
  });

  return {
    items: merged,
    translated: translatedMap.size,
    reused,
    warning,
  };
}

async function replaceRegionNews(
  admin: AdminClient,
  region: Region,
  items: ParsedNews[],
) {
  const regionItems = items
    .filter(
      (item) => item.region === region,
    )
    .slice(0, NEWS_LIMIT);

  if (regionItems.length === 0) {
    return {
      saved: 0,
      deleted: 0,
    };
  }

  const { error: upsertError } =
    await admin
      .from("community_news")
      .upsert(regionItems, {
        onConflict: "article_url",
      });

  if (upsertError) throw upsertError;

  const currentUrlSet = new Set(
    regionItems.map(
      (item) => item.article_url,
    ),
  );

  const {
    data: existingRows,
    error: existingError,
  } = await admin
    .from("community_news")
    .select("id, article_url")
    .eq("region", region);

  if (existingError) throw existingError;

  const rows = (existingRows ?? []) as Array<{
    id: number | string;
    article_url: string;
  }>;

  const deleteIds = rows
    .filter(
      (row) =>
        !currentUrlSet.has(row.article_url),
    )
    .map((row) => row.id);

  if (deleteIds.length > 0) {
    const { error: deleteError } =
      await admin
        .from("community_news")
        .delete()
        .in("id", deleteIds);

    if (deleteError) throw deleteError;
  }

  return {
    saved: regionItems.length,
    deleted: deleteIds.length,
  };
}

function isAuthorized(
  request: NextRequest,
) {
  const secret = process.env.CRON_SECRET;

  if (!secret) return false;

  const authorization =
    request.headers.get("authorization");

  const querySecret =
    request.nextUrl.searchParams.get("secret");

  return (
    authorization === `Bearer ${secret}` ||
    querySecret === secret
  );
}

export async function GET(
  request: NextRequest,
) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

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
  ) as unknown as AdminClient;

  try {
    const settled =
      await Promise.allSettled(
        FEEDS.map(async (feed) => ({
          feed,
          items: await loadFeed(feed),
        })),
      );

    const successful = settled.flatMap(
      (result) =>
        result.status === "fulfilled"
          ? [result.value]
          : [],
    );

    const feedErrors = settled.flatMap(
      (result, index) =>
        result.status === "rejected"
          ? [
              {
                source: FEEDS[index].source,
                url: FEEDS[index].url,
                error:
                  result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason),
              },
            ]
          : [],
    );

    const koreaItems = successful
      .filter(
        (result) =>
          result.feed.region === "korea",
      )
      .flatMap((result) => result.items)
      .sort(sortNewest)
      .slice(0, NEWS_LIMIT);

    const rawUsItems = Array.from(
      new Map(
        successful
          .filter(
            (result) =>
              result.feed.region === "us",
          )
          .flatMap((result) => result.items)
          .sort(sortNewest)
          .map((item) => [
            item.article_url,
            item,
          ]),
      ).values(),
    ).slice(0, NEWS_LIMIT);

    const translation =
      await translateUsNews(
        admin,
        rawUsItems,
      );

    const finalItems = [
      ...koreaItems,
      ...translation.items,
    ];

    const koreaSucceeded = successful.some(
      (result) =>
        result.feed.region === "korea",
    );

    const usSucceeded = successful.some(
      (result) =>
        result.feed.region === "us",
    );

    const koreaResult =
      koreaSucceeded &&
      koreaItems.length > 0
        ? await replaceRegionNews(
            admin,
            "korea",
            finalItems,
          )
        : {
            saved: 0,
            deleted: 0,
          };

    const usResult =
      usSucceeded &&
      translation.items.length > 0
        ? await replaceRegionNews(
            admin,
            "us",
            finalItems,
          )
        : {
            saved: 0,
            deleted: 0,
          };

    const usSourceCounts =
      translation.items.reduce<
        Record<string, number>
      >((counts, item) => {
        counts[item.source] =
          (counts[item.source] ?? 0) + 1;

        return counts;
      }, {});

    if (
      koreaItems.length === 0 &&
      translation.items.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          korea: koreaResult,
          us: usResult,
          feedErrors,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      korea: koreaResult,
      us: usResult,
      usSources: usSourceCounts,
      usImages: {
        available:
          translation.items.filter(
            (item) =>
              Boolean(item.image_url),
          ).length,
        missing:
          translation.items.filter(
            (item) =>
              !item.image_url,
          ).length,
      },
      translation: {
        translated:
          translation.translated,
        reused: translation.reused,
        warning: translation.warning,
      },
      feedErrors,
      syncedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "sync community news error:",
      error,
    );

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
