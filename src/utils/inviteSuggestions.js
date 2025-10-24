import { uniqueParticipants } from "./participants";
import { memberMatchesParticipant } from "./memberIdentity";

const candidateIdKeys = [
  "player_id",
  "playerId",
  "user_id",
  "userId",
  "participant_id",
  "participantId",
  "match_participant_id",
  "matchParticipantId",
  "invitee_id",
  "inviteeId",
  "id",
  ["profile", "player_id"],
  ["profile", "playerId"],
  ["profile", "id"],
];

const readValue = (subject, key) => {
  if (!subject || typeof subject !== "object") return undefined;
  if (Array.isArray(key)) {
    return key.reduce((acc, segment) => {
      if (acc && typeof acc === "object") {
        return acc[segment];
      }
      return undefined;
    }, subject);
  }
  return subject[key];
};

const isPlainIdKey = (key) => typeof key === "string" && key === "id";

const participantIdentityPaths = candidateIdKeys.filter((key) => !isPlainIdKey(key));

const parseNumericId = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const extractParticipantId = (participant) => {
  if (!participant || typeof participant !== "object") {
    return null;
  }

  for (const key of candidateIdKeys) {
    const candidate = readValue(participant, key);
    const parsed = parseNumericId(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
};

const participantContextKeys = [
  "participant_status",
  "participantStatus",
  "status",
  "status_reason",
  "statusReason",
  "role",
  "is_active",
  "active",
  "joined_at",
  "joinedAt",
  "checked_in_at",
  "checkedInAt",
  "invited_at",
  "invitedAt",
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
  "profile",
  "player",
  "invitee",
  "user",
  "member",
  "team",
  "identity",
  "identity_id",
  "identityId",
  "identity_ids",
  "identityIds",
  "full_name",
  "fullName",
  "display_name",
  "displayName",
];

const plainIdSupplementalKeys = [
  "participant_status",
  "participantStatus",
  "status_reason",
  "statusReason",
  "role",
  "profile",
  "player",
  "invitee",
  "user",
  "member",
  "team",
  "identity",
  "identity_id",
  "identityId",
  "identity_ids",
  "identityIds",
  "full_name",
  "fullName",
  "display_name",
  "displayName",
  "joined_at",
  "joinedAt",
  "checked_in_at",
  "checkedInAt",
  "invited_at",
  "invitedAt",
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
];

const participantStatusValues = new Set([
  "accepted",
  "accept",
  "active",
  "attend",
  "attending",
  "checked-in",
  "checked_in",
  "checkedin",
  "confirm",
  "confirmed",
  "confirmed_player",
  "confirmed_substitute",
  "joining",
  "joined",
  "participant",
  "participating",
  "pending",
  "playing",
  "registered",
  "reserve",
  "standby",
  "sub",
  "substitute",
  "waitlist",
  "waitlisted",
  "alternate",
  "alternate_player",
  "available",
  "invited",
]);

const looksLikeParticipantRecord = (candidate) => {
  if (!candidate || typeof candidate !== "object" || candidate instanceof Date) {
    return false;
  }

  const participantId = extractParticipantId(candidate);
  if (participantId === null) {
    return false;
  }

  const hasParticipantSpecificIdentity = participantIdentityPaths.some((key) => {
    const value = readValue(candidate, key);
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    if (typeof value === "number") {
      return Number.isFinite(value);
    }
    return true;
  });

  const hasPlainId = Object.prototype.hasOwnProperty.call(candidate, "id");

  if (!hasParticipantSpecificIdentity && !hasPlainId) {
    return false;
  }

  const hasContext = participantContextKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(candidate, key),
  );

  if (!hasContext) {
    return false;
  }

  if (hasPlainId && !hasParticipantSpecificIdentity) {
    const hasSupplemental = plainIdSupplementalKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(candidate, key),
    );

    let hasParticipantStatus = false;
    if (!hasSupplemental && Object.prototype.hasOwnProperty.call(candidate, "status")) {
      const statusValue = candidate.status;
      if (statusValue !== undefined && statusValue !== null) {
        const normalized = statusValue.toString().trim().toLowerCase();
        hasParticipantStatus = participantStatusValues.has(normalized);
      }
    }

    if (!hasSupplemental && !hasParticipantStatus) {
      return false;
    }
  }

  return true;
};

const participantCollectionPaths = [
  ["participants"],
  ["match", "participants"],
  ["matchParticipants"],
  ["match", "matchParticipants"],
  ["match_participants"],
  ["match", "match_participants"],
];

const collectParticipantsFromSource = (source, participants, visited) => {
  if (source === null || source === undefined) {
    return;
  }

  if (typeof source !== "object" || source instanceof Date) {
    return;
  }

  if (visited.has(source)) {
    return;
  }
  visited.add(source);

  if (Array.isArray(source)) {
    source.forEach((item) => {
      if (item === undefined || item === null) {
        return;
      }
      collectParticipantsFromSource(item, participants, visited);
    });
    return;
  }

  if (looksLikeParticipantRecord(source)) {
    participants.push(source);
    return;
  }

  Object.values(source).forEach((value) => {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value !== "object") {
      return;
    }
    collectParticipantsFromSource(value, participants, visited);
  });
};

