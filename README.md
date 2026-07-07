# VeriFund V2

VeriFund V2 is a hackathon-ready cooperative finance platform for fraud detection, trust scoring, multi-signature withdrawals, and public verification.

It includes:

- A React + TypeScript frontend
- A modular TypeScript backend monolith
- Prisma-based persistence
- JWT auth
- Realtime feed updates over WebSockets
- Risk scoring and fraud alert logic inspired by the build spec

## Features

- Cooperative dashboard with balances, activity, and contribution history
- Withdrawal workflow with multi-step approval states
- Fraud alerts with detail and action modals
- Public trust registry and entity lookup pages
- Whistleblower flow and audit trail
- Backend API organized by routes, controllers, services, middleware, and data access

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript, WebSocket
- Database: PostgreSQL via Prisma
- Auth: JWT + bcrypt

## Project Structure

- `src/` frontend application
- `server/src/` backend application
- `prisma/schema.prisma` database schema
- `.env.example` required environment variables
- `render.yaml` Render deployment config
- `vercel.json` Vercel deployment config
- `docs/production-readiness.md` production deployment checklist

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
copy .env.example .env
```

3. Fill in your own values in `.env`. For local testing without Postgres, leave `DATABASE_URL` blank and the backend will use the in-memory store.

4. Generate Prisma Client:

```bash
npm run db:generate
```

5. Push the schema to Postgres if you are using a local database:

```bash
npm run db:push
```

6. Start the frontend and backend together:

```bash
npm run dev
```

The frontend runs on Vite and the backend API runs on `http://localhost:5050`.

## Environment Variables

Copy `.env.example` to `.env` and provide your own values only.

Required values for a live Postgres deployment:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `NOMBA_CLIENT_ID`
- `NOMBA_CLIENT_SECRET`
- `NOMBA_ACCOUNT_ID`
- `NOMBA_WEBHOOK_SECRET`
- `NOMBA_ALLOW_MOCK_FALLBACK`
- `VITE_API_BASE_URL`
- `VITE_WS_URL`

Suggested local values:

- `VITE_API_BASE_URL=http://localhost:5050/api`
- `VITE_WS_URL=ws://localhost:5050/ws`
- `CORS_ORIGIN=http://localhost:5174`

If you are just running the hackathon build locally, the backend can start without `DATABASE_URL` and will serve live in-memory state instead of seeded demo data.

In production, the API validates required configuration before listening. It will refuse to boot if Postgres, JWT, CORS, or live Nomba configuration is incomplete.

## Backend API

The backend is a single TypeScript monolith, but it is split internally into:

- routes
- controllers
- services
- middleware
- repository/data layer

This keeps deployment simple while avoiding one giant file.

Main API areas:

- Authentication
- Cooperative onboarding
- Dashboard summary
- Contributions
- Withdrawals and approvals
- Scheduled Nomba credit sync
- Fraud alerts
- Trust score and registry lookup
- Webhook/audit events

## Frontend Pages

- `/dashboard`
- `/onboard`
- `/login`
- `/cooperative/:id`
- `/cooperative/:id/trust-score`
- `/admin/cooperative`
- `/admin/withdrawal`
- `/fraud/alerts`
- `/whistleblower`
- `/public/lookup`

## Deployment

### Render backend

1. Create a new Render Web Service from this repository.
2. Attach a Render PostgreSQL database.
3. Set these environment variables in Render:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `NOMBA_CLIENT_ID`
- `NOMBA_CLIENT_SECRET`
- `NOMBA_ACCOUNT_ID`
- `NOMBA_SUB_ACCOUNT_ID` if required by your account setup
- `NOMBA_WEBHOOK_SECRET`
- `NOMBA_ALLOW_MOCK_FALLBACK=false`
- `NOMBA_ENV=production`

4. Use this build command:

```bash
npm install && npm run db:generate && npm run db:push
```

5. Use this start command:

```bash
npm run api
```

6. Set `CORS_ORIGIN` to your deployed Vercel frontend URL.

7. Confirm `/api/health` reports `"databaseMode":"postgres"` and `"nombaMode":"live"`.

### Vercel frontend

1. Import the same repository into Vercel.
2. Set these environment variables in Vercel:

- `VITE_API_BASE_URL=https://your-render-service.onrender.com/api`
- `VITE_WS_URL=wss://your-render-service.onrender.com/ws`

3. Build command:

```bash
npm run build
```

4. Output directory:

```bash
dist
```

## Testing Locally

Useful checks while developing:

- Open `http://localhost:5173`
- Hit `http://localhost:5050/api/health`
- Inspect dashboard, alerts, trust score, and withdrawal pages
- Try the withdrawal and fraud alert detail modals
- Watch live activity updates over WebSocket

The backend starts empty without Postgres, and the Nomba credit path now has a cron-sync test route. If you want real persistence, connect Postgres and run `npm run db:push`.

## Notes

- No API keys are committed to the repository.
- Keep secrets in `.env` only.
- The AI layer is implemented as a practical fraud and risk scoring engine with explainable signals for the hackathon MVP, with a roadmap to trained ML models after the event.
