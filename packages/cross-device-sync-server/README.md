## Cross-device sync server (WebDAV)

This package provides a small **self-hostable WebDAV server** that you can use as a sync target for Super Productivity, so multiple devices can sync against the same server.

Super Productivity already supports WebDAV sync; this server exists to make self-hosting easy and reliable.

### Quick start (Docker)

From repo root:

```bash
cd packages/cross-device-sync-server
USERNAME=admin PASSWORD='change-me' PORT=2345 docker compose up -d --build
```

Server will be available at:

- `http://<your-server-ip>:2345/` (WebDAV)
- `http://<your-server-ip>:2345/health` (health check)

### Local run (no Docker)

```bash
cd packages/cross-device-sync-server
DATA_DIR=./data USERNAME=admin PASSWORD='change-me' PORT=2345 npm run dev
```

### Configure Super Productivity

In **Settings → Sync**:

- **Sync provider**: WebDAV
- **Base URL**: `http://<your-server-ip>:2345`
- **User name**: `admin` (or your `USERNAME`)
- **Password**: your `PASSWORD`
- **Sync folder path**: `/sp-sync` (recommended)
- **Encryption key**: set one (recommended). The server stores whatever the client uploads; encryption happens client-side.

### Recommended setup notes

- Use a strong `PASSWORD` and run behind HTTPS (e.g. via a reverse proxy) if exposed to the internet.
- If you sync from the web/PWA version, CORS is enabled by default in this server.
