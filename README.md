# Marketplace Analytics

Marketplace Analytics is a provider-independent product analytics service for
registration, discovery, booking, communication, notification, review, dispute,
and engagement events. It reports product usage and conversion; it is not an
infrastructure monitoring or service-health platform.

## Run and validate

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm run validate
```

The local server listens on `PORT` or `5000`. Without an injected trusted
authorizer, protected endpoints deny requests; `/health` is liveness only.

## Integrate with a host application

Import `createApp` from the `marketplace-analytics/app` package export and pass
host-owned adapters:

- `store`: durable event storage with atomic insert-if-absent behavior keyed by
  `eventId`.
- `providers`: one or more `AnalyticsProvider` implementations. Each provider
  must make `track` idempotent by `eventId`, and implement user deletion and
  retention deletion.
- `authorize`: a callback that checks roles against the host's authenticated
  principal. It must use trusted upstream authentication context, not client-set
  role headers.
- `pseudonymisationKey`: a secret of at least 32 bytes, supplied through the
  host's secret manager (or `ANALYTICS_PSEUDONYMISATION_KEY`).

Production startup fails closed unless durable storage, idempotent providers,
trusted authorization, and the pseudonymisation key are provided. This package
does not create or own the host application's database schema, authentication,
bookings, payments, notifications, or realtime services. Host repositories
should implement these interfaces at their integration boundary.

## API

- `GET /health` — minimal process liveness; no dependency or infrastructure
  status.
- `POST /v1/events/batch` — authenticated `ingest` or `admin` role.
- `GET /v1/reports/summary` — authenticated `analyst` or `admin` role.
- `POST /v1/privacy/deletion-requests` — authenticated `admin` role.
- `POST /v1/privacy/retention/purge` — authenticated `admin` role.

See [the OpenAPI contract](docs/openapi.yaml) for request and response details.

## Event contract and privacy

Events use the versioned contract in [docs/event-contract.md](docs/event-contract.md).
Identifiers are HMAC-pseudonymised before storage or provider delivery. The
service rejects sensitive fields and values, drops events without analytics
consent, deduplicates retries by `eventId`, and reports conflicting reuse of an
ID as a conflict. Product reports are not a substitute for transactional truth.
