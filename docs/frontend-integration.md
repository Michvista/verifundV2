# VeriFund Frontend Integration Guide

This document describes the current backend contract for building or updating a frontend against VeriFund. It is based on the Express/TypeScript backend in `server/src`, the Prisma schema in `prisma/schema.prisma`, and the existing client wrapper in `src/services/api.ts`.

## 1. Runtime Setup

Local backend:

```env
PORT=5050
```

Local frontend:

```env
VITE_API_BASE_URL=http://localhost:5050/api
VITE_WS_URL=ws://localhost:5050/ws
```

Production example:

```env
VITE_API_BASE_URL=https://your-api-host.example.com/api
VITE_WS_URL=wss://your-api-host.example.com/ws
```

The root frontend app runs on Vite port `5174`:

```bash
npm run dev
```

Backend-only:

```bash
npm run api
```

## 2. Transport Rules

All normal API endpoints accept and return JSON. Send `Content-Type: application/json` for requests with a body.

The API base URL should include `/api`. The existing frontend default is:

```ts
const baseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:5050/api";
```

Protected routes require a bearer token:

```http
Authorization: Bearer <jwt>
```

The existing frontend stores auth state in local storage:

```ts
localStorage.setItem("verifund_token", token);
localStorage.setItem("verifund_user", JSON.stringify(member));
```

Error responses generally use:

```json
{ "message": "Human readable error" }
```

Protected endpoint failures:

- `401` means the token is missing or invalid.
- `403` means the token is valid but the member role is not allowed.

## 3. Health Checks

```http
GET /health
GET /api/health
```

Response:

```json
{
  "ok": true,
  "service": "verifund-api",
  "mode": "monolith",
  "nombaMode": "mock",
  "time": "2026-07-05T12:00:00.000Z"
}
```

`nombaMode` is `live` only when real Nomba credentials are configured. Otherwise the backend stays usable through deterministic mock/fallback flows.

## 4. Auth

### Register

```http
POST /api/auth/register
```

Body:

```json
{
  "firstName": "Ada",
  "lastName": "Okafor",
  "phoneNumber": "+2348000000000",
  "password": "Password123!",
  "bvnHash": "hash_bvn_unique",
  "role": "member"
}
```

Required fields are `firstName`, `lastName`, `phoneNumber`, `password`, and `bvnHash`. `role` is optional and defaults to `member`. Passwords are hashed by the backend before storage and are never returned by the API.

Success `201`:

```json
{
  "member": {
    "id": "mem_123",
    "firstName": "Ada",
    "lastName": "Okafor",
    "phoneNumber": "+2348000000000",
    "bvnVerified": true,
    "role": "member"
  },
  "verification": {
    "verified": true,
    "duplicateCount": 0,
    "bvnNameMatch": true,
    "details": { "duplicateCount": 0 }
  },
  "nomba": {
    "accountCreated": true,
    "virtualAccountCreated": true,
    "accountRef": "va_mem_123"
  }
}
```

### Login

```http
POST /api/auth/login
```

Body:

```json
{
  "phoneNumber": "+2348000000001",
  "password": "Password123!"
}
```

Success:

```json
{
  "token": "<jwt>",
  "member": {
    "id": "mem-01",
    "firstName": "Amina",
    "lastName": "Okafor",
    "role": "treasurer"
  }
}
```

Demo/fallback users all use password `Password123!`:

| Phone Number | Member ID | Role |
| --- | --- | --- |
| `+2348000000001` | `mem-01` | `treasurer` |
| `+2348000000002` | `mem-02` | `executive1` |
| `+2348000000003` | `mem-03` | `executive2` |
| `+2348000000004` | `admin-01` | `admin` |
| `+2348000000005` | `reg-01` | `regulator` |

## 5. Dashboard

```http
GET /api/dashboard?cooperativeId=okafor-farmers-thrift
```

`cooperativeId` is optional. If omitted, the backend uses its default cooperative.

Success:

