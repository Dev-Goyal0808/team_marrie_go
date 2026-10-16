import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlaceRepository } from '../../src/places/index.mjs';

test('place repository falls back to PostgreSQL when cache reads fail', async () => {
  let queryCount = 0;
  const db = {
    async query(text) {
      queryCount += 1;
      if (text.includes('COUNT(*) OVER')) {
        return {
          rows: [{
            id: '13000000-0000-0000-0000-000000000001',
            name: 'Sample Central Library',
            address: '1 Sample Street',
            city: 'Sample City',
            category: 'library',
            category_name: 'Library',
            status: 'active',
            source: 'admin',
            is_sample: true,
            latitude: 12.9716,
            longitude: 77.5946,
            distance_meters: null,
            latest_observed_at: null,
            active_incident_count: 0,
            total_count: 1
          }]
        };
      }
      return { rows: [] };
    }
  };
  const cache = {
    async get() { throw new Error('cache unavailable'); },
    async set() { throw new Error('cache unavailable'); }
  };
  const repository = createPlaceRepository({ db, cache });
  const response = await repository.searchPlaces({
    query: undefined,
    city: undefined,
    category: undefined,
    features: [],
    latitude: undefined,
    longitude: undefined,
    radiusMeters: undefined,
    bbox: undefined,
    page: 1,
    pageSize: 20,
    sort: 'relevance'
  });

  assert.equal(response.cache, 'miss');
  assert.equal(response.items[0].name, 'Sample Central Library');
  assert.equal(response.pagination.total, 1);
  assert.equal(queryCount, 1);
});
