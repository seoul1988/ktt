import { createClient } from "@supabase/supabase-js";

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
    candidateLimit: 80,
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

const KOREA_US_ECONOMY_STRONG_KEYWORDS = [
  "미국",
  "미 증시",
  "미국 증시",
  "뉴욕증시",
  "월가",
  "나스닥",
  "다우",
  "s&p500",
  "s&p 500",
  "연준",
  "fed",
  "fomc",
  "파월",
  "미 국채",
  "미국채",
  "미 재무부",
  "미국 경제",
  "미국 고용",
  "미국 물가",
  "미국 소비자물가",
  "미국 생산자물가",
  "미국 gdp",
  "미국 금리",
  "미 기준금리",
  "달러",
  "뉴욕",
];

const KOREA_US_ECONOMY_COMPANY_KEYWORDS = [
  "엔비디아",
  "애플",
  "마이크로소프트",
  "테슬라",
  "아마존",
  "메타",
  "구글",
  "알파벳",
  "팔란티어",
  "오픈ai",
  "openai",
  "amd",
  "인텔",
  "브로드컴",
  "퀄컴",
  "넷플릭스",
  "월마트",
  "코스트코",
  "보잉",
  "스페이스x",
];

const KOREA_ECONOMY_CONTEXT_KEYWORDS = [
  "경제",
  "증시",
  "주가",
  "주식",
  "금리",
  "채권",
  "국채",
  "환율",
  "달러",
  "실적",
  "매출",
  "이익",
  "투자",
  "시장",
  "인플레이션",
  "물가",
  "고용",
  "관세",
  "무역",
  "수출",
  "반도체",
  "ai",
  "기업",
];

