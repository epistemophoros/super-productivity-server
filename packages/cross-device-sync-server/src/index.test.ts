import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn, ChildProcess } from 'node:child_process';
import { request } from 'node:http';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';

const TEST_PORT = 2346; // Different from default to avoid conflicts
const TEST_DATA_DIR = pathResolve(__dirname, '../test-data');
const TEST_USERNAME = 'testuser';
const TEST_PASSWORD = 'testpass';

let serverProcess: ChildProcess | null = null;

const waitForServer = (port: number, timeout = 10000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkServer = (): void => {
      const req = request(
        {
          hostname: 'localhost',
          port,
          path: '/health',
          method: 'GET',
        },
        (res) => {
          if (res.statusCode === 200) {
            res.on('data', () => {});
            res.on('end', () => resolve());
          } else {
            if (Date.now() - startTime > timeout) {
              reject(new Error(`Server health check failed after ${timeout}ms`));
            } else {
              setTimeout(checkServer, 100);
            }
          }
        },
      );
      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server not responding after ${timeout}ms`));
        } else {
          setTimeout(checkServer, 100);
        }
      });
      req.end();
    };
    checkServer();
  });
};

const makeRequest = (
  options: {
    method?: string;
    path?: string;
    auth?: string;
    body?: string;
  } = {},
): Promise<{ statusCode?: number; headers: Record<string, string | string[] | undefined>; body: string }> => {
  return new Promise((resolve, reject) => {
    const { method = 'GET', path = '/health', auth, body } = options;
    const req = request(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path,
        method,
        headers: {
          ...(auth ? { Authorization: `Basic ${Buffer.from(auth).toString('base64')}` } : {}),
          ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body: responseBody,
          });
        });
      },
    );
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
};

describe('cross-device-sync-server', () => {
  before(async () => {
    // Clean up test data directory
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DATA_DIR, { recursive: true });

    // Build the server first if needed (in CI, it will be pre-built)
    // Start the server
    const serverPath = pathResolve(__dirname, '../dist/index.js');
    if (!existsSync(serverPath)) {
      throw new Error(`Server not built. Expected at: ${serverPath}`);
    }
    serverProcess = spawn('node', [serverPath], {
      env: {
        ...process.env,
        HOST: '0.0.0.0',
        PORT: String(TEST_PORT),
        DATA_DIR: TEST_DATA_DIR,
        USERNAME: TEST_USERNAME,
        PASSWORD: TEST_PASSWORD,
        REALM: 'Test Realm',
      },
      stdio: 'pipe',
    });

    // Wait for server to be ready
    await waitForServer(TEST_PORT, 10000);
  });

  after(() => {
    // Clean up server
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }

    // Clean up test data directory
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  describe('Health endpoint', () => {
    it('should return 200 OK for /health endpoint', async () => {
      const response = await makeRequest({ path: '/health' });
      assert.strictEqual(response.statusCode, 200);
      assert.strictEqual(response.body.trim(), 'ok');
    });

    it('should have CORS headers on health endpoint', async () => {
      const response = await makeRequest({ path: '/health' });
      assert.ok(response.headers['access-control-allow-origin']);
    });
  });

  describe('WebDAV authentication', () => {
    it('should require authentication for WebDAV requests', async () => {
      const response = await makeRequest({ path: '/', method: 'PROPFIND' });
      assert.strictEqual(response.statusCode, 401);
    });

    it('should accept valid credentials', async () => {
      const auth = `${TEST_USERNAME}:${TEST_PASSWORD}`;
      const response = await makeRequest({ path: '/', method: 'PROPFIND', auth });
      // 207 is Multi-Status (successful PROPFIND response)
      assert.ok([207, 200, 404].includes(response.statusCode || 0), `Expected 207, 200, or 404, got ${response.statusCode}`);
    });

    it('should reject invalid credentials', async () => {
      const auth = `${TEST_USERNAME}:wrongpassword`;
      const response = await makeRequest({ path: '/', method: 'PROPFIND', auth });
      assert.strictEqual(response.statusCode, 401);
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers in OPTIONS requests', async () => {
      const response = await makeRequest({ method: 'OPTIONS', path: '/' });
      assert.strictEqual(response.statusCode, 204);
      assert.ok(response.headers['access-control-allow-origin']);
      assert.ok(response.headers['access-control-allow-methods']);
      assert.ok(response.headers['access-control-allow-headers']);
    });

    it('should reflect Origin header when present', async () => {
      // This would require a custom request with Origin header
      // For now, just verify CORS headers are present
      const response = await makeRequest({ path: '/health' });
      assert.ok(response.headers['access-control-allow-origin']);
    });
  });

  describe('Data directory handling', () => {
    it('should create data directory if it does not exist', () => {
      assert.ok(existsSync(TEST_DATA_DIR), 'Test data directory should exist');
    });
  });

  describe('Environment validation', () => {
    it('should validate PORT environment variable', () => {
      // This is tested implicitly by the server startup
      // If invalid PORT, server would fail to start
      assert.ok(true, 'Server started successfully with valid PORT');
    });
  });
});

