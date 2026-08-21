import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CateringRequestBody = {
  business_id?: number;
  business_name?: string;
  is_test?: boolean;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  company?: string;
  event_date?: string;
  event_time?: string;
  guest_count?: number;
  occasion?: string;
  category_id?: number | null;
  category_name?: string;
  item_id?: number | null;
  item_name?: string;
  service_type?: string;
  delivery_fee?: number;
  budget_per_person?: string;
  notes?: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(
  request: NextRequest,
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

    const body = (await request.json()) as CateringRequestBody;

    if (Number(body.business_id) !== businessId) {
      return NextResponse.json(
        { error: "Business ID does not match." },
        { status: 400 },
      );
    }

    const customerName = text(body.customer_name);
    const customerPhone = text(body.customer_phone);
    const customerEmail = text(body.customer_email);
    const eventDate = text(body.event_date);
    const eventTime = text(body.event_time);
    const serviceType = text(body.service_type);

    if (
      !customerName ||
      !customerPhone ||
      !customerEmail ||
      !eventDate ||
      !eventTime ||
      !Number(body.guest_count) ||
      !serviceType
    ) {
      return NextResponse.json(
        { error: "Please complete all required fields." },
        { status: 400 },
      );
    }

    if (!isValidEmail(customerEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const supabase = getAdminSupabase();

    const { data: settings, error: settingsError } = await supabase
      .from("business_catering_settings")
      .select(
        "business_id, is_enabled, notification_email, notification_phone, sender_email",
      )
      .eq("business_id", businessId)
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    if (!settings) {
      return NextResponse.json(
        { error: "Catering settings were not found." },
        { status: 404 },
      );
    }

    const recipient = text(settings.notification_email);

    if (!recipient) {
      return NextResponse.json(
        {
          error:
            "Please add the catering notification email in Catering Management first.",
        },
        { status: 400 },
      );
    }

    if (!isValidEmail(recipient)) {
      return NextResponse.json(
        {
          error:
            "The catering notification email saved for this business is invalid.",
        },
        { status: 400 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is missing." },
        { status: 500 },
      );
    }

    /*
      Sender priority:
      1. Business-specific sender_email from DB
         e.g. catering@bunsofchapelhill.com
      2. KTown fallback sender from .env.local
         e.g. catering@ktowntriangle.com
    */
    const businessSenderEmail = text(settings.sender_email);
    const fallbackSenderEmail = text(process.env.CATERING_FROM_EMAIL);
    const senderEmail = businessSenderEmail || fallbackSenderEmail;

    if (!senderEmail) {
      return NextResponse.json(
        {
          error:
            "No sender email is configured. Add a business sender email or set CATERING_FROM_EMAIL.",
        },
        { status: 500 },
      );
    }

    if (!isValidEmail(senderEmail)) {
      return NextResponse.json(
        {
          error: `Invalid sender email: ${senderEmail}`,
        },
        { status: 500 },
      );
    }

    const isTest = body.is_test === true;
    const businessName =
      text(body.business_name) || `Business ${businessId}`;
    const categoryName = text(body.category_name) || "Not selected";
    const itemName = text(body.item_name) || "Not selected";
    const deliveryFee = Math.max(0, Number(body.delivery_fee || 0));

    const from = `${businessName} <${senderEmail}>`;

    const subject = `${
      isTest ? "[TEST] " : ""
    }Catering Request - ${businessName} - ${customerName}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#172033">
        <h2 style="margin-bottom:4px">${
          isTest ? "[TEST] " : ""
        }New Catering Request</h2>

        <p style="margin-top:0;color:#667085">
          ${escapeHtml(businessName)}
        </p>

        ${
          isTest
            ? `<div style="padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;margin:16px 0;font-weight:700;color:#9a3412">
                 This email was sent from the Website Editor preview.
               </div>`
            : ""
        }

        <table style="width:100%;border-collapse:collapse">
          <tbody>
            ${[
              ["Customer", customerName],
              ["Phone", customerPhone],
              ["Email", customerEmail],
              ["Company", text(body.company)],
              ["Event Date", eventDate],
              ["Event Time", eventTime],
              ["Guests", String(Number(body.guest_count || 0))],
              ["Occasion", text(body.occasion)],
              ["Category", categoryName],
              ["Menu", itemName],
              ["Service", serviceType],
              [
                "Delivery Fee",
                serviceType === "delivery"
                  ? `$${deliveryFee.toFixed(2)}`
                  : "",
              ],
              ["Budget / Person", text(body.budget_per_person)],
              ["Notes", text(body.notes)],
            ]
              .filter(([, value]) => value)
              .map(
                ([label, value]) => `
                  <tr>
                    <td style="padding:9px;border-bottom:1px solid #e5e7eb;font-weight:700;width:180px">
                      ${escapeHtml(label)}
                    </td>
                    <td style="padding:9px;border-bottom:1px solid #e5e7eb">
                      ${escapeHtml(value)}
                    </td>
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>

        <p style="margin-top:18px;font-size:12px;color:#667085">
          Reply to this email to contact the customer directly.
        </p>
      </div>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        reply_to: customerEmail,
        subject,
        html,
      }),
    });

    const resendText = await resendResponse.text();
    let resendData: any = {};

    if (resendText) {
      try {
        resendData = JSON.parse(resendText);
      } catch {
        resendData = { message: resendText };
      }
    }

    if (!resendResponse.ok) {
      return NextResponse.json(
        {
          error:
            resendData?.message ||
            resendData?.error ||
            "Failed to send the catering request email.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      test: isTest,
      recipient,
      sender: senderEmail,
      reply_to: customerEmail,
      email_id: resendData?.id ?? null,
    });
  } catch (error) {
    console.error("CATERING REQUEST EMAIL ERROR:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while sending the catering request.",
      },
      { status: 500 },
    );
  }
}