```json
{
  "balance": 482000.5,
  "nextContribution": "Jan 15, NGN 20,000",
  "tenure": "14 Months Active",
  "trustScore": 92,
  "loanStatus": "Eligible",
  "activityFeed": [
    {
      "id": "feed-1",
      "title": "New Member Joined",
      "text": "Adewale K. joined the Lagos Mainland cell.",
      "time": "2 mins ago"
    }
  ],
  "contributionTrend": [18, 21, 19, 24],
  "contributionHistory": [
    {
      "id": "txn-9921-xf",
      "date": "2023-12-15",
      "amount": 20000,
      "status": "confirmed",
      "reference": "TXN-9921-XF"
    }
  ],
  "cooperativeId": "okafor-farmers-thrift",
  "healthScore": 92
}
```

## 6. Cooperatives And Trust Score

The backend mounts cooperative routes at both `/api/cooperative` and `/api/cooperatives`. Prefer the singular form because the current frontend uses it.

### Create Cooperative

Requires `admin`.

```http
POST /api/cooperative
Authorization: Bearer <admin jwt>
```

Body:

```json
{
  "name": "Lagos Market Women Cooperative",
  "registrationNumber": "LMW-2026-001",
  "stateName": "Lagos",
  "cooperativeType": "thrift",
  "bvn": "12345678901"
}
```

Required fields are `name`, `registrationNumber`, `stateName`, and `cooperativeType`.

Success `201`:

```json
{
  "cooperative": {
    "id": "lmw-2026-001",
    "name": "Lagos Market Women Cooperative",
    "registrationNumber": "LMW-2026-001",
    "state": "Lagos",
    "cooperativeType": "thrift",
    "nombaVirtualAccountRef": "va_LMW-2026-001",
    "nombaAccountId": "acct_5191",
    "nombaVirtualAccountNumber": "901005191",
    "healthScore": 92,
    "isActive": true,
    "memberCount": 0,
    "balance": 0
  },
  "virtualAccount": {
    "success": true,
    "accountId": "acct_5191",
    "accountRef": "va_LMW-2026-001",
    "accountName": "Lagos Market Women Cooperative",
    "accountNumber": "901005191",
    "bankName": "Nomba (mock)",
    "currency": "NGN",
    "provider": "nomba-mock"
  }
}
```

If Nomba virtual account creation fails, the endpoint returns `502` with a `message`.

### Get Cooperative

Public endpoint:

```http
GET /api/cooperative/:id
```

Success:

```json
{
  "id": "okafor-farmers-thrift",
  "name": "Okafor Farmers Thrift & Credit",
  "registrationNumber": "2024-X99",
  "state": "Lagos",
  "cooperativeType": "thrift",
  "nombaVirtualAccountRef": "VA-OF-2049",
  "nombaAccountId": "ACCT-4491",
  "nombaVirtualAccountNumber": "901004491",
  "healthScore": 92,
  "healthScoreUpdatedAt": "2026-07-05T12:00:00.000Z",
  "isActive": true,
  "memberCount": 1248,
  "balance": 48200050,
  "trustHistory": [42, 48, 54],
  "scoreBreakdown": [
    { "label": "Member Verification", "value": 95 }
  ]
}
```

### Get Trust Score

Public endpoint:

```http
GET /api/cooperative/:id/trust-score
```

Alias:

```http
GET /api/trust-score/:id
```

Success:

```json
{
  "id": "okafor-farmers-thrift",
  "name": "Okafor Farmers Thrift & Credit",
  "score": 92,
  "summary": "This cooperative maintains a 98% timely contribution rate and has no outstanding dispute records.",
  "scoreBreakdown": [
    { "label": "Member Verification", "value": 95 },
    { "label": "Contribution Regularity", "value": 88 }
  ],
  "history": [42, 46, 50, 53]
}
```

## 7. Contributions

Requires one of `member`, `treasurer`, or `admin`.

```http
POST /api/contribution
Authorization: Bearer <jwt>
```

Body:

```json
{
  "memberId": "mem-01",
  "cooperativeId": "okafor-farmers-thrift",
  "amount": 20000,
  "expectedAmount": 20000,
  "duplicateBvn": false
}
```

Required fields are `memberId`, `cooperativeId`, and `amount`.

Success `201`:

```json
{
  "contribution": {
    "id": "contrib_123",
    "memberId": "mem-01",
    "cooperativeId": "okafor-farmers-thrift",
    "amount": 20000,
    "nombaTransactionRef": "manual_123",
    "status": "confirmed",
    "riskScore": 0.08,
    "contributedAt": "2026-07-05T12:00:00.000Z"
  },
  "result": {
    "riskScore": 0.08,
    "riskCategory": "low",
    "reasons": []
  }
}
```

