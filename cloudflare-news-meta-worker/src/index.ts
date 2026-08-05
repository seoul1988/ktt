export interface Env {
  WORKER_SECRET: string;
}

type MetadataResult = {
  ok: boolean;
  inputUrl: string;
  articleUrl: string | null;
  imageUrl: string | null;
  title: string | null;
  description: string | null;
  error?: string;
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

function json(data: MetadataResult, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=1800",
      "access-control-allow-origin": "*",
    },
  });
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u003f/gi, "?")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\//g, "/");
}

function stripHtml(value: string | null) {
  if (!value) return null;

  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(value: string | null, baseUrl: string) {
  if (!value) return null;

  try {
    return new URL(decodeHtml(value), baseUrl).toString();
  } catch {
    return null;
  }
}

function isBloombergUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();

    return (
      hostname === "bloomberg.com" ||
      hostname.endsWith(".bloomberg.com")
    );
  } catch {
    return false;
  }
}

function cleanBloombergUrl(value: string) {
  let candidate = decodeHtml(value)
    .replace(/^["']+|["']+$/g, "")
    .replace(/[),;\]}]+$/g, "");

  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    // Already decoded.
  }

  try {
    const url = new URL(candidate);
    url.hash = "";

    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "cmpid",
      "srnd",
    ].forEach((key) => url.searchParams.delete(key));

    return url.toString();
  } catch {
    return candidate;
  }
}

function getMetaContent(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  return match?.[1] ? decodeHtml(match[1]) : null;
}

function extractBloombergUrl(html: string) {
  const normalized = decodeHtml(html);

  const patterns = [
    /https?:\/\/(?:www\.)?bloomberg\.com\/news\/articles\/[^"'<>\\\s]+/gi,
    /https?:\/\/(?:www\.)?bloomberg\.com\/(?:markets|technology|politics|economics|business|wealth|crypto|industries)\/[^"'<>\\\s]+/gi,
    /https%3A%2F%2F(?:www\.)?bloomberg\.com%2F[^"'<>\\\s]+/gi,
  ];

  for (const pattern of patterns) {
    for (const rawMatch of normalized.match(pattern) ?? []) {
      const cleaned = cleanBloombergUrl(rawMatch);

      if (
        isBloombergUrl(cleaned) &&
        !cleaned.includes("/account/") &&
        !cleaned.includes("/privacy") &&
        !cleaned.includes("/tos") &&
        !cleaned.includes("/company/")
      ) {
        return cleaned;
      }
    }
  }

  return null;
}

async function fetchHtml(url: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        "accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      finalUrl: response.url || url,
      html: await response.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveMetadata(inputUrl: string): Promise<MetadataResult> {
  try {
    const first = await fetchHtml(inputUrl, 10000);

    let articleUrl = isBloombergUrl(first.finalUrl)
      ? cleanBloombergUrl(first.finalUrl)
      : extractBloombergUrl(first.html);

    if (!articleUrl) {
      return {
        ok: false,
        inputUrl,
        articleUrl: null,
        imageUrl: null,
        title: null,
        description: null,
        error: "Bloomberg article URL was not found",
      };
    }

    const article = await fetchHtml(articleUrl, 12000);
    articleUrl = isBloombergUrl(article.finalUrl)
      ? cleanBloombergUrl(article.finalUrl)
      : articleUrl;

    const image =
      getMetaContent(article.html, "og:image") ||
      getMetaContent(article.html, "twitter:image:src") ||
      getMetaContent(article.html, "twitter:image");

    const title =
      getMetaContent(article.html, "og:title") ||
      getMetaContent(article.html, "twitter:title");

    const description =
      getMetaContent(article.html, "og:description") ||
      getMetaContent(article.html, "twitter:description") ||
      getMetaContent(article.html, "description");

    return {
      ok: true,
      inputUrl,
      articleUrl,
      imageUrl: absoluteUrl(image, articleUrl),
      title: stripHtml(title),
      description: stripHtml(description),
    };
  } catch (error) {
    return {
      ok: false,
      inputUrl,
      articleUrl: null,
      imageUrl: null,
      title: null,
      description: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization, content-type",
          "access-control-allow-methods": "GET, OPTIONS",
        },
      });
    }

    if (request.method !== "GET") {
      return json(
        {
          ok: false,
          inputUrl: "",
          articleUrl: null,
          imageUrl: null,
          title: null,
          description: null,
          error: "Method not allowed",
        },
        405,
      );
    }

    const authorization = request.headers.get("authorization");

    if (
      !env.WORKER_SECRET ||
      authorization !== `Bearer ${env.WORKER_SECRET}`
    ) {
      return json(
        {
          ok: false,
          inputUrl: "",
          articleUrl: null,
          imageUrl: null,
          title: null,
          description: null,
          error: "Unauthorized",
        },
        401,
      );
    }

    const requestUrl = new URL(request.url);
    const targetUrl = requestUrl.searchParams.get("url");

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return json(
        {
          ok: false,
          inputUrl: targetUrl || "",
          articleUrl: null,
          imageUrl: null,
          title: null,
          description: null,
          error: "A valid url query parameter is required",
        },
        400,
      );
    }

    const result = await resolveMetadata(targetUrl);

    return json(result, result.ok ? 200 : 422);
  },
};
