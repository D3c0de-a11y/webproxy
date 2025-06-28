# Intuit Web Proxy

A minimal proxy hard-coded for the Intuit ecosystem.

## Usage

```bash
npm install
PORT=3000 node server.js
```

Navigate to `http://localhost:3000/` and you'll be redirected to QuickBooks via the proxy.

## Environment variables

- `PORT` – Port to listen on (default `3000`).
- `https_proxy` – Optional outbound proxy for fetching Intuit sites.

## Deploying

### Replit

1. Add a new Node.js Repl and copy the repo files.
2. Set the `PORT` variable under **Secrets**.
3. Start with `node server.js`.

### Render

1. Create a new Web Service from this repo.
2. Set build command to `npm install` and start command to `node server.js`.
3. Define `PORT` environment variable if you need a custom port.
