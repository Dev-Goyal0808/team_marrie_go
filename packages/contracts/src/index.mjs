const string = (extra = {}) => ({ type: 'string', ...extra });
const number = (extra = {}) => ({ type: 'number', ...extra });
const boolean = (extra = {}) => ({ type: 'boolean', ...extra });

export const contractVersion = 'v1';

export const schemas = Object.freeze({
  healthResponse: {
    $id: 'accessmap.health.v1',
    type: 'object',
    required: ['schemaVersion', 'service', 'status', 'version'],
    properties: {
      schemaVersion: string({ const: 'health.v1' }),
      service: string(),
      status: string({ enum: ['ok', 'degraded'] }),
      version: string(),
      checks: { type: 'object' }
    },
    additionalProperties: false
  },
  problemResponse: {
    $id: 'accessmap.problem.v1',
    type: 'object',
    required: ['schemaVersion', 'type', 'title', 'status', 'detail'],
    properties: {
      schemaVersion: string({ const: 'problem.v1' }),
      type: string(),
      title: string(),
      status: number({ minimum: 400, maximum: 599 }),
      detail: string(),
      traceId: string()
    },
    additionalProperties: false
  },
  pagination: {
    $id: 'accessmap.pagination.v1',
    type: 'object',
    required: ['page', 'pageSize', 'total'],
    properties: {
      page: number({ minimum: 1 }),
      pageSize: number({ minimum: 1, maximum: 100 }),
      total: number({ minimum: 0 }),
      hasNext: boolean()
    },
    additionalProperties: false
  },
  placeSummary: {
    $id: 'accessmap.place-summary.v1',
    type: 'object',
    required: ['id', 'name', 'category', 'address', 'sampleData'],
    properties: {
      id: string(),
      name: string(),
      category: string(),
      address: string(),
      distanceMeters: number({ minimum: 0 }),
      sampleData: boolean()
    },
    additionalProperties: false
  },
  accessibilityClaim: {
    $id: 'accessmap.accessibility-claim.v1',
    type: 'object',
    required: ['featureCode', 'status', 'source', 'observedAt'],
    properties: {
      featureCode: string(),
      status: string(),
      source: string(),
      observedAt: string(),
      supportingCount: number({ minimum: 0 }),
      disputingCount: number({ minimum: 0 })
    },
    additionalProperties: false
  },
  matchProfile: {
    $id: 'accessmap.match-profile.v1',
    type: 'object',
    required: ['requirements'],
    properties: {
      requirements: {
        type: 'array',
        items: {
          type: 'object',
          required: ['featureCode', 'level'],
          properties: {
            featureCode: string(),
            level: string({ enum: ['required', 'preferred', 'avoid'] })
          },
          additionalProperties: false
        }
      }
    },
    additionalProperties: false
  },
  matchExplanation: {
    $id: 'accessmap.match-explanation.v1',
    type: 'object',
    required: ['decision', 'required', 'preferred', 'avoidanceWarnings', 'items'],
    properties: {
      decision: string({
        enum: ['meets_known_requirements', 'partial', 'needs_more_information', 'known_barrier', 'no_profile']
      }),
      required: { type: 'object' },
      preferred: { type: 'object' },
      avoidanceWarnings: { type: 'array' },
      items: { type: 'array' },
      claimsVersion: number({ minimum: 0 }),
      calculationVersion: number({ minimum: 1 })
    },
    additionalProperties: false
  },
  observation: {
    $id: 'accessmap.observation.v1',
    type: 'object',
    required: ['id', 'placeId', 'featureCode', 'value', 'observedAt', 'status'],
    properties: {
      id: string(),
      placeId: string(),
      featureCode: string(),
      value: string(),
      observedAt: string(),
      status: string({ enum: ['pending', 'approved', 'rejected', 'changes_requested', 'synced'] }),
      sampleData: boolean()
    },
    additionalProperties: false
  },
  incident: {
    $id: 'accessmap.incident.v1',
    type: 'object',
    required: ['id', 'placeId', 'type', 'severity', 'status', 'startsAt', 'reviewAt'],
    properties: {
      id: string(),
      placeId: string(),
      type: string(),
      severity: string({ enum: ['informational', 'warning', 'major', 'critical'] }),
      status: string({ enum: ['reported', 'validated', 'published', 'disputed', 'resolved', 'archived'] }),
      startsAt: string(),
      reviewAt: string()
    },
    additionalProperties: false
  },
  routeRequest: {
    $id: 'accessmap.route-request.v1',
    type: 'object',
    required: ['origin', 'destination', 'constraints'],
    properties: {
      origin: { type: 'object' },
      destination: { type: 'object' },
      constraints: { type: 'object' }
    },
    additionalProperties: false
  },
  routeResult: {
    $id: 'accessmap.route-result.v1',
    type: 'object',
    required: ['id', 'distanceMeters', 'estimatedMinutes', 'uncertainSegments', 'recommendation'],
    properties: {
      id: string(),
      distanceMeters: number({ minimum: 0 }),
      estimatedMinutes: number({ minimum: 0 }),
      uncertainSegments: { type: 'array' },
      recommendation: string()
    },
    additionalProperties: false
  },
  sessionSummary: {
    $id: 'accessmap.session-summary.v1',
    type: 'object',
    required: ['authenticated', 'role'],
    properties: {
      authenticated: boolean(),
      role: string({ enum: ['anonymous', 'user', 'moderator', 'admin', 'facility_manager'] })
    },
    additionalProperties: false
  }
});

export function getSchema(name) {
  const schema = schemas[name];
  if (!schema) {
    throw new Error(`Unknown contract schema: ${name}`);
  }
  return schema;
}
