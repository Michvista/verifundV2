# VeriFund Production Readiness

Use this checklist before promoting VeriFund to a public production deployment.

## Required Backend Configuration

Render must provide these environment variables:

```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=<random value with at least 32 characters>
CORS_ORIGIN=https://your-vercel-app.vercel.app
NOMBA_CLIENT_ID=<live client id>
NOMBA_CLIENT_SECRET=<live client secret>
NOMBA_ACCOUNT_ID=<live account id>
NOMBA_SUB_ACCOUNT_ID=<live sub account id, if required>
NOMBA_WEBHOOK_SECRET=<live webhook secret>
NOMBA_ALLOW_MOCK_FALLBACK=false
NOMBA_ENV=production
NOMBA_SIGNATURE_HEADER=signature
```

The API intentionally refuses to start in production if the database URL is missing or invalid, the JWT secret is weak, CORS is not configured, Nomba credentials are placeholders, or mock Nomba fallback is still enabled.

## Required Frontend Configuration

Vercel must provide:

```bash
VITE_API_BASE_URL=https://your-render-service.onrender.com/api
VITE_WS_URL=wss://your-render-service.onrender.com/ws
```

The API base URL must include `/api`. The WebSocket URL must use `wss://` when the frontend is served over HTTPS.

## Deployment Steps

1. Attach a real PostgreSQL database to the Render backend.
2. Set all required Render environment variables.
3. Deploy the backend with:

```bash
npm install && npm run db:generate && npm run db:push
```

4. Confirm backend health:

```bash
curl https://your-render-service.onrender.com/api/health
```

Expected production health signals:

```json
{
  "ok": true,
  "service": "verifund-api",
  "mode": "monolith",
  "nombaMode": "live",
  "databaseMode": "postgres"
}
```

5. Set Vercel frontend environment variables.
6. Deploy the frontend with `npm run build` and output directory `dist`.
7. Register a new user, log in with phone number and password, refresh the page, and log in again.
8. Verify protected pages reject unauthenticated access and authorized roles can complete their expected workflows.

## Security Notes

- Do not commit `.env`, logs, build output, or generated TypeScript build info.
- Passwords are hashed with bcrypt before storage and are never returned by the API.
- Login errors intentionally use a generic message so the API does not reveal whether a phone number exists.
- Production CORS must point to the deployed frontend origin. Multiple origins can be comma-separated.
- `NOMBA_ALLOW_MOCK_FALLBACK=false` is required in production so payment-like flows do not silently run in mock mode.

## Current Known Limits

- There is no password reset flow yet.
- There is no email or SMS verification for account ownership yet.
- Rate limiting is not implemented yet.
- The AI risk layer is currently explainable scoring logic, not a trained ML model.
