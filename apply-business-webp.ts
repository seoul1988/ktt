import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REPORT_PATH =
  process.env.REPORT_PATH ??
  "./webp-migration-output/webp-check-report.json";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
}

if (process.env.APPLY !== "true") {
  throw new Error(
    "Safety stop: set APPLY=true after reviewing the CSV report.",
  );
}

type ReportRow = {
  id: string | number;
  name?: string | null;
  status: string;
  old_url: string;
  new_url: string;
  new_path: string;
};

type MigrationReport = {
  bucket: string;
  table: string;
  columns: {
    id: string;
    image: string;
  };
  rows: ReportRow[];
};

type RollbackRow = {
  id: string | number;
  name?: string | null;
  old_url: string;
  new_url: string;
  updated_at: string;
};

type SkippedRow = {
  id: string | number;
  reason: string;
};

const report = JSON.parse(
  fs.readFileSync(REPORT_PATH, "utf8"),
) as MigrationReport;

const supabase = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

/*
 * 동적 table/column 이름은 Supabase 타입 추론이 지나치게 깊어질 수 있습니다.
 * Storage는 정상 타입을 유지하고, 동적 DB 쿼리에만 any를 적용합니다.
 */
const db = supabase as any;

async function exists(
  bucket: string,
  storagePath: string,
): Promise<boolean> {
  const slash = storagePath.lastIndexOf("/");
  const folder =
    slash >= 0 ? storagePath.slice(0, slash) : "";
  const file =
    slash >= 0
      ? storagePath.slice(slash + 1)
      : storagePath;

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder, {
      limit: 100,
      search: file,
    });

  if (error) {
    throw new Error(
      `Storage lookup failed for ${bucket}/${storagePath}: ${error.message}`,
    );
  }

  return (data ?? []).some(
    (item) =>
      item.name === file &&
      item.metadata != null,
  );
}

async function main() {
  const matched = report.rows.filter(
    (row) => row.status === "matched",
  );

  const rollback: RollbackRow[] = [];
  const skipped: SkippedRow[] = [];

  for (const row of matched) {
    const webpExists = await exists(
      report.bucket,
      row.new_path,
    );

    if (!webpExists) {
      skipped.push({
        id: row.id,
        reason: "WebP missing",
      });
      continue;
    }

    const { data, error } = await db
      .from(report.table)
      .update({
        [report.columns.image]: row.new_url,
      })
      .eq(report.columns.id, row.id)
      .eq(report.columns.image, row.old_url)
      .select(report.columns.id);

    if (error) {
      skipped.push({
        id: row.id,
        reason: error.message,
      });
      continue;
    }

    if (!Array.isArray(data) || data.length !== 1) {
      skipped.push({
        id: row.id,
        reason: "Row changed or was not found",
      });
      continue;
    }

    rollback.push({
      id: row.id,
      name: row.name ?? null,
      old_url: row.old_url,
      new_url: row.new_url,
      updated_at: new Date().toISOString(),
    });

    console.log(
      `Updated ${row.id}: ${row.name ?? ""}`,
    );
  }

  const dir = path.dirname(REPORT_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-");

  const rollbackPath = path.join(
    dir,
    `webp-rollback-${timestamp}.json`,
  );

  fs.writeFileSync(
    rollbackPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        table: report.table,
        id_column: report.columns.id,
        image_column: report.columns.image,
        rows: rollback,
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(dir, "webp-update-skipped.json"),
    JSON.stringify(skipped, null, 2),
  );

  console.log({
    updated: rollback.length,
    skipped: skipped.length,
    rollbackPath,
  });

  console.log("No Storage files were deleted.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});