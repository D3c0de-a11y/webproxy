# Intuit Web Proxy

A minimal Express proxy limited to the Intuit ecosystem.

## Usage

```bash
npm install
PORT=3000 node server.js
```

Navigate to `http://localhost:3000/` and you'll be redirected to QuickBooks via the proxy.

## Environment variables

- `PORT` – Port to listen on (default `3000`).

## Deploying

### Replit

1. Create a Node.js Repl and copy the files.
2. Set the `PORT` variable under **Secrets**.
3. Run `node server.js`.

### Render

1. Create a Web Service from this repo.
2. Build with `npm install` and start with `node server.js`.
3. Define the `PORT` environment variable if custom.
