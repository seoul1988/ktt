import { NextResponse } from "next/server";
import {
  getOrderAdmin,
  cleanPhone,
  moneyCents,
} from "@/lib/restaurant-order/server";
import { createStripeCheckoutSession } from "@/lib/restaurant-order/stripe";
import { sendTwilioSms } from "@/lib/restaurant-order/twilio";
import {
  createUberDirectQuote,
  isUberDirectEnabled,
} from "@/lib/delivery/uber-direct";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


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

type RequestItem = {
  menuItemId: number;
  quantity: number;
  instructions?: string;
  selections?: unknown;
};


function cleanSelectionLabel(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  // Stored selection keys are commonly "index:Label".
  const colonIndex = raw.indexOf(":");
  const label = colonIndex >= 0 ? raw.slice(colonIndex + 1) : raw;

  return label
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function selectedSquareModifiers(selections: unknown) {
  if (!selections) {
    return [] as Array<{
      name: string;
      base_price_money: {
        amount: number;
        currency: "USD";
      };
    }>;
  }

  let value: any = selections;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      const cleaned = cleanSelectionLabel(value);

      return cleaned
        ? [
            {
              name: cleaned,
              base_price_money: {
                amount: 0,
                currency: "USD" as const,
              },
            },
          ]
        : [];
    }
  }

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return [];
  }

  const modifiers: Array<{
    name: string;
    base_price_money: {
      amount: number;
      currency: "USD";
    };
  }> = [];

  for (const selectedGroup of Object.values(
    value as Record<string, unknown>,
  )) {
    if (
      !selectedGroup ||
      typeof selectedGroup !== "object" ||
      Array.isArray(selectedGroup)
    ) {
      continue;
    }

    for (const [optionKey, quantityValue] of Object.entries(
      selectedGroup as Record<string, unknown>,
    )) {
      const quantity = Math.max(
        0,
        Math.floor(Number(quantityValue) || 0),
      );

      if (quantity <= 0) continue;

      const optionName =
        cleanSelectionLabel(optionKey);

      if (!optionName) continue;

      modifiers.push({
        name:
          quantity > 1
            ? `${optionName} x${quantity}`
            : optionName,
        base_price_money: {
          amount: 0,
          currency: "USD",
        },
      });
    }
  }

  return modifiers;
}


