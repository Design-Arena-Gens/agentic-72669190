import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import twilio from "twilio";

export const runtime = "nodejs";

const payloadSchema = z.object({
  to: z.string().min(5),
  message: z.string().min(1),
  mediaUrls: z.array(z.string().url()).optional(),
});

export async function POST(request: NextRequest) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !whatsappNumber) {
    return NextResponse.json(
      {
        error:
          "Missing Twilio credentials. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER environment variables.",
      },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload validation failed.", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const client = twilio(accountSid, authToken);
  const target =
    parsed.data.to.startsWith("whatsapp:") ? parsed.data.to : `whatsapp:${parsed.data.to}`;
  const from = whatsappNumber.startsWith("whatsapp:")
    ? whatsappNumber
    : `whatsapp:${whatsappNumber}`;

  try {
    const message = await client.messages.create({
      from,
      to: target,
      body: parsed.data.message,
      ...(parsed.data.mediaUrls && parsed.data.mediaUrls.length > 0
        ? { mediaUrl: parsed.data.mediaUrls }
        : {}),
    });

    return NextResponse.json(
      {
        success: true,
        sid: message.sid,
        status: message.status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to send WhatsApp message via Twilio:", error);
    return NextResponse.json(
      {
        error: "Unable to send WhatsApp message. Check logs for details.",
      },
      { status: 502 }
    );
  }
}
