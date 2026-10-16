import assert from 'node:assert/strict';
import { startApiServer } from '../apps/api/src/server.mjs';

const running = await startApiServer({ port: 0 });

try {
  const response = await fetch(`http://${running.host}:${running.port}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.schemaVersion, 'health.v1');
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'accessmap-api');
  process.stdout.write(`Health check passed at http://${running.host}:${running.port}/health\n`);
} finally {
  await new Promise((resolve, reject) => {
    running.server.close((error) => (error ? reject(error) : resolve()));
  });
}
