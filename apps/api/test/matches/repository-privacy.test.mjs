import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMatchRepository } from '../../src/matches/index.mjs';

const placeId = '13000000-0000-0000-0000-000000000001';

test('match cache keys use a hash and cache values contain derived explanation only', async () => {
  let cacheKey;
  let cacheValue;
  const db = {
    async query(text) {
      if (text.includes('FROM user_access_profiles')) {
        return { rows: [{ requirements: [{ featureCode: 'step_free_entrance', level: 'required' }], profile_version: 2 }] };
      }
      if (text.includes('SELECT code FROM accessibility_features')) return { rows: [{ code: 'step_free_entrance' }] };
      if (text.includes('FROM places')) return { rows: [{ id: placeId }] };
      if (text.includes('FROM claims')) {
        return {
          rows: [{
            feature_code: 'step_free_entrance',
            status: 'community_corroborated',
            summary_value: 'yes',
            freshness_state: 'fresh',
            latest_observed_at: '2026-10-03T11:00:00Z',
            supporting_count: 2,
            disputing_count: 0,
            calculation_version: 1,
            claims_version: 9,
            source: 'community_observation'
          }]
        };
      }
      return { rows: [] };
    }
  };
  const cache = {
    async get(key) {
      cacheKey = key;
      return null;
    },
    async set(key, value) {
      cacheKey = key;
      cacheValue = value;
    }
  };
  const repository = createMatchRepository({ db, cache });

  await repository.getAuthenticatedMatch('user-1', placeId);

  assert.match(cacheKey, new RegExp(`^accessmap:match:${placeId}:9:[a-f0-9]{64}$`));
  assert.equal(cacheKey.includes('step_free_entrance'), false);
  assert.equal(JSON.parse(cacheValue).requirements, undefined);
  assert.equal(JSON.parse(cacheValue).decision, 'meets_known_requirements');
});
