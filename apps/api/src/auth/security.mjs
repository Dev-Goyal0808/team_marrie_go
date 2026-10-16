import { AuthError } from './errors.mjs';

const DEFAULT_MAX_REQUEST_BYTES = 1024 * 1024;

function getHeader(headers, name) {
  if (!headers) {
    return undefined;
  }
  if (typeof headers.get === 'function') {
    return headers.get(name) ?? undefined;
  }
  const lowerName = name.toLowerCase();
  const directValue = headers[name] ?? headers[lowerName];
  const value = directValue ?? Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName)?.[1];
  return Array.isArray(value) ? value[0] : value;
}

function requestParts(requestOrOptions) {
  if (requestOrOptions?.headers) {
    return {
      headers: requestOrOptions.headers,
      method: requestOrOptions.method ?? 'POST'
    };
  }
  return { headers: requestOrOptions, method: 'POST' };
}

export const DEFAULT_SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store'
});

export function securityHeaders({ https = false, includeHsts = https } = {}) {
  return {
    ...DEFAULT_SECURITY_HEADERS,
    ...(includeHsts ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {})
  };
}

export function applySecurityHeaders(response, options) {
  if (!response || typeof response.setHeader !== 'function') {
    throw new TypeError('A response with setHeader(name, value) is required');
  }
  for (const [name, value] of Object.entries(securityHeaders(options))) {
    response.setHeader(name, value);
  }
  return response;
}

export function validateContentType(
  requestOrHeaders,
  { expected = 'application/json', required = true, allowJsonSuffix = true } = {}
) {
  const { headers } = requestParts(requestOrHeaders);
  const rawValue = getHeader(headers, 'content-type');
  const value = rawValue === undefined || rawValue === null ? rawValue : String(rawValue);
  if (value === undefined || value === null || value.trim() === '') {
    if (!required) {
      return null;
    }
    throw new AuthError({
      code: 'CONTENT_TYPE_REQUIRED',
      status: 415,
      title: 'Unsupported media type',
      detail: 'The request must declare its content type.',
      type: 'https://accessmap.example/problems/invalid-request'
    });
  }

  const mediaType = value.split(';', 1)[0].trim().toLowerCase();
  const expectedTypes = (Array.isArray(expected) ? expected : [expected]).map((type) => type.toLowerCase());
  const valid = expectedTypes.some((type) => mediaType === type) ||
    (allowJsonSuffix && expectedTypes.includes('application/json') && mediaType.startsWith('application/') && mediaType.endsWith('+json'));
  if (!valid) {
    throw new AuthError({
      code: 'UNSUPPORTED_CONTENT_TYPE',
      status: 415,
      title: 'Unsupported media type',
      detail: 'The request content type is not supported.',
      type: 'https://accessmap.example/problems/invalid-request'
    });
  }
  return mediaType;
}

export function validateRequestSize(requestOrHeaders, { maxBytes = DEFAULT_MAX_REQUEST_BYTES } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError('maxBytes must be a positive safe integer');
  }
  const { headers } = requestParts(requestOrHeaders);
  const rawLength = getHeader(headers, 'content-length');
  if (rawLength === undefined || rawLength === null || rawLength === '') {
    return { contentLength: null, maxBytes };
  }
  if (!/^\d+$/.test(String(rawLength))) {
    throw new AuthError({
      code: 'INVALID_CONTENT_LENGTH',
      status: 400,
      title: 'Invalid request',
      detail: 'Content-Length must be a non-negative integer.',
      type: 'https://accessmap.example/problems/invalid-request'
    });
  }
  const contentLength = Number(rawLength);
  if (!Number.isSafeInteger(contentLength)) {
    throw new AuthError({
      code: 'INVALID_CONTENT_LENGTH',
      status: 400,
      title: 'Invalid request',
      detail: 'Content-Length is outside the supported range.',
      type: 'https://accessmap.example/problems/invalid-request'
    });
  }
  if (contentLength > maxBytes) {
    throw new AuthError({
      code: 'REQUEST_TOO_LARGE',
      status: 413,
      title: 'Payload too large',
      detail: `The request body must not exceed ${maxBytes} bytes.`,
      type: 'https://accessmap.example/problems/invalid-request'
    });
  }
  return { contentLength, maxBytes };
}

export function validateRequest(
  requestOrOptions,
  { maxBytes = DEFAULT_MAX_REQUEST_BYTES, contentType = 'application/json', requireContentType } = {}
) {
  const { method } = requestParts(requestOrOptions);
  const size = validateRequestSize(requestOrOptions, { maxBytes });
  const shouldRequireContentType = requireContentType ?? !['GET', 'HEAD', 'DELETE'].includes(method.toUpperCase());
  const mediaType = validateContentType(requestOrOptions, {
    expected: contentType,
    required: shouldRequireContentType
  });
  return { ...size, contentType: mediaType };
}

/** Read and parse a bounded JSON body from a Node IncomingMessage or async iterable. */
export async function readJsonBody(request, { maxBytes = DEFAULT_MAX_REQUEST_BYTES } = {}) {
  const { contentLength } = validateRequest(request, { maxBytes, contentType: 'application/json', requireContentType: true });
  const chunks = [];
  let totalBytes = 0;
  try {
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > maxBytes) {
        throw new AuthError({
          code: 'REQUEST_TOO_LARGE',
          status: 413,
          title: 'Payload too large',
          detail: `The request body must not exceed ${maxBytes} bytes.`,
          type: 'https://accessmap.example/problems/invalid-request'
        });
      }
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError({
      code: 'REQUEST_BODY_READ_FAILED',
      status: 400,
      title: 'Invalid request',
      detail: 'The request body could not be read.',
      type: 'https://accessmap.example/problems/invalid-request',
      cause: error
    });
  }
  if (contentLength !== null && totalBytes !== contentLength) {
    throw new AuthError({
      code: 'CONTENT_LENGTH_MISMATCH',
      status: 400,
      title: 'Invalid request',
      detail: 'The request body length does not match Content-Length.',
      type: 'https://accessmap.example/problems/invalid-request'
    });
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    throw new AuthError({
      code: 'INVALID_JSON',
      status: 400,
      title: 'Invalid request',
      detail: 'The request body must contain valid JSON.',
      type: 'https://accessmap.example/problems/invalid-request',
      cause: error
    });
  }
}