## 8. Nomba Utilities

These endpoints run in mock mode unless Nomba credentials are configured.

### List Banks

```http
GET /api/nomba/banks
```

Success:

```json
{
  "banks": [
    { "code": "058", "name": "Guaranty Trust Bank" },
    { "code": "011", "name": "First Bank of Nigeria" }
  ],
  "mode": "mock"
}
```

`mode` can be `mock`, `live`, or `fallback`.

### Verify Bank Account

```http
POST /api/nomba/verify-account
```

Body:

```json
{
  "accountNumber": "0123456789",
  "bankCode": "058"
}
```

Success:

```json
{
  "verified": true,
  "accountName": "Verified Account Holder (mock)",
  "provider": "nomba-mock",
  "mode": "mock"
}
```

### Simulate Deposit

This is a frontend/demo helper. It now queues a test credit and immediately runs the same cron sync path that posts Nomba credits into the treasury balance.

```http
POST /api/nomba/simulate-deposit
```

Body:

```json
{
  "cooperativeId": "okafor-farmers-thrift",
  "amount": 20000,
  "nombaTransactionRef": "demo-credit-001"
}
```

Required fields are `cooperativeId` and `amount`.

Success:

```json
{
  "success": true,
  "message": "Test credit queued and processed by the cron sync path",
  "credit": {
    "id": "credit_123",
    "cooperativeId": "okafor-farmers-thrift",
    "amount": 20000,
    "nombaTransactionRef": "demo-credit-001",
    "source": "test",
    "createdAt": "2026-07-05T12:00:00.000Z"
  },
  "pollResult": {
    "trigger": "test",
    "scannedTransactions": 0,
    "processedCredits": 1,
    "queuedCreditsProcessed": 1,
    "matchedCooperatives": 1,
    "pendingCredits": 0,
    "lastRunAt": "2026-07-05T12:00:00.000Z",
    "source": "local-queue"
  }
}
```

## 9. Nomba Cron Controls

These routes are currently public in the backend and are intended for demos, admin dashboards, or manual testing.

### Status

```http
GET /api/cron/nomba/status
```

Success:

```json
{
  "running": true,
  "lastRunAt": "2026-07-05T12:00:00.000Z",
  "pendingCredits": 0,
  "pollIntervalMs": 60000,
  "nombaConfigured": false
}
```

### Queue Test Credit

```http
POST /api/cron/nomba/test-credit
```

Body:

```json
{
  "cooperativeId": "okafor-farmers-thrift",
  "amount": 20000,
  "nombaTransactionRef": "demo-credit-002"
}
```

Success `201`:

```json
{
  "queued": true,
  "credit": {
    "id": "credit_123",
    "cooperativeId": "okafor-farmers-thrift",
    "amount": 20000,
    "nombaTransactionRef": "demo-credit-002",
    "source": "test",
    "createdAt": "2026-07-05T12:00:00.000Z"
  },
  "note": "Run the cron sync route to post this credit into the treasury balance."
}
```

### Run Credit Sync

```http
POST /api/cron/nomba/run
```

Body:

```json
{ "trigger": "manual" }
```

`trigger` can be `manual` or `test`.

Success:

```json
{
  "trigger": "manual",
  "scannedTransactions": 0,
  "processedCredits": 1,
  "queuedCreditsProcessed": 1,
  "matchedCooperatives": 1,
  "pendingCredits": 0,
  "lastRunAt": "2026-07-05T12:00:00.000Z",
  "source": "local-queue"
}
```

## 10. Withdrawals

Withdrawal routes are mounted at both `/api/withdrawal` and `/api/withdrawals`. Prefer `/api/withdrawals`.

### List Withdrawals

Requires one of `admin`, `treasurer`, `executive1`, or `executive2`.

```http
GET /api/withdrawals
Authorization: Bearer <jwt>
```

Success:

