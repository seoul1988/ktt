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
 * 특정 업체 한 곳 테스트:
 *   /api/instagram-sync?businessId=83&secret=YOUR_SECRET
 *
 * 로컬 배치 테스트:
 *   /api/instagram-sync?limit=1
 *
 * 실제 배치 실행:
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
  detectedImageUrl?: string;
  detectedPostedAt?: string | null;
  imageCompareKey?: string;
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


/**
 * Instagram CDN URL은 같은 이미지라도 만료시간과 서명 파라미터가
 * 계속 바뀔 수 있습니다.
 *
 * 비교할 때는 query string을 제거하고 실제 이미지 파일 경로만 사용합니다.
 */
function normalizeImageUrlForCompare(
  value: string | null | undefined,
) {
  const url = String(value || "").trim();

  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);

    return `${parsed.hostname.toLowerCase()}${parsed.pathname}`;
  } catch {
    return url.split("?")[0].trim().toLowerCase();
  }
}



/**
 * Supabase Storage public URL에서 bucket 내부 파일 경로만 추출합니다.
 *
 * 예:
 * https://.../storage/v1/object/public/business-instagram/korea_t0wn/file.jpg
 * → korea_t0wn/file.jpg
 */
function getStorageObjectPath(
  publicUrl: string | null | undefined,
) {
  const value = String(publicUrl || "").trim();

  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);

    const marker =
      `/storage/v1/object/public/${STORAGE_BUCKET}/`;

    const markerIndex =
      parsed.pathname.indexOf(marker);

    if (markerIndex < 0) {
      return null;
    }

    const objectPath =
      parsed.pathname.slice(
        markerIndex + marker.length,
      );

    return decodeURIComponent(objectPath) || null;
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

  const postTiles = page.locator(
    'main a[href*="/p/"]:has(img), ' +
      'main a[href*="/reel/"]:has(img), ' +
      'main a[href*="/reels/"]:has(img)',
  );

  await postTiles.first().waitFor({
    state: "visible",
    timeout: 20000,
  });

  /**
   * locator.first()는 화면에서 맨 위에 보이는 게시물이 아니라
   * Instagram DOM에 먼저 들어 있는 링크를 선택할 수 있습니다.
   *
   * 따라서 현재 화면에 실제로 보이는 게시물 타일들을 모두 읽고,
   * 화면 좌표(top → left) 기준으로 가장 위·왼쪽 타일을 선택합니다.
   * 고정 게시물이 없는 일반 프로필에서는 이 타일이 최신 게시물입니다.
   */
  const tileData = await postTiles.evaluateAll((elements) => {
    const candidates = elements
      .map((element) => {
        const anchor = element as HTMLAnchorElement;
        const image = anchor.querySelector("img");

        if (!image) {
          return null;
        }

        const rect = anchor.getBoundingClientRect();

        if (
          rect.width <= 0 ||
          rect.height <= 0 ||
          rect.bottom <= 0 ||
          rect.right <= 0
        ) {
          return null;
        }

        const srcset = image.getAttribute("srcset") || "";

        const srcsetCandidates = srcset
          .split(",")
          .map((entry) => {
            const parts = entry.trim().split(/\s+/);
            const url = parts[0] || "";
            const widthText = parts[1] || "0w";
            const width =
              Number(widthText.replace(/[wx]/g, "")) || 0;

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
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
      })
      .filter(
        (
          candidate,
        ): candidate is {
          href: string | null;
          imageUrl: string | null;
          alt: string | null;
          top: number;
          left: number;
          width: number;
          height: number;
        } => Boolean(candidate?.href),
      )
      .sort((left, right) => {
        const rowDifference = left.top - right.top;

        // 같은 줄에서 약간의 좌표 오차가 있어도 왼쪽 순서를 사용합니다.
        if (Math.abs(rowDifference) <= 12) {
          return left.left - right.left;
        }

        return rowDifference;
      });

    return candidates[0] || null;
  });

  if (!tileData?.href) {
    throw new Error(
      "Instagram 화면의 최신 게시물 링크를 찾지 못했습니다.",
    );
  }

  if (!tileData.imageUrl) {
    throw new Error(
      "Instagram 화면의 최신 게시물 이미지를 찾지 못했습니다.",
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
      `Instagram 최신 게시물 URL을 해석하지 못했습니다: ${tileData.href}`,
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
     * URL만으로 같은 게시물인지 판단하면 Instagram DOM이 이전 링크를
     * 재사용하는 경우 최신 이미지가 저장되지 않을 수 있습니다.
     *
     * 따라서 해당 업체의 최근 저장 기록을 가져온 뒤 게시물 URL과
     * 원본 이미지 파일 경로를 함께 비교합니다.
     */
    const { data: existingPosts, error: existingError } =
      await supabase
        .from("business_instagram_posts")
        .select(
          "id, instagram_post_url, original_image_url, posted_at, fetched_at, stored_image_url",
        )
        .eq("business_id", business.id)
        .order("fetched_at", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(20);

    if (existingError) {
      throw new Error(
        `기존 게시물 확인 실패: ${existingError.message}`,
      );
    }

    const detectedImageKey =
      normalizeImageUrlForCompare(post.imageUrl);

    const exactExistingPost =
      (existingPosts || []).find((item) => {
        const samePostUrl =
          item.instagram_post_url === latestPostUrl;

        const sameImage =
          normalizeImageUrlForCompare(
            item.original_image_url,
          ) === detectedImageKey;

        return samePostUrl && sameImage;
      });

    /**
     * 게시물 URL과 이미지 파일 경로가 모두 같을 때만 같은 게시물입니다.
     * 이때는 이미지 다운로드 없이 확인 시각만 갱신합니다.
     */
    if (exactExistingPost) {
      const now = new Date().toISOString();

      const { error: touchError } = await supabase
        .from("business_instagram_posts")
        .update({
          fetched_at: now,
          status: "active",
          error_message: null,
          updated_at: now,
        })
        .eq("id", exactExistingPost.id);

      if (touchError) {
        throw new Error(
          `기존 게시물 확인 시각 업데이트 실패: ${touchError.message}`,
        );
      }

      /**
       * 최신 행이 이미 저장돼 있더라도 이전 행이 남아 있다면
       * 최신 행을 제외한 나머지를 즉시 삭제합니다.
       */
      const oldRows =
        (existingPosts || []).filter(
          (item) =>
            item.id !== exactExistingPost.id,
        );

      if (oldRows.length > 0) {
        const oldRowIds = oldRows.map(
          (item) => item.id,
        );

        const { error: deleteOldRowsError } =
          await supabase
            .from("business_instagram_posts")
            .delete()
            .in("id", oldRowIds);

        if (deleteOldRowsError) {
          throw new Error(
            `이전 게시물 DB 삭제 실패: ${deleteOldRowsError.message}`,
          );
        }

        const currentStoragePath =
          getStorageObjectPath(
            exactExistingPost.stored_image_url,
          );

        const oldStoragePaths = Array.from(
          new Set(
            oldRows
              .map((item) =>
                getStorageObjectPath(
                  item.stored_image_url,
                ),
              )
              .filter(
                (storagePath): storagePath is string =>
                  Boolean(storagePath) &&
                  storagePath !== currentStoragePath,
              ),
          ),
        );

        if (oldStoragePaths.length > 0) {
          const { error: storageDeleteError } =
            await supabase.storage
              .from(STORAGE_BUCKET)
              .remove(oldStoragePaths);

          if (storageDeleteError) {
            console.error(
              `[Instagram sync] 이전 Storage 이미지 삭제 실패 (${businessName}):`,
              storageDeleteError,
            );
          }
        }
      }

      return {
        businessId: business.id,
        businessName,
        username: instagram.username,
        status: "success",
        message:
          oldRows.length > 0
            ? `최신 게시물을 유지하고 이전 게시물 ${oldRows.length}개를 삭제했습니다.`
            : "게시물 URL과 이미지가 모두 같습니다. 확인 날짜만 갱신했습니다.",
        postUrl: latestPostUrl,
        detectedImageUrl: post.imageUrl,
        detectedPostedAt: post.postedAt,
        imageCompareKey: detectedImageKey,
      };
    }

    /**
     * URL이 같아도 이미지 파일 경로가 다르면 최신 이미지로 판단합니다.
     * 아래 저장 과정에서 Storage와 DB 내용을 새 이미지로 덮어씁니다.
     */

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

    const imageFileName = (() => {
      try {
        const parsedImageUrl = new URL(post.imageUrl);
        const fileName =
          parsedImageUrl.pathname
            .split("/")
            .filter(Boolean)
            .pop() || "";

        return sanitizePathPart(
          fileName.replace(/\.[a-z0-9]+$/i, ""),
        );
      } catch {
        return "";
      }
    })();

    const storageFileKey =
      imageFileName
        ? `${post.postCode}-${imageFileName}`
        : post.postCode;

    const storagePath =
      `${usernamePath}/${storageFileKey}.${extension}`;

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

    const {
      data: savedPost,
      error: insertError,
    } = await supabase
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
      )
      .select("id, stored_image_url")
      .single();

    if (insertError || !savedPost) {
      throw new Error(
        `게시물 DB 저장 실패: ${
          insertError?.message ||
          "저장된 게시물 정보를 받지 못했습니다."
        }`,
      );
    }

    /**
     * 각 업체는 최신 Instagram 게시물 한 개만 유지합니다.
     *
     * 새 게시물 저장이 성공한 뒤 같은 business_id의 이전 행을 모두
     * 삭제합니다. 이렇게 하면 화면 쿼리의 정렬 방식과 관계없이
     * 항상 최신 게시물 한 개만 표시됩니다.
     */
    const { data: oldPosts, error: oldPostsError } =
      await supabase
        .from("business_instagram_posts")
        .select("id, stored_image_url")
        .eq("business_id", business.id)
        .neq("id", savedPost.id);

    if (oldPostsError) {
      throw new Error(
        `이전 게시물 조회 실패: ${oldPostsError.message}`,
      );
    }

    const oldPostRows = oldPosts || [];

    if (oldPostRows.length > 0) {
      const oldPostIds = oldPostRows.map(
        (item) => item.id,
      );

      const { error: deleteRowsError } =
        await supabase
          .from("business_instagram_posts")
          .delete()
          .in("id", oldPostIds);

      if (deleteRowsError) {
        throw new Error(
          `이전 게시물 DB 삭제 실패: ${deleteRowsError.message}`,
        );
      }

      /**
       * 이전 DB 행이 삭제된 뒤 사용하지 않는 Storage 이미지도
       * 정리합니다. 현재 저장한 이미지 경로는 절대 삭제하지 않습니다.
       */
      const currentStoragePath =
        getStorageObjectPath(
          savedPost.stored_image_url,
        );

      const oldStoragePaths = Array.from(
        new Set(
          oldPostRows
            .map((item) =>
              getStorageObjectPath(
                item.stored_image_url,
              ),
            )
            .filter(
              (storagePath): storagePath is string =>
                Boolean(storagePath) &&
                storagePath !== currentStoragePath,
            ),
        ),
      );

      if (oldStoragePaths.length > 0) {
        const { error: storageDeleteError } =
          await supabase.storage
            .from(STORAGE_BUCKET)
            .remove(oldStoragePaths);

        if (storageDeleteError) {
          /**
           * 최신 DB 행 저장은 이미 성공했으므로 Storage 정리 실패는
           * 전체 동기화를 실패 처리하지 않고 로그만 남깁니다.
           */
          console.error(
            `[Instagram sync] 이전 Storage 이미지 삭제 실패 (${businessName}):`,
            storageDeleteError,
          );
        }
      }
    }

    return {
      businessId: business.id,
      businessName,
      username: instagram.username,
      status: "success",
      message:
        oldPostRows.length > 0
          ? `새 게시물을 저장하고 이전 게시물 ${oldPostRows.length}개를 삭제했습니다.`
          : "새 게시물을 저장했습니다.",
      postUrl: post.postUrl,
      detectedImageUrl: post.imageUrl,
      detectedPostedAt: post.postedAt,
      imageCompareKey: detectedImageKey,
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

  /**
   * 특정 업체 하나만 동기화할 때 사용합니다.
   *
   * 예:
   *   /api/instagram-sync?businessId=83&secret=YOUR_SECRET
   *
   * businessId가 있으면 limit과 offset은 무시됩니다.
   */
  const businessIdParam =
    request.nextUrl.searchParams.get("businessId");

  const requestedBusinessId =
    businessIdParam !== null && businessIdParam.trim() !== ""
      ? Number(businessIdParam)
      : null;

  if (
    requestedBusinessId !== null &&
    (
      !Number.isFinite(requestedBusinessId) ||
      !Number.isInteger(requestedBusinessId) ||
      requestedBusinessId <= 0
    )
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "businessId는 1 이상의 올바른 정수여야 합니다.",
      },
      {
        status: 400,
      },
    );
  }

  const businessId =
    requestedBusinessId !== null
      ? requestedBusinessId
      : null;

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
  let businessesQuery = supabase
    .from("businesses")
    .select("id, name, instagram_url")
    .not("instagram_url", "is", null)
    .neq("instagram_url", "");

  if (businessId !== null) {
    /**
     * businessId가 전달되면 해당 업체 한 곳만 가져옵니다.
     * 이 경우 limit과 offset은 사용하지 않습니다.
     */
    businessesQuery = businessesQuery.eq(
      "id",
      businessId,
    );
  } else {
    /**
     * businessId가 없을 때만 기존의 limit/offset 방식으로
     * 여러 업체를 순차 처리합니다.
     */
    businessesQuery = businessesQuery
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
  }

  const {
    data: businesses,
    error: businessesError,
  } = await businessesQuery;

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

  if (
    businessId !== null &&
    businessRows.length === 0
  ) {
    const message =
      `Instagram URL이 등록된 Business ${businessId}를 찾지 못했습니다.`;

    if (logRow?.id) {
      await supabase
        .from("instagram_sync_logs")
        .update({
          completed_at: new Date().toISOString(),
          total_businesses: 0,
          successful_businesses: 0,
          failed_businesses: 0,
          new_posts: 0,
          status: "failed",
          error_message: message,
        })
        .eq("id", logRow.id);
    }

    return NextResponse.json(
      {
        ok: false,
        businessId,
        error: message,
      },
      {
        status: 404,
      },
    );
  }

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
              result.message.startsWith("새 게시물을 저장"),
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
      result.message.startsWith("새 게시물을 저장"),
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
    mode:
      businessId !== null
        ? "single-business"
        : "batch",
    businessId,
    offset:
      businessId !== null
        ? null
        : offset,
    requestedLimit:
      businessId !== null
        ? 1
        : limit,
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