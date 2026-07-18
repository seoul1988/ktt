import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.BUCKET ?? 'business-images';
const TABLE = process.env.TABLE ?? 'businesses';
const ID_COLUMN = process.env.ID_COLUMN ?? 'id';
const NAME_COLUMN = process.env.NAME_COLUMN ?? 'name';
const IMAGE_COLUMN = process.env.IMAGE_COLUMN ?? 'image_url';
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? './webp-migration-output';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function storagePathFromPublicUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const i = parsed.pathname.indexOf(marker);
    return i < 0 ? null : decodeURIComponent(parsed.pathname.slice(i + marker.length));
  } catch { return null; }
}

async function fetchRows() {
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(TABLE).select(`${ID_COLUMN},${NAME_COLUMN},${IMAGE_COLUMN}`).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

async function listRecursive(folder = ''): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    for (const item of data ?? []) {
      const full = folder ? `${folder}/${item.name}` : item.name;
      if (item.metadata == null) out.push(...await listRecursive(full)); else out.push(full);
    }
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

function candidates(original: string) {
  const ext = path.posix.extname(original);
  const stem = original.slice(0, -ext.length);
  const dir = path.posix.dirname(original);
  const base = path.posix.basename(stem);
  return [...new Set([
    `${stem}.webp`,
    `_optimized/${base}.webp`,
    dir === '.' ? `_optimized/${base}.webp` : `${dir}/_optimized/${base}.webp`,
    `${base}.webp`,
  ].map(x => x.replace(/^\.\//, '')))];
}

function csv(v: unknown) { const s = v == null ? '' : String(v); return `"${s.replaceAll('"', '""')}"`; }
function publicUrl(p: string) { return supabase.storage.from(BUCKET).getPublicUrl(p).data.publicUrl; }

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const rows = await fetchRows();
  const files = await listRecursive();
  const fileSet = new Set(files);
  const source = rows.filter(r => /\.(png|jpe?g)(?:\?.*)?$/i.test((r[IMAGE_COLUMN] ?? '').trim()));
  const result = source.map(r => {
    const oldUrl = String(r[IMAGE_COLUMN]).trim();
    const original = storagePathFromPublicUrl(oldUrl);
    if (!original) return { id:r[ID_COLUMN], name:r[NAME_COLUMN], status:'external_or_unrecognized_url', old_url:oldUrl, original_path:'', new_url:'', new_path:'', candidates_found:[] };
    const found = candidates(original).filter(x => fileSet.has(x));
    if (found.length === 1) return { id:r[ID_COLUMN], name:r[NAME_COLUMN], status:'matched', old_url:oldUrl, original_path:original, new_url:publicUrl(found[0]), new_path:found[0], candidates_found:found };
    return { id:r[ID_COLUMN], name:r[NAME_COLUMN], status:found.length ? 'ambiguous' : 'unmatched', old_url:oldUrl, original_path:original, new_url:'', new_path:'', candidates_found:found };
  });
  const report = {
    generated_at:new Date().toISOString(), bucket:BUCKET, table:TABLE,
    columns:{ id:ID_COLUMN, name:NAME_COLUMN, image:IMAGE_COLUMN },
    summary:{ jpg_png_rows:result.length, matched:result.filter(x=>x.status==='matched').length, unmatched:result.filter(x=>x.status==='unmatched').length, ambiguous:result.filter(x=>x.status==='ambiguous').length, external_or_unrecognized_url:result.filter(x=>x.status==='external_or_unrecognized_url').length, storage_files_scanned:files.length },
    rows:result
  };
  fs.writeFileSync(path.join(OUTPUT_DIR,'webp-check-report.json'), JSON.stringify(report,null,2));
  const header=['id','name','status','old_url','original_path','new_url','new_path','candidates_found'];
  const lines=[header.join(','), ...result.map(r => [r.id,r.name,r.status,r.old_url,r.original_path,r.new_url,r.new_path,r.candidates_found.join(' | ')].map(csv).join(','))];
  fs.writeFileSync(path.join(OUTPUT_DIR,'webp-check-report.csv'), lines.join('\n'));
  console.log('DRY RUN COMPLETE — nothing changed or deleted.');
  console.table(report.summary);
}
main().catch(e=>{ console.error(e); process.exit(1); });