```json
{
  "queue": [
    {
      "id": "wf-9042",
      "cooperativeId": "okafor-farmers-thrift",
      "requestedBy": "mem-01",
      "amount": 2450000,
      "destinationAccount": "0123456789",
      "destinationBankCode": "058",
      "purpose": "Equipment procurement for Q4 distribution run.",
      "riskScore": 0.41,
      "status": "partially_signed",
      "nombaTransferRef": null,
      "createdAt": "2026-07-05T12:00:00.000Z",
      "average30d": 510000,
      "signatureCount": 1,
      "explanations": [
        "Amount is 4.8x the rolling 30-day average"
      ]
    }
  ]
}
```

Database-backed rows may expose `requestedById`; fallback seed data exposes `requestedBy`. Normalize at the API boundary:

```ts
const requestedBy = item.requestedBy ?? item.requestedById;
```

### Get Withdrawal

Public in the current backend:

```http
GET /api/withdrawals/:id
```

Missing items return:

```json
{ "message": "Withdrawal item not found" }
```

### Preview Withdrawal Risk

Public in the current backend:

```http
POST /api/withdrawals/request/preview
```

Body:

```json
{
  "amount": 2450000,
  "average30d": 510000,
  "signatureCount": 1,
  "destinationVerified": true,
  "bvnDuplicate": false,
  "purpose": "Equipment procurement"
}
```

Success:

```json
{
  "riskScore": 0.9,
  "riskCategory": "high",
  "reasons": [
    "Amount is 4.8x the rolling 30-day average",
    "Withdrawal is missing the minimum approval threshold",
    "Withdrawal variance is significantly above the recent baseline"
  ],
  "signals": {
    "ratio": 4.803921568627451,
    "zScore": 2716.915,
    "signatureCount": 1,
    "destinationVerified": true,
    "bvnDuplicate": false
  },
  "explanation": [
    "Amount is 4.8x the rolling 30-day average",
    "Withdrawal is missing the minimum approval threshold",
    "Withdrawal variance is significantly above the recent baseline"
  ]
}
```

### Request Withdrawal

Requires `treasurer` or `admin`.

```http
POST /api/withdrawals/request
Authorization: Bearer <jwt>
```

Body:

```json
{
  "cooperativeId": "okafor-farmers-thrift",
  "requestedBy": "mem-01",
  "amount": 2450000,
  "destinationAccount": "0123456789",
  "destinationBankCode": "058",
  "purpose": "Equipment procurement for Q4 distribution run."
}
```

Success `201`:

```json
{
  "withdrawalId": "wf_123",
  "riskScore": 0.9,
  "riskCategory": "high",
  "reasons": [
    "Amount is 4.8x the rolling 30-day average"
  ],
  "signals": {
    "ratio": 4.803921568627451,
    "zScore": 2716.915,
    "signatureCount": 0,
    "destinationVerified": true,
    "bvnDuplicate": false
  },
  "status": "pending",
  "explanations": [
    "Amount is 4.8x the rolling 30-day average"
  ],
  "destinationAccountName": "Verified Account Holder (mock)"
}
```

### Sign Withdrawal

Requires one of `treasurer`, `executive1`, `executive2`, or `admin`.

```http
POST /api/withdrawals/:id/sign
Authorization: Bearer <jwt>
```

Body:

```json
{
  "role": "executive1"
}
```

`memberId` is inferred from the bearer token in the current backend, so the frontend does not need to send it.

Success:

```json
{
  "withdrawalId": "wf-9042",
  "signatureCount": 2,
  "status": "partially_signed"
}
```

Status becomes `approved` when enough signatures are collected by the repository logic.

### Release Withdrawal

Requires `admin` or `treasurer`.

```http
POST /api/withdrawals/:id/release
Authorization: Bearer <jwt>
```

Body can be `{}`. The backend currently ignores request body fields.

Success:

```json
{
  "withdrawalId": "wf-9042",
  "transferRef": "nomba_trf_2042",
  "status": "released",
  "provider": "nomba-mock"
}
```

Nomba transfer failures return `502` with a `message`.

## 11. Fraud, Audit, And Whistleblower

Fraud routes are mounted at both `/api/fraud/...` and `/api/...` for the same router. There are also app-level public aliases for fraud alerts.

### List Alerts

Requires `admin` or `regulator` for `/api/alerts` and `/api/fraud/alerts`.

```http
GET /api/alerts
Authorization: Bearer <jwt>
```

Aliases:

```http
GET /api/fraud/alerts
GET /api/fraud-alerts
```

