import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import crypto from "node:crypto";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

const BUCKET = "business-images";
const OPTIMIZED_FOLDER = "_optimized";
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const QUALITY = 82;
const PAGE_SIZE = 200;

const stats = {
  businesses: 0,
  uniqueImages: 0,
  optimized: 0,
  skipped: 0,
  failed: 0,
  dbUpdated: 0,
  bytesBefore: 0,
  bytesAfter: 0,
};

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** unitIndex).toFixed(2)} ${units[unitIndex]}`;
}

function getStoragePath(urlValue) {
  if (!urlValue || typeof urlValue !== "string") return null;

  if (!urlValue.startsWith("http")) {
    return urlValue.replace(/^\/+/, "");
  }

  try {
    const url = new URL(urlValue);
    const decodedPath = decodeURIComponent(url.pathname);

    const markers = [
      `/storage/v1/object/public/${BUCKET}/`,
      `/storage/v1/object/sign/${BUCKET}/`,
      `/storage/v1/render/image/public/${BUCKET}/`,
    ];

    for (const marker of markers) {
      const markerIndex = decodedPath.indexOf(marker);

      if (markerIndex >= 0) {
        return decodedPath
          .slice(markerIndex + marker.length)
          .replace(/^\/+/, "");
      }
    }

    return null;
  } catch {
    return null;
  }
}

function isSupportedImage(path) {
  return /\.(jpg|jpeg|png|webp|avif|heic|heif)$/i.test(path);
}

function createOptimizedPath(originalPath) {
  const cleanPath = originalPath.replace(/^\/+/, "");
  const fileWithoutExtension = cleanPath.replace(/\.[^.]+$/, "");
  const hash = crypto
    .createHash("sha1")
    .update(cleanPath)
    .digest("hex")
    .slice(0, 10);

  return `${OPTIMIZED_FOLDER}/${fileWithoutExtension}-${hash}.webp`;
}

function replaceUrlValue(value, replacements) {
  if (typeof value !== "string") return value;

  const storagePath = getStoragePath(value);
  if (!storagePath) return value;

  return replacements.get(storagePath) || value;
}

async function loadBusinesses() {
  const allRows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("businesses")
      .select("id, image_url, image_urls, flipbook_ad_image_url")
      .range(from, to);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...data);

    if (limit && allRows.length >= limit) {
      return allRows.slice(0, limit);
    }

    if (data.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allRows;
}

async function optimizeImage(originalPath) {
  if (originalPath.startsWith(`${OPTIMIZED_FOLDER}/`)) {
    stats.skipped++;
    return null;
  }

  if (!isSupportedImage(originalPath)) {
    console.log(`SKIP unsupported: ${originalPath}`);
    stats.skipped++;
    return null;
  }

  const { data: downloadedFile, error: downloadError } =
    await supabase.storage.from(BUCKET).download(originalPath);

  if (downloadError || !downloadedFile) {
    throw new Error(
      `다운로드 실패: ${downloadError?.message || originalPath}`,
    );
  }

  const originalBuffer = Buffer.from(await downloadedFile.arrayBuffer());

  const metadata = await sharp(originalBuffer, {
    failOn: "none",
  }).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`이미지 크기를 읽을 수 없음: ${originalPath}`);
  }

  if (
    metadata.width <= MAX_WIDTH &&
    metadata.height <= MAX_HEIGHT &&
    originalBuffer.length <= 500 * 1024
  ) {
    console.log(
      `SKIP already small: ${originalPath} ` +
        `(${metadata.width}x${metadata.height}, ${formatBytes(originalBuffer.length)})`,
    );

    stats.skipped++;
    return null;
  }

  const optimizedBuffer = await sharp(originalBuffer, {
    failOn: "none",
  })
    .rotate()
    .resize({
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: QUALITY,
      effort: 5,
      smartSubsample: true,
    })
    .toBuffer();

  if (optimizedBuffer.length >= originalBuffer.length) {
    console.log(
      `SKIP no savings: ${originalPath} ` +
        `(${formatBytes(originalBuffer.length)} → ${formatBytes(optimizedBuffer.length)})`,
    );

    stats.skipped++;
    return null;
  }

  const optimizedPath = createOptimizedPath(originalPath);

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(optimizedPath);

  const optimizedUrl = publicUrlData.publicUrl;

  stats.bytesBefore += originalBuffer.length;
  stats.bytesAfter += optimizedBuffer.length;

  if (dryRun) {
    console.log(
      `DRY ${originalPath}: ` +
        `${metadata.width}x${metadata.height}, ` +
        `${formatBytes(originalBuffer.length)} → ` +
        `${formatBytes(optimizedBuffer.length)}`,
    );

    stats.optimized++;

    return {
      originalPath,
      optimizedPath,
      optimizedUrl,
    };
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(optimizedPath, optimizedBuffer, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`WebP 업로드 실패: ${uploadError.message}`);
  }

  console.log(
    `OK ${originalPath}: ` +
      `${formatBytes(originalBuffer.length)} → ` +
      `${formatBytes(optimizedBuffer.length)}`,
  );

  stats.optimized++;

  return {
    originalPath,
    optimizedPath,
    optimizedUrl,
  };
}

async function updateBusinessRow(business, replacements) {
  const newImageUrl = replaceUrlValue(
    business.image_url,
    replacements,
  );

  const newImageUrls = Array.isArray(business.image_urls)
    ? business.image_urls.map((url) =>
        replaceUrlValue(url, replacements),
      )
    : business.image_urls;

  const newFlipbookUrl = replaceUrlValue(
    business.flipbook_ad_image_url,
    replacements,
  );

  const hasChanges =
    newImageUrl !== business.image_url ||
    JSON.stringify(newImageUrls) !==
      JSON.stringify(business.image_urls) ||
    newFlipbookUrl !== business.flipbook_ad_image_url;

  if (!hasChanges) return;

  if (dryRun) {
    console.log(`DRY DB update business: ${business.id}`);
    stats.dbUpdated++;
    return;
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      image_url: newImageUrl,
      image_urls: newImageUrls,
      flipbook_ad_image_url: newFlipbookUrl,
    })
    .eq("id", business.id);

  if (error) {
    throw new Error(
      `Business ${business.id} DB 업데이트 실패: ${error.message}`,
    );
  }

  console.log(`DB UPDATED business: ${business.id}`);
  stats.dbUpdated++;
}

async function main() {
  console.log(
    `${dryRun ? "DRY RUN" : "START"} — ` +
      `bucket=${BUCKET}, folder=${OPTIMIZED_FOLDER}, ` +
      `max=${MAX_WIDTH}x${MAX_HEIGHT}, quality=${QUALITY}`,
  );

  const businesses = await loadBusinesses();
  stats.businesses = businesses.length;

  const uniquePaths = new Set();

  for (const business of businesses) {
    const values = [];

    if (business.image_url) {
      values.push(business.image_url);
    }

    if (Array.isArray(business.image_urls)) {
      values.push(...business.image_urls);
    }

    if (business.flipbook_ad_image_url) {
      values.push(business.flipbook_ad_image_url);
    }

    for (const value of values) {
      const path = getStoragePath(value);

      if (path && !path.startsWith(`${OPTIMIZED_FOLDER}/`)) {
        uniquePaths.add(path);
      }
    }
  }

  stats.uniqueImages = uniquePaths.size;

  console.log(
    `Businesses: ${stats.businesses}, ` +
      `unique image files: ${stats.uniqueImages}`,
  );

  const replacements = new Map();

  for (const originalPath of uniquePaths) {
    try {
      const result = await optimizeImage(originalPath);

      if (result) {
        replacements.set(
          result.originalPath,
          result.optimizedUrl,
        );
      }
    } catch (error) {
      stats.failed++;

      console.error(
        `FAIL ${originalPath}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  for (const business of businesses) {
    try {
      await updateBusinessRow(business, replacements);
    } catch (error) {
      stats.failed++;

      console.error(
        error instanceof Error ? error.message : error,
      );
    }
  }

  const savedBytes =
    stats.bytesBefore - stats.bytesAfter;

  const savedPercent =
    stats.bytesBefore > 0
      ? (savedBytes / stats.bytesBefore) * 100
      : 0;

  console.log("\n===== RESULT =====");
  console.log(`Businesses scanned: ${stats.businesses}`);
  console.log(`Unique files:       ${stats.uniqueImages}`);
  console.log(`Optimized:          ${stats.optimized}`);
  console.log(`Skipped:            ${stats.skipped}`);
  console.log(`DB rows updated:    ${stats.dbUpdated}`);
  console.log(`Failed:             ${stats.failed}`);
  console.log(`Before:             ${formatBytes(stats.bytesBefore)}`);
  console.log(`After:              ${formatBytes(stats.bytesAfter)}`);
  console.log(
    `Saved:              ${formatBytes(savedBytes)} ` +
      `(${savedPercent.toFixed(1)}%)`,
  );

  if (dryRun) {
    console.log(
      "\nNo Storage files or database rows were changed because --dry-run was used.",
    );
  }

  if (stats.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});