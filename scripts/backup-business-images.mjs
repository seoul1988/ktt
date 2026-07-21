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

const today = new Date()
  .toISOString()
  .slice(0, 10);

const BACKUP_DIR = path.resolve(
  process.cwd(),
  "backups",
  `business-images-${today}`,
);

let foundCount = 0;
let downloadedCount = 0;
let failedCount = 0;
let totalBytes = 0;

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  const index = Math.floor(
    Math.log(bytes) / Math.log(1024),
  );

  return `${(
    bytes /
    Math.pow(1024, index)
  ).toFixed(2)} ${units[index]}`;
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
        `파일 목록 오류: ${error.message}`,
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
        const nestedFiles =
          await listAllFiles(fullPath);

        files.push(...nestedFiles);
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

async function downloadFile(
  storagePath,
) {
  try {
    const {
      data,
      error,
    } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "파일 데이터가 없습니다.",
      );
    }

    const buffer = Buffer.from(
      await data.arrayBuffer(),
    );

    const localPath = path.join(
      BACKUP_DIR,
      ...storagePath.split("/"),
    );

    await fs.mkdir(
      path.dirname(localPath),
      {
        recursive: true,
      },
    );

    await fs.writeFile(
      localPath,
      buffer,
    );

    downloadedCount += 1;
    totalBytes += buffer.length;

    console.log(
      `OK   ${storagePath}`,
    );
  } catch (error) {
    failedCount += 1;

    console.error(
      `FAIL ${storagePath}`,
      error?.message || error,
    );
  }
}

async function main() {
  console.log(
    "===== BUSINESS IMAGES BACKUP =====",
  );

  console.log(
    `Bucket: ${BUCKET}`,
  );

  console.log(
    `Backup folder: ${BACKUP_DIR}`,
  );

  console.log(
    "삭제 작업은 전혀 하지 않습니다.\n",
  );

  await fs.mkdir(
    BACKUP_DIR,
    {
      recursive: true,
    },
  );

  console.log(
    "Storage 파일 목록 확인 중...",
  );

  const files =
    await listAllFiles();

  foundCount = files.length;

  console.log(
    `총 ${foundCount}개 파일 발견\n`,
  );

  for (
    let index = 0;
    index < files.length;
    index += 1
  ) {
    const storagePath =
      files[index];

    console.log(
      `[${index + 1}/${files.length}]`,
    );

    await downloadFile(
      storagePath,
    );
  }

  const result = {
    bucket: BUCKET,
    backupDate:
      new Date().toISOString(),
    backupFolder:
      BACKUP_DIR,
    filesFound:
      foundCount,
    downloaded:
      downloadedCount,
    failed:
      failedCount,
    totalBytes,
    files,
  };

  await fs.writeFile(
    path.join(
      BACKUP_DIR,
      "_backup-result.json",
    ),
    JSON.stringify(
      result,
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    "\n===== RESULT =====",
  );

  console.log(
    `Files found: ${foundCount}`,
  );

  console.log(
    `Downloaded:  ${downloadedCount}`,
  );

  console.log(
    `Failed:      ${failedCount}`,
  );

  console.log(
    `Total size:  ${formatBytes(
      totalBytes,
    )}`,
  );

  console.log(
    `Backup folder:\n${BACKUP_DIR}`,
  );

  if (failedCount === 0) {
    console.log(
      "\nBACKUP COMPLETE",
    );
  } else {
    console.log(
      "\n일부 파일 백업 실패. 아직 Storage 파일을 삭제하지 마세요.",
    );
  }
}

main().catch((error) => {
  console.error(
    "백업 중 오류:",
    error?.message || error,
  );

  process.exit(1);
});