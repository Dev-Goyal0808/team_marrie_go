import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startApiServer } from '../src/server.mjs';

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test('GET /health returns a versioned healthy response', async (t) => {
  const running = await startApiServer({ port: 0, version: 'test-version' });
  t.after(() => closeServer(running.server));

  const response = await fetch(`http://${running.host}:${running.port}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    schemaVersion: 'health.v1',
    service: 'accessmap-api',
    status: 'ok',
    version: 'test-version',
    checks: { process: 'ok' }
  });
});

test('unknown API resources return the problem response contract', async (t) => {
  const running = await startApiServer({ port: 0 });
  t.after(() => closeServer(running.server));

  const response = await fetch(`http://${running.host}:${running.port}/not-a-route`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.schemaVersion, 'problem.v1');
  assert.equal(body.status, 404);
});
