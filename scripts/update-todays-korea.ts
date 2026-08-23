import * as cheerio from "cheerio";

import { createClient } from "@supabase/supabase-js";

type NewsCategory = "kpop" | "kdrama";

type FeedSource = {
  category: NewsCategory;
  sourceName: string;
  provider: "soompi" | "koreaboo";
  feedUrl: string;
};

type MediaType = "image" | "video" | "none";

type CollectedArticle = {
  category: NewsCategory;
  sourceName: string;
  title: string;
  description: string;
  sourceUrl: string;
  imageUrl: string | null;
  videoUrl: string | null;
  mediaType: MediaType;
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
 * RSS 항목에서 이미지와 동영상을 각각 추출합니다.
 *
 * media:content 또는 enclosure가 동영상일 수 있으므로
 * URL만 보고 image_url에 넣지 않습니다.
 */
function extractFeedItemMedia(
  $: cheerio.CheerioAPI,
  element: any,
  descriptionHtml: string,
) {
  const item = $(element);

  const mediaThumbnail =
    normalizeUrl(
      item.find("media\\:thumbnail").first().attr("url"),
    ) ||
    normalizeUrl(
      item.find("thumbnail").first().attr("url"),
    ) ||
    extractImageFromHtml(descriptionHtml);

  let imageUrl = mediaThumbnail || null;
  let videoUrl: string | null = null;

  const mediaCandidates = [
    ...item.find("media\\:content").toArray(),
    ...item.find("content").toArray(),
    ...item.find("enclosure").toArray(),
  ];

  for (const candidate of mediaCandidates) {
    const node = $(candidate);
    const url = normalizeUrl(node.attr("url"));
    const type = String(node.attr("type") || "")
      .trim()
      .toLowerCase();
    const medium = String(node.attr("medium") || "")
      .trim()
      .toLowerCase();

    if (!url) continue;

    if (
      !videoUrl &&
      (type.startsWith("video/") ||
        medium === "video")
    ) {
      videoUrl = url;
      continue;
    }

    if (
      !imageUrl &&
      (type.startsWith("image/") ||
        medium === "image")
    ) {
      imageUrl = url;
    }
  }

  return {
    imageUrl,
    videoUrl,
  };
}

/**
 * 원본 기사 페이지에서 대표 이미지와 동영상을 추출합니다.
 */
async function fetchArticleMedia(sourceUrl: string) {
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
      return {
        imageUrl: null,
        videoUrl: null,
      };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const imageUrl =
      $('meta[property="og:image:secure_url"]').attr(
        "content",
      ) ||
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image:src"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      "";

    const videoUrl =
      $('meta[property="og:video:secure_url"]').attr(
        "content",
      ) ||
      $('meta[property="og:video:url"]').attr("content") ||
      $('meta[property="og:video"]').attr("content") ||
      $('meta[name="twitter:player:stream"]').attr(
        "content",
      ) ||
      "";

    return {
      imageUrl: normalizeUrl(imageUrl) || null,
      videoUrl: normalizeUrl(videoUrl) || null,
    };
  } catch (error) {
    console.error(
      "Today’s Korea article media load failed:",
      sourceUrl,
      error,
    );

    return {
      imageUrl: null,
      videoUrl: null,
    };
  }
}

/**
 * 이미지 주소가 실제로 브라우저에서 표시 가능한 이미지인지 확인합니다.
 *
 * HEAD 요청을 막는 서버가 많기 때문에 GET 요청을 사용합니다.
 * 전체 파일을 내려받지 않도록 Range 헤더로 앞부분만 요청합니다.
 */
