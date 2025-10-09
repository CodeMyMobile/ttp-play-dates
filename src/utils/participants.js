const COMMON_IDENTITY_KEYS = [
  "player_id",
  "playerId",
  "invitee_id",
  "inviteeId",
  "member_id",
  "memberId",
  "user_id",
  "userId",
  "profile_id",
  "profileId",
  "participant_id",
  "participantId",
  "id",
];

const DEFAULT_IDENTITY_KEYS = COMMON_IDENTITY_KEYS;

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

const toIdentityToken = (value) => {
  if (value === null || value === undefined) return null;
  const type = typeof value;
  if (type === "number" && Number.isFinite(value)) {
    return `number:${value}`;
  }
  if (type === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    return `string:${normalized.toLowerCase()}`;
  }
  if (type === "bigint") {
    return `bigint:${value.toString()}`;
  }
  return null;
};

const NESTED_IDENTITY_SOURCES = [
  "player",
  "member",
  "invitee",
  "user",
  "profile",
  "participant",
];

const buildIdentityCandidates = (item, keys = DEFAULT_IDENTITY_KEYS) => {
  if (!item || typeof item !== "object") return [];
  const tokens = [];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
    const normalized = normalizeIdentityValue(item[key]);
    const token = toIdentityToken(normalized);
    if (!token) continue;
    if (!tokens.includes(token)) {
      tokens.push(token);
    }
  }

  for (const sourceKey of NESTED_IDENTITY_SOURCES) {
    if (!Object.prototype.hasOwnProperty.call(item, sourceKey)) continue;
    const nested = item[sourceKey];
    if (!nested || typeof nested !== "object" || nested === item) continue;
    const nestedTokens = buildIdentityCandidates(nested, keys);
    for (const token of nestedTokens) {
      if (!tokens.includes(token)) {
        tokens.push(token);
      }
    }
  }
  return tokens;
};

const hasIdentity = (item, keys = DEFAULT_IDENTITY_KEYS) => {
  if (!item || typeof item !== "object") return false;
  return buildIdentityCandidates(item, keys).length > 0;
};

export const dedupeByIdentity = (items = [], keys = DEFAULT_IDENTITY_KEYS) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const identities = buildIdentityCandidates(item, keys);
    if (identities.length === 0) continue;
    if (identities.some((identity) => seen.has(identity))) continue;
    identities.forEach((identity) => seen.add(identity));
    deduped.push(item);
  }
  return deduped;
};

const PARTICIPANT_IDENTITY_KEYS = COMMON_IDENTITY_KEYS;

export const uniqueParticipants = (participants = []) => {
  if (!Array.isArray(participants)) return [];
  const identityKeys = PARTICIPANT_IDENTITY_KEYS;
  return dedupeByIdentity(
    participants.filter((participant) => hasIdentity(participant, identityKeys)),
    identityKeys,
  );
};

