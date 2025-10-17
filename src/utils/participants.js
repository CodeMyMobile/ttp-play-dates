import {
  safeOwnPropertyDescriptor,
  safeOwnPropertyValue,
  safeValueAtPath,
  safeIterableKeys,
} from "./safeAccess";

const PARTICIPANT_IDENTITY_KEYS = [
  "match_participant_id",
  "matchParticipantId",
  "participant_id",
  "participantId",
  "player_id",
  "playerId",
  "invitee_id",
  "inviteeId",
  "id",
  "profile.id",
  "profile.player_id",
  "profile.playerId",
  "profile.user_id",
  "profile.userId",
  "player.id",
  "player.player_id",
  "player.playerId",
];

const INVITE_IDENTITY_KEYS = [
  "invitee_id",
  "inviteeId",
  "player_id",
  "playerId",
  "participant_id",
  "participantId",
  "id",
  "profile.id",
  "profile.player_id",
  "profile.playerId",
];

const DEFAULT_IDENTITY_KEYS = PARTICIPANT_IDENTITY_KEYS;

const getValueByKeyPath = (item, key) => {
  if (!item || typeof item !== "object") return undefined;
  if (Array.isArray(key)) {
    return safeValueAtPath(item, key);
  }
  if (typeof key !== "string" || key.length === 0) return undefined;
  if (!key.includes(".")) {
    return safeOwnPropertyValue(item, key);
  }
  return safeValueAtPath(item, key.split("."));
};

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
  if (typeof value === "boolean") {
    return null;
  }
  if (typeof value !== "number" && typeof value !== "bigint") {
    return null;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return null;
};

const buildIdentity = (item, keys = DEFAULT_IDENTITY_KEYS) => {
  for (const key of keys) {
    const identity = normalizeIdentityValue(getValueByKeyPath(item, key));
    if (identity !== null) {
      const label = Array.isArray(key) ? key.join(".") : key;
      return `${label}:${identity}`;
    }
  }
  return null;
};

const hasIdentity = (item, keys = DEFAULT_IDENTITY_KEYS) => {
  if (!item || typeof item !== "object") return false;
  return buildIdentity(item, keys) !== null;
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
    if (!identity) continue;
    if (seen.has(identity)) continue;
    seen.add(identity);
    deduped.push(item);
  }
  return deduped;
};

export const uniqueParticipants = (participants = []) => {
  if (!Array.isArray(participants)) return [];
  const identityKeys = PARTICIPANT_IDENTITY_KEYS;
  const withIdentity = participants.filter((participant) =>
    hasIdentity(participant, identityKeys),
  );
  const deduped = dedupeByIdentity(withIdentity, identityKeys);
  if (deduped.length === participants.length) {
    return deduped;
  }
  const withoutIdentity = participants.filter(
    (participant) => !hasIdentity(participant, identityKeys),
  );
  return [...deduped, ...withoutIdentity];
};

const isParticipantActive = (participant) => {
  if (!participant || typeof participant !== "object") return false;

  const inactiveFlags = [
    safeOwnPropertyValue(participant, "is_active"),
    safeOwnPropertyValue(participant, "active"),
  ];
  if (inactiveFlags.some((value) => value === false)) {
    return false;
  }

  const statusCandidates = [
    safeOwnPropertyValue(participant, "status"),
    safeOwnPropertyValue(participant, "participant_status"),
    safeOwnPropertyValue(participant, "participantStatus"),
    safeOwnPropertyValue(participant, "status_reason"),
    safeOwnPropertyValue(participant, "statusReason"),
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
    PARTICIPANT_IDENTITY_KEYS,
  );
};

export const countUniqueMatchOccupants = (participants = [], invitees = []) =>
  uniqueMatchOccupants(participants, invitees).length;

export const uniqueInvitees = (invitees = []) => {
  if (!Array.isArray(invitees)) return [];
  const identityKeys = INVITE_IDENTITY_KEYS;
  return dedupeByIdentity(
    invitees.filter((invite) => hasIdentity(invite, identityKeys)),
    identityKeys,
  );
};

