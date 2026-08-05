import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

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

type ExistingNewsImageRow = {
  article_url: string;
  image_url: string | null;
};

type ExistingTranslationRow = {
  article_url: string;
  title: string | null;
  summary: string | null;
};

type HtmlMetadata = {
  finalUrl: string;
  imageUrl: string | null;
  title: string | null;
  description: string | null;
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


function isLikelyBloombergArticleUrl(value: string | null | undefined) {
  if (!value) return false;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    return (
      (host === "bloomberg.com" ||
        host.endsWith(".bloomberg.com")) &&
      url.pathname.includes("/news/articles/")
    );
  } catch {
    return false;
  }
}

function extractBloombergArticleUrlFromHtml(html: string) {
  const normalized = decodeJavascriptEscapes(html);

  const patterns = [
    /https?:\/\/(?:www\.)?bloomberg\.com\/news\/articles\/[^"'<>\\\s]+/gi,
    /https%3A%2F%2F(?:www\.)?bloomberg\.com%2Fnews%2Farticles%2F[^"'<>\\\s]+/gi,
  ];

  for (const pattern of patterns) {
    const matches = normalized.match(pattern) ?? [];

    for (const raw of matches) {
      const cleaned = cleanBloombergUrl(raw);

      if (isLikelyBloombergArticleUrl(cleaned)) {
        return cleaned;
      }
    }
  }

  return null;
}

async function fetchDirectHtml(
  url: string,
  timeoutMs = 12000,
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
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/124.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        referer: "https://www.google.com/",
      },
    });

    const html = await response.text().catch(() => "");

    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url || url,
      html,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      html: "",
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveBloombergMetadataDirect(
  googleNewsUrl: string,
): Promise<{
  articleUrl: string | null;
  imageUrl: string | null;
  title: string | null;
  description: string | null;
} | null> {
  /*
   * 1) Google News 중계 링크를 브라우저처럼 요청합니다.
   * 2) 최종 URL 또는 HTML 안에서 Bloomberg 원문 URL을 찾습니다.
   * 3) Bloomberg 원문을 다시 요청해 og:image를 읽습니다.
   */
  const googleResult = await fetchDirectHtml(
    googleNewsUrl,
    12000,
  );

  let articleUrl: string | null = null;

  if (
    isLikelyBloombergArticleUrl(
      googleResult.finalUrl,
    )
  ) {
    articleUrl = cleanBloombergUrl(
      googleResult.finalUrl,
    );
  }

  if (!articleUrl && googleResult.html) {
    articleUrl =
      extractBloombergArticleUrlFromHtml(
        googleResult.html,
      );
  }

  if (!articleUrl) {
    console.error(
      "Bloomberg direct URL resolution failed:",
      {
        status: googleResult.status,
        googleNewsUrl,
      },
    );

    return null;
  }

  const articleResult = await fetchDirectHtml(
    articleUrl,
    15000,
  );

  if (!articleResult.ok || !articleResult.html) {
    console.error(
      "Bloomberg direct fetch failed:",
      {
        status: articleResult.status,
        articleUrl,
      },
    );

    return {
      articleUrl,
      imageUrl: null,
      title: null,
      description: null,
    };
  }

  const finalArticleUrl =
    isLikelyBloombergArticleUrl(
      articleResult.finalUrl,
    )
      ? cleanBloombergUrl(
          articleResult.finalUrl,
        )
      : articleUrl;

  const image =
    getMetaContent(
      articleResult.html,
      "og:image",
    ) ||
    getMetaContent(
      articleResult.html,
      "twitter:image:src",
    ) ||
    getMetaContent(
      articleResult.html,
      "twitter:image",
    );

  const title =
    getMetaContent(
      articleResult.html,
      "og:title",
    ) ||
    getMetaContent(
      articleResult.html,
      "twitter:title",
    );

  const description =
    getMetaContent(
      articleResult.html,
      "og:description",
    ) ||
    getMetaContent(
      articleResult.html,
      "twitter:description",
    ) ||
    getMetaContent(
      articleResult.html,
      "description",
    );

  return {
    articleUrl: finalArticleUrl,
    imageUrl:
      image &&
      !isGooglePlaceholderImage(image)
        ? absoluteUrl(
            image,
            finalArticleUrl,
          )
        : null,
    title:
      title &&
      !/^Google News$/i.test(title.trim())
        ? stripHtml(title)
        : null,
    description:
      description
        ? stripHtml(description)
        : null,
  };
}

