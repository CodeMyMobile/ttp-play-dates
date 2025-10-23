import {
  uniqueActiveParticipants,
  uniqueInvitees,
  dedupeByIdentity,
} from "./participants";

const DEFAULT_LOOKAHEAD_HOURS = 48;
const URGENT_THRESHOLD_HOURS = 12;
const WARNING_THRESHOLD_HOURS = 24;

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toFiniteNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const evaluateLowOccupancyAlert = ({
  status,
  playerLimit,
  startDateTime,
  participants,
  invitees,
  activeParticipants,
  dedupedInvitees,
  now = new Date(),
  lookaheadHours = DEFAULT_LOOKAHEAD_HOURS,
} = {}) => {
  const normalizedStatus =
    typeof status === "string" ? status.trim().toLowerCase() : "";
  if (normalizedStatus && normalizedStatus !== "upcoming") {
    return null;
  }

  const limit = toFiniteNumber(playerLimit);
  if (!Number.isFinite(limit) || limit <= 0) {
    return null;
  }

  const matchDate = toDate(startDateTime);
  if (!matchDate) return null;

  const hoursUntil = (matchDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (!Number.isFinite(hoursUntil) || hoursUntil < 0) {
    return null;
  }
  if (hoursUntil > lookaheadHours) {
    return null;
  }

  const activeList = Array.isArray(activeParticipants)
    ? uniqueActiveParticipants(activeParticipants)
    : uniqueActiveParticipants(participants);
  const inviteList = Array.isArray(dedupedInvitees)
    ? uniqueInvitees(dedupedInvitees)
    : uniqueInvitees(invitees);

  const activeCount = activeList.length;
  const combinedUnique = dedupeByIdentity([...activeList, ...inviteList]);
  const combinedCount = combinedUnique.length;
  const inviteCoverage = Math.max(combinedCount - activeCount, 0);
  const openSpots = Math.max(limit - activeCount, 0);

  if (openSpots <= 0) {
    return null;
  }

  if (inviteCoverage >= openSpots) {
    return null;
  }

  const shortfall = Math.max(openSpots - inviteCoverage, 0);
  if (shortfall <= 0) {
    return null;
  }

  const severity =
    hoursUntil <= URGENT_THRESHOLD_HOURS
      ? "urgent"
      : hoursUntil <= WARNING_THRESHOLD_HOURS
      ? "warning"
      : "soon";

  return {
    severity,
    openSpots,
    inviteCoverage,
    shortfall,
    participantCount: activeCount,
    inviteeCount: inviteList.length,
    combinedPotential: combinedCount,
    hoursUntil,
    matchTime: matchDate.toISOString(),
    playerLimit: limit,
    lookaheadHours,
  };
};

export default evaluateLowOccupancyAlert;
