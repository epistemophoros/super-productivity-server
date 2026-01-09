import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { v2 as webdav } from 'webdav-server';

type Env = {
  HOST: string;
  PORT: number;
  DATA_DIR: string;
  USERNAME: string;
  PASSWORD: string;
  REALM: string;
};

const readEnv = (): Env => {
  const host = process.env.HOST?.trim() || '0.0.0.0';
  const portRaw = process.env.PORT?.trim() || '2345';
  const port = Number(portRaw);
  // Default to a local folder for non-docker usage. Docker overrides this to "/data".
  const dataDir = process.env.DATA_DIR?.trim() || pathResolve(process.cwd(), 'data');
  const username = process.env.USERNAME?.trim() || 'admin';
  const password = process.env.PASSWORD?.trim() || 'admin';
  const realm = process.env.REALM?.trim() || 'Super Productivity Sync';

  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: "${portRaw}"`);
  }
  if (!username) {
    throw new Error('USERNAME must not be empty');
  }
  if (!password) {
    throw new Error('PASSWORD must not be empty');
  }

  return {
    HOST: host,
    PORT: port,
    DATA_DIR: dataDir,
    USERNAME: username,
    PASSWORD: password,
    REALM: realm,
  };
};

const setCorsHeaders = (req: IncomingMessage, res: ServerResponse): void => {
  const origin = req.headers.origin;
  const allowOrigin = typeof origin === 'string' && origin.length ? origin : '*';

  // Note: If credentials are used, the browser requires a concrete origin (not "*").
  // We reflect the Origin header when present.
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Access-Control-Allow-Methods',
    [
      'GET',
      'HEAD',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS',
      'PROPFIND',
      'PROPPATCH',
      'MKCOL',
      'COPY',
      'MOVE',
      'LOCK',
      'UNLOCK',
    ].join(', '),
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    [
      'authorization',
      'content-type',
      'depth',
      'destination',
      'overwrite',
      'if',
      'if-match',
      'if-none-match',
      'range',
      'accept',
      'user-agent',
    ].join(', '),
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    ['etag', 'content-length', 'content-type', 'date', 'last-modified'].join(', '),
  );
};

const start = async (): Promise<void> => {
  const env = readEnv();

  if (!existsSync(env.DATA_DIR)) {
    try {
      mkdirSync(env.DATA_DIR, { recursive: true });
    } catch (e) {
      const err = e as { message?: string };
      throw new Error(
        `Unable to create DATA_DIR "${env.DATA_DIR}". ` +
          `Set DATA_DIR to a writable folder. ` +
          `Original error: ${err?.message || String(e)}`,
      );
    }
  }

  const userManager = new webdav.SimpleUserManager();
  const user = userManager.addUser(env.USERNAME, env.PASSWORD, false);

  const privilegeManager = new webdav.SimplePathPrivilegeManager();
  // Full access for the single configured user to the whole server.
  // Data is typically encrypted client-side via Super Productivity's sync encryption key.
  privilegeManager.setRights(user, '/', ['all']);

  const wServer = new webdav.WebDAVServer({
    httpAuthentication: new webdav.HTTPBasicAuthentication(userManager, env.REALM),
    privilegeManager,
  });

  // Mount the filesystem at root. This matches Super Productivity's expectation that the
  // syncFolderPath is a subpath (e.g. "/sp-sync") within the WebDAV baseUrl.
  wServer.setFileSystem(
    '/',
    new webdav.PhysicalFileSystem(env.DATA_DIR),
    () => undefined,
  );

  const httpServer = createServer((req, res) => {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.url === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('ok');
      return;
    }

    wServer.executeRequest(req as any, res as any);
  });

  const handleShutdown = (signal: string): void => {
    // eslint-disable-next-line no-console
    console.log(`[cross-device-sync-server] received ${signal}, shutting down...`);
    httpServer.close(() => {
      // eslint-disable-next-line no-console
      console.log('[cross-device-sync-server] stopped');
      process.exit(0);
    });
  };
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(env.PORT, env.HOST, () => resolve());
  });

  if (env.PASSWORD === 'admin' || env.PASSWORD === 'change-me') {
    // eslint-disable-next-line no-console
    console.warn(
      '[cross-device-sync-server] WARNING: You are using a default/weak PASSWORD. Set a strong PASSWORD.',
    );
  }

  // eslint-disable-next-line no-console
  console.log(
    [
      '[cross-device-sync-server] started',
      `host=${env.HOST}`,
      `port=${env.PORT}`,
      `dataDir=${env.DATA_DIR}`,
      `username=${env.USERNAME}`,
    ].join(' '),
  );
};

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[cross-device-sync-server] failed to start', err);
  process.exitCode = 1;
});