`/api/fraud-alerts` is public in the current app-level alias.

Success:

```json
{
  "alerts": [
    {
      "id": "alert-01",
      "cooperativeId": "okafor-farmers-thrift",
      "alertType": "anomaly",
      "riskScore": 0.87,
      "triggeredBy": "withdrawal_amount_zscore",
      "evidenceJson": {
        "average30d": 510000,
        "requested": 2450000
      },
      "status": "open",
      "createdAt": "2026-07-05T12:00:00.000Z",
      "title": "Large withdrawal outside baseline",
      "reason": "Requested amount is 4.7x the 30-day average.",
      "severity": "High"
    }
  ]
}
```

Normalize alert evidence at the API boundary because frontend code may expect `evidence`:

```ts
const evidence = alert.evidenceJson ?? alert.evidence ?? {};
```

### Get Alert

Requires `admin` or `regulator` for `/api/alerts/:id` and `/api/fraud/alerts/:id`.

```http
GET /api/alerts/:id
Authorization: Bearer <jwt>
```

Public alias:

```http
GET /api/fraud-alerts/:id
```

Missing items return:

```json
{ "message": "Alert not found" }
```

### Audit Log

Requires `admin` or `regulator`.

```http
GET /api/audit/log/:cooperativeId
Authorization: Bearer <jwt>
```

Alias:

```http
GET /api/fraud/audit/log/:cooperativeId
```

Success:

```json
{
  "events": [
    {
      "id": "audit-01",
      "cooperativeId": "okafor-farmers-thrift",
      "eventType": "coop_created",
      "description": "Cooperative created with dedicated Nomba virtual account.",
      "metadata": {
        "accountRef": "VA-OF-2049"
      },
      "createdAt": "2026-07-05T12:00:00.000Z"
    }
  ]
}
```

### Submit Whistleblower Report

Public endpoint:

```http
POST /api/whistleblower/report
```

Alias:

```http
POST /api/fraud/whistleblower/report
```

Body:

```json
{
  "report": "I noticed repeated withdrawals to the same destination account.",
  "supportingDetails": "The pattern happened three times in June."
}
```

Success `201`:

```json
{
  "report": {
    "id": "report_123",
    "submittedAt": "2026-07-05T12:00:00.000Z",
    "report": "I noticed repeated withdrawals to the same destination account.",
    "supportingDetails": "The pattern happened three times in June.",
    "status": "open"
  },
  "alert": {
    "id": "alert_123",
    "cooperativeId": "okafor-farmers-thrift",
    "alertType": "whistleblower",
    "riskScore": 0.5,
    "triggeredBy": "whistleblower_triage",
    "evidenceJson": {},
    "status": "open",
    "title": "Anonymous whistleblower report received",
    "reason": "I noticed repeated withdrawals to the same destination account.",
    "severity": "Medium"
  }
}
```

## 12. Risk Preview

```http
GET /api/risk/:cooperativeId
```

Success:

```json
{
  "cooperativeId": "okafor-farmers-thrift",
  "riskScore": 0.9,
  "riskCategory": "high",
  "reasons": [
    "Amount is 4.8x the rolling 30-day average"
  ],
  "contributionSignal": {
    "riskScore": 0.08,
    "riskCategory": "low",
    "reasons": []
  }
}
```

This endpoint uses hardcoded sample values. For form-driven withdrawal risk previews, use:

```http
POST /api/withdrawals/request/preview
```

## 13. Webhooks

### Nomba Webhook Receiver

```http
POST /api/webhooks/nomba
```

This endpoint is meant for Nomba callbacks and simulator/test tooling, not normal frontend UI actions.

Signature behavior:

- Default header name is `signature`.
- `NOMBA_SIGNATURE_HEADER` can override the header name.
- Legacy `x-nomba-signature` is also accepted.
- In mock mode, signatures containing `mock` are accepted.

Body must include `cooperativeId`.

Success:

```json
{
  "ok": true,
  "received": true,
  "riskScore": 0.08,
  "riskCategory": "low",
  "reasons": [],
  "healthScore": 92,
  "eventType": "virtual_account_deposit"
}
```

Invalid signature returns `401`:

```json
{
  "ok": false,
  "message": "Invalid webhook signature"
}
```

## 14. Realtime WebSocket

