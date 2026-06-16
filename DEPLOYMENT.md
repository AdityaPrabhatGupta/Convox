# Deployment Runbook

## 1. Required Environment

Backend:

```env
PORT=5000
NODE_ENV=production
CLIENT_URL=https://your-frontend-domain
BACKEND_URL=https://your-backend-domain
MONGO_URI=mongodb://...
REDIS_URL=redis://...
JWT_SECRET=replace-with-strong-access-secret
JWT_REFRESH_SECRET=replace-with-strong-refresh-secret
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
API_RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=10
LOG_LEVEL=info
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
GROQ_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Frontend:

```env
VITE_API_URL=https://your-backend-domain
VITE_SOCKET_URL=https://your-backend-domain
```

Important:

- use different strong secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- use HTTPS in production so secure refresh cookies work correctly
- make `CLIENT_URL` exactly match the browser origin you serve from

## 2. Docker Startup

From the repo root:

```powershell
docker compose up --build
```

If you want detached mode:

```powershell
docker compose up --build -d
```

Stop:

```powershell
docker compose down
```

Stop and remove volumes:

```powershell
docker compose down -v
```

## 3. Production Service Topology

Expected flow:

```text
Browser -> nginx frontend -> backend API/socket server -> MongoDB
                                             -> Redis
```

## 4. Health Checks

Backend:

```text
GET /api/health
```

Confirm:

- `status: ok`
- `database.ready: true`
- `redis.ready: true` for scaled deployments

## 5. Smoke Test Checklist

After each deployment:

1. Open the frontend and confirm login page loads.
2. Register or log in with email/password.
3. Refresh the page and confirm the session survives.
4. Wait past access-token expiry, trigger an API call, and confirm refresh succeeds silently.
5. Open two browser sessions and verify:
   - online presence updates
   - realtime messages arrive
   - typing indicators work
   - call notifications arrive
6. Upload one image and one file and confirm both validate and upload correctly.
7. Create a group, rename it, add/remove a member, and verify sidebar/chat updates.
8. Hit `/api/health` and confirm MongoDB/Redis readiness.

Optional scripted health probe:

```powershell
cd backend
npm run smoke:health
```

Optional frontend + backend probe:

```powershell
node .\scripts\smoke-stack.mjs --backend http://localhost:5000/api/health --frontend http://localhost:8080
```

## 6. Platform Notes

Backend targets:

- Render
- Railway
- AWS ECS / EC2
- any Docker-capable host

Frontend targets:

- Docker + nginx
- Vercel if you prefer static hosting

If frontend is deployed separately from backend:

- set `VITE_API_URL` and `VITE_SOCKET_URL` to the backend public origin
- keep backend `CLIENT_URL` aligned to the frontend public origin

## 7. Redis Expectations

Redis is used for:

- Socket.IO multi-instance adapter
- lightweight caching for profile/chat reads

If Redis is unavailable:

- the backend still starts
- caching is skipped
- Socket.IO falls back to single-instance behavior

That is acceptable for local development, but not ideal for horizontally scaled production.

## 8. MongoDB Expectations

MongoDB should be reachable before the backend is considered healthy.

The backend currently exits on unrecoverable initial MongoDB connection failure, which is correct for container orchestration because it allows the platform to restart the container instead of serving a broken process.

## 9. Common Failure Checks

If login works but refresh fails:

- verify HTTPS in production
- verify cookie policy is not being blocked
- verify `CLIENT_URL` is exact

If socket connect fails:

- verify `VITE_SOCKET_URL`
- verify backend CORS origin
- verify the access token is being attached
- verify Redis is not misconfigured if using multiple backend instances

If uploads fail:

- verify Cloudinary credentials
- verify file type and extension are allowed
- verify file size is within limits

If sidebar/chat state looks stale:

- verify Redis is reachable
- verify the backend instance was restarted after env changes

## 10. Recommended Ops Routine

Before promoting a release:

1. Build frontend.
2. Start containers.
3. Run the smoke test list.
4. Check backend logs for auth, CORS, upload, or Redis warnings.
5. Confirm `/api/health` from outside the container network.
