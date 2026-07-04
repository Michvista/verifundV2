# VeriFund Frontend Integration Guide

This guide documents the current VeriFund backend contract for frontend integration. It is based on the Express/TypeScript backend in `server/src` and the existing frontend API client in `src/services/api.ts`.

## Runtime URLs

Local development:

```env
VITE_API_BASE_URL=http://localhost:5050/api
VITE_WS_URL=ws://localhost:5050/ws
```

Production example:

```env
VITE_API_BASE_URL=https://your-render-service.onrender.com/api
VITE_WS_URL=wss://your-render-service.onrender.com/ws
```

The backend also exposes health checks outside and inside the API prefix:

- `GET /health`
- `GET /api/health`

Both return:

```json
{
  "ok": true,
  "service": "verifund-api",
  "mode": "monolith",
  "nombaMode": "mock",
  "time": "2026-07-03T00:00:00.000Z"
}
```

`nombaMode` is `live` only when real Nomba credentials are configured.

## Request Conventions

All API requests and responses use JSON.

```ts
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5050/api";
```

Use `Content-Type: application/json` on requests with a body.

Protected endpoints require:

```http
Authorization: Bearer <jwt>
```

The current frontend stores the token in:

```ts
localStorage.setItem("verifund_token", token);
localStorage.setItem("verifund_user", JSON.stringify(member));
```

Error responses generally use:

```json
{ "message": "Human readable error" }
```

## Demo Seed Users

The seeded login IDs are useful for local and hackathon demos:

| Member ID | Role |
| --- | --- |
| `mem-01` | `treasurer` |
| `mem-02` | `executive1` |
| `mem-03` | `executive2` |
| `admin-01` | `admin` |
| `reg-01` | `regulator` |

Role names are lowercase in backend responses and JWT claims.

## Authentication

### Register Member

```http
POST /api/auth/register
```

Body:

```json
{
  "firstName": "Ada",
  "lastName": "Okafor",
  "phoneNumber": "+2348000000000",
  "bvnHash": "hash_bvn_unique"
}
```

Success `201`:

```json
{
  "member": {
    "id": "mem_...",
    "firstName": "Ada",
    "lastName": "Okafor",
    "phoneNumber": "+2348000000000",
    "bvnHash": "hash_bvn_unique",
    "bvnVerified": true,
    "bvnVerifiedAt": "2026-07-03T00:00:00.000Z",
    "role": "member",
    "isActive": true
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
    "accountRef": "va_mem_..."
  }
}
```

Validation error `400`:

```json
{
  "message": "firstName, lastName, phoneNumber, and bvnHash are required"
}
```

### Login

```http
POST /api/auth/login
```

Body:

```json
{ "memberId": "mem-01" }
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

## Dashboard

### Get Dashboard Summary

```http
GET /api/dashboard?cooperativeId=okafor-farmers-thrift
```

`cooperativeId` is optional. If omitted, the backend defaults to `okafor-farmers-thrift`.

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

## Cooperatives And Trust Score

The cooperative routes are mounted at both `/api/cooperative` and `/api/cooperatives`.

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

`cooperativeType` must be one of:

- `thrift`
- `credit`
- `multipurpose`

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
    "bvnVerified": true,
    "expectedAmount": 20000,
    "provider": "nomba-mock"
  }
}
```

### Get Cooperative

Public endpoint.

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
  "healthScore": 92,
  "healthScoreUpdatedAt": "2026-06-30T00:00:00.000Z",
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

Public endpoint.

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

## Nomba Utilities

These endpoints run in mock mode unless live Nomba credentials are configured.

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

### Simulate Deposit Webhook

Useful for local demos and realtime feed testing.

```http
POST /api/nomba/simulate-deposit
```

Body:

```json
{
  "cooperativeId": "okafor-farmers-thrift",
  "memberId": "mem-01",
  "amount": 20000,
  "expectedAmount": 20000,
  "duplicateBvn": false,
  "historyCount": 4
}
```

Success:

```json
{
  "success": true,
  "message": "Webhook simulated and processed successfully",
  "payload": {
    "cooperativeId": "okafor-farmers-thrift",
    "memberId": "mem-01",
    "amount": 20000,
    "expectedAmount": 20000,
    "duplicateBvn": false,
    "historyCount": 4,
    "eventType": "virtual_account_deposit",
    "timestamp": "2026-07-03T00:00:00.000Z"
  },
  "signature": "mock-signature-abc",
  "signatureHeader": "signature",
  "response": {
    "ok": true,
    "received": true,
    "riskScore": 0.08,
    "riskCategory": "low",
    "reasons": [],
    "healthScore": 92,
    "eventType": "virtual_account_deposit"
  }
}
```

## Withdrawals

Withdrawal routes are mounted at both `/api/withdrawal` and `/api/withdrawals`.

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
      "createdAt": "2023-10-24T00:00:00.000Z",
      "average30d": 510000,
      "signatureCount": 1,
      "explanations": [
        "Amount is 3.8x the rolling 30-day average"
      ]
    }
  ]
}
```

With Prisma enabled, the field returned by the database relation is `requestedById`; fallback data uses `requestedBy`. Frontend mapping should support both:

```ts
const requester = item.requestedBy ?? item.requestedById;
```

### Get Withdrawal

Public in the current backend.

```http
GET /api/withdrawals/:id
```

Success response is one withdrawal object. Missing items return:

```json
{ "message": "Withdrawal item not found" }
```

### Preview Withdrawal Risk

Public in the current backend.

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
  "riskScore": 0.5,
  "riskCategory": "medium",
  "reasons": [
    "Amount is 4.8x the rolling 30-day average"
  ],
  "signals": {
    "ratio": 4.803921568627451,
    "zScore": 2716.915,
    "signatureCount": 1,
    "destinationVerified": true,
    "bvnDuplicate": false
  },
  "explanation": [
    "Amount is 4.8x the rolling 30-day average"
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
  "withdrawalId": "wf_...",
  "riskScore": 0.5,
  "riskCategory": "medium",
  "reasons": [
    "Amount is 4.8x the rolling 30-day average"
  ],
  "signals": {
    "ratio": 4.803921568627451,
    "zScore": 2716.915,
    "signatureCount": 1,
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
  "memberId": "mem-02",
  "role": "executive1"
}
```

