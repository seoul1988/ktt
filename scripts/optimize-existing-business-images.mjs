/**
 * Optimize all existing business images stored in Supabase Storage.
 *
 * Required environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
 *
 * Install:
 *   npm install sharp @supabase/supabase-js
 *
 * Dry run:
 *   node scripts/optimize-existing-business-images.mjs --dry-run
 *
 * Execute:
 *   node scripts/optimize-existing-business-images.mjs
 *
 * Options:
 *   --limit=50
 *   --no-backup
 *   --force
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import crypto from "node:crypto";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const backupEnabled = !args.has("--no-backup");
const force = args.has("--force");
const limitArg = [...args].find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1])) : null;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const BUCKET = "business-images";
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 1600;
const WEBP_QUALITY = 82;
const BACKUP_PREFIX = "_original-backup";
const PAGE_SIZE = 200;

const stats = {
  businesses: 0,
  urlsFound: 0,
  uniqueFiles: 0,
  optimized: 0,
  skipped: 0,
  failed: 0,
  bytesBefore: 0,
  bytesAfter: 0,
};

function humanBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function isSupportedImage(path) {
  return /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(path);
}

function decodeStoragePath(value) {
  if (!value || typeof value !== "string") return null;

  // Also accept a raw storage path.
  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, "");
  }

  try {
    const url = new URL(value);
    const pathname = decodeURIComponent(url.pathname);

    const publicMarker = `/storage/v1/object/public/${BUCKET}/`;
    const signedMarker = `/storage/v1/object/sign/${BUCKET}/`;
    const renderMarker = `/storage/v1/render/image/public/${BUCKET}/`;

    for (const marker of [publicMarker, signedMarker, renderMarker]) {
      const index = pathname.indexOf(marker);
      if (index >= 0) {
        return pathname.slice(index + marker.length).replace(/^\/+/, "");
      }
    }

    return null;
  } catch {
    return null;
  }
}

function collectImageUrls(row) {
  const values = [];

  if (typeof row.image_url === "string" && row.image_url.trim()) {
    values.push(row.image_url.trim());
  }

  if (Array.isArray(row.image_urls)) {
    for (const value of row.image_urls) {
      if (typeof value === "string" && value.trim()) values.push(value.trim());
    }
  }

  if (
    typeof row.flipbook_ad_image_url === "string" &&
    row.flipbook_ad_image_url.trim()
  ) {
    values.push(row.flipbook_ad_image_url.trim());
  }

  return values;
}

async function getAllBusinesses() {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("businesses")
      .select("id, image_url, image_urls, flipbook_ad_image_url")
      .range(from, to);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...data);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;

    if (limit && rows.length >= limit) break;
  }

  return limit ? rows.slice(0, limit) : rows;
}

async function backupOriginal(path, originalBuffer, contentType) {
  if (!backupEnabled) return;

  const backupPath = `${BACKUP_PREFIX}/${path}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(backupPath, originalBuffer, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });

  // Existing backup is safe to keep.
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Backup failed for ${path}: ${error.message}`);
  }
}

async function optimizeOne(path) {
  if (!isSupportedImage(path)) {
    stats.skipped += 1;
    console.log(`SKIP unsupported: ${path}`);
    return;
  }

  const { data, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(path);

  if (downloadError || !data) {
    throw new Error(downloadError?.message || `Download failed: ${path}`);
  }

  const originalBuffer = Buffer.from(await data.arrayBuffer());
  const metadata = await sharp(originalBuffer, { failOn: "none" }).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read image dimensions: ${path}`);
  }

  const alreadySmall =
    metadata.width <= MAX_WIDTH &&
    metadata.height <= MAX_HEIGHT &&
    originalBuffer.length <= 500 * 1024;

  if (alreadySmall && !force) {
    stats.skipped += 1;
    console.log(
      `SKIP already small: ${path} (${metadata.width}x${metadata.height}, ${humanBytes(originalBuffer.length)})`,
    );
    return;
  }

  const optimizedBuffer = await sharp(originalBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: WEBP_QUALITY,
      effort: 5,
      smartSubsample: true,
    })
    .toBuffer();

  // Do not overwrite when conversion makes the file larger unless --force.
  if (optimizedBuffer.length >= originalBuffer.length && !force) {
    stats.skipped += 1;
    console.log(
      `SKIP no savings: ${path} (${humanBytes(originalBuffer.length)} → ${humanBytes(optimizedBuffer.length)})`,
    );
    return;
  }

  stats.bytesBefore += originalBuffer.length;
  stats.bytesAfter += optimizedBuffer.length;

  if (dryRun) {
    stats.optimized += 1;
    console.log(
      `DRY ${path}: ${metadata.width}x${metadata.height}, ${humanBytes(originalBuffer.length)} → ${humanBytes(optimizedBuffer.length)}`,
    );
    return;
  }

  const originalContentType = data.type || "application/octet-stream";
  await backupOriginal(path, originalBuffer, originalContentType);

  // Keep the same object path so existing database URLs remain valid.
  // Content type becomes image/webp even when the old filename ends in .jpg/.png.
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, optimizedBuffer, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Overwrite failed for ${path}: ${uploadError.message}`);
  }

  stats.optimized += 1;
  console.log(
    `OK ${path}: ${metadata.width}x${metadata.height}, ${humanBytes(originalBuffer.length)} → ${humanBytes(optimizedBuffer.length)}`,
  );
}

async function main() {
  console.log(
    `${dryRun ? "DRY RUN" : "START"} — bucket=${BUCKET}, backup=${backupEnabled}, max=${MAX_WIDTH}x${MAX_HEIGHT}, quality=${WEBP_QUALITY}`,
  );

  const businesses = await getAllBusinesses();
  stats.businesses = businesses.length;

  const paths = new Set();

  for (const business of businesses) {
    const urls = collectImageUrls(business);
    stats.urlsFound += urls.length;

    for (const value of urls) {
      const path = decodeStoragePath(value);
      if (path && !path.startsWith(`${BACKUP_PREFIX}/`)) {
        paths.add(path);
      }
    }
  }

  stats.uniqueFiles = paths.size;

  console.log(
    `Businesses: ${stats.businesses}, URL references: ${stats.urlsFound}, unique files: ${stats.uniqueFiles}`,
  );

  for (const path of paths) {
    try {
      await optimizeOne(path);
    } catch (error) {
      stats.failed += 1;
      console.error(`FAIL ${path}:`, error instanceof Error ? error.message : error);
    }
  }

  const saved = stats.bytesBefore - stats.bytesAfter;
  const percent =
    stats.bytesBefore > 0 ? (saved / stats.bytesBefore) * 100 : 0;

  console.log("\n===== RESULT =====");
  console.log(`Businesses scanned: ${stats.businesses}`);
  console.log(`Unique files:       ${stats.uniqueFiles}`);
  console.log(`Optimized:          ${stats.optimized}`);
  console.log(`Skipped:            ${stats.skipped}`);
  console.log(`Failed:             ${stats.failed}`);
  console.log(`Before:             ${humanBytes(stats.bytesBefore)}`);
  console.log(`After:              ${humanBytes(stats.bytesAfter)}`);
  console.log(`Saved:              ${humanBytes(saved)} (${percent.toFixed(1)}%)`);

  if (dryRun) {
    console.log("\nNo files were changed because --dry-run was used.");
  }

  if (stats.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});