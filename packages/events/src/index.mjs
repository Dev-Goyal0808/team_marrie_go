import { randomUUID } from 'node:crypto';

export const EVENT_NAMES = Object.freeze([
  'place.created',
  'observation.submitted',
  'observation.approved',
  'observation.rejected',
  'observation.confirmed',
  'observation.disputed',
  'barrier.created',
  'barrier.resolved',
  'claim.recomputed',
  'facility.response.published',
  'route.invalidated',
  'evidence.processed',
  'notification.requested'
]);

export function createEventEnvelope({
  eventType,
  aggregateType,
  aggregateId,
  payload,
  actorId = null,
  traceId = null,
  eventId = randomUUID(),
  occurredAt = new Date().toISOString(),
  version = 1
}) {
  if (!EVENT_NAMES.includes(eventType)) {
    throw new RangeError(`Unsupported AccessMap event: ${eventType}`);
  }
  if (!aggregateType || !aggregateId) {
    throw new TypeError('aggregateType and aggregateId are required');
  }
  if (payload === undefined) {
    throw new TypeError('payload is required');
  }

  return Object.freeze({
    eventId,
    eventType,
    aggregateType,
    aggregateId,
    version,
    occurredAt,
    actorId,
    traceId,
    payload
  });
}
