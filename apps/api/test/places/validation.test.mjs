import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlaceInputError, parsePlaceQuery, validatePlaceId } from '../../src/places/index.mjs';

const codes = {
  categoryCodes: new Set(['library', 'community_center']),
  featureCodes: new Set(['step_free_entrance', 'accessible_toilet'])
};

test('place query validation normalizes pagination, radius, and list filters', () => {
  const result = parsePlaceQuery(new URLSearchParams({
    query: 'library',
    city: 'Sample City',
    category: 'library',
    features: 'step_free_entrance,accessible_toilet,step_free_entrance',
    latitude: '12.9716',
    longitude: '77.5946',
    radius: '2500',
    page: '2',
    pageSize: '10',
    sort: 'distance'
  }), codes);

  assert.deepEqual(result.features, ['step_free_entrance', 'accessible_toilet']);
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 10);
  assert.equal(result.radiusMeters, 2500);
  assert.equal(result.sort, 'distance');
});

test('place query validation rejects invalid coordinates, ranges, and codes', () => {
  assert.throws(() => parsePlaceQuery(new URLSearchParams({ latitude: '91', longitude: '77' }), codes), PlaceInputError);
  assert.throws(() => parsePlaceQuery(new URLSearchParams({ radius: '100' }), codes), PlaceInputError);
  assert.throws(() => parsePlaceQuery(new URLSearchParams({ category: 'not_active' }), codes), PlaceInputError);
  assert.throws(() => parsePlaceQuery(new URLSearchParams({ features: 'not_active' }), codes), PlaceInputError);
});

test('bounding-box searches are bounded and mutually exclusive with radius searches', () => {
  const result = parsePlaceQuery(new URLSearchParams({ bbox: '77.58,12.96,77.61,12.99' }), codes);
  assert.deepEqual(result.bbox, { west: 77.58, south: 12.96, east: 77.61, north: 12.99 });
  assert.throws(() => parsePlaceQuery(new URLSearchParams({ bbox: '0,0,10,10' }), codes), PlaceInputError);
  assert.throws(() => parsePlaceQuery(new URLSearchParams({ bbox: '77.58,12.96,77.61,12.99', latitude: '12.97', longitude: '77.59' }), codes), PlaceInputError);
});

test('place IDs must be UUIDs at the API boundary', () => {
  assert.equal(validatePlaceId('13000000-0000-0000-0000-000000000001'), '13000000-0000-0000-0000-000000000001');
  assert.throws(() => validatePlaceId('place_sample_community_centre'), PlaceInputError);
});
