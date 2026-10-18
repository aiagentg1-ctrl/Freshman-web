# Production Bug Fixes

## Fixed Issues

### 1. Removed the hard-coded admin fallback
**Problem**: Several API routes still accepted a legacy default admin key (`mirkuz123`) and could silently bypass a missing deployment secret.

**Solution**:
- Removed the fallback secret from the live API routes and admin proxy endpoints.
- Require a real `ADMIN_SECRET` / `ADMIN_KEY` / `ADMIN_PASSWORD` to be configured in environment variables.
- Return a clear `503` when the server has no admin secret configured instead of accepting a stale default.

### 2. Fixed stale backend host assumptions
**Problem**: The frontend could choose `FRESHO_BACKEND_URL` for browser API calls while server routes used `BACKEND_URL`. The Fresho Render hostname currently returns 404, so this mismatch caused exam requests to fail even though the existing API was reachable.

**Solution**:
- Made `BACKEND_URL` take precedence consistently for both browser and server API calls.
- Kept the production fallback on the currently reachable API host, `https://freshman-web.onrender.com`, until the Fresho Render service is deployed and serving the same database.
- The student exam screen now reports API load failures and can retry, rather than silently showing an empty exam list. It also refreshes exam data when the app becomes visible again.

## Environment Variables Required

### Frontend
Set these in Vercel/project settings:
```
BACKEND_URL=https://freshman-web.onrender.com
ADMIN_SECRET=your_admin_secret_here
NEXT_PUBLIC_BOT_TOKEN=your_bot_token_here
```

When the Fresho Render service is deployed and its exam database is confirmed, update `BACKEND_URL` to that live service URL. Keep `BACKEND_URL` and any `FRESHO_BACKEND_URL` value consistent.

### Backend
Set the same admin secret in the Render service environment:
```
ADMIN_SECRET=your_admin_secret_here
BOT_TOKEN=your_bot_token_here
ADMIN_ID=your_telegram_admin_id
DATABASE_URL=your_postgres_url
```

## Validation

1. Confirm `BACKEND_URL` points to the active Render API service.
2. Confirm the Vercel deployment uses the same backend URL for browser and server requests.
3. Confirm the admin dashboard sends the configured secret via `x-admin-key` / `x-admin-secret`.
4. If the secret is missing, the API should fail with `503` instead of accepting a legacy fallback.
