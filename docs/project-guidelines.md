# VeriFund Project Guidelines

These guidelines are based on the current VeriFund repo and the Nomba hackathon build specification in `verifund.md`.

## Product Direction

- Build VeriFund as an AI-powered cooperative treasury and fraud-detection platform for Nigerian cooperatives.
- Keep the central promise clear: contributions flow through Nomba virtual accounts, member/treasury activity is verified, and fraud signals are surfaced before funds leave.
- Prioritize demo-ready flows that prove real payment infrastructure value, not cosmetic API mentions.
- Treat the Nomba integration as a core product workflow: virtual accounts, transfer release, webhook/credit sync, bank lookup, and payment audit trails should stay visible in the user journey.

## Architecture Rules

- Keep the backend as a single Node.js + Express + TypeScript monolith under `server/src`.
- Do not introduce microservices, Docker Compose, FastAPI, Django, or a separate AI worker unless the project direction is explicitly changed.
- Keep backend responsibilities separated by the existing pattern:
  - `routes` define URLs and middleware.
  - `controllers` handle HTTP validation and response shape.
  - `services` contain domain logic, Nomba calls, realtime events, and scoring.
  - `repository`/data layer handles Prisma or fallback store access.
  - `middleware` handles auth and role checks.
- Keep the frontend as React + TypeScript + Vite under `src`.
- Keep Prisma/Postgres as the live persistence target, while preserving the local fallback/demo behavior where it already exists.

## Integration Contract

- Treat `docs/frontend-integration.md` as the frontend/backend contract for endpoints, payloads, auth, WebSocket behavior, and response normalization.
- Keep API calls centralized in `src/services/api.ts`; avoid scattering raw `fetch` calls across pages.
- Normalize backend shape differences in the API service layer, not inside individual pages.
- Use these local defaults unless deployment config says otherwise:

```env
VITE_API_BASE_URL=http://localhost:5050/api
VITE_WS_URL=ws://localhost:5050/ws
```

- The frontend runs on Vite port `5174`; the backend defaults to `5050`.

## Auth And Roles

- Store JWT auth consistently using the current frontend keys:

```ts
localStorage.setItem("verifund_token", token);
localStorage.setItem("verifund_user", JSON.stringify(member));
```

- Preserve backend role restrictions for protected treasury operations.
- Use lowercase role names: `member`, `treasurer`, `executive1`, `executive2`, `admin`, and `regulator`.
- Do not widen permissions in page code to make a UI action pass. Change the backend contract deliberately if permissions need to change.

## Nomba Rules

- Verify live Nomba endpoint names and fields against current Nomba docs before changing production payment calls.
- Keep mock/fallback Nomba mode usable for local demos, but make live-mode behavior explicit in code and docs.
- Do not fake success silently on protected money movement. If Nomba transfer, virtual account, or verification calls fail in live mode, surface a clear error.
- Keep webhook signature verification intact. Frontend code should use simulator/cron helper routes for demos instead of calling webhook internals directly.

## Fraud And Risk Logic

- Keep risk scoring explainable. Every score should have human-readable reasons that can be shown in the UI.
- Prefer deterministic, inspectable scoring for the hackathon demo over opaque model behavior.
- Preserve the main signals already represented in the backend:
  - contribution amount deviation
  - low contribution history
  - duplicate BVN signal
  - withdrawal amount versus baseline
  - missing approvals
  - unverified destination account
  - high-risk purpose keywords
- Emit audit/realtime events when user-visible financial or fraud workflows change.

## Frontend UX Priorities

- Build actual operational screens first, not marketing pages.
- Keep workflows clear for these user journeys:
  - member registration/login
  - cooperative onboarding and virtual account creation
  - dashboard balance and contribution visibility
  - withdrawal request, signing, and release
  - fraud alert review
  - whistleblower reporting
  - public trust lookup
- Surface backend errors clearly on protected workflows such as withdrawals, alerts, and admin actions.
- Keep local fallback/demo data helpful, but avoid letting fallback data hide integration failures.

## Development Workflow

- Run the full app locally with:

```bash
npm run dev
```

- Run only the backend with:

```bash
npm run api
```

- Before handing off code changes, run at least:

```bash
npm run build
```

- If Prisma schema changes are made, also run:

```bash
npm run db:generate
```

- Use `npm run db:push` only when intentionally applying schema changes to a configured database.

## Change Discipline

- Prefer small, contract-aligned changes over broad rewrites.
- Keep new backend endpoints documented in `docs/frontend-integration.md`.
- Keep environment variable changes reflected in `README.md` or a relevant docs file.
- Do not commit secrets, real BVNs, real customer data, or live payment credentials.
- When a feature touches money movement, auth, role permissions, or Nomba calls, include verification steps in the handoff notes.

## Deployment Assumptions

- Backend deployment target is Render: one web service plus managed Postgres.
- Frontend deployment can use Vercel or another static host pointed at the deployed API.
- Keep WebSocket URL configuration separate from HTTP API URL.
- Production should use real `DATABASE_URL`, `JWT_SECRET`, Nomba credentials, and webhook secret.

## Hackathon Focus

- Ship the strongest proof of the VeriFund loop: verified cooperative, Nomba-backed treasury account, contribution visibility, risk scoring, multi-signature withdrawal control, and fraud/audit transparency.
- If time is tight, prioritize one complete end-to-end path over many half-integrated screens.
- Demo the mock mode only as a local fallback; explain how live Nomba credentials switch the same workflows to real provider calls.
