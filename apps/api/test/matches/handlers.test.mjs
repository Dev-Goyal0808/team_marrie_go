import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMatchHandlers } from '../../src/matches/index.mjs';

const placeId = '13000000-0000-0000-0000-000000000001';

function repository() {
  return {
    getProfile: async () => ({ requirements: [{ featureCode: 'step_free_entrance', level: 'required' }], profileVersion: 2 }),
    saveProfile: async (_userId, profile) => ({ ...profile, profileVersion: 3 }),
    getAuthenticatedMatch: async () => ({
      cache: 'hit',
      explanation: {
        decision: 'needs_more_information',
        required: { total: 1, confirmed: 0, knownBarriers: 0, unknown: 1 },
        preferred: { total: 0, confirmed: 0, knownBarriers: 0, unknown: 0 },
        avoidanceWarnings: [],
        items: [{ featureCode: 'step_free_entrance', level: 'required', result: 'unknown', claimStatus: 'not_assessed', source: 'unknown', observedAt: null }],
        claimsVersion: 7,
        calculationVersion: 1
      }
    }),
    compareAnonymous: async (_profile, placeIds) => placeIds.map((id) => ({
      placeId: id,
      explanation: {
        decision: 'needs_more_information',
        required: { total: 1, confirmed: 0, knownBarriers: 0, unknown: 1 },
        preferred: { total: 0, confirmed: 0, knownBarriers: 0, unknown: 0 },
        avoidanceWarnings: [],
        items: [],
        claimsVersion: 1,
        calculationVersion: 1
      }
    }))
  };
}

test('private profile endpoints require the session boundary', async () => {
  const handlers = createMatchHandlers({ repository: repository() });

  const response = await handlers.getProfile({});

  assert.equal(response.status, 401);
  assert.equal(response.payload.schemaVersion, 'problem.v1');
  assert.equal(response.payload.status, 401);
});

test('authenticated profile responses contain only the private profile shape', async () => {
  const handlers = createMatchHandlers({ repository: repository() });

  const response = await handlers.getProfile({ auth: { authenticated: true, userId: 'user-1' } });

  assert.equal(response.status, 200);
  assert.deepEqual(response.payload, {
    requirements: [{ featureCode: 'step_free_entrance', level: 'required' }],
    profileVersion: 2
  });
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('anonymous comparison returns derived explanations and does not expose the submitted profile', async () => {
  const handlers = createMatchHandlers({ repository: repository() });

  const response = await handlers.comparePlaces({
    body: {
      placeIds: [placeId],
      profile: { requirements: [{ featureCode: 'step_free_entrance', level: 'required' }] }
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.items[0].placeId, placeId);
  assert.equal('profile' in response.payload, false);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('place match returns server-derived explanation without private requirements', async () => {
  const handlers = createMatchHandlers({ repository: repository() });

  const response = await handlers.getPlaceMatch({
    params: { placeId },
    auth: { authenticated: true, userId: 'user-1' }
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.placeId, placeId);
  assert.equal(response.payload.decision, 'needs_more_information');
  assert.equal('requirements' in response.payload, false);
  assert.equal(response.headers['X-AccessMap-Cache'], 'hit');
});