async function enrichUsImages(
  admin: ReturnType<typeof createClient>,
  items: ParsedNews[],
) {
  if (items.length === 0) {
    return {
      items,
      reused: 0,
      fetched: 0,
      failed: 0,
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
      "article_url, image_url",
    )
    .eq("region", "us")
    .in("article_url", urls);

  if (existingError) {
    throw existingError;
  }

  const typedExistingRows =
    (existingRows ?? []) as ExistingNewsImageRow[];

  const existingImageMap = new Map<string, string>(
    typedExistingRows
      .filter(
        (row) =>
          Boolean(row.image_url) &&
          !isGooglePlaceholderImage(
            row.image_url,
          ),
      )
      .map((row) => [
        row.article_url,
        row.image_url as string,
      ]),
  );

  let reused = 0;
  let fetched = 0;
  let failed = 0;

  const output: ParsedNews[] = [];

  /*
   * 같은 기사에 이미지가 이미 있으면 재사용합니다.
   * 이미지가 없는 기사만 직접 원문 메타데이터를 조회합니다.
   * 외부 서버 부담을 줄이기 위해 동시에 2개씩 처리합니다.
   */
  for (
    let index = 0;
    index < items.length;
    index += 2
  ) {
    const batch = items.slice(
      index,
      index + 2,
    );

    const resolved = await Promise.all(
      batch.map(async (item) => {
        const existingImage =
          existingImageMap.get(
            item.article_url,
          );

        if (existingImage) {
          reused += 1;

          return {
            ...item,
            image_url: existingImage,
          };
        }

        const metadata =
          await resolveBloombergMetadataDirect(
            item.article_url,
          );

        if (metadata?.imageUrl) {
          fetched += 1;

          return {
            ...item,
            image_url: metadata.imageUrl,
          };
        }

        failed += 1;

        return item;
      }),
    );

    output.push(...resolved);
  }

  return {
    items: output,
    reused,
    fetched,
    failed,
  };
}

function containsKorean(value: string | null | undefined) {
  return Boolean(value && /[가-힣]/.test(value));
}

function extractOpenAIText(payload: any) {
  if (typeof payload?.output_text === "string") {
    return payload.output_text;
  }

  const parts: string[] = [];

  for (const output of payload?.output ?? []) {
    for (const content of output?.content ?? []) {
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

function parseTranslationJson(value: string): TranslationOutput[] {
  const cleaned = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error("Translation response is not an array");
  }

  return parsed
    .map((item) => ({
      article_url: String(item?.article_url ?? "").trim(),
      title: String(item?.title ?? "").trim(),
      summary:
        item?.summary === null || item?.summary === undefined
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
): Promise<TranslationOutput[]> {
  if (items.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const model =
    process.env.OPENAI_TRANSLATION_MODEL ||
    "gpt-5-mini";

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
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
              "You translate Bloomberg business news into natural Korean. " +
              "Return JSON only. Do not add facts or opinions. " +
              "Keep company and product names recognizable. " +
              "Use concise Korean financial-news wording. " +
              "Keep each title under about 55 Korean characters. " +
              "Translate summaries faithfully and keep each summary under 220 Korean characters.",
          },
          {
            role: "user",
            content:
              "Translate every item below into Korean. " +
              "Return one JSON array with the same article_url values and this exact shape: " +
              '[{"article_url":"...","title":"...","summary":"... or null"}].\n\n' +
              JSON.stringify(items),
          },
        ],
      }),
      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      `OpenAI translation failed: HTTP ${response.status}`;

    throw new Error(message);
  }

  const outputText = extractOpenAIText(payload);

  if (!outputText) {
    throw new Error("OpenAI translation returned empty output");
  }

  return parseTranslationJson(outputText);
}

async function translateNewUsItems(
  admin: ReturnType<typeof createClient>,
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

  const urls = items.map((item) => item.article_url);

  const {
    data: existingRows,
    error: existingError,
  } = await admin
    .from("community_news")
    .select("article_url, title, summary")
    .eq("region", "us")
    .in("article_url", urls);

  if (existingError) {
    throw existingError;
  }

  const typedTranslationRows =
    (existingRows ?? []) as ExistingTranslationRow[];

  const existingMap = new Map<
    string,
    {
      title: string;
      summary: string | null;
    }
  >(
    typedTranslationRows.map((row) => [
      row.article_url,
      {
        title: row.title ?? "",
        summary: row.summary,
      },
    ]),
  );

  const reusedUrls = new Set<string>();

  const pending: TranslationInput[] = [];

  for (const item of items) {
    const existing = existingMap.get(
      item.article_url,
    );

    if (
      existing &&
      containsKorean(existing.title)
    ) {
      reusedUrls.add(item.article_url);
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
    const existing = existingMap.get(
      item.article_url,
    );

    if (
      existing &&
      containsKorean(existing.title)
    ) {
      return {
        ...item,
        title: existing.title,
        summary: existing.summary,
      };
    }

    const translated = translatedMap.get(
      item.article_url,
    );

    if (!translated) {
      return item;
    }

    return {
      ...item,
      title:
        translated.title || item.title,
      summary:
        translated.summary ?? item.summary,
    };
  });

  return {
    items: merged,
    translated: translatedMap.size,
    reused: reusedUrls.size,
    warning,
  };
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

    const rawItems = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );

    const usImages =
      await enrichUsImages(
        admin,
        rawItems.filter(
          (item) => item.region === "us",
        ),
      );

    const usTranslation =
      await translateNewUsItems(
        admin,
        usImages.items,
      );

    const items = [
      ...rawItems.filter(
        (item) => item.region === "korea",
      ),
      ...usTranslation.items,
    ];

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

      const regionItems = items
        .filter((item) => item.region === region)
        .slice(0, 12);

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
      images: {
        fetchedDirectly: usImages.fetched,
        reusedFromDatabase: usImages.reused,
        failed: usImages.failed,
      },
      translation: {
        translated: usTranslation.translated,
        reused: usTranslation.reused,
        warning: usTranslation.warning,
      },
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