const isParticipantActive = (participant) => {
  if (!participant || typeof participant !== "object") return false;

  if (participant.is_active === false || participant.active === false) {
    return false;
  }

  if (
    hasTruthyFlag(participant, [
      "removed",
      "is_removed",
      "has_removed",
      "was_removed",
      "kicked",
      "is_kicked",
      "left",
      "has_left",
      "hasLeft",
      "did_leave",
      "didLeave",
      "didLeft",
      "left_match",
      "leftMatch",
      "is_cancelled",
      "isCanceled",
      "isCancelled",
      "is_declined",
      "isDeclined",
      "is_withdrawn",
      "isWithdrawn",
    ])
  ) {
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

  if (!hasAffirmativeStatus(participant)) {
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

const MATCH_OCCUPANT_IDENTITY_KEYS = [
  ...COMMON_IDENTITY_KEYS,
];

export const uniqueMatchOccupants = (participants = [], invitees = []) => {
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
    MATCH_OCCUPANT_IDENTITY_KEYS,
  );
};

export const countUniqueMatchOccupants = (participants = [], invitees = []) =>
  uniqueMatchOccupants(participants, invitees).length;

const INVITEE_IDENTITY_KEYS = COMMON_IDENTITY_KEYS;

export const uniqueInvitees = (invitees = []) => {
  if (!Array.isArray(invitees)) return [];
  const identityKeys = INVITEE_IDENTITY_KEYS;
  return dedupeByIdentity(
    invitees.filter((invite) => hasIdentity(invite, identityKeys)),
    identityKeys,
  );
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

const TRUTHY_STRING_VALUES = new Set(["true", "1", "yes", "y", "t"]);
const FALSY_STRING_VALUES = new Set(["false", "0", "no", "n", "f"]);

const hasTruthyFlag = (item, keys = []) => {
  if (!item) return false;
  return keys.some((key) => {
    if (!Object.prototype.hasOwnProperty.call(item, key)) return false;
    const value = item[key];
    if (value === undefined || value === null) return false;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return false;
      if (FALSY_STRING_VALUES.has(normalized)) return false;
      if (TRUTHY_STRING_VALUES.has(normalized)) return true;
      return true;
    }
    return Boolean(value);
  });
};

const INACTIVE_STATUS_VALUES = new Set([
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
  "invite",
  "request",
  "requested",
  "requesting",
  "waitlisted",
  "waiting",
  "tentative",
]);

const INACTIVE_STATUS_KEYWORDS = [
  /left/, // left, left_by_host, player_left, etc.
  /remov/, // removed, removed_by_host
  /cancel/, // cancelled_by_host, cancel
  /declin/, // declined, declining
  /reject/,
  /withdraw/,
  /expire/,
  /pending/,
  /invite/,
  /request/,
  /wait/,
  /tentativ/,
  /no(?![a-z])/,
  /not\s+going/,
  /backup/,
  /alternate/,
];

const isInactiveStatus = (value) => {
  if (!value) return false;
  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) return false;
  if (INACTIVE_STATUS_VALUES.has(normalized)) return true;
  return INACTIVE_STATUS_KEYWORDS.some((pattern) => pattern.test(normalized));
};

const ACTIVE_STATUS_VALUES = new Set([
  "accepted",
  "confirmed",
  "joined",
  "active",
  "attending",
  "yes",
  "going",
  "participating",
  "participant",
  "registered",
  "playing",
  "host",
  "owner",
  "leader",
  "captain",
]);

const ACTIVE_STATUS_PATTERNS = [
  /accept/,
  /confirm/,
  /join/,
  /attend/,
  /going/,
  /particip/,
  /active/,
  /register/,
  /play/,
  /host/,
  /owner/,
  /leader/,
  /captain/,
];

const collectStatusValues = (participant) => {
  if (!participant || typeof participant !== "object") {
    return [];
  }
  const statusKeys = [
    "status",
    "participant_status",
    "participantStatus",
    "attendance_status",
    "attendanceStatus",
    "response",
    "rsvp_status",
    "rsvpStatus",
    "state",
  ];

  return statusKeys
    .flatMap((key) => {
      if (!Object.prototype.hasOwnProperty.call(participant, key)) return [];
      const value = participant[key];
      if (value === undefined || value === null) return [];
      if (Array.isArray(value)) {
        return value
          .map((entry) =>
            entry && entry.toString && entry.toString().trim().toLowerCase(),
          )
          .filter((entry) => entry);
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const normalized = value.toString().trim().toLowerCase();
        return normalized ? [normalized] : [];
      }
      return [];
    })
    .filter((entry, index, self) => self.indexOf(entry) === index);
};

const hasAffirmativeStatus = (participant) => {
  const statuses = collectStatusValues(participant);
  if (statuses.length === 0) {
    return true;
  }
  return statuses.some(
    (status) =>
      ACTIVE_STATUS_VALUES.has(status) ||
      ACTIVE_STATUS_PATTERNS.some((pattern) => pattern.test(status)),
  );
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

  if (
    hasTruthyFlag(invite, [
      "removed",
      "is_removed",
      "has_removed",
      "was_removed",
      "kicked",
      "is_kicked",
      "left",
      "has_left",
      "hasLeft",
      "did_leave",
      "didLeave",
      "didLeft",
      "left_match",
      "leftMatch",
      "is_cancelled",
      "isCanceled",
      "isCancelled",
      "is_declined",
      "isDeclined",
      "is_withdrawn",
      "isWithdrawn",
    ])
  ) {
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

export const uniqueAcceptedInvitees = (invitees = []) => {
  if (!Array.isArray(invitees) || invitees.length === 0) return [];
  const identityKeys = INVITEE_IDENTITY_KEYS;
  return dedupeByIdentity(
    invitees.filter(
      (invite) => hasIdentity(invite, identityKeys) && isInviteActive(invite),
    ),
    identityKeys,
  );
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

const pruneItemsByIdentity = (items, memberId) => {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => {
    if (!item || typeof item !== "object") return true;
    return COMMON_IDENTITY_KEYS.every((key) => !idsMatch(item[key], memberId));
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

const clearJoinMetadata = (target) => {
  if (!target || typeof target !== "object") return target;
  for (const key of JOIN_METADATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      delete target[key];
    }
  }
  return target;
};

const pruneParticipantCollections = (target, memberId, seen) => {
  if (!target || typeof target !== "object") return target;
  if (seen.has(target)) return target;
  seen.add(target);

  const next = clearJoinMetadata({ ...target });

  if (Array.isArray(next.participants)) {
    next.participants = pruneItemsByIdentity(next.participants, memberId);
  }

  if (Array.isArray(next.invitees)) {
    next.invitees = pruneItemsByIdentity(next.invitees, memberId);
  }

  if (next.match && typeof next.match === "object") {
    next.match = pruneParticipantCollections(next.match, memberId, seen);
    clearJoinMetadata(next.match);
  }

  return next;
};

export const pruneParticipantFromMatchData = (data, memberId) => {
  if (memberId === null || memberId === undefined) return data;
  if (!data || typeof data !== "object") return data;
  const seen = new WeakSet();
  return pruneParticipantCollections(data, memberId, seen);
};
