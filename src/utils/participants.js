const DEFAULT_IDENTITY_KEYS = ["player_id", "invitee_id", "id"];

const normalizeIdentityValue = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;
    return trimmed;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return null;
};

const buildIdentity = (item, keys = DEFAULT_IDENTITY_KEYS) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
    const identity = normalizeIdentityValue(item[key]);
    if (identity !== null) {
      return `${key}:${identity}`;
    }
  }
  return null;
};

export const dedupeByIdentity = (items = [], keys = DEFAULT_IDENTITY_KEYS) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const identity = buildIdentity(item, keys);
    if (identity) {
      if (seen.has(identity)) continue;
      seen.add(identity);
    }
    deduped.push(item);
  }
  return deduped;
};

export const uniqueParticipants = (participants = []) => {
  if (!Array.isArray(participants)) return [];
  return dedupeByIdentity(participants.filter(Boolean), [
    "player_id",
    "invitee_id",
    "id",
  ]);
};

export const uniqueActiveParticipants = (participants = []) =>
  uniqueParticipants(participants).filter((participant) =>
    participant?.status ? participant.status !== "left" : true,
  );

export const countUniqueActiveParticipants = (participants = []) =>
  uniqueActiveParticipants(participants).length;

export const uniqueMatchOccupants = (
  participants = [],
  invitees = [],
) => {
  const activeParticipants = uniqueActiveParticipants(participants);
  const acceptedInvitees = uniqueAcceptedInvitees(invitees);

  if (acceptedInvitees.length === 0) {
    return activeParticipants;
  }

  if (activeParticipants.length === 0) {
    return acceptedInvitees;
  }

  return dedupeByIdentity(
    [...activeParticipants, ...acceptedInvitees],
    ["player_id", "invitee_id", "id"],
  );
};

export const countUniqueMatchOccupants = (participants = [], invitees = []) =>
  uniqueMatchOccupants(participants, invitees).length;

export const uniqueInvitees = (invitees = []) => {
  if (!Array.isArray(invitees)) return [];
  return dedupeByIdentity(invitees.filter(Boolean), [
    "invitee_id",
    "player_id",
    "id",
  ]);
};

export const uniqueAcceptedInvitees = (invitees = []) =>
  dedupeByIdentity(
    Array.isArray(invitees)
      ? invitees.filter(
          (invite) => invite && invite.status === "accepted",
        )
      : [],
    ["invitee_id", "player_id", "id"],
  );

export const countUniqueAcceptedInvitees = (invitees = []) =>
  uniqueAcceptedInvitees(invitees).length;

const normalizeForComparison = (value) => {
  const normalized = normalizeIdentityValue(value);
  if (typeof normalized === "string") {
    return normalized.toLowerCase();
  }
  return normalized;
};

export const idsMatch = (a, b) => {
  const left = normalizeForComparison(a);
  const right = normalizeForComparison(b);
  if (left === null || right === null) return false;
  return left === right;
};
