import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateMatch,
  normalizeProfile,
  ProfileValidationError,
  profileHash,
  validateProfile
} from '../../../../packages/domain/src/matching/index.mjs';

const confirmedEntrance = {
  featureCode: 'step_free_entrance',
  status: 'community_corroborated',
  summaryValue: 'yes',
  freshnessState: 'fresh',
  latestObservedAt: '2026-10-03T11:00:00Z',
  source: 'community_observation',
  claimsVersion: 4
};

function profile(...requirements) {
  return { requirements };
}

test('an empty profile returns no_profile and no universal score', () => {
  const result = evaluateMatch(profile());

  assert.equal(result.decision, 'no_profile');
  assert.deepEqual(result.required, { total: 0, confirmed: 0, knownBarriers: 0, unknown: 0 });
  assert.equal('score' in result, false);
});

test('a recent positive claim confirms a required feature', () => {
  const result = evaluateMatch(profile({ featureCode: 'step_free_entrance', level: 'required' }), [confirmedEntrance]);

  assert.equal(result.decision, 'meets_known_requirements');
  assert.equal(result.required.confirmed, 1);
  assert.equal(result.required.unknown, 0);
  assert.equal(result.items[0].result, 'confirmed');
  assert.equal(result.items[0].observedAt, confirmedEntrance.latestObservedAt);
});

test('a missing required claim produces needs_more_information, not a match', () => {
  const result = evaluateMatch(profile({ featureCode: 'accessible_toilet', level: 'required' }), []);

  assert.equal(result.decision, 'needs_more_information');
  assert.equal(result.required.confirmed, 0);
  assert.equal(result.required.unknown, 1);
  assert.notEqual(result.decision, 'meets_known_requirements');
});

test('a current negative or temporary claim produces a known barrier', () => {
  const result = evaluateMatch(profile({ featureCode: 'accessible_toilet', level: 'required' }), [{
    featureCode: 'accessible_toilet',
    status: 'temporarily_unavailable',
    summaryValue: 'temporarily_unavailable',
    freshnessState: 'fresh',
    latestObservedAt: '2026-10-04T12:00:00Z',
    source: 'community_observation'
  }]);

  assert.equal(result.decision, 'known_barrier');
  assert.equal(result.required.knownBarriers, 1);
  assert.equal(result.required.confirmed, 0);
});

test('preferred unknown information stays visible without blocking required access', () => {
  const result = evaluateMatch(profile(
    { featureCode: 'step_free_entrance', level: 'required' },
    { featureCode: 'quiet_space', level: 'preferred' }
  ), [confirmedEntrance]);

  assert.equal(result.decision, 'meets_known_requirements');
  assert.equal(result.preferred.unknown, 1);
  assert.equal(result.required.confirmed, 1);
  assert.equal(result.items.find((item) => item.featureCode === 'quiet_space').result, 'unknown');
});

test('an avoid requirement creates a visible warning when the avoided condition is known', () => {
  const result = evaluateMatch(profile({ featureCode: 'stairs', level: 'avoid' }), [{
    featureCode: 'stairs',
    status: 'recently_observed',
    summaryValue: 'yes',
    freshnessState: 'fresh',
    latestObservedAt: '2026-10-05T13:30:00Z',
    source: 'community_observation'
  }]);

  assert.equal(result.decision, 'meets_known_requirements');
  assert.equal(result.avoidanceWarnings.length, 1);
  assert.equal(result.items[0].result, 'avoidance_warning');
});

test('stale and conflicting claims remain unknown', () => {
  const result = evaluateMatch(profile(
    { featureCode: 'step_free_entrance', level: 'required' },
    { featureCode: 'accessible_toilet', level: 'required' }
  ), [
    { ...confirmedEntrance, freshnessState: 'stale', status: 'needs_reverification' },
    { ...confirmedEntrance, featureCode: 'accessible_toilet', status: 'conflicting_information', summaryValue: 'unknown' }
  ]);

  assert.equal(result.decision, 'needs_more_information');
  assert.equal(result.required.unknown, 2);
  assert.equal(result.items.every((item) => item.result === 'unknown'), true);
});

test('profile validation rejects duplicate and inactive feature codes', () => {
  const invalid = validateProfile({
    requirements: [
      { featureCode: 'step_free_entrance', level: 'required' },
      { featureCode: 'step_free_entrance', level: 'preferred' },
      { featureCode: 'unknown_feature', level: 'avoid' }
    ]
  }, { activeFeatureCodes: new Set(['step_free_entrance']) });

  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 2);
  assert.throws(() => normalizeProfile({
    requirements: [
      { featureCode: 'step_free_entrance', level: 'required' },
      { featureCode: 'step_free_entrance', level: 'preferred' }
    ]
  }), ProfileValidationError);
});

test('profile hashes are stable and do not contain raw requirements', () => {
  const first = profileHash(profile(
    { featureCode: 'quiet_space', level: 'preferred' },
    { featureCode: 'step_free_entrance', level: 'required' }
  ));
  const second = profileHash(profile(
    { featureCode: 'step_free_entrance', level: 'required' },
    { featureCode: 'quiet_space', level: 'preferred' }
  ));

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first.includes('step_free_entrance'), false);
});
