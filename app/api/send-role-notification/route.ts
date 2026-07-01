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

    const { email, role } = await req.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "Missing email or role." },
        { status: 400 }
      );
    }

    const roleLabel =
      role === "admin"
        ? "Administrator"
        : role === "owner"
        ? "Business Owner"
        : "User";

    const { data, error } = await resend.emails.send({
      from: "K-Town Triangle <onboarding@resend.dev>",
      to: [email],
      subject: "Your K-Town Triangle account has been updated",
      html: `
        <div style="font-family: Arial, sans-serif; line-height:1.6">
          <h2>Your account has been updated</h2>

          <p>Hello,</p>

          <p>Your K-Town Triangle account role has been updated.</p>

          <p>
            <strong>New Role:</strong> ${roleLabel}
          </p>

          <p>
            You can now log in and access the features available for your account.
          </p>

          <br>

          <p>Thank you,</p>

          <p><strong>K-Town Triangle</strong></p>
        </div>
      `,
    });

    // Resend가 오류를 반환했는지 확인
    if (error) {
      console.error("Resend Error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    console.log("Resend Success:", data);

    return NextResponse.json({
      success: true,
      id: data?.id,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500 }
    );
  }
}