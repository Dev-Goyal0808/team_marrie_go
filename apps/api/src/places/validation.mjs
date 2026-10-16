import { validateCoordinates, validatePagination } from '../../../../packages/validation/src/index.mjs';

const CODE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const MAX_QUERY_LENGTH = 200;
const MAX_RADIUS_METERS = 50_000;
const MAX_BBOX_SPAN_DEGREES = 2;
const SORT_VALUES = new Set(['relevance', 'distance', 'freshness', 'name']);

export class PlaceInputError extends Error {
  constructor(errors) {
    super('Place request parameters are invalid.');
    this.name = 'PlaceInputError';
    this.errors = errors;
  }
}

function readParam(params, name) {
  if (params instanceof URLSearchParams) return params.get(name);
  if (params instanceof URL) return params.searchParams.get(name);
  return params?.[name] ?? null;
}

function stringParam(params, name, { maxLength = MAX_QUERY_LENGTH } = {}) {
  const value = readParam(params, name);
  if (value === null || value === undefined || value === '') return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) throw new PlaceInputError([{ field: name, message: `Must be ${maxLength} characters or fewer.` }]);
  return normalized;
}

function numberParam(params, name) {
  const value = readParam(params, name);
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function listParam(params, name) {
  const value = readParam(params, name);
  if (value === null || value === undefined || value === '') return [];
  const values = Array.isArray(value) ? value : String(value).split(',');
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

function validateCodes(values, field, allowedCodes) {
  const errors = [];
  for (const value of values) {
    if (!CODE_PATTERN.test(value)) errors.push({ field, message: `${value} is not a valid code.` });
    else if (allowedCodes && !allowedCodes.has(value)) errors.push({ field, message: `${value} is not an active code.` });
  }
  return errors;
}

function parseBoundingBox(value) {
  if (!value) return undefined;
  const parts = String(value).split(',').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new PlaceInputError([{ field: 'bbox', message: 'Bounding box must be west,south,east,north.' }]);
  }

  const [west, south, east, north] = parts;
  const coordinateErrors = {
    ...validateCoordinates({ latitude: south, longitude: west }),
    ...validateCoordinates({ latitude: north, longitude: east })
  };
  if (Object.keys(coordinateErrors).length > 0 || west >= east || south >= north) {
    throw new PlaceInputError([{ field: 'bbox', message: 'Bounding box coordinates must be ordered and within valid ranges.' }]);
  }
  if (east - west > MAX_BBOX_SPAN_DEGREES || north - south > MAX_BBOX_SPAN_DEGREES) {
    throw new PlaceInputError([{ field: 'bbox', message: `Bounding box must be no larger than ${MAX_BBOX_SPAN_DEGREES} degrees in either direction.` }]);
  }
  return { west, south, east, north };
}

export function parsePlaceQuery(params, { categoryCodes, featureCodes } = {}) {
  const errors = [];
  const latitude = numberParam(params, 'latitude');
  const longitude = numberParam(params, 'longitude');
  const radiusMeters = numberParam(params, 'radius');
  const page = numberParam(params, 'page') ?? 1;
  const pageSize = numberParam(params, 'pageSize') ?? 20;
  const category = stringParam(params, 'category', { maxLength: 64 });
  const features = listParam(params, 'features');
  const sort = stringParam(params, 'sort', { maxLength: 32 }) ?? 'relevance';

  errors.push(...Object.entries(validatePagination({ page, pageSize })).map(([field, message]) => ({ field, message })));

  if ((latitude === undefined) !== (longitude === undefined)) errors.push({ field: 'latitude', message: 'Latitude and longitude must be provided together.' });
  if (latitude !== undefined && longitude !== undefined) {
    const coordinateErrors = validateCoordinates({ latitude, longitude });
    errors.push(...Object.entries(coordinateErrors).map(([field, message]) => ({ field, message })));
  }
  if (radiusMeters !== undefined && (latitude === undefined || longitude === undefined)) errors.push({ field: 'radius', message: 'Radius requires latitude and longitude.' });
  if (radiusMeters !== undefined && (!Number.isFinite(radiusMeters) || radiusMeters <= 0 || radiusMeters > MAX_RADIUS_METERS)) {
    errors.push({ field: 'radius', message: `Radius must be greater than zero and no more than ${MAX_RADIUS_METERS} metres.` });
  }
  if (!SORT_VALUES.has(sort)) errors.push({ field: 'sort', message: 'Sort must be relevance, distance, freshness, or name.' });
  if (sort === 'distance' && (latitude === undefined || longitude === undefined)) errors.push({ field: 'sort', message: 'Distance sorting requires latitude and longitude.' });
  if (category && !CODE_PATTERN.test(category)) errors.push({ field: 'category', message: 'Category must be a valid code.' });
  if (category && categoryCodes && !categoryCodes.has(category)) errors.push({ field: 'category', message: 'Category is not active.' });
  errors.push(...validateCodes(features, 'features', featureCodes));

  let bbox;
  try {
    bbox = parseBoundingBox(readParam(params, 'bbox'));
  } catch (error) {
    errors.push(...error.errors);
  }
  if (bbox && (latitude !== undefined || longitude !== undefined || radiusMeters !== undefined)) errors.push({ field: 'bbox', message: 'Use either a bounding box or a radius search, not both.' });

  if (errors.length > 0) throw new PlaceInputError(errors);

  return {
    query: stringParam(params, 'query'),
    city: stringParam(params, 'city'),
    category,
    features,
    latitude,
    longitude,
    radiusMeters: radiusMeters ?? (latitude !== undefined ? 5_000 : undefined),
    bbox,
    page,
    pageSize,
    sort
  };
}

export function validatePlaceId(placeId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(placeId ?? '')) {
    throw new PlaceInputError([{ field: 'placeId', message: 'Place ID must be a UUID.' }]);
  }
  return placeId;
}

export function problemDetailForInput(error) {
  return error.errors.map(({ field, message }) => `${field}: ${message}`).join(' ');
}
