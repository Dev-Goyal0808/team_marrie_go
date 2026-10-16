const DEFAULT_PROBLEM_TYPE = 'https://accessmap.example/problems/authentication';

/**
 * Error used by the auth adapter. The status and code are safe for an HTTP
 * adapter to expose; implementation details should be kept in `cause`.
 */
export class AuthError extends Error {
  constructor({
    code,
    status = 401,
    title = 'Authentication failed',
    detail = 'The request could not be authenticated.',
    type = DEFAULT_PROBLEM_TYPE,
    headers,
    cause
  }) {
    super(detail, cause ? { cause } : undefined);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.type = type;
    if (headers) {
      this.headers = { ...headers };
    }
  }

  toProblem() {
    return {
      schemaVersion: 'problem.v1',
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      code: this.code
    };
  }
}

export function createAuthProblem(error) {
  if (error instanceof AuthError) {
    return error.toProblem();
  }

  return {
    schemaVersion: 'problem.v1',
    type: DEFAULT_PROBLEM_TYPE,
    title: 'Authentication failed',
    status: 500,
    detail: 'The authentication operation could not be completed.',
    code: 'AUTHENTICATION_ERROR'
  };
}