function orderNumber() {
  return `${Date.now()
    .toString()
    .slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const businessId = Number(id);

    if (!Number.isInteger(businessId) || businessId <= 0) {
      return NextResponse.json(
        { error: "Invalid business ID." },
        { status: 400 },
      );
    }

    const body = await request.json();

    const orderNote = String(
      body?.orderNote || "",
    )
      .trim()
      .slice(0, 500);

    const fulfillmentType =
      body?.fulfillmentType === "delivery"
        ? "delivery"
        : "pickup";

    // Pay at Store is temporarily disabled.
    // Reject old clients or direct API requests that still send pay_at_pickup.
    if (body?.paymentMethod === "pay_at_pickup") {
      return NextResponse.json(
        { error: "Pay at Store is temporarily unavailable. Please pay online." },
        { status: 400 },
      );
    }

    const paymentMethod = "online";

    const customerName = String(
      body?.customer?.name || "",
    )
      .trim()
      .slice(0, 120);

    const customerPhone = cleanPhone(
      body?.customer?.phone,
    );

    const customerEmail = String(
      body?.customer?.email || "",
    )
      .trim()
      .toLowerCase()
      .slice(0, 254);

    if (
      customerEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)
    ) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const items: RequestItem[] = Array.isArray(
      body?.items,
    )
      ? body.items
      : [];

    if (!customerName || !customerPhone) {
      return NextResponse.json(
        {
          error:
            "Name and phone number are required.",
        },
        { status: 400 },
      );
    }

    if (!items.length) {
      return NextResponse.json(
        { error: "Your cart is empty." },
        { status: 400 },
      );
    }

    if (fulfillmentType === "delivery") {
      const address =
        body?.deliveryAddress || {};

      if (
        !address.address1 ||
        !address.city ||
        !address.state ||
        !address.postalCode
      ) {
        return NextResponse.json(
          {
            error:
              "A complete delivery address is required.",
          },
          { status: 400 },
        );
      }
    }

    const db = getOrderAdmin();

    const [
      { data: business },
      { data: settings },
      { data: privateSettings },
    ] = await Promise.all([
      db
        .from("businesses")
        .select("*")
        .eq("id", businessId)
        .single(),

      db
        .from("restaurant_order_settings")
        .select(
          "pickup_enabled,delivery_enabled,pay_at_pickup_enabled,sms_enabled,tax_rate,pickup_prep_minutes,delivery_prep_minutes",
        )
        .eq("business_id", businessId)
        .maybeSingle(),

      db
        .from(
          "restaurant_order_private_settings",
        )
        .select(
          "payment_provider,stripe_secret_key,square_access_token,square_location_id,twilio_account_sid,twilio_auth_token,twilio_phone_number,delivery_provider,uber_direct_enabled,uber_direct_customer_id,delivery_fee_markup_cents,pickup_phone_override",
        )
        .eq("business_id", businessId)
        .maybeSingle(),
    ]);

    const orderWindow = getOrderWindow(business?.hours, 15);

    if (orderWindow.enforceable && !orderWindow.open) {
      return NextResponse.json(
        {
          error: orderWindow.reason || "Online ordering is currently closed.",
          orderingClosed: true,
          closesAt: orderWindow.closesAt,
          cutoffAt: orderWindow.cutoffAt,
        },
        { status: 400 },
      );
    }

    if (
      fulfillmentType === "pickup" &&
      settings?.pickup_enabled === false
    ) {
      return NextResponse.json(
        {
          error:
            "Pickup ordering is currently unavailable.",
        },
        { status: 400 },
      );
    }

    if (
      fulfillmentType === "delivery" &&
      settings?.delivery_enabled !== true
    ) {
      return NextResponse.json(
        {
          error:
            "Delivery ordering is currently unavailable.",
        },
        { status: 400 },
      );
    }

    const paymentProvider =
      privateSettings?.payment_provider === "square"
        ? "square"
        : "stripe";

    const stripeSecretKey =
      privateSettings?.stripe_secret_key || "";

    const squareAccessToken =
      privateSettings?.square_access_token || "";

    const squareLocationId =
      privateSettings?.square_location_id || "";

    if (paymentMethod === "online") {
      if (
        paymentProvider === "square" &&
        (!squareAccessToken || !squareLocationId)
      ) {
        return NextResponse.json(
          {
            error:
              "Square is selected, but this restaurant has not connected its Square account yet.",
          },
          { status: 400 },
        );
      }

      if (
        paymentProvider === "stripe" &&
        !stripeSecretKey
      ) {
        return NextResponse.json(
          {
            error:
              "Stripe is selected, but Stripe payment has not been configured yet.",
          },
          { status: 400 },
        );
      }
    }

    const ids = [
      ...new Set(
        items
          .map((item) =>
            Number(item.menuItemId),
          )
          .filter(
            (menuItemId) =>
              Number.isInteger(menuItemId) &&
              menuItemId > 0,
          ),
      ),
    ];

    if (!ids.length) {
      return NextResponse.json(
        {
          error:
            "Your cart does not contain any valid menu items.",
        },
        { status: 400 },
      );
    }

    const {
      data: menuRows,
      error: menuError,
    } = await db
      .from("business_menu_items")
      .select(
        "id,name,price,pickup_price,delivery_price,is_available",
      )
      .eq("business_id", businessId)
      .in("id", ids);

    if (menuError) {
      throw menuError;
    }

    const menuMap = new Map(
      (menuRows || []).map((row) => [
        Number(row.id),
        row,
      ]),
    );

    /*
     * Server-side option pricing.
     *
     * Never trust the option-inclusive price calculated in the browser.
     * Re-read the restaurant's current option groups/items and calculate
     * every selected price_delta here so KTown, Square and the charged
     * amount all use the same server-authoritative total.
     */
    const {
      data: optionGroupRows,
      error: optionGroupError,
    } = await db
      .from("business_menu_option_groups")
      .select(
        "id,menu_item_id,name,is_required,min_select,max_select,display_order",
      )
      .eq("business_id", businessId)
      .in("menu_item_id", ids)
      .order("display_order", { ascending: true })
      .order("id", { ascending: true });

    if (optionGroupError) {
      throw optionGroupError;
    }

    const optionGroupIds = (optionGroupRows || [])
      .map((group: any) => Number(group.id))
      .filter((id: number) => Number.isInteger(id) && id > 0);

    let optionItemRows: any[] = [];

    if (optionGroupIds.length > 0) {
      const {
        data,
        error,
      } = await db
        .from("business_menu_option_items")
        .select(
          "id,option_group_id,name,price_delta,is_available,display_order",
        )
        .eq("business_id", businessId)
        .in("option_group_id", optionGroupIds)
        .order("display_order", { ascending: true })
        .order("id", { ascending: true });

      if (error) {
        throw error;
      }

      optionItemRows = data || [];
    }

    const groupsByMenuItem = new Map<number, any[]>();

    for (const group of optionGroupRows || []) {
      const menuItemId = Number((group as any).menu_item_id);
      const list = groupsByMenuItem.get(menuItemId) || [];
      list.push(group);
      groupsByMenuItem.set(menuItemId, list);
    }

    const optionsByGroup = new Map<number, any[]>();

    for (const option of optionItemRows) {
      const groupId = Number(option.option_group_id);
      const list = optionsByGroup.get(groupId) || [];
      list.push(option);
      optionsByGroup.set(groupId, list);
    }

    function parseSelections(value: unknown): Record<string, Record<string, number>> {
      if (!value) return {};

      let parsed: unknown = value;

      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          return {};
        }
      }

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        return {};
      }

      return parsed as Record<string, Record<string, number>>;
    }

    function selectedBucket(
      selections: Record<string, Record<string, number>>,
      index: number,
      name: string,
    ) {
      const exact = selections[`${index}:${name}`];

      if (
        exact &&
        typeof exact === "object" &&
        !Array.isArray(exact)
      ) {
        return exact;
      }

      const fallbackKey = Object.keys(selections).find(
        (key) => cleanSelectionLabel(key) === name,
      );

      const fallback = fallbackKey
        ? selections[fallbackKey]
        : undefined;

      return fallback &&
        typeof fallback === "object" &&
        !Array.isArray(fallback)
        ? fallback
        : {};
    }

    const normalized = items.map(
      (item) => {
        const row: any = menuMap.get(
          Number(item.menuItemId),
        );

        if (
          !row ||
          row.is_available === false
        ) {
          throw new Error(
            "Your order contains an unavailable menu item.",
          );
        }

        const quantity = Math.min(
          99,
          Math.max(
            1,
            Math.floor(Number(item.quantity) || 1),
          ),
        );

        const base = Number(
          row.price || 0,
        );

        const pickup =
          row.pickup_price == null
            ? base
            : Number(
                row.pickup_price,
              );

        const delivery =
          row.delivery_price == null
            ? pickup
            : Number(
                row.delivery_price,
              );

        const baseUnitPrice =
          fulfillmentType === "delivery"
            ? delivery
            : pickup;

        const selections = parseSelections(
          item.selections,
        );

        const groups =
          groupsByMenuItem.get(Number(row.id)) || [];

        let optionExtra = 0;

        const squareModifiers: Array<{
          name: string;
          base_price_money: {
            amount: number;
            currency: "USD";
          };
        }> = [];

        groups.forEach((group: any, groupIndex: number) => {
          const groupName = String(group.name || "");
          const selectedGroup = selectedBucket(
            selections,
            groupIndex,
            groupName,
          );

          const options =
            optionsByGroup.get(Number(group.id)) || [];

          let groupSelectionCount = 0;

          options.forEach((option: any, optionIndex: number) => {
            const optionName = String(option.name || "");
            const exactKey = `${optionIndex}:${optionName}`;

            let selectedQuantity = Math.max(
              0,
              Math.floor(
                Number(selectedGroup[exactKey]) || 0,
              ),
            );

            if (selectedQuantity <= 0) {
              const fallbackKey = Object.keys(
                selectedGroup,
              ).find(
                (key) =>
                  cleanSelectionLabel(key) === optionName,
              );

              selectedQuantity = fallbackKey
                ? Math.max(
                    0,
                    Math.floor(
                      Number(selectedGroup[fallbackKey]) || 0,
                    ),
                  )
                : 0;
            }

            if (selectedQuantity <= 0) {
              return;
            }

            if (option.is_available === false) {
              throw new Error(
                `The option "${optionName}" is no longer available.`,
              );
            }

            groupSelectionCount += selectedQuantity;

            const priceDelta = Number(
              option.price_delta || 0,
            );

            const optionAmount =
              priceDelta * selectedQuantity;

            optionExtra += optionAmount;

            squareModifiers.push({
              name:
                selectedQuantity > 1
                  ? `${optionName} x${selectedQuantity}`
                  : optionName,
              base_price_money: {
                amount: moneyCents(optionAmount),
                currency: "USD",
              },
            });
          });

          const minimum = Math.max(
            group.is_required === true ? 1 : 0,
            Math.max(
              0,
              Math.floor(Number(group.min_select) || 0),
            ),
          );

          const maximum =
            group.max_select == null
              ? null
              : Math.max(
                  0,
                  Math.floor(Number(group.max_select) || 0),
                );

          if (groupSelectionCount < minimum) {
            throw new Error(
              `Please complete the required option "${groupName}".`,
            );
          }

          if (
            maximum != null &&
            maximum > 0 &&
            groupSelectionCount > maximum
          ) {
            throw new Error(
              `Too many selections were made for "${groupName}".`,
            );
          }
        });

        const unitPrice = Math.max(
          0,
          baseUnitPrice + optionExtra,
        );

        return {
          menuItemId: Number(row.id),
          name: String(row.name),
          quantity,
          baseUnitPrice,
          optionExtra,
          unitPrice,
          lineTotal:
            unitPrice * quantity,
          instructions: String(
            item.instructions || "",
          ).slice(0, 500),
          selections:
            item.selections ?? null,
          squareModifiers,
        };
      },
    );

    const subtotal =
      normalized.reduce(
        (sum, item) =>
          sum + item.lineTotal,
        0,
      );

    const taxRate = Math.max(
      0,
      Number(settings?.tax_rate || 0),
    );

    const tax =
      subtotal * taxRate;

    const squareTaxPercentage =
      (taxRate * 100)
        .toFixed(4)
        .replace(/0+$/, "")
        .replace(/\.$/, "");

    const tipPercent =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            body?.tipPercent || 0,
          ),
        ),
      );

    const tip =
      subtotal *
      (tipPercent / 100);

    const address =
      fulfillmentType === "delivery"
        ? body.deliveryAddress
        : null;

    let deliveryFee = 0;
    let deliveryQuoteId: string | null = null;
    let deliveryQuoteExpiresAt: string | null = null;

    if (
      fulfillmentType === "delivery" &&
      isUberDirectEnabled(privateSettings)
    ) {
      const directQuote = await createUberDirectQuote({
        business,
        privateSettings,
        dropoffAddress: address,
      });

      deliveryFee = directQuote.customerFeeCents / 100;
      deliveryQuoteId = directQuote.id;
      deliveryQuoteExpiresAt = directQuote.expires || null;
    }

    const total =
      subtotal + tax + tip + deliveryFee;

    const number =
      orderNumber();

    const {
      data: order,
      error: orderError,
    } = await db
      .from("restaurant_orders")
      .insert({
        business_id:
          businessId,
        order_number:
          number,
        fulfillment_type:
          fulfillmentType,
        customer_name:
          customerName,
        customer_phone:
          customerPhone,
        delivery_address:
          address,
        requested_time: String(
          body?.requestedTime ||
            "asap",
        ).slice(0, 80),
        order_note:
          orderNote || null,
        payment_method:
          paymentMethod,
        payment_status: "pending",
        order_status:
          "new",
        subtotal,
        tax,
        tip,
        delivery_fee: deliveryFee,
        delivery_provider:
          fulfillmentType === "delivery" &&
          isUberDirectEnabled(privateSettings)
            ? "uber_direct"
            : privateSettings?.delivery_provider || "manual",
        delivery_quote_id: deliveryQuoteId,
        delivery_quote_expires_at: deliveryQuoteExpiresAt,
        delivery_status:
          fulfillmentType === "delivery"
            ? "awaiting_payment"
            : null,
        total,
      })
      .select("id")
      .single();

    if (orderError) {
      throw orderError;
    }

    const orderId = order?.id;

    if (!orderId) {
      throw new Error(
        "Order was created, but no order ID was returned.",
      );
    }

    const {
      error: itemsError,
    } = await db
      .from(
        "restaurant_order_items",
      )
      .insert(
        normalized.map(
          (item) => ({
            order_id:
              orderId,
            business_id:
              businessId,
            menu_item_id:
              item.menuItemId,
            item_name:
              item.name,
            quantity:
              item.quantity,
            unit_price:
              item.unitPrice,
            line_total:
              item.lineTotal,
            instructions:
              item.instructions,
            selections:
              item.selections,
          }),
        ),
      );

    if (itemsError) {
      throw itemsError;
    }



    {
      const origin =
        new URL(
          request.url,
        ).origin;

      if (paymentProvider === "square") {
        const squareApplicationId =
          process.env.SQUARE_APPLICATION_ID || "";

        if (!squareApplicationId) {
          throw new Error(
            "SQUARE_APPLICATION_ID is not configured.",
          );
        }

        const squareOrderResponse = await fetch(
          "https://connect.squareup.com/v2/orders",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${squareAccessToken}`,
              "Content-Type": "application/json",
              "Square-Version": "2026-08-19",
            },
            body: JSON.stringify({
              idempotency_key: `ktown-order-${orderId}`,
              order: {
                location_id: squareLocationId,
                reference_id: `KTOWN-${number}`,
                source: {
                  name: "KTown Triangle",
                },
                line_items: [
                  ...normalized.map((item) => {
                    const modifiers =
                      item.squareModifiers;

                    const note = item.instructions
                      ? `NOTE: ${item.instructions}`.slice(
                          0,
                          500,
                        )
                      : "";

                    return {
                      name: item.name,
                      quantity: String(item.quantity),
                      base_price_money: {
                        amount: moneyCents(
                          item.baseUnitPrice,
                        ),
                        currency: "USD",
                      },
                      ...(modifiers.length
                        ? { modifiers }
                        : {}),
                      ...(tax > 0 && squareTaxPercentage
                        ? {
                            applied_taxes: [
                              {
                                tax_uid: "ktown-sales-tax",
                              },
                            ],
                          }
                        : {}),
                      ...(note
                        ? { note }
                        : {}),
                    };
                  }),
                  ...(tip > 0
                    ? [
                        {
                          name: "Tip",
                          quantity: "1",
                          base_price_money: {
                            amount: moneyCents(tip),
                            currency: "USD",
                          },
                        },
                      ]
                    : []),
                  ...(deliveryFee > 0
                    ? [
                        {
                          name: "Delivery Fee",
                          quantity: "1",
                          base_price_money: {
                            amount: moneyCents(deliveryFee),
                            currency: "USD",
                          },
                        },
                      ]
                    : []),
                ],
                ...(tax > 0 && squareTaxPercentage
                  ? {
                      taxes: [
                        {
                          uid: "ktown-sales-tax",
                          name: "Tax",
                          type: "ADDITIVE",
                          percentage: squareTaxPercentage,
                          scope: "LINE_ITEM",
                        },
                      ],
                    }
                  : {}),
                fulfillments: [
                  fulfillmentType === "pickup"
                    ? {
                        type: "PICKUP",
                        state: "PROPOSED",
                        pickup_details: {
                          schedule_type: "ASAP",
                          prep_time_duration: `PT${Math.max(
                            1,
                            Number(settings?.pickup_prep_minutes || 20),
                          )}M`,
                          recipient: {
                            display_name: customerName,
                            phone_number: customerPhone,
                            ...(customerEmail
                              ? { email_address: customerEmail }
                              : {}),
                          },
                          note: [
                            `KTown order #${number} · Requested: ${String(
                              body?.requestedTime || "asap",
                            ).slice(0, 80)}`,
                            orderNote
                              ? `Order notes: ${orderNote}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")
                            .slice(0, 500),
                        },
                      }
                    : {
                        type: "DELIVERY",
                        state: "PROPOSED",
                        delivery_details: {
                          schedule_type: "ASAP",
                          prep_time_duration: `PT${Math.max(
                            1,
                            Number(settings?.delivery_prep_minutes || 45),
                          )}M`,
                          recipient: {
                            display_name: customerName,
                            phone_number: customerPhone,
                            ...(customerEmail
                              ? { email_address: customerEmail }
                              : {}),
                            address: {
                              address_line_1: String(
                                address?.address1 || "",
                              ).slice(0, 500),
                              ...(address?.address2
                                ? {
                                    address_line_2: String(
                                      address.address2,
                                    ).slice(0, 500),
                                  }
                                : {}),
                              locality: String(
                                address?.city || "",
                              ).slice(0, 255),
                              administrative_district_level_1: String(
                                address?.state || "",
                              )
                                .trim()
                                .toUpperCase()
                                .slice(0, 3),
                              postal_code: String(
                                address?.postalCode || "",
                              ).slice(0, 32),
                              country: "US",
                            },
                          },
                          ...(
                            address?.note || orderNote
                              ? {
                                  dropoff_notes: [
                                    address?.note
                                      ? String(address.note).trim()
                                      : "",
                                    orderNote
                                      ? `Order notes: ${orderNote}`
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" | ")
                                    .slice(0, 550),
                                }
                              : {}
                          ),
                        },
                      },
                ],
              },
            }),
            cache: "no-store",
          },
        );

        const squareOrderText = await squareOrderResponse.text();

        let squareOrderPayload: any = {};
        try {
          squareOrderPayload = squareOrderText
            ? JSON.parse(squareOrderText)
            : {};
        } catch {
          throw new Error(
            `Square returned an invalid order response (HTTP ${squareOrderResponse.status}).`,
          );
        }

        if (!squareOrderResponse.ok) {
          const detail =
            Array.isArray(squareOrderPayload?.errors) &&
            squareOrderPayload.errors.length
              ? squareOrderPayload.errors
                  .map(
                    (item: any) =>
                      item?.detail ||
                      item?.code ||
                      "Square order error",
                  )
                  .join(" / ")
              : `HTTP ${squareOrderResponse.status}`;

          throw new Error(
            `Square order could not be created: ${detail}`,
          );
        }

        const squareOrderId =
          String(squareOrderPayload?.order?.id || "");

        if (!squareOrderId) {
          throw new Error(
            "Square did not return an order ID.",
          );
        }

        const { error: squareOrderSaveError } = await db
          .from("restaurant_orders")
          .update({
            square_order_id: squareOrderId,
            square_payment_link_id: null,
          })
          .eq("id", orderId);

        if (squareOrderSaveError) {
          throw squareOrderSaveError;
        }

        // Apple Pay on the Web needs the current host registered for this seller.
        // Failure here does not block Card or Google Pay.
        try {
          const requestHost = new URL(request.url).hostname;
          const applePayDomains = Array.from(
            new Set(
              [
                requestHost,
                requestHost.startsWith("www.")
                  ? requestHost.slice(4)
                  : requestHost
                    ? `www.${requestHost}`
                    : "",
              ].filter(
                (host) =>
                  host &&
                  host !== "localhost" &&
                  host !== "127.0.0.1",
              ),
            ),
          );

          for (const domainName of applePayDomains) {
            const domainResponse = await fetch(
              "https://connect.squareup.com/v2/apple-pay/domains",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${squareAccessToken}`,
                  "Content-Type": "application/json",
                  "Square-Version": "2026-08-19",
                },
                body: JSON.stringify({
                  domain_name: domainName,
                }),
                cache: "no-store",
              },
            );

            if (!domainResponse.ok) {
              const domainText = await domainResponse.text();
              console.warn(
                "Square Apple Pay domain registration failed:",
                domainName,
                domainResponse.status,
                domainText,
              );
            }
          }
        } catch (appleDomainError) {
          console.warn(
            "Square Apple Pay domain registration error:",
            appleDomainError,
          );
        }

        return NextResponse.json({
          ok: true,
          paymentProvider: "square",
          paymentRequired: true,
          orderId: orderId,
          orderNumber: number,
          squarePayment: {
            applicationId: squareApplicationId,
            locationId: squareLocationId,
            amount: total.toFixed(2),
            amountCents: moneyCents(total),
            currencyCode: "USD",
          },
        });
      }

      const session =
        await createStripeCheckoutSession(
          {
            secretKey:
              stripeSecretKey,
            orderId:
              orderId,
            orderNumber:
              number,
            businessId,
            businessName:
              business?.name ||
              "Restaurant",
            amountCents:
              moneyCents(total),
            customerName,
            customerPhone,
            origin,
          },
        );

      await db
        .from(
          "restaurant_orders",
        )
        .update({
          stripe_session_id:
            session.id,
        })
        .eq(
          "id",
          orderId,
        );

      return NextResponse.json({
        ok: true,
        paymentProvider: "stripe",
        orderId:
          orderId,
        orderNumber:
          number,
        checkoutUrl:
          session.url,
      });
    }

    const twilioAccountSid =
      privateSettings?.twilio_account_sid || "";

    const twilioAuthToken =
      privateSettings?.twilio_auth_token || "";

    const twilioPhoneNumber =
      privateSettings?.twilio_phone_number || "";

    if (
      settings?.sms_enabled &&
      twilioAccountSid &&
      twilioAuthToken &&
      twilioPhoneNumber
    ) {
      sendTwilioSms(
        {
          accountSid: twilioAccountSid,
          authToken: twilioAuthToken,
          fromNumber: twilioPhoneNumber,
        },
        customerPhone,
        `${
          business?.name ||
          "Restaurant"
        }: Order #${number} received. ${
          fulfillmentType ===
          "pickup"
            ? "We'll text you when it's ready."
            : "Your delivery order is being prepared."
        }`,
      ).catch(
        (error) =>
          console.error(
            "ORDER SMS ERROR",
            error,
          ),
      );
    }

    return NextResponse.json({
      ok: true,
      orderId:
        orderId,
      orderNumber:
        number,
    });
  } catch (error) {
    console.error(
      "PUBLIC ORDER POST ERROR",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process your order.",
      },
      { status: 500 },
    );
  }
}