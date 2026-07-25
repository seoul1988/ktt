import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

import { createSupabaseAdminClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

type NewsCategory = "kpop" | "kdrama";

type FeedSource = {
  category: NewsCategory;
  sourceName: string;
  provider: "soompi" | "koreaboo";
  feedUrl: string;
};

type CollectedArticle = {
  category: NewsCategory;
  sourceName: string;
  title: string;
  description: string;
  sourceUrl: string;
  imageUrl: string | null;
  publishedAt: string;
};

const FEED_SOURCES: FeedSource[] = [
  {
    category: "kdrama",
    sourceName: "Soompi TV & Film",
    provider: "soompi",
    feedUrl: "https://www.soompi.com/category/tvfilm/feed",
  },
  {
    category: "kpop",
    sourceName: "Soompi",
    provider: "soompi",
    feedUrl: "https://www.soompi.com/feed",
  },
  {
    category: "kpop",
    sourceName: "Koreaboo",
    provider: "koreaboo",
    feedUrl: "https://www.koreaboo.com/feed/",
  },
];

const MAX_SUMMARY_LENGTH = 260;

/**
 * HTML Entity 변환
 */
function decodeHtmlEntities(value: string) {
  if (!value) return "";

  const $ = cheerio.load(`<div>${value}</div>`);

  return $("div").text();
}

/**
 * XML 및 HTML 문자열 정리
 */
function cleanText(value: unknown) {
  const raw = String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(raw)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 문장이 너무 길면 자연스럽게 줄이기
 */
function createSummary(value: string) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "Read the latest Korean entertainment news from the original source.";
  }

  if (cleaned.length <= MAX_SUMMARY_LENGTH) {
    return cleaned;
  }

  const shortened = cleaned.slice(0, MAX_SUMMARY_LENGTH);

  const lastSentenceEnd = Math.max(
    shortened.lastIndexOf(". "),
    shortened.lastIndexOf("! "),
    shortened.lastIndexOf("? "),
  );

  if (lastSentenceEnd >= 100) {
    return shortened.slice(0, lastSentenceEnd + 1).trim();
  }

  const lastSpace = shortened.lastIndexOf(" ");

  if (lastSpace > 0) {
    return `${shortened.slice(0, lastSpace).trim()}…`;
  }

  return `${shortened.trim()}…`;
}

/**
 * 정상 URL인지 검사
 */
function normalizeUrl(value: unknown) {
  const url = String(value ?? "").trim();

  if (!url) return "";

  try {
    return new URL(url).toString();
  } catch {
    return "";
  }
}

/**
 * 날짜를 ISO 문자열로 변환
 */
