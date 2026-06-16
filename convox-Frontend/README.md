# Convox Frontend

React + Vite frontend for Convox.

## Local Development

```powershell
npm install
npm run dev
```

## Environment

See:

- [convox-Frontend/.env.example](C:/Users/adity/web development/Convox/convox-Frontend/.env.example)

Typical values:

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

## Production Build

```powershell
npm run build
```

## Docker

The production image is defined in:

- [convox-Frontend/Dockerfile](C:/Users/adity/web development/Convox/convox-Frontend/Dockerfile)

The nginx proxy config is:

- [convox-Frontend/nginx.conf](C:/Users/adity/web development/Convox/convox-Frontend/nginx.conf)

For full stack deployment instructions, use:

- [DEPLOYMENT.md](C:/Users/adity/web development/Convox/DEPLOYMENT.md)
