import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}


type BusinessHourInterval = { start: number; end: number; endText: string };
const BUSINESS_DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;

function normalizeBusinessDay(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase().replace(/[.:]$/, "");
  const aliases: Record<string,string> = {
    sun:"Sunday",sunday:"Sunday",일:"Sunday",일요일:"Sunday",
    mon:"Monday",monday:"Monday",월:"Monday",월요일:"Monday",
    tue:"Tuesday",tues:"Tuesday",tuesday:"Tuesday",화:"Tuesday",화요일:"Tuesday",
    wed:"Wednesday",wednesday:"Wednesday",수:"Wednesday",수요일:"Wednesday",
    thu:"Thursday",thur:"Thursday",thurs:"Thursday",thursday:"Thursday",목:"Thursday",목요일:"Thursday",
    fri:"Friday",friday:"Friday",금:"Friday",금요일:"Friday",
    sat:"Saturday",saturday:"Saturday",토:"Saturday",토요일:"Saturday",
  };
  return aliases[raw] || "";
}
function hoursTextIsClosed(value: unknown) {
  const text = String(value ?? "").trim().toLowerCase();
  return !text || ["closed","close","휴무","휴점","off","영업 안 함"].some((w)=>text.includes(w));
}
function normalizeHoursText(value: unknown) {
  let text = String(value ?? "").trim();
  if (!text || hoursTextIsClosed(text)) return "";
  if (/24\s*(hours?|hrs?)|24\/7|open\s*24/i.test(text)) return "00:00-24:00";
  text = text.replace(/[–—~]/g,"-").replace(/\s+to\s+/gi,"-").replace(/\s*,\s*/g,",").trim();
  const b = text.match(/(?:\/|\|)?\s*(?:break(?:\s*time)?|브레이크(?:\s*타임)?|휴게시간)\s*[:：]?\s*([^/|,]+?)\s*-\s*([^/|,]+)\s*$/i);
  if (b) {
    const before = text.slice(0,b.index).replace(/[\/|,\s]+$/,"").trim();
    const m = before.match(/(.+?)\s*-\s*(.+)$/);
    if (m) return `${m[1].trim()}-${b[1].trim()},${b[2].trim()}-${m[2].trim()}`;
  }
  return text;
}
function parseBusinessHours(value: unknown) {
  const result = new Map<string,string>();
  const save = (d: unknown,h: unknown) => {
    const day = normalizeBusinessDay(d); if (!day) return;
    const text = String(h ?? "").trim();
    result.set(day, hoursTextIsClosed(text) ? "" : normalizeHoursText(text));
  };
  const consume = (obj: Record<string,unknown>) => {
    for (const [k,item] of Object.entries(obj)) {
      if (!normalizeBusinessDay(k)) continue;
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const r = item as Record<string,unknown>;
        const combined = r.hours ?? r.time ?? r.value ?? [r.open ?? r.open_time,r.close ?? r.close_time].filter(Boolean).join("-");
        save(k, r.closed || r.is_closed ? "Closed" : combined);
      } else save(k,item);
    }
  };
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const r = item as Record<string,unknown>;
      const d = r.day ?? r.weekday ?? r.day_of_week ?? r.name;
      const combined = r.hours ?? r.time ?? r.value ?? [r.open ?? r.open_time,r.close ?? r.close_time].filter(Boolean).join("-");
      save(d, r.closed || r.is_closed ? "Closed" : combined);
    }
  } else if (value && typeof value === "object") consume(value as Record<string,unknown>);
  else {
    const raw = String(value ?? "").trim();
    if (raw) {
      try { const parsed = JSON.parse(raw); if (parsed && typeof parsed === "object") return parseBusinessHours(parsed); } catch {}
      for (const line0 of raw.split(/\r?\n|\s*;\s*(?=(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|월|화|수|목|금|토|일))/i)) {
        const line = line0.trim(); if (!line) continue;
        const m = line.match(/^\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tues?|Wed|Thu|Thur|Thurs|Fri|Sat|Sun|월요일?|화요일?|수요일?|목요일?|금요일?|토요일?|일요일?)\s*[:：-]?\s*(.*)$/i);
        if (m) save(m[1],m[2]);
      }
    }
  }
  return result;
}
function parseHourMinutes(value: string) {
  const text = String(value || "").trim().toUpperCase().replace(/\s+/g," ");
  if (text === "24:00") return 1440;
  const m = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/); if (!m) return null;
  let hour = Number(m[1]); const minute = Number(m[2] || 0); const ap = m[3];
  if (minute < 0 || minute > 59) return null;
  if (ap) { if (hour < 1 || hour > 12) return null; if (hour === 12) hour = 0; if (ap === "PM") hour += 12; }
  else if (hour < 0 || hour > 23) return null;
  return hour * 60 + minute;
}
function formatHourMinutes(value: number) {
  const n = ((value % 1440)+1440)%1440, h24 = Math.floor(n/60), min=n%60, suffix=h24>=12?"PM":"AM", h12=h24%12||12;
  return `${h12}:${String(min).padStart(2,"0")} ${suffix}`;
}
function parseHourIntervals(text: string): BusinessHourInterval[] {
  if (!text) return [];
  const out: BusinessHourInterval[] = [];
  for (const p of text.split(/[,;\n]+/).map(v=>v.trim()).filter(Boolean)) {
    const m = p.match(/^(.+?)\s*(?:-|–|—|~|to)\s*(.+)$/i); if (!m) continue;
    const start = parseHourMinutes(m[1]), pe = parseHourMinutes(m[2]); if (start == null || pe == null) continue;
    const end = pe <= start ? pe + 1440 : pe;
    out.push({start,end,endText:formatHourMinutes(pe)});
  }
  return out.sort((a,b)=>a.start-b.start);
}
function getEasternNow() {
  const parts = new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"long",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const v = (t:string)=>parts.find(p=>p.type===t)?.value || "";
  return { weekday:v("weekday"), minutes:Number(v("hour"))*60+Number(v("minute")) };
}
function getOrderWindow(hoursValue: unknown, cutoffMinutes = 15) {
  const parsed = parseBusinessHours(hoursValue);
  if (!parsed.size) return { enforceable:false, open:true, reason:"", closesAt:null as string|null, cutoffAt:null as string|null };
  const now = getEasternNow();
  const today = parseHourIntervals(parsed.get(now.weekday) || "");
  const idx = BUSINESS_DAYS.indexOf(now.weekday as (typeof BUSINESS_DAYS)[number]);
  const prevDay = idx >= 0 ? BUSINESS_DAYS[(idx+6)%7] : "Sunday";
  const prev = parseHourIntervals(parsed.get(prevDay)||"").filter(i=>i.end>1440).map(i=>({...i,start:i.start-1440,end:i.end-1440}));
  const intervals = [...prev,...today].sort((a,b)=>a.start-b.start);
  for (const interval of intervals) {
    if (now.minutes >= interval.start && now.minutes < interval.end) {
      const cutoff = Math.max(interval.start, interval.end-cutoffMinutes);
      if (now.minutes >= cutoff) return { enforceable:true, open:false, reason:`Online ordering closes ${cutoffMinutes} minutes before closing time (${interval.endText}).`, closesAt:interval.endText, cutoffAt:formatHourMinutes(cutoff) };
      return { enforceable:true, open:true, reason:"", closesAt:interval.endText, cutoffAt:formatHourMinutes(cutoff) };
    }
  }
  const next = today.find(i=>now.minutes<i.start);
  if (next) return { enforceable:true, open:false, reason:`Online ordering is closed. Ordering opens at ${formatHourMinutes(next.start)}.`, closesAt:next.endText, cutoffAt:formatHourMinutes(Math.max(next.start,next.end-cutoffMinutes)) };
  return { enforceable:true, open:false, reason:"Online ordering is closed for today.", closesAt:null as string|null, cutoffAt:null as string|null };
}

