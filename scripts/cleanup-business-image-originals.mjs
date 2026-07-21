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
const deleteMode = args.includes("--delete");
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

function isOptimizedFolder(filePath) {
  return (
    filePath === "_optimized" ||
    filePath.startsWith("_optimized/")
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
    return decodeURIComponent(trimmed)
      .replace(/^\/+/, "");
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
        `Storage 목록 오류: ${error.message}`,
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
        files.push(fullPath);
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

    deleted +=
      Array.isArray(data)
        ? data.length
        : batch.length;

    for (const filePath of batch) {
      console.log(`DELETED ${filePath}`);
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
    "_optimized 폴더는 보호됩니다.\n",
  );

  const referencedPaths =
    await loadReferencedPaths();

  const storageFiles =
    await listAllFiles();

  const originalFiles =
    storageFiles.filter(
      (filePath) =>
        !isOptimizedFolder(filePath) &&
        isOriginalImage(filePath),
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
    "===== STILL REFERENCED - KEEP =====",
  );

  if (
    stillReferenced.length === 0
  ) {
    console.log("(none)");
  } else {
    for (const filePath of stillReferenced) {
      console.log(`KEEP ${filePath}`);
    }
  }

  console.log(
    "\n===== SAFE DELETE CANDIDATES =====",
  );

  if (
    safeDeleteCandidates.length === 0
  ) {
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
    `Storage files scanned:   ${storageFiles.length}`,
  );

  console.log(
    `JPG/PNG originals found: ${originalFiles.length}`,
  );

  console.log(
    `Still referenced (kept): ${stillReferenced.length}`,
  );

  console.log(
    `Safe delete candidates:  ${safeDeleteCandidates.length}`,
  );

  console.log(
    `Deleted:                 ${deleted}`,
  );

  console.log(
    `Delete failures:         ${failed}`,
  );

  if (!deleteMode) {
    console.log(
      "\n아직 아무 파일도 삭제하지 않았습니다.",
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