Connect to the backend root, not the API base URL:

```ts
const socket = new WebSocket(
  import.meta.env.VITE_WS_URL || "ws://localhost:5050/ws",
);
```

Initial message:

```json
{
  "type": "connected",
  "message": "VeriFund live feed connected",
  "timestamp": "2026-07-05T12:00:00.000Z"
}
```

Event shape:

```ts
type FeedEvent = {
  type: string;
  message: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};
```

Known event types emitted by backend services include:

- `connected`
- `nomba-api-call`
- `nomba-webhook`
- `contribution`
- `withdrawal`
- `withdrawal-signature`
- `withdrawal-release`
- `whistleblower`

Client helper:

```ts
export function connectVerifundFeed(onEvent: (event: FeedEvent) => void) {
  const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:5050/ws";
  const socket = new WebSocket(wsUrl);

  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data));
    } catch {
      // Ignore malformed messages.
    }
  };

  return () => socket.close();
}
```

## 15. Frontend API Wrapper Pattern

Keep auth headers, error parsing, and backend shape normalization inside the service layer.

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("verifund_token");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

Recommended normalizers:

```ts
function normalizeAlert(alert: any) {
  return {
    ...alert,
    evidence: alert.evidenceJson ?? alert.evidence ?? {},
  };
}

function normalizeWithdrawal(item: any) {
  return {
    ...item,
    requestedBy: item.requestedBy ?? item.requestedById,
  };
}
```

## 16. Auth And Role Matrix

| Endpoint | Auth | Roles |
| --- | --- | --- |
| `POST /api/auth/register` | No | Public |
| `POST /api/auth/login` | No | Public |
| `GET /api/dashboard` | No | Public |
| `POST /api/cooperative` | Yes | `admin` |
| `GET /api/cooperative/:id` | No | Public |
| `GET /api/cooperative/:id/trust-score` | No | Public |
| `POST /api/contribution` | Yes | `member`, `treasurer`, `admin` |
| `GET /api/nomba/banks` | No | Public |
| `POST /api/nomba/verify-account` | No | Public |
| `POST /api/nomba/simulate-deposit` | No | Public/demo |
| `GET /api/cron/nomba/status` | No | Public/demo |
| `POST /api/cron/nomba/test-credit` | No | Public/demo |
| `POST /api/cron/nomba/run` | No | Public/demo |
| `GET /api/withdrawals` | Yes | `admin`, `treasurer`, `executive1`, `executive2` |
| `GET /api/withdrawals/:id` | No | Public in current backend |
| `POST /api/withdrawals/request/preview` | No | Public |
| `POST /api/withdrawals/request` | Yes | `treasurer`, `admin` |
| `POST /api/withdrawals/:id/sign` | Yes | `treasurer`, `executive1`, `executive2`, `admin` |
| `POST /api/withdrawals/:id/release` | Yes | `admin`, `treasurer` |
| `GET /api/alerts` | Yes | `admin`, `regulator` |
| `GET /api/alerts/:id` | Yes | `admin`, `regulator` |
| `GET /api/fraud-alerts` | No | Public alias |
| `GET /api/fraud-alerts/:id` | No | Public alias |
| `GET /api/audit/log/:cooperativeId` | Yes | `admin`, `regulator` |
| `POST /api/whistleblower/report` | No | Public |
| `GET /api/risk/:cooperativeId` | No | Public/sample |
| `POST /api/webhooks/nomba` | Signature | Nomba/simulator |

## 17. Integration Notes

- The backend is an Express monolith under `server/src` with route, controller, service, repository, and middleware layers.
- Prisma/Postgres is used when `DATABASE_URL` is configured. Without a database, the app falls back to demo store behavior.
- Nomba calls are live only when credentials are configured; otherwise the backend returns mock values and uses a local credit queue for deposit demos.
- `GET /api/state` is diagnostic. In fallback mode it returns the full in-memory state object; in database mode it returns count totals. Do not use it for user-facing UI.
- Several route families have aliases for compatibility. Prefer one canonical path in new frontend code: `/api/cooperative`, `/api/withdrawals`, `/api/fraud/...`, and `/api/nomba/...`.
- Keep protected workflow failures visible to users. Local fallback data is useful for demos, but withdrawal, fraud, and admin actions should surface backend errors.
