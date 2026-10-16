import placeSummary from '@accessmap/contracts/fixtures/place-summary.json' with { type: 'json' };
import claim from '@accessmap/contracts/fixtures/accessibility-claim.json' with { type: 'json' };
import matchProfile from '@accessmap/contracts/fixtures/match-profile.json' with { type: 'json' };
import matchExplanation from '@accessmap/contracts/fixtures/match-explanation.json' with { type: 'json' };
import observation from '@accessmap/contracts/fixtures/observation.json' with { type: 'json' };
import incident from '@accessmap/contracts/fixtures/incident.json' with { type: 'json' };

export const featureCatalog = [
  {
    code: 'step_free_entrance',
    label: 'Step-free entrance',
    group: 'Movement',
    description: 'An entrance without steps on the approach.'
  },
  {
    code: 'accessible_toilet',
    label: 'Accessible toilet',
    group: 'Facilities',
    description: 'A toilet with accessible features available to visitors.'
  },
  {
    code: 'quiet_space',
    label: 'Quiet space',
    group: 'Environment',
    description: 'A calmer area for people who need a lower-stimulation space.'
  },
  {
    code: 'ramp_available',
    label: 'Ramp available',
    group: 'Movement',
    description: 'A ramp that provides an alternative to steps.'
  }
];

export const samplePlace = {
  ...placeSummary,
  categoryLabel: 'Community centre',
  claims: [claim],
  incidents: [incident],
  observation,
  matchProfile,
  matchExplanation
};

export function labelForFeature(featureCode) {
  return featureCatalog.find((feature) => feature.code === featureCode)?.label ?? featureCode.replaceAll('_', ' ');
}

export function featureForCode(featureCode) {
  return featureCatalog.find((feature) => feature.code === featureCode);
}

export function searchPlaces(query = '') {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [samplePlace];

  const searchableText = [
    samplePlace.name,
    samplePlace.category,
    samplePlace.categoryLabel,
    samplePlace.address,
    'community centre pilot district'
  ].join(' ').toLowerCase();

  return searchableText.includes(normalizedQuery) ? [samplePlace] : [];
}

export function formatObservedDate(value) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC'
  }).format(new Date(value));
}

export function formatDistance(distanceMeters) {
  if (distanceMeters < 1000) return `${distanceMeters} m away`;
  return `${(distanceMeters / 1000).toFixed(1)} km away`;
}

export function statusLabel(status) {
  const labels = {
    recently_observed: 'Recently observed',
    community_observation: 'Community observation',
    not_assessed: 'Not assessed',
    temporarily_unavailable: 'Temporarily unavailable',
    published: 'Published barrier',
    pending: 'Pending review',
    needs_more_information: 'Needs more information'
  };

  return labels[status] ?? status.replaceAll('_', ' ');
}

export function getMatchItem(featureCode) {
  return samplePlace.matchExplanation.items.find((item) => item.featureCode === featureCode);
}
