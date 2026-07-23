import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Browser, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STORAGE_BUCKET = "business-instagram";

/**
 * 한 번 실행할 때 처리할 최대 업체 수입니다.
 *
 * 로컬 테스트:
 *   /api/instagram-sync?limit=1
 *
 * 실제 실행:
 *   /api/instagram-sync?limit=44
 */
const DEFAULT_LIMIT = 44;

/**
 * Instagram 요청 사이의 대기 시간입니다.
 * 너무 빠르게 요청하지 않도록 업체마다 잠시 쉽니다.
 */
const REQUEST_DELAY_MS = 2500;

type BusinessRecord = {
  id: string | number;
  name: string | null;
  instagram_url: string | null;
};

type InstagramPost = {
  postUrl: string;
  postCode: string;
  imageUrl: string;
  caption: string | null;
  postedAt: string | null;
};

type SyncResult = {
  businessId: string | number;
  businessName: string;
  username: string | null;
  status: "success" | "skipped" | "failed";
  message: string;
  postUrl?: string;
};

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function normalizeInstagramUrl(value: string) {
  let url = value.trim();

  if (!url) {
    return null;
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);

    if (
      parsed.hostname !== "instagram.com" &&
      parsed.hostname !== "www.instagram.com"
    ) {
      return null;
    }

    const segments = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (segments.length === 0) {
      return null;
    }

    const username = segments[0]
      .replace(/^@/, "")
      .trim()
      .toLowerCase();

    const reservedPaths = new Set([
      "p",
      "reel",
      "reels",
      "stories",
      "explore",
      "accounts",
      "direct",
      "about",
      "developer",
    ]);

    if (!username || reservedPaths.has(username)) {
      return null;
    }

    return {
      username,
      profileUrl: `https://www.instagram.com/${username}/`,
    };
  } catch {
    return null;
  }
}

function sanitizePathPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getExtension(contentType: string | null) {
  const normalized = String(contentType || "").toLowerCase();

  if (normalized.includes("png")) {
    return "png";
  }

  if (normalized.includes("webp")) {
    return "webp";
  }

  return "jpg";
}

