import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROLLBACK_PATH = process.env.ROLLBACK_PATH;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ROLLBACK_PATH) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ROLLBACK_PATH required.",
  );
}

if (process.env.APPLY_ROLLBACK !== "true") {
  throw new Error(
    "Safety stop: set APPLY_ROLLBACK=true.",
  );
}

type RollbackRow = {
  id: string | number;
  old_url: string;
  new_url: string;
};

type RollbackPayload = {
  table: string;
  id_column: string;
  image_column: string;
  rows: RollbackRow[];
};

const payload = JSON.parse(
  fs.readFileSync(ROLLBACK_PATH, "utf8"),
) as RollbackPayload;

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

const db = supabase as any;

(async () => {
  let restored = 0;
  let skipped = 0;

  for (const row of payload.rows) {
    const { data, error } = await db
      .from(payload.table)
      .update({
        [payload.image_column]: row.old_url,
      })
      .eq(payload.id_column, row.id)
      .eq(payload.image_column, row.new_url)
      .select(payload.id_column);

    if (
      error ||
      !Array.isArray(data) ||
      data.length !== 1
    ) {
      skipped++;
      continue;
    }

    restored++;
  }

  console.log({
    restored,
    skipped,
  });

  console.log("No Storage files were deleted.");
})().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});