function normalizePublishedDate(value: unknown) {
  const text = cleanText(value);

  if (!text) {
    return new Date().toISOString();
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

/**
 * HTML에서 첫 번째 이미지 추출
 */
function extractImageFromHtml(html: string) {
  if (!html) return null;

  const $ = cheerio.load(html);

  const imageUrl =
    $("img").first().attr("src") ||
    $("img").first().attr("data-src") ||
    $("img").first().attr("data-lazy-src") ||
    "";

  return normalizeUrl(imageUrl) || null;
}

/**
 * RSS 항목에서 이미지 추출
 */
function extractFeedItemImage(
  $: cheerio.CheerioAPI,
  element: any,
  descriptionHtml: string,
) {
  const item = $(element);

  const mediaContent =
    item.find("media\\:content").first().attr("url") ||
    item.find("content").first().attr("url") ||
    "";

  const mediaThumbnail =
    item.find("media\\:thumbnail").first().attr("url") ||
    item.find("thumbnail").first().attr("url") ||
    "";

  const enclosure =
    item.find("enclosure").first().attr("url") || "";

  const directImage =
    normalizeUrl(mediaContent) ||
    normalizeUrl(mediaThumbnail) ||
    normalizeUrl(enclosure);

  if (directImage) {
    return directImage;
  }

  return extractImageFromHtml(descriptionHtml);
}

/**
 * 원본 기사 페이지에서 og:image 추출
 */
async function fetchArticleImage(sourceUrl: string) {
  try {
    const response = await fetch(sourceUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; KTownTriangle/1.0; +https://www.ktowntriangle.com)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const imageUrl =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[property="og:image:secure_url"]').attr(
        "content",
      ) ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[name="twitter:image:src"]').attr("content") ||
      "";

    return normalizeUrl(imageUrl) || null;
  } catch (error) {
    console.error(
      "Today’s Korea article image load failed:",
      sourceUrl,
      error,
    );

    return null;
  }
}

/**
 * Koreaboo 기사 제목과 설명을 바탕으로
 * K-Drama와 K-POP을 간단히 구분합니다.
 */
function classifyKoreabooCategory(
  title: string,
  description: string,
): NewsCategory {
  const value = `${title} ${description}`.toLowerCase();

  const dramaKeywords = [
    "k-drama",
    "kdrama",
    "drama",
    "actor",
    "actress",
    "tv series",
    "netflix series",
    "episode",
    "character",
    "cast",
    "rom-com",
    "romance series",
  ];

  return dramaKeywords.some((keyword) =>
    value.includes(keyword),
  )
    ? "kdrama"
    : "kpop";
}

/**
 * RSS XML을 기사 목록으로 변환
 */
function parseFeedXml(
  xml: string,
  source: FeedSource,
): CollectedArticle[] {
  const $ = cheerio.load(xml, {
    xmlMode: true,
  });

  const articles: CollectedArticle[] = [];

  $("item").each((_, element) => {
    const item = $(element);

    const rawTitle = item.find("title").first().text();

    const rawLink =
      item.find("link").first().text() ||
      item.find("guid").first().text();

    const rawDescription =
      item.find("content\\:encoded").first().text() ||
      item.find("encoded").first().text() ||
      item.find("description").first().text() ||
      item.find("summary").first().text();

    const rawPublishedAt =
      item.find("pubDate").first().text() ||
      item.find("published").first().text() ||
      item.find("updated").first().text();

    const title = cleanText(rawTitle);
    const sourceUrl = normalizeUrl(rawLink);
    const description = cleanText(rawDescription);

    if (!title || !sourceUrl) {
      return;
    }

    const category =
      source.provider === "koreaboo"
        ? classifyKoreabooCategory(title, description)
        : source.category;

    articles.push({
      category,
      sourceName: source.sourceName,
      title,
      description,
      sourceUrl,
      imageUrl: extractFeedItemImage(
        $,
        element,
        rawDescription,
      ),
      publishedAt: normalizePublishedDate(rawPublishedAt),
    });
  });

  return articles;
}

/**
 * RSS 주소 호출
 */
async function fetchFeedSource(
  source: FeedSource,
): Promise<CollectedArticle[]> {
  try {
    const response = await fetch(source.feedUrl, {
      method: "GET",
      headers: {
        Accept:
          "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent":
          "Mozilla/5.0 (compatible; KTownTriangle/1.0; +https://www.ktowntriangle.com)",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(
        `${source.sourceName} returned HTTP ${response.status}`,
      );
    }

    const xml = await response.text();

    return parseFeedXml(xml, source);
  } catch (error) {
    console.error(
      `Today’s Korea RSS load failed: ${source.sourceName}`,
      error,
    );

    return [];
  }
}

/**
 * 제목 비교용 문자열
 */
function normalizeTitleForComparison(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, "")
    .trim();
}

/**
 * 중복을 제거하고 최신순으로 제한
 */
function selectLatestUniqueArticles(
  articles: CollectedArticle[],
  limit: number,
) {
  const selected: CollectedArticle[] = [];
  const sourceUrlSet = new Set<string>();
  const titleSet = new Set<string>();

  const sorted = [...articles].sort((a, b) => {
    return (
      new Date(b.publishedAt).getTime() -
      new Date(a.publishedAt).getTime()
    );
  });

  for (const article of sorted) {
    const normalizedTitle = normalizeTitleForComparison(
      article.title,
    );

    if (sourceUrlSet.has(article.sourceUrl)) {
      continue;
    }

    if (normalizedTitle && titleSet.has(normalizedTitle)) {
      continue;
    }

    sourceUrlSet.add(article.sourceUrl);

    if (normalizedTitle) {
      titleSet.add(normalizedTitle);
    }

    selected.push(article);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

/**
 * 비밀키 검사
 */
function isAuthorized(request: NextRequest) {
  const configuredSecret =
    process.env.TODAYS_KOREA_SECRET?.trim();

  if (!configuredSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const querySecret =
    request.nextUrl.searchParams.get("secret")?.trim() || "";

  const authorizationHeader =
    request.headers.get("authorization")?.trim() || "";

  return (
    querySecret === configuredSecret ||
    authorizationHeader ===
      `Bearer ${configuredSecret}`
  );
}

/**
 * DB에 이미 존재하는 URL 확인
 */
async function findExistingSourceUrls(
  sourceUrls: string[],
) {
  if (sourceUrls.length === 0) {
    return new Set<string>();
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("todays_korea_posts")
    .select("source_url")
    .in("source_url", sourceUrls);

  if (error) {
    throw new Error(
      `Existing URL lookup failed: ${error.message}`,
    );
  }

  return new Set(
    (data || [])
      .map((item: any) =>
        String(item.source_url || ""),
      )
      .filter(Boolean),
  );
}

/**
 * Soompi 최신 6개와 Koreaboo 최신 6개만 DB에 유지합니다.
 * 새 기사가 들어오면 각 출처에서 가장 오래된 기사부터 실제 삭제합니다.
 */
async function refreshActivePosts() {
  const supabase = createSupabaseAdminClient();

  const sourceGroups = [
    {
      name: "Soompi",
      applyFilter: (query: any) =>
        query.like("source_name", "Soompi%"),
    },
    {
      name: "Koreaboo",
      applyFilter: (query: any) =>
        query.eq("source_name", "Koreaboo"),
    },
  ];

  const keepCountPerSource = 6;

  for (const sourceGroup of sourceGroups) {
    let loadQuery = supabase
      .from("todays_korea_posts")
      .select("id")
      .order("published_at", {
        ascending: false,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: false,
      });

    loadQuery = sourceGroup.applyFilter(loadQuery);

    const { data: sourcePosts, error: loadError } =
      await loadQuery;

    if (loadError) {
      throw new Error(
        `Post load failed for ${sourceGroup.name}: ${loadError.message}`,
      );
    }

    const posts = sourcePosts || [];

    const keepIds = posts
      .slice(0, keepCountPerSource)
      .map((post: any) => post.id);

    const deleteIds = posts
      .slice(keepCountPerSource)
      .map((post: any) => post.id);

    if (deleteIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("todays_korea_posts")
        .delete()
        .in("id", deleteIds);

      if (deleteError) {
        throw new Error(
          `Old post delete failed for ${sourceGroup.name}: ${deleteError.message}`,
        );
      }
    }

    if (keepIds.length > 0) {
      const { error: activateError } = await supabase
        .from("todays_korea_posts")
        .update({
          is_active: true,
        })
        .in("id", keepIds);

      if (activateError) {
        throw new Error(
          `Activate failed for ${sourceGroup.name}: ${activateError.message}`,
        );
      }
    }
  }
}

/**
 * 실제 뉴스 업데이트
 */
async function runTodayKoreaUpdate() {
  const supabase = createSupabaseAdminClient();

  const feedResults = await Promise.all(
    FEED_SOURCES.map((source) =>
      fetchFeedSource(source),
    ),
  );

  const collectedArticles = feedResults.flat();

  /*
   * Soompi는 TV & Film 피드와 전체 피드를 합쳐 중복을 제거한 뒤
   * K-POP 3개 + K-Drama 3개를 우선 선택하여 총 6개를 구성합니다.
   */
  const soompiArticles = collectedArticles.filter(
    (article) =>
      article.sourceName === "Soompi" ||
      article.sourceName === "Soompi TV & Film",
  );

  const soompiDramaArticles = soompiArticles.filter(
    (article) => article.category === "kdrama",
  );

  const soompiDramaUrlSet = new Set(
    soompiDramaArticles.map(
      (article) => article.sourceUrl,
    ),
  );

  const soompiKpopArticles = soompiArticles.filter(
    (article) =>
      article.category === "kpop" &&
      !soompiDramaUrlSet.has(article.sourceUrl),
  );

  const soompiKpopCandidates =
    selectLatestUniqueArticles(
      soompiKpopArticles,
      8,
    );

  const soompiDramaCandidates =
    selectLatestUniqueArticles(
      soompiDramaArticles,
      8,
    );

  const preferredSoompiCandidates = [
    ...soompiKpopCandidates.slice(0, 3),
    ...soompiDramaCandidates.slice(0, 3),
  ];

  const soompiFallbackCandidates =
    selectLatestUniqueArticles(
      [
        ...soompiKpopCandidates.slice(3),
        ...soompiDramaCandidates.slice(3),
      ],
      12,
    );

  const soompiCandidates =
    selectLatestUniqueArticles(
      [
        ...preferredSoompiCandidates,
        ...soompiFallbackCandidates,
      ],
      6,
    );

  /*
   * Koreaboo에서는 최신 고유 기사 6개를 선택합니다.
   */
  const koreabooCandidates =
    selectLatestUniqueArticles(
      collectedArticles.filter(
        (article) =>
          article.sourceName === "Koreaboo",
      ),
      6,
    );

  const candidates = [
    ...soompiCandidates,
    ...koreabooCandidates,
  ];

  const existingSourceUrls =
    await findExistingSourceUrls(
      candidates.map((article) => article.sourceUrl),
    );

  /*
   * 출처별로 새 기사 최대 6개를 저장합니다.
   * 저장 후 refreshActivePosts()가 각 출처의 최신 6개만 남깁니다.
   */
  const newSoompiArticles = soompiCandidates.filter(
    (article) =>
      !existingSourceUrls.has(article.sourceUrl),
  );

  const newKoreabooArticles =
    koreabooCandidates.filter(
      (article) =>
        !existingSourceUrls.has(article.sourceUrl),
    );

  const newArticles = [
    ...newSoompiArticles,
    ...newKoreabooArticles,
  ];

  const savedPosts: any[] = [];

  const failedPosts: {
    title: string;
    reason: string;
  }[] = [];

  for (const article of newArticles) {
    try {
      let imageUrl = article.imageUrl;

      if (!imageUrl) {
        imageUrl = await fetchArticleImage(
          article.sourceUrl,
        );
      }

      const { data, error } = await supabase
        .from("todays_korea_posts")
        .upsert(
          {
            category: article.category,
            title: article.title.slice(0, 150),
            summary: createSummary(
              article.description,
            ),
            source_name: article.sourceName,
            source_url: article.sourceUrl,
            image_url: imageUrl,
            original_title: article.title,
            original_description:
              article.description.slice(0, 2000),
            published_at: article.publishedAt,
            collected_at: new Date().toISOString(),
            is_active: true,
          },
          {
            onConflict: "source_url",
            ignoreDuplicates: false,
          },
        )
        .select(
          `
            id,
            category,
            title,
            summary,
            source_name,
            source_url,
            image_url,
            published_at,
            is_active
          `,
        )
        .single();

      if (error) {
        failedPosts.push({
          title: article.title,
          reason: error.message,
        });

        console.error(
          "Today’s Korea DB save failed:",
          article.title,
          error,
        );

        continue;
      }

      savedPosts.push(data);
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Unknown article processing error";

      failedPosts.push({
        title: article.title,
        reason,
      });

      console.error(
        "Today’s Korea article processing failed:",
        article.title,
        error,
      );
    }
  }

  await refreshActivePosts();

  const { data: activePosts, error: activePostsError } =
    await supabase
      .from("todays_korea_posts")
      .select(
        `
          id,
          category,
          title,
          summary,
          source_name,
          source_url,
          image_url,
          published_at,
          is_active
        `,
      )
      .eq("is_active", true)
      .order("category", {
        ascending: true,
      })
      .order("published_at", {
        ascending: false,
        nullsFirst: false,
      });

  if (activePostsError) {
    throw new Error(
      `Active posts load failed: ${activePostsError.message}`,
    );
  }

  return {
    collected: collectedArticles.length,
    candidates: candidates.length,
    newArticles: newArticles.length,
    saved: savedPosts.length,
    skippedExisting:
      candidates.length - newArticles.length,
    failed: failedPosts.length,
    failedPosts,
    sources: {
      soompiCandidates: soompiCandidates.length,
      koreabooCandidates: koreabooCandidates.length,
      newSoompi: newSoompiArticles.length,
      newKoreaboo: newKoreabooArticles.length,
    },
    activePosts: activePosts || [],
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  try {
    const result = await runTodayKoreaUpdate();

    return NextResponse.json(
      {
        ok: true,
        message:
          "Today’s Korea RSS update completed. Soompi 6 and Koreaboo 6 are retained.",
        ...result,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error(
      "Today’s Korea update route failed:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown Today’s Korea update error",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}