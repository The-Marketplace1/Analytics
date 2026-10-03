# Analytics event contract

Events are versioned records describing Marketplace product behaviour. The
contract is provider-neutral so clients and services do not depend on an
external analytics vendor. Version 1 is currently supported; unsupported
versions and unknown fields are rejected.

## Required fields

`eventId`, `eventType`, `version`, `occurredAt`, `actor`, `platform`,
`application`, `environment`, `properties`, and `consent` are required.

`eventType` uses lower-case dotted names such as `booking.started`,
`booking.completed`, `profile.viewed`, and `notification.opened`. `properties`
is a flat map of primitive values, not an arbitrary nested object.

## Privacy rules

The service rejects credentials, personal contact and identity details,
payment-card data, private message contents, and precise location values. User,
anonymous, session, and resource identifiers are HMAC-pseudonymised before
storage and provider delivery. The host supplies the key and must keep it
stable across app instances. Events without analytics consent are dropped and
never forwarded to a provider.

`eventId` is the idempotency key. Repeated equivalent events are counted as
duplicates; reusing an ID with different event data returns a conflict. Host
stores must atomically insert-if-absent, and provider adapters must make
delivery idempotent by this same ID.

## Reporting

Reports expose event counts, unique actors, unique sessions, platform
breakdowns, and the booking funnel. They are product analytics, not technical
monitoring, operational health, or exact transactional truth.
