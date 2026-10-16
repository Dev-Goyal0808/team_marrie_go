import { AuthError } from './errors.mjs';
import { requireActiveSession } from './session.mjs';

export const ROLES = Object.freeze(['user', 'moderator', 'admin', 'facility_manager']);

function roleSet(roles) {
  const values = Array.isArray(roles) ? roles : [roles];
  if (values.some((role) => typeof role !== 'string' || !ROLES.includes(role))) {
    throw new TypeError(`Roles must be one of: ${ROLES.join(', ')}`);
  }
  return new Set(values);
}

function userFromSession(session) {
  requireActiveSession(session);
  return session.user;
}

export function hasRole(session, roles, { allowAdmin = true } = {}) {
  if (!session?.authenticated || !session.user || session.user.status !== 'active') {
    return false;
  }
  const allowed = roleSet(roles);
  return allowed.has(session.user.role) || (allowAdmin && session.user.role === 'admin');
}

export function requireRole(session, roles, options) {
  const user = userFromSession(session);
  if (!hasRole(session, roles, options)) {
    throw new AuthError({
      code: 'FORBIDDEN_ROLE',
      status: 403,
      title: 'Insufficient role',
      detail: 'This account does not have the role required for this operation.',
      type: 'https://accessmap.example/problems/forbidden'
    });
  }
  return user;
}

function ownerIdFrom(resourceOrOwnerId, ownerIdField) {
  if (typeof resourceOrOwnerId === 'string') {
    return resourceOrOwnerId;
  }
  return resourceOrOwnerId?.[ownerIdField] ?? resourceOrOwnerId?.owner_id ?? resourceOrOwnerId?.userId;
}

export function ownsResource(session, resourceOrOwnerId, { ownerIdField = 'ownerId', allowAdmin = true } = {}) {
  if (!session?.authenticated || !session.user || session.user.status !== 'active') {
    return false;
  }
  const ownerId = ownerIdFrom(resourceOrOwnerId, ownerIdField);
  return session.user.id === ownerId || (allowAdmin && session.user.role === 'admin');
}

export function requireOwnership(session, resourceOrOwnerId, options) {
  const user = userFromSession(session);
  if (!ownsResource(session, resourceOrOwnerId, options)) {
    throw new AuthError({
      code: 'FORBIDDEN_OWNERSHIP',
      status: 403,
      title: 'Ownership required',
      detail: 'This account cannot access the requested private resource.',
      type: 'https://accessmap.example/problems/forbidden'
    });
  }
  return user;
}

function facilityIdsFor(user) {
  const ids = user.facilityIds ?? user.facilities ?? (user.facilityId ? [user.facilityId] : []);
  return Array.isArray(ids) ? ids : [];
}

export function hasFacilityScope(session, facilityId, { allowRoles = ['admin', 'moderator'] } = {}) {
  if (!session?.authenticated || !session.user || session.user.status !== 'active') {
    return false;
  }
  const privilegedRoles = roleSet(allowRoles);
  return (
    privilegedRoles.has(session.user.role) ||
    session.user.role === 'admin' ||
    (session.user.role === 'facility_manager' && facilityIdsFor(session.user).includes(facilityId))
  );
}

export function requireFacilityScope(session, facilityId, options) {
  const user = userFromSession(session);
  if (typeof facilityId !== 'string' || facilityId.length === 0 || !hasFacilityScope(session, facilityId, options)) {
    throw new AuthError({
      code: 'FORBIDDEN_FACILITY_SCOPE',
      status: 403,
      title: 'Facility scope required',
      detail: 'This account is not authorized for the requested facility.',
      type: 'https://accessmap.example/problems/forbidden'
    });
  }
  return user;
}