Success:

```json
{
  "withdrawalId": "wf-9042",
  "signatureCount": 2,
  "status": "partially_signed"
}
```

Status becomes `approved` when `signatureCount >= 3`.

### Release Withdrawal

Requires `admin` or `treasurer`.

```http
POST /api/withdrawals/:id/release
Authorization: Bearer <jwt>
```

Body is currently ignored by the backend, so send `{}`.

Success:

```json
{
  "withdrawalId": "wf-9042",
  "transferRef": "nomba_trf_2042",
  "status": "released",
  "provider": "nomba-mock"
}
```

## Fraud, Audit, And Whistleblower

Fraud routes are mounted at both `/api/fraud/...` and `/api/...` for the same route definitions. The existing frontend uses the short aliases (`/alerts`, `/alerts/:id`).

### List Alerts

Requires `admin` or `regulator`.

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
      "createdAt": "2023-10-24T09:12:11.000Z",
      "title": "Large withdrawal outside baseline",
      "reason": "Requested amount is 4.7x the 30-day average.",
      "severity": "High"
    }
  ]
}
```

The current frontend `AlertItem` type expects an `evidence` field, but the backend returns `evidenceJson`. Map it at the API boundary:

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

### Get Audit Log

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
      "createdAt": "2023-10-20T08:00:00.000Z"
    }
  ]
}
```

### Submit Whistleblower Report

Public endpoint.

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
    "id": "...",
    "submittedAt": "2026-07-03T00:00:00.000Z",
    "report": "I noticed repeated withdrawals to the same destination account.",
    "supportingDetails": "The pattern happened three times in June.",
    "status": "open"
  },
  "alert": {
    "id": "...",
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

## Risk Preview

```http
GET /api/risk/:cooperativeId
```

Success:

```json
{
  "cooperativeId": "okafor-farmers-thrift",
  "riskScore": 0.41,
  "riskCategory": "low",
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

This endpoint uses hardcoded sample values for its withdrawal preview. Use `/api/withdrawals/request/preview` when the frontend needs a preview for user-entered form values.

## Webhooks

### Nomba Webhook Receiver

```http
POST /api/webhooks/nomba
```

This endpoint is intended for Nomba or the simulator, not regular frontend calls.

Signature rules:

- Header defaults to `signature`.
- Override with `NOMBA_SIGNATURE_HEADER`.
- Legacy `x-nomba-signature` is also accepted.
- In mock mode, signatures containing `mock` are accepted.

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

Invalid signature:

```json
{
  "ok": false,
  "message": "Invalid webhook signature"
}
```

## Realtime WebSocket

Connect to:

```ts
const socket = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:5050/ws");
```

Initial message:

```json
{
  "type": "connected",
  "message": "VeriFund live feed connected",
  "timestamp": "2026-07-03T00:00:00.000Z"
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

Known event types:

- `connected`
- `nomba-api-call`
- `nomba-webhook`
- `contribution`
- `withdrawal`
- `withdrawal-signature`
- `withdrawal-release`
- `whistleblower`

Example client:

```ts
export function connectVerifundFeed(onEvent: (event: FeedEvent) => void) {
  const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:5050/ws";
  const socket = new WebSocket(wsUrl);

  socket.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data));
    } catch {
      // Ignore malformed messages from non-VeriFund sources.
    }
  };

  return () => socket.close();
}
```

## Suggested Frontend API Wrapper

The current `src/services/api.ts` already follows this pattern. Keep backend-only naming differences contained here so pages can consume stable UI types.

```ts
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("verifund_token");
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

Normalize backend response differences at the service layer:

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

## Auth And Role Matrix

| Endpoint | Auth | Roles |
| --- | --- | --- |
| `POST /api/auth/register` | No | Public |
| `POST /api/auth/login` | No | Public |
| `GET /api/dashboard` | No | Public |
| `POST /api/cooperative` | Yes | `admin` |
| `GET /api/cooperative/:id` | No | Public |
| `GET /api/cooperative/:id/trust-score` | No | Public |
| `GET /api/nomba/banks` | No | Public |
| `POST /api/nomba/verify-account` | No | Public |
| `POST /api/nomba/simulate-deposit` | No | Public/demo |
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

## Current Integration Notes

- `src/services/api.ts` defaults to `http://localhost:5050/api`, but `npm run dev` starts Vite on port `5174`, not `5173`.
- Several frontend service calls use local fallback data when the backend is unavailable. This is helpful for demos, but production screens should surface backend errors for protected workflows such as withdrawals and alerts.
- Protected endpoints will return `401` when there is no bearer token and `403` when the logged-in user role is not allowed.
- The backend has duplicate route mounts for convenience: `/api/cooperative` and `/api/cooperatives`, `/api/withdrawal` and `/api/withdrawals`, plus fraud aliases under `/api` and `/api/fraud`.
- For alerts, backend persistence uses `evidenceJson`; the current frontend type mentions `evidence`. Normalize once in the API client.
- For withdrawals, database-backed rows use Prisma's `requestedById`; fallback seed data uses `requestedBy`. Normalize once in the API client.
- `GET /api/state` returns the full in-memory state object in fallback mode, but count totals in database mode. Use it only for diagnostics, not user-facing UI.
