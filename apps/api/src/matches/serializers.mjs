export function serializePrivateProfile(profile) {
  return {
    requirements: profile.requirements.map(({ featureCode, level }) => ({ featureCode, level })),
    profileVersion: Number(profile.profileVersion ?? 0)
  };
}

export function serializeMatchResponse(placeId, match) {
  return {
    placeId,
    ...match.explanation
  };
}

export function serializeAnonymousMatches(items) {
  return { items: items.map(({ placeId, explanation }) => ({ placeId, ...explanation })) };
}
