export function createProblem({ status, title, detail, type = 'about:blank', traceId }) {
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    throw new RangeError('Problem status must be an HTTP 4xx or 5xx integer');
  }

  return {
    schemaVersion: 'problem.v1',
    type,
    title,
    status,
    detail,
    ...(traceId ? { traceId } : {})
  };
}

export function validateCoordinates({ latitude, longitude }) {
  const errors = {};
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = 'Latitude must be between -90 and 90.';
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = 'Longitude must be between -180 and 180.';
  }
  return errors;
}

export function validatePagination({ page = 1, pageSize = 20 } = {}) {
  const errors = {};
  if (!Number.isInteger(page) || page < 1) {
    errors.page = 'Page must be a positive integer.';
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    errors.pageSize = 'Page size must be an integer from 1 to 100.';
  }
  return errors;
}
