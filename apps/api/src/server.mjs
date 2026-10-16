import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createProblem } from '../../../packages/validation/src/index.mjs';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3001;
const APPLICATION_VERSION = process.env.APP_VERSION ?? '0.1.0';

export function healthPayload(version = APPLICATION_VERSION) {
  return {
    schemaVersion: 'health.v1',
    service: 'accessmap-api',
    status: 'ok',
    version,
    checks: {
      process: 'ok'
    }
  };
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Length', Buffer.byteLength(body));
  response.end(body);
}

export function createApiServer({ version = APPLICATION_VERSION } = {}) {
  return createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? DEFAULT_HOST}`);

    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      sendJson(response, 200, healthPayload(version));
      return;
    }

    sendJson(
      response,
      404,
      createProblem({
        status: 404,
        title: 'Resource not found',
        detail: 'The requested API resource does not exist.',
        type: 'https://accessmap.example/problems/not-found'
      })
    );
  });
}

export function startApiServer({ host = process.env.API_HOST ?? DEFAULT_HOST, port = Number(process.env.API_PORT ?? DEFAULT_PORT), version } = {}) {
  const server = createApiServer({ version });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve({ server, host, port: server.address().port });
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { host, port } = await startApiServer();
  process.stdout.write(`AccessMap API listening at http://${host}:${port}\n`);
}
