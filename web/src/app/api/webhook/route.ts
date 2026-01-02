import { NextRequest } from "next/server";
import { buildTwiml, findMatchingFlow, getAutomationConfig } from "@/lib/automation";
import type { AutomationResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const from = String(form.get("From") ?? "");
  const body = String(form.get("Body") ?? "");

  const config = getAutomationConfig();
  const match = findMatchingFlow(body, config.flows);
  const responses = match?.responses ?? [];
  const twiml = buildTwiml(responses, config.fallbackMessage);

  const headers = {
    "Content-Type": "text/xml",
  };

  await triggerHandoffIfNeeded(match?.responses ?? [], from, body).catch((error) => {
    console.error("Handoff dispatch failed:", error);
  });

  return new Response(twiml, { status: 200, headers });
}

async function triggerHandoffIfNeeded(
  responses: AutomationResponse[],
  originatingNumber: string,
  messageBody: string
) {
  if (!responses) return;

  const handoffNumber = responses.find((response) => response.handoffNumber)?.handoffNumber;
  if (!handoffNumber) return;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !whatsappNumber) return;

  const twilio = (await import("twilio")).default;
  const client = twilio(accountSid, authToken);
  const from = whatsappNumber.startsWith("whatsapp:")
    ? whatsappNumber
    : `whatsapp:${whatsappNumber}`;

  const agentTarget = handoffNumber.startsWith("whatsapp:")
    ? handoffNumber
    : `whatsapp:${handoffNumber}`;

  const summary = `Heads up! ${originatingNumber} needs help.\nMessage: ${messageBody}`;

  await client.messages.create({
    from,
    to: agentTarget,
    body: summary,
  });
}