const collectMatchParticipants = (match) => {
  if (!match || typeof match !== "object") {
    return [];
  }

  const participants = [];
  const visited = new Set();

  participantCollectionPaths.forEach((path) => {
    const value = readValue(match, path);
    if (value !== undefined && value !== null) {
      collectParticipantsFromSource(value, participants, visited);
    }
  });

  return participants;
};

const departureKeys = [
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
];

const statusKeys = [
  "status",
  "participant_status",
  "participantStatus",
  "status_reason",
  "statusReason",
  "response",
  "rsvp_status",
  "rsvpStatus",
];

const normalizeStatus = (value) => {
  if (value === undefined || value === null) {
    return "";
  }
  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  return normalized
    .replace(/[_-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const inactiveStatusValues = new Set([
  "left",
  "removed",
  "cancelled",
  "canceled",
  "declined",
  "rejected",
  "withdrawn",
  "expired",
  "no show",
  "did not show",
  "did not attend",
  "not attending",
  "not coming",
  "no longer attending",
  "no longer playing",
  "banned",
  "blocked",
  "suspended",
  "kicked",
  "booted",
  "removed by host",
  "removed by captain",
  "cancelled by host",
  "canceled by host",
  "cancelled by captain",
  "canceled by captain",
]);

const inactiveStatusList = Array.from(inactiveStatusValues);

const hasMeaningfulValue = (subject, key) => {
  if (!subject || typeof subject !== "object") {
    return false;
  }
  if (!Object.prototype.hasOwnProperty.call(subject, key)) {
    return false;
  }
  const value = subject[key];
  if (value === undefined || value === null) {
    return false;
  }
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
};

const hasDepartureMetadata = (participant) =>
  departureKeys.some((key) => hasMeaningfulValue(participant, key));

const hasInactiveStatus = (participant) =>
  statusKeys.some((key) => {
    const raw = readValue(participant, key);
    const normalized = normalizeStatus(raw);
    if (!normalized) {
      return false;
    }
    if (inactiveStatusValues.has(normalized)) {
      return true;
    }
    return inactiveStatusList.some((inactive) =>
      normalized.includes(inactive),
    );
  });

const isEligibleForSuggestions = (participant) => {
  if (!participant || typeof participant !== "object") {
    return false;
  }
  if (participant.is_active === false || participant.active === false) {
    return false;
  }
  if (hasDepartureMetadata(participant)) {
    return false;
  }
  if (hasInactiveStatus(participant)) {
    return false;
  }
  return true;
};

const buildParticipantName = (participant, fallbackId) => {
  if (!participant || typeof participant !== "object") {
    return fallbackId ? `Player ${fallbackId}` : "Unknown player";
  }
  const profile = participant.profile || {};
  const nameCandidates = [
    profile.full_name,
    profile.fullName,
    profile.display_name,
    profile.displayName,
    profile.name,
    [profile.first_name, profile.last_name]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(" "),
    participant.full_name,
    participant.fullName,
    participant.display_name,
    participant.displayName,
    participant.name,
    participant.player_name,
    participant.playerName,
  ];

  for (const candidate of nameCandidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (fallbackId) {
    return `Player ${fallbackId}`;
  }
  return "Unknown player";
};

const candidateDateKeys = [
  "start_date_time",
  "startDateTime",
  "start_time",
  "startTime",
  "start_at",
  "startAt",
];

const extractMatchMoment = (match) => {
  if (!match || typeof match !== "object") {
    return { timestamp: null, iso: null };
  }
  const candidates = [];
  for (const key of candidateDateKeys) {
    if (Object.prototype.hasOwnProperty.call(match, key)) {
      candidates.push(match[key]);
    }
  }
  if (match.match && typeof match.match === "object") {
    for (const key of candidateDateKeys) {
      if (Object.prototype.hasOwnProperty.call(match.match, key)) {
        candidates.push(match.match[key]);
      }
    }
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    const date = candidate instanceof Date ? candidate : new Date(candidate);
    if (Number.isNaN(date.getTime())) continue;
    return { timestamp: date.getTime(), iso: date.toISOString() };
  }
  return { timestamp: null, iso: null };
};

export const buildRecentPartnerSuggestions = ({
  matches = [],
  currentUser,
  memberIdentities,
} = {}) => {
  if (!Array.isArray(matches) || matches.length === 0) {
    return [];
  }
  const suggestionMap = new Map();

  matches.forEach((match) => {
    const { timestamp, iso } = extractMatchMoment(match);
    const participants = uniqueParticipants(
      collectMatchParticipants(match),
    ).filter(isEligibleForSuggestions);
    participants.forEach((participant) => {
      if (
        memberMatchesParticipant(
          currentUser,
          participant,
          memberIdentities,
        )
      ) {
        return;
      }
      const participantId = extractParticipantId(participant);
      if (!participantId) return;
      const name = buildParticipantName(participant, participantId);
      const existing = suggestionMap.get(participantId);
      if (
        !existing ||
        ((timestamp ?? -Infinity) > (existing.lastPlayedTs ?? -Infinity))
      ) {
        suggestionMap.set(participantId, {
          user_id: participantId,
          full_name: name,
          lastPlayedAt: iso,
          lastPlayedTs: timestamp ?? null,
        });
      }
    });
  });

  return Array.from(suggestionMap.values())
    .sort(
      (a, b) => (b.lastPlayedTs ?? -Infinity) - (a.lastPlayedTs ?? -Infinity),
    )
    .map(({ lastPlayedTs, ...player }) => player);
};

export default buildRecentPartnerSuggestions;