function normalizeTaxRate(value: unknown) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return 0;
  return Math.max(0, Math.min(1, rate));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json({ error: "Invalid business id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const [
      { data: business, error: businessError },
      { data: settings, error: settingsError },
      { data: privateSettings, error: privateError },
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select(
          "id,name,hours,restaurant_menu_menu_enabled,restaurant_menu_pickup_enabled,restaurant_menu_delivery_enabled",
        )
        .eq("id", businessId)
        .maybeSingle(),
      supabase
        .from("restaurant_order_settings")
        .select(
          "pickup_enabled,delivery_enabled,pay_at_pickup_enabled,sms_enabled,pickup_prep_minutes,delivery_prep_minutes,tax_rate,tip_presets",
        )
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("restaurant_order_private_settings")
        .select("payment_provider,stripe_secret_key,square_access_token,square_location_id")
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    if (businessError) throw businessError;
    if (settingsError) throw settingsError;
    if (privateError) throw privateError;

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    let menu = business.restaurant_menu_menu_enabled !== false;
    let pickup = business.restaurant_menu_pickup_enabled === true;
    let delivery = business.restaurant_menu_delivery_enabled === true;

    if (!menu && !pickup && !delivery) {
      menu = true;
      pickup = false;
      delivery = false;
    }

    const paymentProvider =
      privateSettings?.payment_provider === "square" ? "square" : "stripe";

    const onlinePaymentEnabled =
      paymentProvider === "square"
        ? Boolean(
            privateSettings?.square_access_token &&
              privateSettings?.square_location_id,
          )
        : Boolean(privateSettings?.stripe_secret_key);

    const orderWindow = getOrderWindow(business.hours, 15);

    const tipPresets = Array.isArray(settings?.tip_presets)
      ? settings.tip_presets
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isFinite(value) && value >= 0 && value <= 100)
      : [15, 18, 20];

    return NextResponse.json(
      {
        businessId,
        businessName: business.name || "Restaurant",

        orderingOpen: orderWindow.open,
        orderingHoursEnforced: orderWindow.enforceable,
        orderingClosedReason: orderWindow.reason,
        orderingClosesAt: orderWindow.closesAt,
        orderingCutoffAt: orderWindow.cutoffAt,
        orderCutoffMinutes: 15,

        orderModes: { menu, pickup, delivery },

        pickupEnabled: pickup,
        deliveryEnabled: delivery,

        paymentProvider,
        onlinePaymentEnabled,
        payAtPickupEnabled: settings?.pay_at_pickup_enabled !== false,
        smsEnabled: settings?.sms_enabled === true,

        pickupPrepMinutes: Math.max(
          0,
          Number(settings?.pickup_prep_minutes ?? 20) || 20,
        ),
        deliveryPrepMinutes: Math.max(
          0,
          Number(settings?.delivery_prep_minutes ?? 45) || 45,
        ),

        taxRate: normalizeTaxRate(settings?.tax_rate),
        tipPresets,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Order settings load failed",
      },
      { status: 500 },
    );
  }
}
