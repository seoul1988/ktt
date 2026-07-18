import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REPORT_PATH = process.env.REPORT_PATH ?? './webp-migration-output/webp-check-report.json';
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
if (process.env.APPLY !== 'true') throw new Error('Safety stop: set APPLY=true after reviewing the CSV report.');

const report = JSON.parse(fs.readFileSync(REPORT_PATH,'utf8'));
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth:{ persistSession:false, autoRefreshToken:false } });

async function exists(bucket:string, storagePath:string) {
  const slash = storagePath.lastIndexOf('/');
  const folder = slash >= 0 ? storagePath.slice(0,slash) : '';
  const file = slash >= 0 ? storagePath.slice(slash+1) : storagePath;
  const { data, error } = await supabase.storage.from(bucket).list(folder,{ limit:100, search:file });
  if (error) throw error;
  return (data ?? []).some(x => x.name === file && x.metadata != null);
}

async function main() {
  const matched = report.rows.filter((r:any)=>r.status==='matched');
  const rollback:any[]=[]; const skipped:any[]=[];
  for (const r of matched) {
    if (!await exists(report.bucket,r.new_path)) { skipped.push({id:r.id,reason:'WebP missing'}); continue; }
    const { data, error } = await supabase.from(report.table)
      .update({ [report.columns.image]:r.new_url })
      .eq(report.columns.id,r.id)
      .eq(report.columns.image,r.old_url)
      .select(report.columns.id);
    if (error || !data || data.length !== 1) { skipped.push({id:r.id,reason:error?.message ?? 'row changed'}); continue; }
    rollback.push({ id:r.id, name:r.name, old_url:r.old_url, new_url:r.new_url, updated_at:new Date().toISOString() });
    console.log(`Updated ${r.id}: ${r.name ?? ''}`);
  }
  const dir=path.dirname(REPORT_PATH); fs.mkdirSync(dir,{recursive:true});
  const rollbackPath=path.join(dir,`webp-rollback-${new Date().toISOString().replaceAll(':','-')}.json`);
  fs.writeFileSync(rollbackPath,JSON.stringify({generated_at:new Date().toISOString(),table:report.table,id_column:report.columns.id,image_column:report.columns.image,rows:rollback},null,2));
  fs.writeFileSync(path.join(dir,'webp-update-skipped.json'),JSON.stringify(skipped,null,2));
  console.log({updated:rollback.length,skipped:skipped.length,rollbackPath});
  console.log('No Storage files were deleted.');
}
main().catch(e=>{console.error(e);process.exit(1)});
