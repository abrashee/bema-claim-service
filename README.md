# bema-claim-service

NestJS claim-processing service.

## Environment variables

Required:

- `DATABASE_URL` - PostgreSQL connection string used by Prisma
- `JWT_SECRET` - minimum 32 characters, shared with `identity-service`
- `REDIS_HOST` - queue, idempotency and rate-limit backend host
- `REDIS_PORT` - queue, idempotency and rate-limit backend port
- `WEBSOCKET_ORIGIN` - explicit allowed Socket.IO browser origin
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` - explicit OTLP/HTTP trace endpoint

Optional:

- `PORT` - HTTP listen port, defaults to `8083`
- `NODE_ENV` - runtime environment, defaults to `production`
- `REQUEST_BODY_LIMIT` - JSON body limit, defaults to `64kb`
- `REDIS_CONNECT_TIMEOUT_MS` - Redis connection timeout, defaults to `2000`
- `CLAIM_CREATE_RATE_LIMIT` - claim creation limit per window, defaults to `10`
- `CLAIM_CREATE_RATE_WINDOW_MS` - claim-rate window, defaults to `60000`
- `CLAIM_QUEUE_BACKPRESSURE_LIMIT` - queue overload threshold, defaults to `1000`
- `USER_SERVICE_URL` - downstream user-service base URL, defaults to `http://user-service:8081`

## Endpoints

- `GET /` - service status
- `GET /api/claims` - authenticated claim list for the current user
- `POST /api/claims` - authenticated claim creation, supports optional `Idempotency-Key`
- `GET /api/claims/:id` - authenticated claim lookup for the current user
- `GET /api/claims/actuator/health` - liveness/readiness probe
- `GET /actuator/prometheus` - Prometheus scrape endpoint

All claim endpoints require `Authorization: Bearer <JWT>` issued by `identity-service`.

<!-- BEMA-LICENSE-SECTION:START -->
## License and use

Copyright © 2026 Abdul Rasheed Momand.

This repository is part of **Bema**, a demonstration and portfolio project built to present software-engineering, security, observability, containerization, testing, and cloud-deployment skills.

The Bema-authored source code in this repository is licensed under the **MIT License**. The complete controlling terms are available in the repository's [`LICENSE`](LICENSE) file.

### Permitted use

Subject to the MIT License, the software may be:

- viewed and evaluated by recruiters, hiring managers, technical reviewers, and other interested parties;
- used for learning, education, research, experimentation, and personal projects;
- used, copied, modified, merged, published, distributed, sublicensed, or sold;
- incorporated into commercial or noncommercial software.

Copies or substantial portions of the software must retain the copyright notice and MIT License notice.

### No warranty or guarantee

This software is provided **“AS IS”**, without warranty of any kind, express or implied. No guarantee is made regarding its correctness, reliability, availability, security, fitness for a particular purpose, or suitability for production use.

To the extent permitted by applicable law, the author and copyright holder are not liable for claims, damages, losses, or other liability arising from the software or its use.

The [`LICENSE`](LICENSE) file contains the legally controlling terms. This README section is only a practical summary.

### Third-party components

Dependencies, container images, fonts, icons, GitHub Actions, and other third-party materials remain governed by their respective licenses. The MIT License for Bema-authored code does not replace or modify those third-party terms.

Third-party attribution and license notices will be maintained separately where required.
<!-- BEMA-LICENSE-SECTION:END -->
