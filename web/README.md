## FlowWave WhatsApp Automation Agent

FlowWave is a full-stack Next.js reference implementation for orchestrating WhatsApp automation with Twilio. It includes a visual flow builder, a webhook simulator, and production-ready API routes for outbound messaging and inbound automation.

### Local Development

```bash
cd web
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to open the builder. Flows are stored in local storage so you can experiment freely before promoting changes.

### Environment Variables

Create a `.env.local` file with the following settings when you are ready to connect to Twilio:

```
AUTOMATION_RULES='{"flows":[...]}'
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886
```

Use the **Copy JSON for env** button in the UI to paste a valid `AUTOMATION_RULES` payload. The webhook falls back to sensible defaults if the env variable is missing so you can experiment locally without credentials.

### Webhooks

- `POST /api/webhook` — Twilio inbound WhatsApp webhook (TwiML response).
- `POST /api/send` — Helper endpoint to send outbound WhatsApp messages through Twilio.
- `POST /api/simulate` — Internal simulator used by the builder UI to render TwiML previews.

### Deployment

Deploy directly to Vercel once environment variables are configured:

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-72669190
```

Point your Twilio WhatsApp sandbox or business number webhook to `https://agentic-72669190.vercel.app/api/webhook`.
