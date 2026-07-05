# VeriFund Backend Routes

## Health
- `GET /health`
- `GET /api/health`

## Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me/cooperatives`

## Cooperative
- `POST /api/cooperative`
- `POST /api/cooperative/:id/members`
- `GET /api/cooperative/:id`
- `GET /api/cooperative/:id/trust-score`
- `GET /api/cooperatives/:id`
- `GET /api/cooperatives/:id/trust-score`

## Dashboard
- `GET /api/dashboard`

## Contributions
- `POST /api/contribution`

## Cron Sync
- `GET /api/cron/nomba/status`
- `POST /api/cron/nomba/run`
- `POST /api/cron/nomba/test-credit`

## Nomba
- `GET /api/nomba/banks`
- `POST /api/nomba/verify-account`
- `POST /api/nomba/simulate-deposit`
- `GET /api/nomba/transactions`
- `GET /api/nomba/transactions/:cooperativeId`

## Risk
- `GET /api/risk/:cooperativeId`

## Fraud
- `GET /api/fraud/alerts`
- `GET /api/fraud/alerts/:id`
- `GET /api/fraud/audit/log/:cooperativeId`
- `POST /api/fraud/whistleblower/report`
- `GET /api/fraud-alerts`
- `GET /api/fraud-alerts/:id`

## Webhooks
- `POST /api/webhooks/nomba`

## Withdrawals
- `GET /api/withdrawal`
- `POST /api/withdrawal/request`
- `POST /api/withdrawal/request/preview`
- `GET /api/withdrawal/:id`
- `POST /api/withdrawal/:id/sign`
- `POST /api/withdrawal/:id/release`
- `GET /api/withdrawals`
- `POST /api/withdrawals/request`
- `POST /api/withdrawals/request/preview`
- `GET /api/withdrawals/:id`
- `POST /api/withdrawals/:id/sign`
- `POST /api/withdrawals/:id/release`

## Misc
- `GET /api/state`
- `GET /api/trust-score/:id`