const hasAnyValue = (item, keys = []) => {
  if (!item || typeof item !== "object") return false;
  return keys.some((key) => {
    const value = safeOwnPropertyValue(item, key);
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
  if (value === undefined || value === null) return false;
  if (typeof value !== "string" && typeof value !== "number") {
    return false;
  }
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
    "pending",
    "invited",
  ].includes(normalized);
};

const isInviteActive = (invite) => {
  if (!invite || typeof invite !== "object") return false;
  const rawStatus = safeOwnPropertyValue(invite, "status");
  const status = rawStatus ? rawStatus.toString().trim().toLowerCase() : "";
  if (status !== "accepted" || isInactiveStatus(status)) {
    return false;
  }

  const inactiveFlags = [
    safeOwnPropertyValue(invite, "is_active"),
    safeOwnPropertyValue(invite, "active"),
  ];
  if (inactiveFlags.some((value) => value === false)) {
    return false;
  }

  const participantStatusRaw =
    safeOwnPropertyValue(invite, "participant_status") ??
    safeOwnPropertyValue(invite, "participantStatus");
  const participantStatus = participantStatusRaw
    ? participantStatusRaw.toString().trim().toLowerCase()
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

  const statusReasonRaw =
    safeOwnPropertyValue(invite, "status_reason") ??
    safeOwnPropertyValue(invite, "statusReason");
  const statusReason = statusReasonRaw
    ? statusReasonRaw.toString().trim().toLowerCase()
    : "";
  if (isInactiveStatus(statusReason)) {
    return false;
  }

  return true;
};

export const uniqueAcceptedInvitees = (invitees = []) => {
  if (!Array.isArray(invitees) || invitees.length === 0) return [];
  const identityKeys = INVITE_IDENTITY_KEYS;
  const activeInvitees = invitees.filter((invite) => isInviteActive(invite));
  const withIdentity = activeInvitees.filter((invite) =>
    hasIdentity(invite, identityKeys),
  );
  const deduped = dedupeByIdentity(withIdentity, identityKeys);
  if (deduped.length === activeInvitees.length) {
    return deduped;
  }
  const withoutIdentity = activeInvitees.filter(
    (invite) => !hasIdentity(invite, identityKeys),
  );
  return [...deduped, ...withoutIdentity];
};

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

const matchesMemberIdentity = (value, memberIdentity) => {
  if (memberIdentity === null || memberIdentity === undefined) return false;
  if (Array.isArray(memberIdentity)) {
    return memberIdentity.some((candidate) => idsMatch(value, candidate));
  }
  return idsMatch(value, memberIdentity);
};

const pruneItemsByIdentity = (items, memberIdentity) => {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => {
    if (!item || typeof item !== "object") return true;
    const candidates = [
      safeOwnPropertyValue(item, "player_id"),
      safeOwnPropertyValue(item, "playerId"),
      safeOwnPropertyValue(item, "match_participant_id"),
      safeOwnPropertyValue(item, "matchParticipantId"),
      safeOwnPropertyValue(item, "participant_id"),
      safeOwnPropertyValue(item, "participantId"),
      safeOwnPropertyValue(item, "invitee_id"),
      safeOwnPropertyValue(item, "inviteeId"),
      safeOwnPropertyValue(item, "id"),
      safeValueAtPath(item, ["profile", "id"]),
      safeValueAtPath(item, ["profile", "player_id"]),
      safeValueAtPath(item, ["profile", "playerId"]),
    ];
    return !candidates.some((value) => matchesMemberIdentity(value, memberIdentity));
  });
};

const JOIN_METADATA_KEYS = [
  "joined_at",
  "joinedAt",
  "joined",
  "joined_on",
  "joinedOn",
  "joined_by_player_id",
  "joinedByPlayerId",
  "joined_player_id",
  "joinedPlayerId",
  "joined_status",
  "joinedStatus",
  "is_joined",
  "isJoined",
];

const clonePlainObject = (source) => {
  if (!source || typeof source !== "object") return {};
  const clone = {};
  for (const key of safeIterableKeys(source)) {
    const descriptor = safeOwnPropertyDescriptor(source, key);
    if (!descriptor) continue;
    if (typeof descriptor.get === "function" || typeof descriptor.set === "function") {
      continue;
    }
    clone[key] = descriptor.value;
  }
  return clone;
};

const clearJoinMetadata = (target) => {
  if (!target || typeof target !== "object") return target;
  for (const key of JOIN_METADATA_KEYS) {
    const descriptor = safeOwnPropertyDescriptor(target, key);
    if (!descriptor) continue;
    if (typeof descriptor.get === "function" || typeof descriptor.set === "function") {
      continue;
    }
    try {
      delete target[key];
    } catch {
      try {
        target[key] = undefined;
      } catch {
        /* ignore */
      }
    }
  }
  return target;
};

const pruneParticipantCollections = (target, memberIdentity, seen) => {
  if (!target || typeof target !== "object") return target;
  if (seen.has(target)) return target;
  seen.add(target);

  const next = clearJoinMetadata(clonePlainObject(target));

  const participants = safeOwnPropertyValue(target, "participants");
  if (Array.isArray(participants)) {
    next.participants = pruneItemsByIdentity(participants, memberIdentity);
  }

  const invitees = safeOwnPropertyValue(target, "invitees");
  if (Array.isArray(invitees)) {
    next.invitees = pruneItemsByIdentity(invitees, memberIdentity);
  }

  const nestedMatch = safeOwnPropertyValue(target, "match");
  if (nestedMatch && typeof nestedMatch === "object") {
    next.match = pruneParticipantCollections(nestedMatch, memberIdentity, seen);
  }

  return next;
};

export const pruneParticipantFromMatchData = (data, memberIdentity) => {
  if (memberIdentity === null || memberIdentity === undefined) return data;
  if (Array.isArray(memberIdentity) && memberIdentity.length === 0) return data;
  if (!data || typeof data !== "object") return data;
  const seen = new WeakSet();
  return pruneParticipantCollections(data, memberIdentity, seen);
};
