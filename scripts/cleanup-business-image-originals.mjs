import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없습니다.",
  );
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const BUCKET = "business-images";
const PAGE_SIZE = 100;

const args = process.argv.slice(2);

const deleteMode =
  args.includes("--delete");

const confirmed =
  args.includes("--confirm=DELETE-ORIGINALS");

if (deleteMode && !confirmed) {
  console.error(
    "실제 삭제하려면 --delete --confirm=DELETE-ORIGINALS를 같이 사용해야 합니다.",
  );

  process.exit(1);
}

function isOriginalImage(filePath) {
  return /\.(jpg|jpeg|png)$/i.test(filePath);
}

/*
 * 절대 삭제하면 안 되는 폴더입니다.
 *
 * _optimized:
 * 현재 businesses 테이블에서 사용하는 WebP 이미지
 *
 * flipbook-ads:
 * 플립북 광고 이미지
 */
function isProtectedFolder(filePath) {
  const normalizedPath =
    String(filePath ?? "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

  return (
    normalizedPath === "_optimized" ||
    normalizedPath.startsWith("_optimized/") ||
    normalizedPath === "flipbook-ads" ||
    normalizedPath.startsWith("flipbook-ads/")
  );
}

function getStoragePath(value) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const trimmed = value.trim();

  if (!/^https?:\/\//i.test(trimmed)) {
    try {
      return decodeURIComponent(trimmed)
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
    } catch {
      return trimmed
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
    }
  }

  try {
    const url = new URL(trimmed);

    const pathname =
      decodeURIComponent(url.pathname);

    const markers = [
      `/storage/v1/object/public/${BUCKET}/`,
      `/storage/v1/object/sign/${BUCKET}/`,
      `/storage/v1/render/image/public/${BUCKET}/`,
      `/storage/v1/render/image/sign/${BUCKET}/`,
    ];

    for (const marker of markers) {
      const index =
        pathname.indexOf(marker);

      if (index >= 0) {
        return pathname
          .slice(index + marker.length)
          .replace(/\\/g, "/")
          .replace(/^\/+/, "");
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function loadReferencedPaths() {
  const referenced = new Set();

  let from = 0;

  while (true) {
    const to =
      from + PAGE_SIZE - 1;

    const {
      data,
      error,
    } = await supabase
      .from("businesses")
      .select(
        "id,image_url,image_urls,flipbook_ad_image_url",
      )
      .range(from, to);

    if (error) {
      throw new Error(
        `DB 읽기 실패: ${error.message}`,
      );
    }

    const rows = data || [];

    for (const row of rows) {
      const values = [];

      if (
        typeof row.image_url === "string" &&
        row.image_url.trim()
      ) {
        values.push(row.image_url);
      }

      if (Array.isArray(row.image_urls)) {
        for (const value of row.image_urls) {
          if (
            typeof value === "string" &&
            value.trim()
          ) {
            values.push(value);
          }
        }
      }

      if (
        typeof row.flipbook_ad_image_url ===
          "string" &&
        row.flipbook_ad_image_url.trim()
      ) {
        values.push(
          row.flipbook_ad_image_url,
        );
      }

      for (const value of values) {
        const storagePath =
          getStoragePath(value);

        if (storagePath) {
          referenced.add(storagePath);
        }
      }
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return referenced;
}

async function listAllFiles(prefix = "") {
  const files = [];

  let offset = 0;

  while (true) {
    const {
      data,
      error,
    } = await supabase.storage
      .from(BUCKET)
      .list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

    if (error) {
      throw new Error(
        `Storage 목록 오류 (${prefix || "/"}): ${error.message}`,
      );
    }

    const items = data || [];

    for (const item of items) {
      const fullPath = prefix
        ? `${prefix}/${item.name}`
        : item.name;

      const isFolder =
        !item.id &&
        !item.metadata;

      if (isFolder) {
        const nested =
          await listAllFiles(fullPath);

        files.push(...nested);
      } else {
        files.push(
          fullPath
            .replace(/\\/g, "/")
            .replace(/^\/+/, ""),
        );
      }
    }

    if (items.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return files;
}

async function deleteFiles(paths) {
  let deleted = 0;
  let failed = 0;

  for (
    let index = 0;
    index < paths.length;
    index += 100
  ) {
    const batch =
      paths.slice(index, index + 100);

    const {
      data,
      error,
    } = await supabase.storage
      .from(BUCKET)
      .remove(batch);

    if (error) {
      failed += batch.length;

      console.error(
        `삭제 실패: ${error.message}`,
      );

      continue;
    }

    const removedCount =
      Array.isArray(data)
        ? data.length
        : batch.length;

    deleted += removedCount;

    for (const filePath of batch) {
      console.log(
        `DELETED ${filePath}`,
      );
    }
  }

  return {
    deleted,
    failed,
  };
}

async function main() {
  console.log(
    deleteMode
      ? "DELETE MODE"
      : "DRY RUN - 실제 삭제하지 않습니다.",
  );

  console.log(
    `Bucket: ${BUCKET}`,
  );

  console.log(
    "보호 폴더:",
  );

  console.log(
    "  - _optimized/",
  );

  console.log(
    "  - flipbook-ads/\n",
  );

  const referencedPaths =
    await loadReferencedPaths();

  const storageFiles =
    await listAllFiles();

  /*
   * JPG, JPEG, PNG 파일 중에서
   * 보호 폴더에 들어 있지 않은 파일만 검사합니다.
   */
  const originalFiles =
    storageFiles.filter(
      (filePath) =>
        isOriginalImage(filePath) &&
        !isProtectedFolder(filePath),
    );

  const protectedFiles =
    storageFiles.filter(
      (filePath) =>
        isOriginalImage(filePath) &&
        isProtectedFolder(filePath),
    );

  const stillReferenced = [];
  const safeDeleteCandidates = [];

  for (const filePath of originalFiles) {
    if (
      referencedPaths.has(filePath)
    ) {
      stillReferenced.push(filePath);
    } else {
      safeDeleteCandidates.push(filePath);
    }
  }

  console.log(
    "===== PROTECTED JPG/PNG - NEVER DELETE =====",
  );

  if (protectedFiles.length === 0) {
    console.log("(none)");
  } else {
    for (const filePath of protectedFiles) {
      console.log(
        `PROTECTED ${filePath}`,
      );
    }
  }

  console.log(
    "\n===== STILL REFERENCED - KEEP =====",
  );

  if (stillReferenced.length === 0) {
    console.log("(none)");
  } else {
    for (const filePath of stillReferenced) {
      console.log(
        `KEEP ${filePath}`,
      );
    }
  }

  console.log(
    "\n===== SAFE DELETE CANDIDATES =====",
  );

  if (safeDeleteCandidates.length === 0) {
    console.log("(none)");
  } else {
    for (
      const filePath
      of safeDeleteCandidates
    ) {
      console.log(
        `${deleteMode ? "DELETE" : "DRY DELETE"} ${filePath}`,
      );
    }
  }

  let deleted = 0;
  let failed = 0;

  if (
    deleteMode &&
    safeDeleteCandidates.length > 0
  ) {
    const result =
      await deleteFiles(
        safeDeleteCandidates,
      );

    deleted = result.deleted;
    failed = result.failed;
  }

  console.log(
    "\n===== RESULT =====",
  );

  console.log(
    `Storage files scanned:        ${storageFiles.length}`,
  );

  console.log(
    `Protected JPG/PNG kept:        ${protectedFiles.length}`,
  );

  console.log(
    `Non-protected JPG/PNG found:   ${originalFiles.length}`,
  );

  console.log(
    `Still referenced (kept):      ${stillReferenced.length}`,
  );

  console.log(
    `Safe delete candidates:       ${safeDeleteCandidates.length}`,
  );

  console.log(
    `Deleted:                      ${deleted}`,
  );

  console.log(
    `Delete failures:              ${failed}`,
  );

  if (!deleteMode) {
    console.log(
      "\n아직 아무 파일도 삭제하지 않았습니다.",
    );

    console.log(
      "목록에 flipbook-ads/ 파일이 삭제 대상으로 나오지 않는지 확인하세요.",
    );
  }
}

main().catch((error) => {
  console.error(
    "오류:",
    error?.message || error,
  );

  process.exit(1);
});