function normalizeKeywordText(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function includesAnyKeyword(
  text: string,
  keywords: string[],
) {
  return keywords.some((keyword) =>
    text.includes(keyword.toLowerCase()),
  );
}

function getKoreaUsEconomyScore(
  title: string,
  summary: string | null,
) {
  const normalizedTitle =
    normalizeKeywordText(title);

  const normalizedSummary =
    normalizeKeywordText(summary ?? "");

  let score = 0;

  for (
    const keyword of
    KOREA_US_ECONOMY_STRONG_KEYWORDS
  ) {
    const normalizedKeyword =
      keyword.toLowerCase();

    if (
      normalizedTitle.includes(
        normalizedKeyword,
      )
    ) {
      score += 5;
    }

    if (
      normalizedSummary.includes(
        normalizedKeyword,
      )
    ) {
      score += 2;
    }
  }

  const companyInTitle = includesAnyKeyword(
    normalizedTitle,
    KOREA_US_ECONOMY_COMPANY_KEYWORDS,
  );

  const companyInSummary = includesAnyKeyword(
    normalizedSummary,
    KOREA_US_ECONOMY_COMPANY_KEYWORDS,
  );

  const economyContext =
    includesAnyKeyword(
      `${normalizedTitle} ${normalizedSummary}`,
      KOREA_ECONOMY_CONTEXT_KEYWORDS,
    );

  if (companyInTitle && economyContext) {
    score += 4;
  } else if (
    companyInSummary &&
    economyContext
  ) {
    score += 2;
  }

  return score;
}

function filterKoreaUsEconomyNews(
  items: ParsedNews[],
) {
  return items
    .map((item) => ({
      item,
      usEconomyScore:
        getKoreaUsEconomyScore(
          item.title,
          item.summary,
        ),
    }))
    /*
     * 제목에 강한 미국 경제 키워드가 있거나,
     * 미국 기업명과 경제 문맥이 함께 있어야 통과합니다.
     */
    .filter(
      ({ usEconomyScore }) =>
        usEconomyScore >= 4,
    )
    .sort((a, b) => {
      const dateDifference =
        sortNewest(a.item, b.item);

      if (dateDifference !== 0) {
        return dateDifference;
      }

      return (
        b.usEconomyScore -
        a.usEconomyScore
      );
    })
    .map(({ item }) => item);
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

type ArgosTranslateResponse = {
  translatedText?: string;
  translation?: string;
  translated_text?: string;
  detail?: string;
  error?: string;
  message?: string;
};

function getArgosTranslateEndpoint(value: string) {
  const cleaned = value.trim().replace(/\/+$/, "");

  return /\/translate$/i.test(cleaned)
    ? cleaned
    : `${cleaned}/translate`;
}

async function translateToKorean(
  items: TranslationInput[],
): Promise<TranslationOutput[]> {
  if (items.length === 0) return [];

  const baseUrl = process.env.ARGOS_TRANSLATE_URL?.trim();
  const apiKey = process.env.ARGOS_TRANSLATE_API_KEY?.trim();

  if (!baseUrl) {
    throw new Error("ARGOS_TRANSLATE_URL is missing");
  }

  const endpoint = getArgosTranslateEndpoint(baseUrl);

  async function translateText(
    value: string | null | undefined,
  ): Promise<string> {
    const sourceText = String(value ?? "").trim();

    if (!sourceText) return "";

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      30000,
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...(apiKey
            ? {
                authorization: `Bearer ${apiKey}`,
              }
            : {}),
        },

        // 현재 Argos 서버는 q가 아니라 text 필드를 받습니다.
        body: JSON.stringify({
          text: sourceText,
          source: "en",
          target: "ko",
        }),
      });

      const payload =
        (await response.json().catch(() => null)) as
          | ArgosTranslateResponse
          | null;

      if (!response.ok) {
        throw new Error(
          payload?.detail ||
            payload?.error ||
            payload?.message ||
            `Argos translation failed: HTTP ${response.status}`,
        );
      }

      const translated = String(
        payload?.translatedText ||
          payload?.translation ||
          payload?.translated_text ||
          "",
      ).trim();

      if (!translated) {
        throw new Error(
          "Argos translation returned empty output",
        );
      }

      return translated;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        throw new Error(
          "Argos translation timed out after 30 seconds",
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const translatedItems: TranslationOutput[] = [];

  // 한 번에 3개 기사씩 처리합니다.
  // 각 기사 안에서는 title/summary를 동시에 번역해 전체 실행시간을 줄입니다.
  for (let index = 0; index < items.length; index += 3) {
    const batch = items.slice(index, index + 3);

    const translatedBatch = await Promise.all(
      batch.map(async (item) => {
        const [title, summary] = await Promise.all([
          translateText(item.title),
          item.summary
            ? translateText(item.summary.slice(0, 500))
            : Promise.resolve(""),
        ]);

        // 영어 원문을 조용히 DB에 넣지 않도록 번역 결과를 확인합니다.
        if (!containsKorean(title)) {
          throw new Error(
            `Argos did not return Korean for: ${item.title.slice(0, 80)}`,
          );
        }

        return {
          article_url: item.article_url,
          title: title.slice(0, 180),
          summary: summary
            ? summary.slice(0, 600)
            : null,
        } satisfies TranslationOutput;
      }),
    );

    translatedItems.push(...translatedBatch);
  }

  return translatedItems;
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

      /*
       * 번역 실패는 미국 RSS 업데이트 자체를 막지 않습니다.
       * translatedMap이 비어 있으므로 아래 merged 단계에서
       * 번역되지 않은 새 미국 기사는 영어 원문(item) 그대로 사용됩니다.
       *
       * 결과:
       * - 번역 성공: 한국어 title/summary 저장
       * - 번역 실패: 영어 title/summary 저장
       * - 어느 경우든 US 뉴스는 최신 12개 유지
       */
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
  const regionItems = Array.from(
    new Map(
      items
        .filter(
          (item) =>
            item.region === region &&
            Boolean(item.article_url) &&
            Boolean(item.title),
        )
        .sort(sortNewest)
        .map((item) => [
          item.article_url,
          item,
        ]),
    ).values(),
  ).slice(0, NEWS_LIMIT);

  if (regionItems.length === 0) {
    return {
      saved: 0,
      deleted: 0,
      retained: 0,
    };
  }

  /*
   * 중요:
   * 기존 12개를 먼저 삭제하지 않습니다.
   *
   * 예)
   * DB 기존 12개 + 새 기사 2개
   *   1) 새 기사 2개 upsert -> DB 14개
   *   2) DB 전체를 최신순 정렬
   *   3) 최신 12개 유지
   *   4) 가장 오래된 2개만 삭제
   */
  const { error: upsertError } =
    await admin
      .from("community_news")
      .upsert(regionItems, {
        onConflict: "article_url",
      });

  if (upsertError) throw upsertError;

  const {
    data: existingRows,
    error: existingError,
  } = await admin
    .from("community_news")
    .select(
      "id, article_url, published_at, fetched_at, updated_at",
    )
    .eq("region", region);

  if (existingError) throw existingError;

  const rows = (existingRows ?? []) as Array<{
    id: number | string;
    article_url: string;
    published_at: string | null;
    fetched_at: string | null;
    updated_at: string | null;
  }>;

  const getRowTime = (
    row: (typeof rows)[number],
  ) => {
    const value =
      row.published_at ||
      row.fetched_at ||
      row.updated_at;

    if (!value) return 0;

    const timestamp = new Date(value).getTime();

    return Number.isFinite(timestamp)
      ? timestamp
      : 0;
  };

  const sortedRows = [...rows].sort(
    (a, b) => getRowTime(b) - getRowTime(a),
  );

  const retainedRows =
    sortedRows.slice(0, NEWS_LIMIT);

  const deleteIds = sortedRows
    .slice(NEWS_LIMIT)
    .map((row) => row.id);

  if (deleteIds.length > 0) {
    const { error: deleteError } =
      await admin
        .from("community_news")
        .delete()
        .in("id", deleteIds);

    if (deleteError) throw deleteError;
  }

  const retainedUrls = retainedRows.map(
    (row) => row.article_url,
  );

  if (retainedUrls.length > 0) {
    const { error: activateError } =
      await admin
        .from("community_news")
        .update({
          active: true,
        })
        .eq("region", region)
        .in("article_url", retainedUrls);

    if (activateError) throw activateError;
  }

  return {
    saved: regionItems.length,
    deleted: deleteIds.length,
    retained: retainedRows.length,
  };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
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

  const settled = await Promise.allSettled(
    FEEDS.map(async (feed) => ({
      feed,
      items: await loadFeed(feed),
    })),
  );

  const successful = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  const feedErrors = settled.flatMap((result, index) =>
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

  const koreaItems = filterKoreaUsEconomyNews(
    successful
      .filter((result) => result.feed.region === "korea")
      .flatMap((result) => result.items),
  )
    .sort(sortNewest)
    .slice(0, NEWS_LIMIT);

  const rawUsItems = Array.from(
    new Map(
      successful
        .filter((result) => result.feed.region === "us")
        .flatMap((result) => result.items)
        .sort(sortNewest)
        .map((item) => [item.article_url, item]),
    ).values(),
  ).slice(0, NEWS_LIMIT);

  const translation = await translateUsNews(admin, rawUsItems);
  const finalItems = [...koreaItems, ...translation.items];

  const koreaSucceeded = successful.some(
    (result) => result.feed.region === "korea",
  );
  const usSucceeded = successful.some(
    (result) => result.feed.region === "us",
  );

  const koreaResult =
    koreaSucceeded && koreaItems.length > 0
      ? await replaceRegionNews(admin, "korea", finalItems)
      : { saved: 0, deleted: 0, retained: 0 };

  const usResult =
    usSucceeded && translation.items.length > 0
      ? await replaceRegionNews(admin, "us", finalItems)
      : { saved: 0, deleted: 0, retained: 0 };

  const usSourceCounts = translation.items.reduce<Record<string, number>>(
    (counts, item) => {
      counts[item.source] = (counts[item.source] ?? 0) + 1;
      return counts;
    },
    {},
  );

  if (koreaItems.length === 0 && translation.items.length === 0) {
    throw new Error(
      `No news items were collected. Feed errors: ${JSON.stringify(feedErrors)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        korea: koreaResult,
        us: usResult,
        koreaFilter: {
          topic: "US economy",
          saved: koreaItems.length,
        },
        usSources: usSourceCounts,
        usImages: {
          available: translation.items.filter((item) => Boolean(item.image_url))
            .length,
          missing: translation.items.filter((item) => !item.image_url).length,
        },
        translation: {
          translated: translation.translated,
          reused: translation.reused,
          warning: translation.warning,
        },
        feedErrors,
        syncedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("sync community news failed:", error);
  process.exitCode = 1;
});
