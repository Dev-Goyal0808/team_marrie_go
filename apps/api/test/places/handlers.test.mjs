import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlaceHandlers } from '../../src/places/index.mjs';

const placeId = '13000000-0000-0000-0000-000000000001';

function repository() {
  return {
    activeCodeSets: async () => ({ categoryCodes: new Set(['library']), featureCodes: new Set(['step_free_entrance']) }),
    searchPlaces: async () => ({
      items: [{ id: placeId, name: 'Sample Central Library', category: 'library', address: '1 Sample Street', sampleData: true }],
      pagination: { page: 1, pageSize: 20, total: 1, hasNext: false },
      cache: 'miss'
    }),
    getPlaceDetail: async () => ({ id: placeId, name: 'Sample Central Library', claims: [], incidents: [], matchReady: { claimsVersion: 1, featureCodes: [] } }),
    getPlace: async () => ({ id: placeId }),
    listClaims: async () => [],
    listIncidents: async () => [],
    getAccessGraph: async () => ({ nodes: [], edges: [] }),
    listCategories: async () => [{ code: 'library', name: 'Library', sampleData: true }],
    listFeatures: async () => [{ code: 'step_free_entrance', category: 'entrance', label: 'Step-free entrance', inputType: 'boolean', freshnessDays: 365, sampleData: true }]
  };
}

test('search handler returns a paginated list safe for map-free rendering', async () => {
  const handlers = createPlaceHandlers({ repository: repository() });
  const response = await handlers.search({ query: new URLSearchParams({ category: 'library' }) });

  assert.equal(response.status, 200);
  assert.equal(response.payload.items[0].name, 'Sample Central Library');
  assert.deepEqual(response.payload.pagination, { page: 1, pageSize: 20, total: 1, hasNext: false });
  assert.equal(response.headers['Cache-Control'], 'public, max-age=30, stale-while-revalidate=60');
  assert.equal(response.headers['X-AccessMap-Cache'], 'miss');
});

test('place detail handler returns a public detail payload and no private fields', async () => {
  const handlers = createPlaceHandlers({ repository: repository() });
  const response = await handlers.getPlace({ params: { placeId } });

  assert.equal(response.status, 200);
  assert.equal(response.payload.id, placeId);
  assert.equal('reportedBy' in response.payload, false);
  assert.equal('profile' in response.payload, false);
});

test('invalid search parameters return the problem contract', async () => {
  const handlers = createPlaceHandlers({ repository: repository() });
  const response = await handlers.search({ query: new URLSearchParams({ latitude: '91', longitude: '77' }) });

  assert.equal(response.status, 400);
  assert.equal(response.payload.schemaVersion, 'problem.v1');
  assert.equal(response.payload.status, 400);
});
