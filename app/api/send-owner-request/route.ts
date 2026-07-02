import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY." },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    const { fullName, phone, businessName, email } = await req.json();

    if (!fullName || !phone || !businessName || !email) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const adminEmail =
      process.env.OWNER_REQUEST_ADMIN_EMAIL || "ktowntriangle@gmail.com";

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://www.ktowntriangle.com";

    await resend.emails.send({
      from: "K-Town Triangle <noreply@ktowntriangle.com>",
      to: adminEmail,
      subject: "New Business Owner Application",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;">
          <h2>New Business Owner Application</h2>

          <p>A new business owner application has been submitted.</p>

          <p><strong>Name:</strong> ${fullName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Business Name:</strong> ${businessName}</p>

          <p>
            <a href="${siteUrl}/admin/owner-requests"
               style="display:inline-block;background:#172033;color:white;
               padding:12px 18px;border-radius:10px;text-decoration:none;
               font-weight:bold;">
              Review Owner Request
            </a>
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to send email." },
      { status: 500 }
    );
  }
}