import 'server-only';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
import {createHoursSyncWorker} from './core';
const worker=createHoursSyncWorker(supabaseAdmin,process.env.GOOGLE_PLACES_API_KEY||'');
export const syncBusinessHours=worker.syncBusinessHours;