function getPostCode(postUrl: string) {
  try {
    const parsed = new URL(postUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (
      (
        segments[0] === "p" ||
        segments[0] === "reel" ||
        segments[0] === "reels" ||
        segments[0] === "tv"
      ) &&
      segments[1]
    ) {
      return segments[1];
    }
  } catch {
    // 아래 fallback 사용
  }

  return Buffer.from(postUrl)
    .toString("base64url")
    .slice(0, 60);
}

function normalizePostUrl(href: string) {
  try {
    const cleanedHref = String(href || "")
      .trim()
      .replaceAll("&amp;", "&");

    const parsed = new URL(
      cleanedHref,
      "https://www.instagram.com",
    );

    const hostname = parsed.hostname
      .replace(/^www\./, "")
      .toLowerCase();

    if (hostname !== "instagram.com") {
      return null;
    }

    /**
     * Instagram은 화면/계정에 따라 다음 경로를 사용할 수 있습니다.
     * /p/CODE/
     * /reel/CODE/
     * /reels/CODE/
     * /tv/CODE/
     */
    const pathSegments = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    const supportedTypes = new Set([
      "p",
      "reel",
      "reels",
      "tv",
    ]);

    let typeIndex = -1;

    for (let index = 0; index < pathSegments.length; index += 1) {
      if (supportedTypes.has(pathSegments[index].toLowerCase())) {
        typeIndex = index;
        break;
      }
    }

    if (
      typeIndex < 0 ||
      !pathSegments[typeIndex + 1]
    ) {
      return null;
    }

    const rawType =
      pathSegments[typeIndex].toLowerCase();

    const postCode =
      pathSegments[typeIndex + 1];

    const canonicalType =
      rawType === "p" ? "p" : "reel";

    return `https://www.instagram.com/${canonicalType}/${postCode}/`;
  } catch {
    return null;
  }
}

async function dismissInstagramDialogs(page: Page) {
  const possibleButtons = [
    "Allow all cookies",
    "Allow essential and optional cookies",
    "Decline optional cookies",
    "Not Now",
    "나중에 하기",
    "필수 쿠키만 허용",
    "모든 쿠키 허용",
  ];

  for (const buttonText of possibleButtons) {
    try {
      const button = page.getByRole("button", {
        name: buttonText,
        exact: true,
      });

      if (await button.isVisible({ timeout: 500 })) {
        await button.click({ timeout: 1000 });
        await page.waitForTimeout(500);
      }
    } catch {
      // 해당 버튼이 없으면 계속 진행
    }
  }
}

async function extractFirstVisiblePostTile(
  page: Page,
  profileUrl: string,
): Promise<InstagramPost> {
  await page.goto(profileUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await dismissInstagramDialogs(page);

  await page
    .waitForLoadState("networkidle", { timeout: 10000 })
    .catch(() => undefined);

  await page.waitForTimeout(2500);

  const pageTitle = await page.title().catch(() => "");

  const bodyText = await page
    .locator("body")
    .innerText({ timeout: 10000 })
    .catch(() => "");

  const combinedText =
    `${pageTitle}\n${bodyText}`.toLowerCase();

  if (
    combinedText.includes("page isn't available") ||
    combinedText.includes("sorry, this page") ||
    combinedText.includes("페이지를 사용할 수 없습니다")
  ) {
    throw new Error("Instagram 프로필을 찾을 수 없습니다.");
  }

  if (
    combinedText.includes("this account is private") ||
    combinedText.includes("비공개 계정입니다")
  ) {
    throw new Error("비공개 Instagram 계정입니다.");
  }

  const firstTile = page
    .locator(
      'main a[href*="/p/"]:has(img), main a[href*="/reel/"]:has(img)',
    )
    .first();

  await firstTile.waitFor({
    state: "visible",
    timeout: 20000,
  });

  const tileData = await firstTile.evaluate((element) => {
    const anchor = element as HTMLAnchorElement;
    const image = anchor.querySelector("img");

    if (!image) {
      return null;
    }

    const srcset = image.getAttribute("srcset") || "";

    const srcsetCandidates = srcset
      .split(",")
      .map((entry) => {
        const parts = entry.trim().split(/\s+/);
        const url = parts[0] || "";
        const widthText = parts[1] || "0w";
        const width = Number(widthText.replace("w", "")) || 0;

        return { url, width };
      })
      .filter((entry) => Boolean(entry.url))
      .sort((left, right) => right.width - left.width);

    return {
      href:
        anchor.href ||
        anchor.getAttribute("href"),
      imageUrl:
        srcsetCandidates[0]?.url ||
        image.currentSrc ||
        image.getAttribute("src"),
      alt: image.getAttribute("alt"),
    };
  });

  if (!tileData?.href) {
    throw new Error(
      "Instagram 첫 번째 게시물 링크를 찾지 못했습니다.",
    );
  }

  if (!tileData.imageUrl) {
    throw new Error(
      "Instagram 첫 번째 게시물 이미지를 찾지 못했습니다.",
    );
  }

  let postUrl: string | null = null;

  try {
    const parsedTileUrl = new URL(
      tileData.href,
      "https://www.instagram.com",
    );

    const segments = parsedTileUrl.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

    const postTypeIndex = segments.findIndex((segment) =>
      ["p", "reel", "reels", "tv"].includes(
        segment.toLowerCase(),
      ),
    );

    const postCode =
      postTypeIndex >= 0
        ? segments[postTypeIndex + 1]
        : null;

    if (postCode) {
      const rawType =
        segments[postTypeIndex].toLowerCase();

      const canonicalType =
        rawType === "p" ? "p" : "reel";

      postUrl =
        `https://www.instagram.com/${canonicalType}/${postCode}/`;
    }
  } catch {
    postUrl = null;
  }

  if (!postUrl) {
    throw new Error(
      `Instagram 첫 번째 게시물 URL을 해석하지 못했습니다: ${tileData.href}`,
    );
  }

  /**
   * 프로필 타일 이미지는 정사각형으로 잘린 썸네일입니다.
   * 첫 번째 게시물만 한 번 열어서 원본 비율의 og:image를 가져옵니다.
   */
  await page.goto(postUrl, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  await dismissInstagramDialogs(page);

  await page
    .waitForLoadState("networkidle", { timeout: 10000 })
    .catch(() => undefined);

  await page.waitForTimeout(2500);

  const postMetadata = await page.evaluate(() => {
    const getMetaContent = (
      selector: string,
    ): string | null =>
      document
        .querySelector(selector)
        ?.getAttribute("content") || null;

    const getLargestSrcsetUrl = (
      srcset: string | null,
    ): string | null => {
      if (!srcset) {
        return null;
      }

      const candidates = srcset
        .split(",")
        .map((entry) => {
          const parts = entry.trim().split(/\s+/);
          const url = parts[0] || "";
          const sizeText = parts[1] || "0w";
          const size =
            Number(sizeText.replace(/[wx]/g, "")) || 0;

          return { url, size };
        })
        .filter((candidate) => Boolean(candidate.url))
        .sort((left, right) => right.size - left.size);

      return candidates[0]?.url || null;
    };

    /**
     * 게시물 본문 안의 이미지 중 실제 표시 면적이 가장 큰 이미지를
     * 선택합니다. 프로필 사진과 작은 아이콘은 자동으로 제외됩니다.
     */
    const articleImages = Array.from(
      document.querySelectorAll("article img"),
    )
      .map((image) => {
        const img = image as HTMLImageElement;

        const rect = img.getBoundingClientRect();
        const naturalArea =
          (img.naturalWidth || 0) *
          (img.naturalHeight || 0);

        const visibleArea =
          Math.max(rect.width, 0) *
          Math.max(rect.height, 0);

        return {
          url:
            getLargestSrcsetUrl(
              img.getAttribute("srcset"),
            ) ||
            img.currentSrc ||
            img.getAttribute("src"),
          score:
            naturalArea > 0
              ? naturalArea
              : visibleArea,
          width: img.naturalWidth || rect.width,
          height: img.naturalHeight || rect.height,
        };
      })
      .filter(
        (candidate) =>
          Boolean(candidate.url) &&
          candidate.width >= 300 &&
          candidate.height >= 300,
      )
      .sort((left, right) => right.score - left.score);

    /**
     * Instagram 내부 JSON에 display_url이 있으면 원본 비율 이미지일
     * 가능성이 높으므로 보조 후보로 사용합니다.
     */
    const html = document.documentElement.innerHTML
      .replaceAll("\\u0026", "&")
      .replaceAll("\\u002F", "/")
      .replaceAll("\\/", "/");

    const displayUrlMatches = Array.from(
      html.matchAll(
        /"display_url"\s*:\s*"([^"]+)"/g,
      ),
    )
      .map((match) => match[1])
      .filter(Boolean);

    const articleTime =
      document
        .querySelector("article time")
        ?.getAttribute("datetime") ||
      document
        .querySelector("time")
        ?.getAttribute("datetime") ||
      null;

    return {
      imageUrl:
        articleImages[0]?.url ||
        displayUrlMatches[0] ||
        getMetaContent('meta[property="og:image"]') ||
        getMetaContent('meta[name="twitter:image"]'),
      caption:
        getMetaContent('meta[property="og:description"]') ||
        getMetaContent('meta[name="description"]'),
      postedAt: articleTime,
    };
  });

  return {
    postUrl,
    postCode: getPostCode(postUrl),
    imageUrl:
      postMetadata.imageUrl ||
      tileData.imageUrl,
    caption:
      postMetadata.caption ||
      tileData.alt ||
      null,
    postedAt:
      postMetadata.postedAt ||
      new Date().toISOString(),
  };
}

async function downloadImage(imageUrl: string) {
  const response = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/150.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://www.instagram.com/",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(
      `이미지 다운로드 실패: HTTP ${response.status}`,
    );
  }

  const contentType =
    response.headers.get("content-type") || "image/jpeg";

  if (!contentType.startsWith("image/")) {
    throw new Error(
      `이미지 형식이 아닙니다: ${contentType}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength === 0) {
    throw new Error("다운로드된 이미지가 비어 있습니다.");
  }

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

async function syncBusiness(
  browser: Browser,
  business: BusinessRecord,
): Promise<SyncResult> {
  const supabase = getSupabaseAdmin();

  const businessName =
    business.name?.trim() || `Business ${business.id}`;

  const instagram = business.instagram_url
    ? normalizeInstagramUrl(business.instagram_url)
    : null;

  if (!instagram) {
    return {
      businessId: business.id,
      businessName,
      username: null,
      status: "skipped",
      message: "올바른 Instagram 프로필 URL이 아닙니다.",
    };
  }

  const authFile = path.join(
    process.cwd(),
    "playwright",
    ".auth",
    "instagram.json",
  );

  if (!fs.existsSync(authFile)) {
    throw new Error(
      "Instagram 로그인 파일이 없습니다. scripts/instagram-login.ts를 먼저 실행하세요.",
    );
  }

  const context = await browser.newContext({
    storageState: authFile,
    viewport: {
      width: 1365,
      height: 900,
    },
    locale: "en-US",
    timezoneId: "America/New_York",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/150.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9," +
        "image/avif,image/webp,image/apng,*/*;q=0.8",
    },
  });
  const page = await context.newPage();

  try {
    /**
     * 프로필 화면에서 현재 보이는 첫 번째 타일의 링크와 이미지를
     * 직접 가져옵니다. 게시물 페이지를 여러 개 열지 않습니다.
     */
    const post = await extractFirstVisiblePostTile(
      page,
      instagram.profileUrl,
    );

    const latestPostUrl = post.postUrl;

    /**
     * 이미 저장된 첫 번째 게시물이면 이미지 다운로드 없이
     * 수집 시각과 상태만 갱신합니다.
     */
    const { data: existingPost, error: existingError } =
      await supabase
        .from("business_instagram_posts")
        .select(
          "id, instagram_post_url, posted_at, fetched_at, stored_image_url",
        )
        .eq("business_id", business.id)
        .eq("instagram_post_url", latestPostUrl)
        .maybeSingle();

    if (existingError) {
      throw new Error(
        `기존 게시물 확인 실패: ${existingError.message}`,
      );
    }

    /**
     * 첫 번째 게시물 URL이 이전 수집과 같으면 새 게시물이 아닙니다.
     *
     * fetched_at만 현재 시각으로 갱신하고 posted_at은 절대 바꾸지 않습니다.
     * Community는 posted_at 기준 최근 3일만 표시하므로 같은 게시물이
     * 계속 확인되더라도 최초 저장 후 3일이 지나면 자동으로 숨겨집니다.
     */
    if (existingPost) {
      const { error: touchError } = await supabase
        .from("business_instagram_posts")
        .update({
          fetched_at: new Date().toISOString(),
          status: "active",
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPost.id);

      if (touchError) {
        throw new Error(
          `기존 게시물 확인 시각 업데이트 실패: ${touchError.message}`,
        );
      }

      return {
        businessId: business.id,
        businessName,
        username: instagram.username,
        status: "success",
        message:
          "같은 게시물입니다. 게시 날짜는 유지하고 확인 날짜만 갱신했습니다.",
        postUrl: latestPostUrl,
      };
    }

    /**
     * 새로운 게시물일 때만 이미지를 다운로드하고 저장합니다.
     */
    const downloadedImage = await downloadImage(post.imageUrl);

    const extension = getExtension(
      downloadedImage.contentType,
    );

    const usernamePath =
      sanitizePathPart(instagram.username) ||
      `business-${business.id}`;

    const storagePath =
      `${usernamePath}/${post.postCode}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, downloadedImage.buffer, {
        contentType: downloadedImage.contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(
        `Storage 업로드 실패: ${uploadError.message}`,
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const now = new Date().toISOString();

    const { error: insertError } = await supabase
      .from("business_instagram_posts")
      .upsert(
        {
          business_id: business.id,
          instagram_username: instagram.username,
          instagram_post_id: post.postCode,
          instagram_post_url: post.postUrl,
          original_image_url: post.imageUrl,
          stored_image_url: publicUrl,
          caption: post.caption,
          posted_at: post.postedAt,
          fetched_at: now,
          status: "active",
          error_message: null,
          updated_at: now,
        },
        {
          onConflict: "instagram_post_url",
          ignoreDuplicates: false,
        },
      );

    if (insertError) {
      throw new Error(
        `게시물 DB 저장 실패: ${insertError.message}`,
      );
    }

    return {
      businessId: business.id,
      businessName,
      username: instagram.username,
      status: "success",
      message: "새 게시물을 저장했습니다.",
      postUrl: post.postUrl,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "알 수 없는 수집 오류";

    console.error(
      `[Instagram sync] ${businessName}:`,
      error,
    );

    return {
      businessId: business.id,
      businessName,
      username: instagram.username,
      status: "failed",
      message,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}

function isAuthorized(request: NextRequest) {
  const configuredSecret =
    process.env.INSTAGRAM_SYNC_SECRET;

  /**
   * 개발 환경에서는 브라우저에서 간단하게 테스트할 수 있게
   * secret이 설정되지 않은 경우 허용합니다.
   *
   * 배포 환경에서는 반드시 secret을 설정해야 합니다.
   */
  if (
    process.env.NODE_ENV !== "production" &&
    !configuredSecret
  ) {
    return true;
  }

  if (!configuredSecret) {
    return false;
  }

  const authorization =
    request.headers.get("authorization");

  const headerSecret =
    request.headers.get("x-cron-secret");

  const querySecret =
    request.nextUrl.searchParams.get("secret");

  return (
    authorization === `Bearer ${configuredSecret}` ||
    headerSecret === configuredSecret ||
    querySecret === configuredSecret
  );
}

async function runSync(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const supabase = getSupabaseAdmin();

  const requestedLimit = Number(
    request.nextUrl.searchParams.get("limit") ||
      DEFAULT_LIMIT,
  );

  const limit = Math.min(
    Math.max(
      Number.isFinite(requestedLimit)
        ? Math.floor(requestedLimit)
        : DEFAULT_LIMIT,
      1,
    ),
    100,
  );

  const requestedOffset = Number(
    request.nextUrl.searchParams.get("offset") || 0,
  );

  const offset = Math.max(
    Number.isFinite(requestedOffset)
      ? Math.floor(requestedOffset)
      : 0,
    0,
  );

  const startedAt = new Date().toISOString();

  const { data: logRow, error: logInsertError } =
    await supabase
      .from("instagram_sync_logs")
      .insert({
        started_at: startedAt,
        total_businesses: 0,
        successful_businesses: 0,
        failed_businesses: 0,
        new_posts: 0,
        status: "running",
      })
      .select("id")
      .single();

  if (logInsertError) {
    console.error(
      "Instagram sync log 생성 실패:",
      logInsertError,
    );
  }

  /**
   * 현재 businesses 테이블의 업체명 컬럼을 name으로 가정합니다.
   *
   * 업체명 컬럼이 business_name이라면 아래 select와
   * BusinessRecord의 name 부분만 바꿔야 합니다.
   */
  const { data: businesses, error: businessesError } =
    await supabase
      .from("businesses")
      .select("id, name, instagram_url")
      .not("instagram_url", "is", null)
      .neq("instagram_url", "")
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

  if (businessesError) {
    if (logRow?.id) {
      await supabase
        .from("instagram_sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          status: "failed",
          error_message: businessesError.message,
        })
        .eq("id", logRow.id);
    }

    return NextResponse.json(
      {
        ok: false,
        error: businessesError.message,
      },
      {
        status: 500,
      },
    );
  }

  const businessRows =
    (businesses || []) as BusinessRecord[];

  let browser: Browser | null = null;
  const results: SyncResult[] = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--no-zygote",
      ],
    });

    /**
     * Instagram 차단 가능성을 줄이기 위해 44개를 동시에
     * 요청하지 않고 하나씩 처리합니다.
     */
    for (
      let index = 0;
      index < businessRows.length;
      index += 1
    ) {
      const business = businessRows[index];

      const result = await syncBusiness(
        browser,
        business,
      );

      results.push(result);

      if (index < businessRows.length - 1) {
        await sleep(REQUEST_DELAY_MS);
      }
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Chromium 실행 오류";

    console.error("Instagram sync fatal error:", error);

    if (logRow?.id) {
      await supabase
        .from("instagram_sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          total_businesses: businessRows.length,
          successful_businesses: results.filter(
            (result) => result.status === "success",
          ).length,
          failed_businesses:
            businessRows.length -
            results.filter(
              (result) => result.status === "success",
            ).length,
          new_posts: results.filter(
            (result) =>
              result.message === "새 게시물을 저장했습니다.",
          ).length,
          status: "failed",
          error_message: message,
        })
        .eq("id", logRow.id);
    }

    return NextResponse.json(
      {
        ok: false,
        error: message,
        processed: results.length,
        results,
      },
      {
        status: 500,
      },
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }

  const successfulBusinesses = results.filter(
    (result) => result.status === "success",
  ).length;

  const skippedBusinesses = results.filter(
    (result) => result.status === "skipped",
  ).length;

  const failedBusinesses = results.filter(
    (result) => result.status === "failed",
  ).length;

  const newPosts = results.filter(
    (result) =>
      result.message === "새 게시물을 저장했습니다.",
  ).length;

  const finalStatus =
    failedBusinesses === 0
      ? "completed"
      : successfulBusinesses > 0
        ? "completed_with_errors"
        : "failed";

  if (logRow?.id) {
    const { error: logUpdateError } = await supabase
      .from("instagram_sync_logs")
      .update({
        completed_at: new Date().toISOString(),
        total_businesses: businessRows.length,
        successful_businesses: successfulBusinesses,
        failed_businesses: failedBusinesses,
        new_posts: newPosts,
        status: finalStatus,
        error_message:
          failedBusinesses > 0
            ? `${failedBusinesses}개 업체 수집 실패`
            : null,
      })
      .eq("id", logRow.id);

    if (logUpdateError) {
      console.error(
        "Instagram sync log 업데이트 실패:",
        logUpdateError,
      );
    }
  }

  return NextResponse.json({
    ok: failedBusinesses === 0,
    startedAt,
    completedAt: new Date().toISOString(),
    offset,
    requestedLimit: limit,
    totalProcessed: businessRows.length,
    successfulBusinesses,
    skippedBusinesses,
    failedBusinesses,
    newPosts,
    results,
  });
}

export async function GET(request: NextRequest) {
  return runSync(request);
}

export async function POST(request: NextRequest) {
  return runSync(request);
}