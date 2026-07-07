# bema-claim-service

NestJS claim-processing service.

## Required environment variables

- `PORT` - HTTP listen port, defaults to `8083`
- `NODE_ENV` - `development` or `production`
- `JWT_SECRET` - minimum 32 characters, shared with `identity-service`
- `REDIS_HOST` / `REDIS_PORT` - queue and rate-limit backend
- `WEBSOCKET_ORIGIN` - allowed browser origin for Socket.IO
- `REQUEST_BODY_LIMIT` - JSON body limit, defaults to `64kb`
- `CLAIM_CREATE_RATE_LIMIT` / `CLAIM_CREATE_RATE_WINDOW_MS` - write throttle
- `CLAIM_QUEUE_BACKPRESSURE_LIMIT` - fail closed when queue is overloaded
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` - OTLP trace endpoint
- `USER_SERVICE_URL` - downstream user service base URL

## Endpoints

- `GET /` - service status
- `GET /api/claims` - authenticated claim list for the current user
- `POST /api/claims` - authenticated claim creation, supports optional `Idempotency-Key`
- `GET /api/claims/:id` - authenticated claim lookup for the current user
- `GET /api/claims/actuator/health` - liveness/readiness probe
- `GET /actuator/prometheus` - Prometheus scrape endpoint

All claim endpoints require `Authorization: Bearer <JWT>` issued by `identity-service`.
