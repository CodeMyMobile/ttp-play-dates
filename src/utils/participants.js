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

const isParticipantActive = (participant) => {
  if (!participant || typeof participant !== "object") return false;

  if (participant.is_active === false || participant.active === false) {
    return false;
  }

  const statusCandidates = [
    participant.status,
    participant.participant_status,
    participant.participantStatus,
    participant.status_reason,
    participant.statusReason,
  ];
  if (statusCandidates.some((value) => isInactiveStatus(value))) {
    return false;
  }

  if (
    hasAnyValue(participant, [
      "left_at",
      "leftAt",
      "removed_at",
      "removedAt",
      "cancelled_at",
      "cancelledAt",
      "canceled_at",
      "canceledAt",
      "declined_at",
      "declinedAt",
      "withdrawn_at",
      "withdrawnAt",
    ])
  ) {
    return false;
  }

  return true;
};

export const uniqueActiveParticipants = (participants = []) =>
  uniqueParticipants(participants).filter(isParticipantActive);

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

const hasAnyValue = (item, keys = []) => {
  if (!item) return false;
  return keys.some((key) => {
    if (!Object.prototype.hasOwnProperty.call(item, key)) return false;
    const value = item[key];
    if (value === undefined || value === null) return false;
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    if (typeof value === "number") {
      return Number.isFinite(value);
    }
    if (value instanceof Date) {
      return !Number.isNaN(value.getTime());
    }
    return true;
  });
};

const isInactiveStatus = (value) => {
  if (!value) return false;
  const normalized = value.toString().trim().toLowerCase();
  return [
    "left",
    "removed",
    "cancelled",
    "canceled",
    "declined",
    "rejected",
    "withdrawn",
    "expired",
  ].includes(normalized);
};

const isInviteActive = (invite) => {
  if (!invite || typeof invite !== "object") return false;
  const status = invite.status ? invite.status.toString().trim().toLowerCase() : "";
  if (status !== "accepted" || isInactiveStatus(status)) {
    return false;
  }

  if (invite.is_active === false || invite.active === false) {
    return false;
  }

  const participantStatus = invite.participant_status
    ? invite.participant_status.toString().trim().toLowerCase()
    : invite.participantStatus
    ? invite.participantStatus.toString().trim().toLowerCase()
    : "";
  if (isInactiveStatus(participantStatus)) {
    return false;
  }

  if (
    hasAnyValue(invite, [
      "left_at",
      "leftAt",
      "removed_at",
      "removedAt",
      "cancelled_at",
      "cancelledAt",
      "canceled_at",
      "canceledAt",
      "declined_at",
      "declinedAt",
      "withdrawn_at",
      "withdrawnAt",
    ])
  ) {
    return false;
  }

  const statusReason = invite.status_reason
    ? invite.status_reason.toString().trim().toLowerCase()
    : invite.statusReason
    ? invite.statusReason.toString().trim().toLowerCase()
    : "";
  if (isInactiveStatus(statusReason)) {
    return false;
  }

  return true;
};

export const uniqueAcceptedInvitees = (invitees = []) =>
  dedupeByIdentity(
    Array.isArray(invitees) ? invitees.filter(isInviteActive) : [],
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
