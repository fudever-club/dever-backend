# DEVER Backend

REST API for the FU-DEVER Club platform. It provides authentication, member provisioning, public club content, profile privacy controls, and the admin-only workflows used by the companion web applications.

## Platform

| Application | Repository | Purpose |
| --- | --- | --- |
| Landing page | [fu-dever-landingpage](https://github.com/fudever-club/fu-dever-landingpage) | Public club information and content |
| Member portal | [dever-client](https://github.com/fudever-club/dever-client) | Member profile and club participation |
| Admin dashboard | [dever-admin](https://github.com/fudever-club/dever-admin) | Member and content administration |
| API | [dever-backend](https://github.com/fudever-club/dever-backend) | This service |

Production API: `https://dever-backend-production.up.railway.app`

Health check: `GET /health` · readiness check: `GET /ready`

## Capabilities

- JWT authentication with server-side role checks.
- Admin-only manual and CSV member provisioning; the server issues one-time temporary credentials.
- Public, privacy-aware member profiles using opaque profile keys rather than database identifiers.
- Projects, albums, activities, blogs, resources, events, Project Lab, alumni, and LeetCode leaderboard data.
- Swagger documentation at `/docs` when the service is running.

## Local development

Requires Node.js 20+ and a MongoDB connection.

```bash
npm ci
Copy-Item .env.example .env
npm run dev
```

The API listens on `http://localhost:5000` by default. Railway supplies `PORT` in production.

## Configuration

Do not commit `.env` files or production secrets.

| Variable | Required | Description |
| --- | --- | --- |
| `DB_URI` | Yes | MongoDB connection string |
| `APP_SECRET` | Yes | JWT signing secret; set only in the deployment platform |
| `PUBLIC_PROFILE_KEY_SECRET` | Yes | Stable secret used to derive opaque public profile keys |
| `CORS_ORIGINS` | Yes | Comma-separated allowed frontend origins |
| `APP_PORT` | Local only | Local port; defaults to `5000` |

For a frontend environment, set `NEXT_PUBLIC_API_SERVER=http://localhost:5000` locally, or the Railway API URL in production.

## Quality checks

```bash
npm run build
```

## Contributing

Please keep API authorization on the server, preserve privacy-by-default profile fields, and document any contract change that affects the landing page, member portal, or admin dashboard.
