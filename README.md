# Convox

Convox is a production-oriented MERN real-time chat application with:

- email/password auth and Google OAuth
- JWT access tokens plus refresh-token cookies
- Socket.IO realtime messaging and calling
- media uploads through Cloudinary
- Redis-backed caching and multi-instance Socket.IO scaling
- Groq-powered assistant chat
- Docker-based local and production-style deployment

## Stack

- Backend: Node.js, Express, MongoDB, Mongoose, Socket.IO, Redis, Winston
- Frontend: React, Vite, Axios, socket.io-client
- Infra: Docker, Docker Compose, nginx

## Project Layout

```text
backend/
convox-Frontend/
docker-compose.yml
README.md
DEPLOYMENT.md
```

## Environment

Backend env template:

- [backend/.env.example](C:/Users/adity/web development/Convox/backend/.env.example)

Frontend env template:

- [convox-Frontend/.env.example](C:/Users/adity/web development/Convox/convox-Frontend/.env.example)

Minimum backend envs for non-Docker local development:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
MONGO_URI=mongodb://localhost:27017/convox
REDIS_URL=redis://localhost:6379
JWT_SECRET=replace-with-strong-access-secret
JWT_REFRESH_SECRET=replace-with-strong-refresh-secret
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

## Local Development

Backend:

```powershell
cd backend
npm install
npm run dev
```

Frontend:

```powershell
cd convox-Frontend
npm install
npm run dev
```

## Docker

The repo now includes:

- [backend/Dockerfile](C:/Users/adity/web development/Convox/backend/Dockerfile)
- [convox-Frontend/Dockerfile](C:/Users/adity/web development/Convox/convox-Frontend/Dockerfile)
- [convox-Frontend/nginx.conf](C:/Users/adity/web development/Convox/convox-Frontend/nginx.conf)
- [docker-compose.yml](C:/Users/adity/web development/Convox/docker-compose.yml)

Start the full stack:

```powershell
docker compose up --build
```

Quick health smoke test after startup:

```powershell
cd backend
npm run smoke:health
```

Default ports:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:5000`
- MongoDB: `localhost:27017`
- Redis: `localhost:6379`

## Health Check

Backend health endpoint:

```text
GET /api/health
```

It reports:

- environment
- process uptime
- MongoDB readiness
- Redis readiness

## Security / Runtime Highlights

- access JWTs are short-lived
- refresh tokens are stored as `HttpOnly` cookies and hashed in MongoDB
- API routes are protected with centralized JWT middleware
- Socket.IO handshakes require JWT auth
- auth and API rate limiting are enabled
- uploads validate MIME type, extension, and size
- centralized error handling prevents leaking sensitive internals
- Winston request/error logging is enabled

## Key API Areas

- Auth: `/api/users/register`, `/api/users/login`, `/api/users/refresh`, `/api/users/logout`
- Chat: `/api/chat`
- Messages: `/api/messages`
- Groups: `/api/groups`
- Chat requests: `/api/chat-requests`
- Assistant: `/api/assistant`, `/api/ai`

## Pagination

Message history uses cursor-style pagination on:

```text
GET /api/messages/:chatId?limit=30&before=<ISO timestamp>
```

The backend returns each page in oldest-to-newest order for direct rendering by the client.

## Deployment Notes

The practical runbook lives here:

- [DEPLOYMENT.md](C:/Users/adity/web development/Convox/DEPLOYMENT.md)

That file covers:

- env setup
- Docker startup
- smoke tests
- deployment targets
- common failure checks
