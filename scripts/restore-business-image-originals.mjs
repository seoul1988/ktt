import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Supabase 환경변수가 없습니다.",
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

const BACKUP_DIR =
  "C:\\ktt-pwa\\backups\\business-images-2026-07-21";

function isRestoreImage(filePath) {
  return /\.(jpg|jpeg|png)$/i.test(filePath);
}

function getContentType(filePath) {
  const ext = path
    .extname(filePath)
    .toLowerCase();

  if (ext === ".png") {
    return "image/png";
  }

  if (
    ext === ".jpg" ||
    ext === ".jpeg"
  ) {
    return "image/jpeg";
  }

  return "application/octet-stream";
}

async function walkDirectory(directory) {
  const results = [];

  const entries = await fs.readdir(
    directory,
    {
      withFileTypes: true,
    },
  );

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      const nested =
        await walkDirectory(fullPath);

      results.push(...nested);
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

async function main() {
  console.log(
    "===== RESTORE ORIGINAL IMAGES =====",
  );

  console.log(
    `Backup: ${BACKUP_DIR}`,
  );

  console.log(
    `Bucket: ${BUCKET}\n`,
  );

  const allFiles =
    await walkDirectory(BACKUP_DIR);

  const imageFiles =
    allFiles.filter(isRestoreImage);

  console.log(
    `복구할 JPG/PNG: ${imageFiles.length}개\n`,
  );

  let restored = 0;
  let failed = 0;

  for (
    let index = 0;
    index < imageFiles.length;
    index += 1
  ) {
    const localFile =
      imageFiles[index];

    const relativePath = path
      .relative(
        BACKUP_DIR,
        localFile,
      )
      .split(path.sep)
      .join("/");

    try {
      const fileBuffer =
        await fs.readFile(localFile);

      const {
        error,
      } = await supabase.storage
        .from(BUCKET)
        .upload(
          relativePath,
          fileBuffer,
          {
            upsert: true,
            cacheControl: "3600",
            contentType:
              getContentType(localFile),
          },
        );

      if (error) {
        throw error;
      }

      restored += 1;

      console.log(
        `[${index + 1}/${imageFiles.length}] RESTORED ${relativePath}`,
      );
    } catch (error) {
      failed += 1;

      console.error(
        `[${index + 1}/${imageFiles.length}] FAIL ${relativePath}`,
        error?.message || error,
      );
    }
  }

  console.log(
    "\n===== RESULT =====",
  );

  console.log(
    `Original files found: ${imageFiles.length}`,
  );

  console.log(
    `Restored:             ${restored}`,
  );

  console.log(
    `Failed:               ${failed}`,
  );

  if (failed === 0) {
    console.log(
      "\nRESTORE COMPLETE",
    );
  } else {
    console.log(
      "\n일부 파일 복구 실패",
    );
  }
}

main().catch((error) => {
  console.error(
    "복구 오류:",
    error?.message || error,
  );

  process.exit(1);
});