async function isValidRemoteImage(imageUrl: string) {
  const normalizedImageUrl = normalizeUrl(imageUrl);

  if (!normalizedImageUrl) {
    return false;
  }

  try {
    const parsedUrl = new URL(normalizedImageUrl);

    /*
     * 로컬 기본 이미지나 HTML 페이지가 DB에 들어가는 것을 방지합니다.
     */
    if (
      parsedUrl.pathname.toLowerCase().endsWith("/event.png") ||
      parsedUrl.hostname === "localhost" ||
      parsedUrl.hostname === "127.0.0.1"
    ) {
      return false;
    }

    const response = await fetch(normalizedImageUrl, {
      method: "GET",
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Range: "bytes=0-65535",
        Referer: parsedUrl.origin,
        "User-Agent":
          "Mozilla/5.0 (compatible; KTownTriangle/1.0; +https://www.ktowntriangle.com)",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok && response.status !== 206) {
      return false;
    }

    const contentType = (
      response.headers.get("content-type") || ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (!contentType.startsWith("image/")) {
      return false;
    }

    /*
     * 일부 서버가 잘못된 Content-Type을 반환할 수 있으므로
     * 실제 응답 데이터가 비어 있는지도 확인합니다.
     */
    const imageBytes = await response.arrayBuffer();

    if (imageBytes.byteLength === 0) {
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      "Today’s Korea image validation failed:",
      imageUrl,
      error,
    );

    return false;
  }
}


/**
 * 원격 주소가 실제 동영상인지 확인합니다.
 */
async function isValidRemoteVideo(videoUrl: string) {
  const normalizedVideoUrl = normalizeUrl(videoUrl);

  if (!normalizedVideoUrl) {
    return false;
  }

  try {
    const response = await fetch(normalizedVideoUrl, {
      method: "GET",
      headers: {
        Accept: "video/*,*/*;q=0.8",
        Range: "bytes=0-65535",
        "User-Agent":
          "Mozilla/5.0 (compatible; KTownTriangle/1.0; +https://www.ktowntriangle.com)",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok && response.status !== 206) {
      return false;
    }

    const contentType = (
      response.headers.get("content-type") || ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

    return contentType.startsWith("video/");
  } catch (error) {
    console.error(
      "Today’s Korea video validation failed:",
      videoUrl,
      error,
    );

    return false;
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

    const feedMedia = extractFeedItemMedia(
      $,
      element,
      rawDescription,
    );

    articles.push({
      category,
      sourceName: source.sourceName,
      title,
      description,
      sourceUrl,
      imageUrl: feedMedia.imageUrl,
      videoUrl: feedMedia.videoUrl,
      mediaType: feedMedia.videoUrl
        ? "video"
        : feedMedia.imageUrl
          ? "image"
          : "none",
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


function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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
 * 출처와 카테고리별로 최신 6개만 DB에 유지합니다.
 *
 * 최종 유지 개수:
 * - Soompi K-POP 6개
 * - Koreaboo K-POP 6개
 * - Soompi K-Drama 6개
 * - Koreaboo K-Drama 6개
 *
 * 따라서 K-POP 최대 12개, K-Drama 최대 12개,
 * 전체 최대 24개만 DB에 남습니다.
 */
async function refreshActivePosts() {
  const supabase = createSupabaseAdminClient();

  const sourceGroups = [
    {
      name: "Soompi",
      applySourceFilter: (query: any) =>
        query.like("source_name", "Soompi%"),
    },
    {
      name: "Koreaboo",
      applySourceFilter: (query: any) =>
        query.eq("source_name", "Koreaboo"),
    },
  ];

  const categories: NewsCategory[] = [
    "kpop",
    "kdrama",
  ];

  const keepCountPerSourceAndCategory = 6;

  for (const sourceGroup of sourceGroups) {
    for (const category of categories) {
      let loadQuery = supabase
        .from("todays_korea_posts")
        .select("id")
        .eq("category", category)
        .order("published_at", {
          ascending: false,
          nullsFirst: false,
        })
        .order("created_at", {
          ascending: false,
        });

      loadQuery =
        sourceGroup.applySourceFilter(loadQuery);

      const { data: sourcePosts, error: loadError } =
        await loadQuery;

      if (loadError) {
        throw new Error(
          `Post load failed for ${sourceGroup.name} ${category}: ${loadError.message}`,
        );
      }

      const posts = sourcePosts || [];

      const keepIds = posts
        .slice(0, keepCountPerSourceAndCategory)
        .map((post: any) => post.id);

      const deleteIds = posts
        .slice(keepCountPerSourceAndCategory)
        .map((post: any) => post.id);

      if (deleteIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("todays_korea_posts")
          .delete()
          .in("id", deleteIds);

        if (deleteError) {
          throw new Error(
            `Old post delete failed for ${sourceGroup.name} ${category}: ${deleteError.message}`,
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
            `Activate failed for ${sourceGroup.name} ${category}: ${activateError.message}`,
          );
        }
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
   * Soompi TV & Film에 포함된 URL은 K-Drama로 우선 분류합니다.
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

  /*
   * 출처와 카테고리별로 최신 6개씩 선택합니다.
   *
   * - Soompi K-POP 6개
   * - Soompi K-Drama 6개
   * - Koreaboo K-POP 6개
   * - Koreaboo K-Drama 6개
   */
  const soompiKpopCandidates =
    selectLatestUniqueArticles(
      soompiKpopArticles,
      6,
    );

  const soompiDramaCandidates =
    selectLatestUniqueArticles(
      soompiDramaArticles,
      6,
    );

  const koreabooArticles = collectedArticles.filter(
    (article) =>
      article.sourceName === "Koreaboo",
  );

  const koreabooKpopCandidates =
    selectLatestUniqueArticles(
      koreabooArticles.filter(
        (article) => article.category === "kpop",
      ),
      6,
    );

  const koreabooDramaCandidates =
    selectLatestUniqueArticles(
      koreabooArticles.filter(
        (article) => article.category === "kdrama",
      ),
      6,
    );

  const kpopCandidates = [
    ...soompiKpopCandidates,
    ...koreabooKpopCandidates,
  ];

  const kdramaCandidates = [
    ...soompiDramaCandidates,
    ...koreabooDramaCandidates,
  ];

  const candidates = [
    ...kpopCandidates,
    ...kdramaCandidates,
  ];

  const existingSourceUrls =
    await findExistingSourceUrls(
      candidates.map((article) => article.sourceUrl),
    );

  const newSoompiKpopArticles =
    soompiKpopCandidates.filter(
      (article) =>
        !existingSourceUrls.has(article.sourceUrl),
    );

  const newSoompiDramaArticles =
    soompiDramaCandidates.filter(
      (article) =>
        !existingSourceUrls.has(article.sourceUrl),
    );

  const newKoreabooKpopArticles =
    koreabooKpopCandidates.filter(
      (article) =>
        !existingSourceUrls.has(article.sourceUrl),
    );

  const newKoreabooDramaArticles =
    koreabooDramaCandidates.filter(
      (article) =>
        !existingSourceUrls.has(article.sourceUrl),
    );

  const newArticles = [
    ...newSoompiKpopArticles,
    ...newSoompiDramaArticles,
    ...newKoreabooKpopArticles,
    ...newKoreabooDramaArticles,
  ];

  const savedPosts: any[] = [];

  const failedPosts: {
    title: string;
    reason: string;
  }[] = [];

  for (const article of newArticles) {
    try {
      let imageUrl = article.imageUrl;
      let videoUrl = article.videoUrl;

      /*
       * RSS의 media:content가 동영상인데 type 정보가 없는 경우가 있으므로
       * image_url 후보를 실제 이미지인지 먼저 검사합니다.
       */
      if (imageUrl) {
        const imageIsValid =
          await isValidRemoteImage(imageUrl);

        if (!imageIsValid) {
          const mistakenVideo =
            await isValidRemoteVideo(imageUrl);

          if (mistakenVideo && !videoUrl) {
            videoUrl = imageUrl;
          }

          imageUrl = null;
        }
      }

      if (videoUrl) {
        const videoIsValid =
          await isValidRemoteVideo(videoUrl);

        if (!videoIsValid) {
          videoUrl = null;
        }
      }

      /*
       * RSS에 올바른 대표 이미지가 없으면 원문 페이지에서
       * og:image와 og:video를 다시 확인합니다.
       */
      if (!imageUrl || !videoUrl) {
        const articleMedia =
          await fetchArticleMedia(article.sourceUrl);

        if (!imageUrl && articleMedia.imageUrl) {
          const articleImageIsValid =
            await isValidRemoteImage(
              articleMedia.imageUrl,
            );

          if (articleImageIsValid) {
            imageUrl = articleMedia.imageUrl;
          }
        }

        if (!videoUrl && articleMedia.videoUrl) {
          const articleVideoIsValid =
            await isValidRemoteVideo(
              articleMedia.videoUrl,
            );

          if (articleVideoIsValid) {
            videoUrl = articleMedia.videoUrl;
          }
        }
      }

      /*
       * 동영상만 있고 대표 이미지가 없는 경우에도 글은 저장합니다.
       * 목록에서는 /event.png 위에 재생 아이콘을 표시할 수 있습니다.
       */
      const mediaType: MediaType = videoUrl
        ? "video"
        : imageUrl
          ? "image"
          : "none";

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
            video_url: videoUrl,
            media_type: mediaType,
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
            video_url,
            media_type,
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
      soompiKpopCandidates:
        soompiKpopCandidates.length,
      soompiDramaCandidates:
        soompiDramaCandidates.length,
      koreabooKpopCandidates:
        koreabooKpopCandidates.length,
      koreabooDramaCandidates:
        koreabooDramaCandidates.length,
      totalKpopCandidates:
        kpopCandidates.length,
      totalDramaCandidates:
        kdramaCandidates.length,
      newSoompiKpop:
        newSoompiKpopArticles.length,
      newSoompiDrama:
        newSoompiDramaArticles.length,
      newKoreabooKpop:
        newKoreabooKpopArticles.length,
      newKoreabooDrama:
        newKoreabooDramaArticles.length,
    },
    activePosts: activePosts || [],
  };
}

async function main() {
  const result = await runTodayKoreaUpdate();

  console.log(
    JSON.stringify(
      {
        ok: true,
        message:
          "Today’s Korea RSS update completed. K-POP 12 and K-Drama 12 are retained.",
        ...result,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Today’s Korea update failed:", error);
  process.exitCode = 1;
});
