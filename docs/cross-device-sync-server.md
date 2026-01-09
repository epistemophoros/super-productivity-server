## Cross-device sync server (self-hosted)

Super Productivity already supports syncing via **WebDAV**. This repo includes a small, self-hostable WebDAV server you can run to sync **multiple devices** against the same endpoint.

### Run the server (Docker)

From the repo root:

```bash
cd packages/cross-device-sync-server
USERNAME=admin PASSWORD='change-me' PORT=2345 docker compose up -d --build
```

### Run the server (no Docker)

```bash
cd packages/cross-device-sync-server
DATA_DIR=./data USERNAME=admin PASSWORD='change-me' PORT=2345 npm run dev
```

### Configure the app

In **Settings → Sync**:

- **Sync provider**: WebDAV
- **Base URL**: `http://<your-server-ip>:2345`
- **User name**: `admin`
- **Password**: the `PASSWORD` you set
- **Sync folder path**: `/sp-sync` (recommended)
- **Encryption key**: set one (recommended)

### Notes

- If exposed to the internet, put the server behind **HTTPS** and use a strong password.
- The app can encrypt sync data client-side via the encryption key; the server just stores files.
