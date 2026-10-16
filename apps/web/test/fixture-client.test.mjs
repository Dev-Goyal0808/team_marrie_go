import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatObservedDate,
  labelForFeature,
  samplePlace,
  searchPlaces
} from '../lib/fixture-client.js';

test('fixture search returns the sample place without requiring a map', () => {
  assert.deepEqual(searchPlaces('community centre').map((place) => place.id), [samplePlace.id]);
  assert.deepEqual(searchPlaces('Pilot District').map((place) => place.id), [samplePlace.id]);
});

test('fixture search exposes an honest empty state for an unknown query', () => {
  assert.deepEqual(searchPlaces('unlisted hospital'), []);
});

test('fixture labels preserve unknown match information', () => {
  assert.equal(labelForFeature('accessible_toilet'), 'Accessible toilet');
  assert.equal(samplePlace.matchExplanation.decision, 'needs_more_information');
  assert.equal(samplePlace.matchExplanation.required.unknown, 1);
  assert.equal(samplePlace.matchExplanation.required.confirmed, 1);
  assert.equal(formatObservedDate(samplePlace.claims[0].observedAt), 'Oct 1, 2026');
});
