import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  automationConfigSchema,
  buildTwiml,
  findMatchingFlow,
} from "@/lib/automation";

export const runtime = "nodejs";

const payloadSchema = automationConfigSchema
  .extend({
    message: z.string().min(1, "Message content is required for simulation."),
  })
  .strip();

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);

  if (!json) {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload validation failed.", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { message, flows, fallbackMessage, notes } = parsed.data;
  const match = findMatchingFlow(message, flows);
  const twiml = buildTwiml(match?.responses ?? [], fallbackMessage);

  return NextResponse.json({
    matched: Boolean(match),
    flow: match,
    twiml,
    fallbackMessage,
    notes,
  });
}
