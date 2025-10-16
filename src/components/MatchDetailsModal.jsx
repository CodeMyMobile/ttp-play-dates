import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Autocomplete from "react-google-autocomplete";
import {
  AlertCircle,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Send,
  Share2,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  cancelMatch,
  getShareLink,
  joinMatch,
  leaveMatch,
  removeParticipant,
  updateMatch,
} from "../services/matches";
import { getPhoneDigits, normalizePhoneValue } from "../services/phone";
import { isMatchArchivedError } from "../utils/archive";
import {
  countUniqueMatchOccupants,
  idsMatch,
  pruneParticipantFromMatchData,
  uniqueAcceptedInvitees,
  uniqueActiveParticipants,
  uniqueParticipants,
} from "../utils/participants";
import { collectMemberIds, memberIsMatchHost } from "../utils/memberIdentity";
import {
  DEFAULT_EVENT_DURATION_MINUTES,
  downloadICSFile,
  ensureEventEnd,
  openGoogleCalendar,
  openOutlookCalendar,
} from "../utils/calendar";
import {
  MATCH_FORMAT_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  ensureOptionPresent,
  isValidOptionValue,
} from "../utils/matchOptions";
import { buildMatchUpdatePayload } from "../utils/matchPayload";
import {
  getMatchPrivacy,
  isPrivateMatch as isMatchPrivate,
} from "../utils/matchPrivacy";
import { combineDateAndTimeToIso } from "../utils/datetime";

const buildAvatarLabel = (name = "") => {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const safeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const distanceLabel = (distance) => {
  const numeric = Number(distance);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric * 10) / 10;
  const display = Number.isInteger(rounded)
    ? rounded.toString()
    : rounded.toFixed(1);
  const plural = Math.abs(rounded - 1) < 0.05 ? "" : "s";
  return `${display} mile${plural} away`;
};

const skillLevelString = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "";
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed.toLowerCase() === "any level") return "";
    return trimmed;
  }
  return "";
};

const skillLevelNumeric = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const numeric = Number.parseFloat(value);
    return Number.isNaN(numeric) ? null : numeric;
  }
  return null;
};

const asNonEmptyString = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : null;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return null;
};

const sanitizeBaseUrl = (value) => {
  const str = asNonEmptyString(value);
  if (!str) return null;
  const normalized = /^https?:\/\//i.test(str)
    ? str
    : `https://${str.replace(/^\/+/, "")}`;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
};

const ENV_PROFILE_BASE_URL = (() => {
  const candidates = [
    import.meta.env.VITE_PLAYER_PROFILE_BASE_URL,
    import.meta.env.VITE_PLAYER_PORTAL_URL,
    import.meta.env.VITE_PLAYER_APP_URL,
    import.meta.env.VITE_APP_BASE_URL,
    import.meta.env.VITE_APP_URL,
  ];
  for (const candidate of candidates) {
    const sanitized = sanitizeBaseUrl(candidate);
    if (sanitized) return sanitized;
  }
  return null;
})();

const getProfileBaseUrl = () => {
  if (ENV_PROFILE_BASE_URL) return ENV_PROFILE_BASE_URL;
  if (typeof window !== "undefined") {
    const overrides = [
      window.__TTP_PLAYER_PROFILE_BASE_URL__,
      window.__PLAYER_PROFILE_BASE_URL__,
      window.__MATCH_PLAYER_PROFILE_BASE_URL__,
      window.location?.origin,
    ];
    for (const override of overrides) {
      const sanitized = sanitizeBaseUrl(override);
      if (sanitized) return sanitized;
    }
  }
  return null;
};

const buildProfileUrlFromString = (value) => {
  const str = asNonEmptyString(value);
  if (!str) return null;
  if (/^https?:\/\//i.test(str)) {
    return str;
  }
  if (/^www\./i.test(str)) {
    return `https://${str}`;
  }
  const baseUrl = getProfileBaseUrl();
  if (!baseUrl) return null;
  try {
    const url = new URL(str, `${baseUrl}/`);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
};

const buildProfileUrlFromPlayerId = (playerId) => {
  const idString = asNonEmptyString(playerId);
  if (!idString || !ENV_PROFILE_BASE_URL) return null;
  try {
    const url = new URL(
      encodeURIComponent(idString),
      `${ENV_PROFILE_BASE_URL}/`,
    );
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
};

const getProfileImageFromSource = (source) => {
  if (!source || typeof source !== "object") return null;
  const keys = [
    "profile_picture",
    "profilePicture",
    "profile_picture_url",
    "profilePictureUrl",
    "profile_photo",
    "profilePhoto",
    "profile_image",
    "profileImage",
    "profile_image_url",
    "profileImageUrl",
    "photo_url",
    "photoUrl",
    "image_url",
    "imageUrl",
    "avatar_url",
    "avatarUrl",
    "avatar",
    "host_avatar",
    "hostAvatar",
    "picture",
    "photo",
  ];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = asNonEmptyString(source[key]);
    if (value) return value;
  }
  return null;
};

const getProfileUrlFromSource = (source) => {
  if (!source || typeof source !== "object") return null;
  const keys = [
    "profile_url",
    "profileUrl",
    "profile_link",
    "profileLink",
    "profile_page",
    "profilePage",
    "profile_path",
    "profilePath",
    "profile_handle",
    "profileHandle",
    "permalink",
    "url",
    "link",
    "slug",
    "handle",
  ];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const candidate = source[key];
    const url = buildProfileUrlFromString(candidate);
    if (url) return url;
  }
  return null;
};

const getParticipantProfileImage = (participant) => {
  if (!participant || typeof participant !== "object") return null;
  return (
    getProfileImageFromSource(participant.profile) ||
    getProfileImageFromSource(participant.player) ||
    getProfileImageFromSource(participant) ||
    null
  );
};

const getParticipantProfileUrl = (participant, playerId) => {
  if (!participant || typeof participant !== "object") {
    return buildProfileUrlFromPlayerId(playerId);
  }

  const profileUrl =
    getProfileUrlFromSource(participant.profile) ||
    getProfileUrlFromSource(participant.player) ||
    getProfileUrlFromSource(participant);
  if (profileUrl) {
    return profileUrl;
  }

  return buildProfileUrlFromPlayerId(playerId);
};

const getSkillLevelDisplay = (match) => {
  if (!match) return "";

  const directLevels = [match.skill_level, match.skillLevel];
  for (const level of directLevels) {
    const display = skillLevelString(level);
    if (display) return display;
  }

  const minRaw = match.skill_level_min ?? match.skillLevelMin;
  const maxRaw = match.skill_level_max ?? match.skillLevelMax;
  const minDisplay = skillLevelString(minRaw);
  const maxDisplay = skillLevelString(maxRaw);
  const minNumeric = skillLevelNumeric(minRaw);
  const maxNumeric = skillLevelNumeric(maxRaw);

  if (minDisplay && maxDisplay && minNumeric !== null && maxNumeric !== null) {
    return `${minDisplay} - ${maxDisplay}`;
  }
  if (minDisplay && minNumeric !== null) {
    return `${minDisplay}+`;
  }
  if (maxDisplay && maxNumeric !== null) {
    return `Up to ${maxDisplay}`;
  }
  return minDisplay || maxDisplay || "";
};

const buildMatchDescription = ({ match, hostName }) => {
  if (!match) return "Tennis match";
  const parts = [];
  if (match.match_format || match.format) {
    parts.push(`${match.match_format || match.format}`);
  }
  if (match.location_text || match.location) {
    parts.push(`at ${match.location_text || match.location}`);
  }
  if (hostName) {
    parts.push(`hosted by ${hostName}`);
  }
  const skillLevelDisplay = getSkillLevelDisplay(match);
  if (skillLevelDisplay) {
    parts.push(`Skill level: ${skillLevelDisplay}`);
  }
  if (match.notes) {
    parts.push(match.notes);
  }
  return parts.join(". ");
};

const DEFAULT_EDIT_FORM = {
  date: "",
  time: "",
  location: "",
  latitude: null,
  longitude: null,
  matchFormat: "",
  level: "",
  notes: "",
};

const parseCoordinate = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const toDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toTimeInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
};

const combineDateTime = (date, time) => combineDateAndTimeToIso(date, time);

const isNonEmptyValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return true;
};

const firstNonEmptyValue = (values = []) => {
  for (const value of values) {
    if (isNonEmptyValue(value)) {
      return value;
    }
  }
  return null;
};

const getParticipantIdentityCandidates = (participant) => {
  if (!participant || typeof participant !== "object") return [];
  const profile = participant.profile || {};
  const player = participant.player || {};
  return [
    participant.match_participant_id,
    participant.matchParticipantId,
    participant.participant_id,
    participant.participantId,
    participant.player_id,
    participant.playerId,
    participant.invitee_id,
    participant.inviteeId,
    participant.id,
    profile.id,
    profile.player_id,
    profile.playerId,
    profile.user_id,
    profile.userId,
    player.id,
    player.player_id,
    player.playerId,
  ];
};

const getParticipantIdentity = (participant, fallback = null) =>
  firstNonEmptyValue(getParticipantIdentityCandidates(participant)) ?? fallback;

const getParticipantPlayerId = (participant) => {
  if (!participant || typeof participant !== "object") return null;
  const profile = participant.profile || {};
  const player = participant.player || {};
  return firstNonEmptyValue([
    participant.player_id,
    participant.playerId,
    player.id,
    player.player_id,
    player.playerId,
    profile.player_id,
    profile.playerId,
    profile.id,
  ]);
};

const participantMatchesMember = (participant, memberIdentity) => {
  if (!participant || typeof participant !== "object") return false;
  if (Array.isArray(memberIdentity)) {
    if (memberIdentity.length === 0) return false;
    return getParticipantIdentityCandidates(participant).some((candidate) =>
      memberIdentity.some((id) => idsMatch(candidate, id)),
    );
  }
  if (memberIdentity === null || memberIdentity === undefined) return false;
  return getParticipantIdentityCandidates(participant).some((candidate) =>
    idsMatch(candidate, memberIdentity),
  );
};

const PHONE_VALUE_KEYS = [
  "value",
  "number",
  "phone",
  "phone_number",
  "phoneNumber",
  "mobile",
  "mobile_phone",
  "mobilePhone",
  "cell",
  "cell_phone",
  "cellPhone",
  "primary_phone",
  "primaryPhone",
  "contact_phone",
  "contactPhone",
];
const PHONE_CONTAINER_KEYS = [
  "profile",
  "player",
  "user",
  "member",
  "memberProfile",
  "member_profile",
  "contact",
  "contacts",
  "metadata",
  "details",
  "info",
  "information",
  "organizer",
  "host",
  "owner",
  "emergency_contact",
  "emergencyContact",
  "primary_contact",
  "primaryContact",
];

const collectParticipantPhoneNumbers = (
  participants = [],
  hostIdentities = [],
) => {
  if (!Array.isArray(participants) || participants.length === 0) {
    return [];
  }

  const normalizedNumbers = new Set();
  const digitValues = new Set();
  const visitedObjects = new WeakSet();
  const hostIdentityList = Array.isArray(hostIdentities)
    ? hostIdentities.filter(Boolean)
    : hostIdentities !== null && hostIdentities !== undefined
    ? [hostIdentities]
    : [];

  const addPhone = (value) => {
    if (value === null || value === undefined) return;
    const digits = getPhoneDigits(value);
    if (!digits || digits.length < 7) return;
    if (digitValues.has(digits)) return;
    digitValues.add(digits);
    const normalized = normalizePhoneValue(value);
    if (normalized) {
      normalizedNumbers.add(normalized);
    } else {
      normalizedNumbers.add(`+${digits}`);
    }
  };

  const safeGet = (object, key) => {
    if (!object || typeof object !== "object") return undefined;
    try {
      if (!Object.prototype.hasOwnProperty.call(object, key)) {
        return undefined;
      }
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (!descriptor) return undefined;
      if (typeof descriptor.get === "function" || typeof descriptor.set === "function") {
        return undefined;
      }
      return descriptor.value;
    } catch (error) {
      return undefined;
    }
  };

  const addPhoneValue = (value) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string" || typeof value === "number") {
      addPhone(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => addPhoneValue(item));
      return;
    }
    if (typeof value === "object") {
      if (visitedObjects.has(value)) return;
      visitedObjects.add(value);

      PHONE_VALUE_KEYS.forEach((key) => {
        const candidate = safeGet(value, key);
        if (candidate !== undefined) {
          addPhoneValue(candidate);
        }
      });

      PHONE_CONTAINER_KEYS.forEach((key) => {
        const container = safeGet(value, key);
        if (container !== undefined) {
          addPhoneValue(container);
        }
      });
    }
  };

  const isHostParticipant = (participant) =>
    hostIdentityList.length > 0 &&
    participantMatchesMember(participant, hostIdentityList);

  participants.forEach((participant) => {
    if (!participant || typeof participant !== "object") return;
    if (isHostParticipant(participant)) return;
    addPhoneValue(participant);
  });

  return Array.from(normalizedNumbers);
};

const buildInitialEditForm = (match) => {
  if (!match) return { ...DEFAULT_EDIT_FORM };
  const latitude =
    parseCoordinate(match.latitude) ?? parseCoordinate(match.lat);
  const longitude =
    parseCoordinate(match.longitude) ?? parseCoordinate(match.lng);
  const privateMatch = isMatchPrivate(match);
  const openLevel =
    match.skill_level ||
    match.skillLevel ||
    match.skill_level_min ||
    match.skillLevelMin ||
    "";
  return {
    date: toDateInput(match.start_date_time || match.startDateTime),
    time: toTimeInput(match.start_date_time || match.startDateTime),
    location: match.location_text || match.location || match.locationText || "",
    latitude,
    longitude,
    matchFormat: match.match_format || match.format || "",
    level: privateMatch ? "" : openLevel,
    notes: match.notes || "",
  };
};

const MatchDetailsModal = ({
  isOpen,
  matchData,
  currentUser,
  onClose,
  onRequireSignIn,
  onMatchRefresh,
  onReloadMatch,
  onUpdateMatch,
  onToast,
  formatDateTime,
  onManageInvites,
  initialStatus,
  onViewPlayerProfile,
}) => {
  const normalizedInitialStatus = initialStatus || "details";
  const [status, setStatus] = useState(normalizedInitialStatus);
  const [joining, setJoining] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(DEFAULT_EDIT_FORM);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [cancellingMatch, setCancellingMatch] = useState(false);
  const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  const shareCopyTimeoutRef = useRef(null);

  useEffect(
    () => () => {
      if (shareCopyTimeoutRef.current) {
        clearTimeout(shareCopyTimeoutRef.current);
      }
    },
    [],
  );

  const match = matchData?.match || null;
  const matchPrivacy = useMemo(() => getMatchPrivacy(match), [match]);
  const suggestedSkillLevel = useMemo(() => getSkillLevelDisplay(match), [match]);
  const participants = useMemo(() => {
    if (Array.isArray(matchData?.participants)) {
      return uniqueParticipants(matchData.participants);
    }
    if (Array.isArray(match?.participants)) {
      return uniqueParticipants(match.participants);
    }
    return [];
  }, [matchData, match]);
  const invitees = useMemo(() => {
    if (Array.isArray(matchData?.invitees)) return matchData.invitees;
    if (Array.isArray(match?.invitees)) return match.invitees;
    return [];
  }, [matchData, match]);

  const originalEditForm = useMemo(() => buildInitialEditForm(match), [match]);
  const availableMatchFormats = useMemo(
    () => ensureOptionPresent(MATCH_FORMAT_OPTIONS, originalEditForm.matchFormat),
    [originalEditForm.matchFormat],
  );
  const availableSkillLevels = useMemo(
    () => ensureOptionPresent(SKILL_LEVEL_OPTIONS, originalEditForm.level),
    [originalEditForm.level],
  );

  useEffect(() => {
    setEditForm(originalEditForm);
  }, [originalEditForm]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setEditError("");
    }
  }, [isOpen]);

  const hasEditChanges = useMemo(
    () => JSON.stringify(editForm) !== JSON.stringify(originalEditForm),
    [editForm, originalEditForm],
  );

  const scheduleChanged =
    originalEditForm.date !== editForm.date ||
    originalEditForm.time !== editForm.time ||
    originalEditForm.location.trim() !== editForm.location.trim();

  const hostParticipant = useMemo(() => {
    if (!match?.host_id) return null;
    return (
      participants.find((participant) =>
        participantMatchesMember(participant, match.host_id),
      ) || null
    );
  }, [match?.host_id, participants]);

  const hostIdentityCandidates = useMemo(() => {
    const identities = [];
    if (match?.host_id) identities.push(match.host_id);
    if (hostParticipant) {
      identities.push(...getParticipantIdentityCandidates(hostParticipant));
    }
    return identities.filter(Boolean);
  }, [hostParticipant, match?.host_id]);

  const hostProfile = match?.host_profile || hostParticipant?.profile || null;
  const hostName =
    hostProfile?.full_name ||
    hostProfile?.fullName ||
    match?.host_name ||
    hostParticipant?.profile?.name ||
    "Match Organizer";

  const hostAvatar =
    getProfileImageFromSource(hostProfile) ||
    getParticipantProfileImage(hostParticipant) ||
    getProfileImageFromSource(match) ||
    null;

  const committedParticipants = useMemo(
    () => uniqueActiveParticipants(participants),
    [participants],
  );

  const participantSmsTargets = useMemo(() => {
    if (!isHost) return [];
    return collectParticipantPhoneNumbers(
      committedParticipants,
      hostIdentityCandidates,
    );
  }, [committedParticipants, hostIdentityCandidates, isHost]);

  const acceptedInvitees = useMemo(
    () => uniqueAcceptedInvitees(invitees),
    [invitees],
  );

  const capacityInfo = useMemo(() => {
    if (!match?.capacity || typeof match.capacity !== "object") return null;
    return match.capacity;
  }, [match?.capacity]);

  const numericPlayerLimit = useMemo(() => {
    const candidate =
      match?.player_limit ??
      match?.playerLimit ??
      match?.player_count ??
      match?.match_player_limit;
    const numeric = Number(candidate);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }, [match]);

  const fallbackCommitted = countUniqueMatchOccupants(participants, invitees);

  const committedCount = useMemo(() => {
    if (!capacityInfo) return fallbackCommitted;
    const confirmed = Number(capacityInfo.confirmed);
    if (Number.isFinite(confirmed) && confirmed >= 0) {
      return confirmed;
    }
    return fallbackCommitted;
  }, [capacityInfo, fallbackCommitted]);

  const capacityLimit = useMemo(() => {
    if (capacityInfo) {
      const limit = Number(capacityInfo.limit ?? capacityInfo.max ?? capacityInfo.capacity);
      if (Number.isFinite(limit) && limit > 0) {
        return limit;
      }
    }
    return numericPlayerLimit;
  }, [capacityInfo, numericPlayerLimit]);

  const remainingSpots = useMemo(() => {
    if (capacityInfo && capacityInfo.open !== undefined && capacityInfo.open !== null) {
      const open = Number(capacityInfo.open);
      if (Number.isFinite(open)) {
        return Math.max(open, 0);
      }
    }
    if (capacityLimit === null) return null;
    if (!Number.isFinite(capacityLimit)) return null;
    return Math.max(capacityLimit - committedCount, 0);
  }, [capacityInfo, capacityLimit, committedCount]);

  const memberIdentities = useMemo(
    () => collectMemberIds(currentUser),
    [currentUser],
  );

  const isHost =
    memberIdentities.length > 0
      ? memberIsMatchHost(currentUser, match, memberIdentities)
      : false;
  const isParticipant = committedParticipants.some((participant) =>
    participantMatchesMember(participant, memberIdentities),
  );
  const hasAcceptedInvite = acceptedInvitees.some((invite) =>
    participantMatchesMember(invite, memberIdentities),
  );

  const metadataIndicatesJoined = useMemo(() => {
    if (memberIdentities.length === 0) return false;
    const identityMatchesCurrentUser = (value) =>
      memberIdentities.some((id) => idsMatch(value, id));

    const sources = [matchData, matchData?.match, match];
    const truthyStatuses = new Set([
      "joined",
      "accepted",
      "confirmed",
      "on_roster",
      "on-roster",
    ]);

    for (const source of sources) {
      if (!source || typeof source !== "object") continue;

      const idCandidates = [
        source.joined_player_id,
        source.joinedPlayerId,
        source.joined_by_player_id,
        source.joinedByPlayerId,
        source.joined_member_id,
        source.joinedMemberId,
        source.joined_user_id,
        source.joinedUserId,
        source.joined_participant_id,
        source.joinedParticipantId,
        source.participant_id,
        source.participantId,
      ];
      if (idCandidates.some(identityMatchesCurrentUser)) {
        return true;
      }

      const booleanCandidates = [
        source.is_joined,
        source.isJoined,
        source.joined,
        source.has_joined,
        source.hasJoined,
      ];
      if (booleanCandidates.some((value) => value === true)) {
        return true;
      }

      const statusCandidates = [
        source.joined_status,
        source.joinedStatus,
        source.join_status,
        source.joinStatus,
        source.player_status,
        source.playerStatus,
      ];
      if (
        statusCandidates.some((value) => {
          if (value === undefined || value === null) return false;
          const normalized = value.toString().trim().toLowerCase();
          return normalized && truthyStatuses.has(normalized);
        })
      ) {
        return true;
      }
    }

    return false;
  }, [match, matchData, memberIdentities]);

  const isJoined = useMemo(
    () => isHost || isParticipant || hasAcceptedInvite || metadataIndicatesJoined,
    [hasAcceptedInvite, isHost, isParticipant, metadataIndicatesJoined],
  );

  const isArchived = match?.status === "archived";
  const isCancelled = match?.status === "cancelled";

  const canMessageParticipants =
    isHost &&
    !isArchived &&
    !isCancelled &&
    participantSmsTargets.length > 0;
  const isUpcoming = match?.status === "upcoming";
  const isPrivate = matchPrivacy === "private";
  const isOpenMatch = !isPrivate;
  const isFull = useMemo(() => {
    if (capacityInfo && typeof capacityInfo.isFull === "boolean") {
      return capacityInfo.isFull;
    }
    if (remainingSpots === null) return false;
    return remainingSpots === 0;
  }, [capacityInfo, remainingSpots]);
  const matchId = match?.id ?? null;
  const canManageInvites = Boolean(onManageInvites) && isHost && matchId;

  const handleManageInvites = useCallback(() => {
    if (!canManageInvites || !matchId) return;
    onManageInvites(matchId);
  }, [canManageInvites, matchId, onManageInvites]);

  useEffect(() => {
    if ((!isHost || isArchived || isCancelled) && isEditing) {
      setIsEditing(false);
    }
  }, [isHost, isArchived, isCancelled, isEditing]);

  const requestShareLink = useCallback(
    async ({ silent = false, signal } = {}) => {
      if (!match?.id || !isOpenMatch) return;
      setShareLoading(true);
      setShareError("");
      setShareCopied(false);
      try {
        const { shareUrl } = await getShareLink(match.id);
        if (signal?.aborted) return;
        setShareLink(shareUrl || "");
      } catch (error) {
        if (signal?.aborted) return;
        console.error(error);
        setShareLink("");
        const message =
          error?.response?.data?.message ||
          "We couldn't generate a share link. Try again.";
        setShareError(message);
        if (!silent) {
          onToast?.(message, "error");
        }
      } finally {
        if (!signal?.aborted) {
          setShareLoading(false);
        }
      }
    },
    [isOpenMatch, match?.id, onToast],
  );

  useEffect(() => {
    if (!isOpen || !isOpenMatch || !match?.id) {
      setShareLink("");
      setShareError("");
      setShareLoading(false);
      setShareCopied(false);
      return undefined;
    }

    const controller = new AbortController();
    requestShareLink({ silent: true, signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [isOpen, isOpenMatch, match?.id, requestShareLink]);

  useEffect(() => {
    if (!isOpen) {
      setStatus(normalizedInitialStatus);
      setJoining(false);
      setLeaving(false);
      return;
    }
    if (initialStatus && status === initialStatus) return;
    if (isJoined) {
      if (isOpenMatch && !isHost) {
        setStatus("success");
      } else {
        setStatus("alreadyJoined");
      }
    } else if (isFull) {
      setStatus("full");
    } else {
      setStatus("details");
    }
  }, [
    initialStatus,
    isFull,
    isHost,
    isJoined,
    isOpen,
    isOpenMatch,
    normalizedInitialStatus,
    status,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const startDate = safeDate(match?.start_date_time || match?.startDateTime);

  const fallbackDurationMinutes = useMemo(() => {
    const candidates = [
      match?.duration_minutes,
      match?.durationMinutes,
      match?.duration,
    ];
    if (match?.duration_hours !== undefined && match?.duration_hours !== null) {
      const hours = Number(match.duration_hours);
      if (Number.isFinite(hours)) {
        candidates.push(hours * 60);
      }
    }
    for (const candidate of candidates) {
      const numeric = Number(candidate);
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric;
      }
    }
    return DEFAULT_EVENT_DURATION_MINUTES;
  }, [match?.duration, match?.durationMinutes, match?.duration_hours, match?.duration_minutes]);

  const endDate = ensureEventEnd(
    startDate,
    safeDate(match?.end_date_time || match?.endDateTime),
    fallbackDurationMinutes,
  );

  const eventDetails = startDate
    ? {
        title: match.title || match.name || `Tennis Match - ${match.match_format || match.format || "Play"}`,
        description: buildMatchDescription({ match, hostName }),
        location: match.location_text || match.location || match.locationText || "",
        start: startDate,
        end: endDate || startDate,
      }
    : null;

  const shareDateTimeLabel = useMemo(() => {
    if (!startDate) return null;
    return formatDateTime
      ? formatDateTime(startDate)
      : startDate.toLocaleString();
  }, [formatDateTime, startDate]);

  const shareMatchLabel = useMemo(
    () => match?.match_format || match?.format || "Tennis match",
    [match?.format, match?.match_format],
  );

  const shareMessage = useMemo(() => {
    if (!isOpenMatch) return "";
    const parts = [`Join me for a ${shareMatchLabel}!`];
    if (shareDateTimeLabel) parts.push(`When: ${shareDateTimeLabel}`);
    if (match?.location_text || match?.location) {
      parts.push(`Where: ${match.location_text || match.location}`);
    }
    if (hostName) parts.push(`Host: ${hostName}`);
    if (Number.isFinite(remainingSpots) && remainingSpots > 0) {
      parts.push(`Spots remaining: ${remainingSpots}`);
    }
    if (shareLink) parts.push(`Join here: ${shareLink}`);
    return parts.join("\n");
  }, [
    hostName,
    isOpenMatch,
    match?.location,
    match?.location_text,
    remainingSpots,
    shareDateTimeLabel,
    shareLink,
    shareMatchLabel,
  ]);

  const participantSmsMessage = useMemo(() => {
    if (!isHost) return "";
    const segments = [];
    if (hostName) {
      segments.push(`Hi team — ${hostName} here.`);
    } else {
      segments.push("Hi team!");
    }
    if (match?.title || match?.name) {
      segments.push(`Match: ${match.title || match.name}`);
    }
    if (shareDateTimeLabel) {
      segments.push(`When: ${shareDateTimeLabel}`);
    }
    if (match?.location_text || match?.location) {
      segments.push(`Where: ${match.location_text || match.location}`);
    }
    return segments.join(" ").trim();
  }, [
    hostName,
    isHost,
    match?.location,
    match?.location_text,
    match?.name,
    match?.title,
    shareDateTimeLabel,
  ]);

  const shareEmailSubject = useMemo(() => {
    const base = shareMatchLabel || "Tennis Match";
    if (!shareDateTimeLabel) return `${base} Invite`;
    return `${base} – ${shareDateTimeLabel}`;
  }, [shareDateTimeLabel, shareMatchLabel]);

  const shareLinkReady = !!shareLink && !shareLoading;

  const handleEditFieldChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditLocationChange = useCallback((value) => {
    setEditForm((prev) => ({
      ...prev,
      location: value,
      latitude: null,
      longitude: null,
    }));
  }, []);

  const handleEditLocationSelect = useCallback((place) => {
    if (!place) return;
    setEditForm((prev) => {
      const placeName = typeof place?.name === "string" ? place.name.trim() : "";
      const formattedAddress =
        typeof place?.formatted_address === "string"
          ? place.formatted_address.trim()
          : "";
      const locationLabel = placeName || formattedAddress || prev.location || "";
      const lat = place?.geometry?.location?.lat?.();
      const lng = place?.geometry?.location?.lng?.();
      return {
        ...prev,
        location: locationLabel || prev.location,
        latitude: typeof lat === "number" ? lat : prev.latitude,
        longitude: typeof lng === "number" ? lng : prev.longitude,
      };
    });
  }, []);

  const handleStartEdit = () => {
    if (!isHost || isArchived || isCancelled) return;
    setEditError("");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditForm(originalEditForm);
    setEditError("");
    setIsEditing(false);
  };

  const handleCancelMatch = async () => {
    if (!match?.id || !isHost || isArchived || isCancelled) {
      return;
    }
    const confirmed = window.confirm(
      "Cancel this match? We'll notify your players and remove it from match listings.",
    );
    if (!confirmed) return;
    try {
      setCancellingMatch(true);
      await cancelMatch(match.id);
      onToast?.("Match cancelled");
      setIsEditing(false);
      setEditError("");
      await onMatchRefresh?.();
      if (onReloadMatch && onUpdateMatch) {
        const updated = await onReloadMatch(match.id, { includeArchived: true });
        if (updated) {
          onUpdateMatch(updated);
        }
      } else if (onUpdateMatch) {
        onUpdateMatch((prev) => {
          if (!prev) return prev;
          const nextMatch = {
            ...(prev.match || {}),
            status: "cancelled",
          };
          return { ...prev, match: nextMatch };
        });
      }
    } catch (error) {
      if (isMatchArchivedError(error)) {
        onToast?.("This match has been archived and can't be cancelled.", "error");
      } else {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "We couldn't cancel the match.";
        onToast?.(message, "error");
      }
    } finally {
      setCancellingMatch(false);
    }
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!match?.id) return;
    setEditError("");
    const trimmedLocation = editForm.location.trim();
    if (!editForm.date || !editForm.time || !trimmedLocation) {
      setEditError("Date, time, and location are required.");
      return;
    }
    const isoDate = combineDateTime(editForm.date, editForm.time);
    if (!isoDate) {
      setEditError("Please provide a valid date and time.");
      return;
    }
    if (scheduleChanged) {
      const confirmed = window.confirm(
        "Changing the schedule will notify players. Continue?",
      );
      if (!confirmed) return;
    }

    const matchFormat = editForm.matchFormat?.trim?.() ?? "";
    if (matchFormat && !isValidOptionValue(availableMatchFormats, matchFormat)) {
      setEditError("Select a valid match format.");
      return;
    }

    const level = editForm.level?.trim?.() ?? "";
    if (isOpenMatch && level && !isValidOptionValue(availableSkillLevels, level)) {
      setEditError("Select a valid level.");
      return;
    }

    const notes = editForm.notes.trim();
    const latitude = parseCoordinate(editForm.latitude);
    const longitude = parseCoordinate(editForm.longitude);

    const skillLevel = isOpenMatch ? level : "";

    const payload = buildMatchUpdatePayload({
      startDateTime: isoDate,
      locationText: trimmedLocation,
      matchFormat,
      previousMatchFormat: originalEditForm.matchFormat,
      notes,
      isOpenMatch,
      skillLevel,
      previousSkillLevel: isOpenMatch ? originalEditForm.level : "",
      latitude,
      longitude,
      previousLatitude: originalEditForm.latitude,
      previousLongitude: originalEditForm.longitude,
    });

    try {
      setEditSaving(true);
      await updateMatch(match.id, payload);
      onToast?.("Match updated");
      setIsEditing(false);
      await onMatchRefresh?.();
      if (onReloadMatch && onUpdateMatch) {
        const updated = await onReloadMatch(match.id, { includeArchived: false });
        if (updated) {
          onUpdateMatch(updated);
        }
      } else if (onUpdateMatch) {
        onUpdateMatch((prev) => {
          if (!prev) return prev;
          const nextMatch = {
            ...(prev.match || {}),
            start_date_time: isoDate,
            startDateTime: isoDate,
            location_text: trimmedLocation,
            locationText: trimmedLocation,
            location: trimmedLocation,
            match_format: matchFormat || null,
            format: matchFormat || null,
          };
          if (latitude !== null) {
            nextMatch.latitude = latitude;
          }
          if (longitude !== null) {
            nextMatch.longitude = longitude;
          }
          if (isOpenMatch) {
            nextMatch.skill_level = skillLevel || null;
            nextMatch.skill_level_min = skillLevel || null;
            nextMatch.skillLevel = skillLevel || null;
            nextMatch.notes = notes || null;
          }
          return { ...prev, match: nextMatch };
        });
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "We couldn't update the match.";
      setEditError(message);
      onToast?.(message, "error");
    } finally {
      setEditSaving(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareLinkReady) return;
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
      onToast?.("Share link copied!");
      if (shareCopyTimeoutRef.current) {
        clearTimeout(shareCopyTimeoutRef.current);
      }
      shareCopyTimeoutRef.current = setTimeout(() => {
        setShareCopied(false);
        shareCopyTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error(error);
      setShareCopied(false);
      onToast?.("We couldn't copy the link", "error");
    }
  };

  const handleShareSms = () => {
    if (!shareLinkReady) return;
    const body = encodeURIComponent(shareMessage);
    const url = `sms:?&body=${body}`;
    onToast?.("Opening messages...");
    window.location.href = url;
  };

  const handleShareWhatsApp = () => {
    if (!shareLinkReady) return;
    const text = encodeURIComponent(shareMessage);
    const url = `https://wa.me/?text=${text}`;
    onToast?.("Opening WhatsApp...");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareEmail = () => {
    if (!shareLinkReady) return;
    const subject = encodeURIComponent(shareEmailSubject);
    const body = encodeURIComponent(shareMessage);
    const url = `mailto:?subject=${subject}&body=${body}`;
    onToast?.("Opening email...");
    window.location.href = url;
  };

  const handleMessageParticipants = useCallback(() => {
    if (!canMessageParticipants) return;
    const recipients = participantSmsTargets.join(",");
    if (!recipients) return;
    const smsUrl = participantSmsMessage
      ? `sms:${recipients}?&body=${encodeURIComponent(participantSmsMessage)}`
      : `sms:${recipients}`;
    try {
      onToast?.("Opening messages...");
      window.location.href = smsUrl;
    } catch (error) {
      console.error(error);
      onToast?.("We couldn't open your messages app", "error");
    }
  }, [
    canMessageParticipants,
    onToast,
    participantSmsMessage,
    participantSmsTargets,
  ]);

  const handleRefreshShareLink = () => {
    if (shareLoading || !isOpenMatch || !match?.id) return;
    requestShareLink({ silent: false });
  };

  const handlePlayerProfileClick = useCallback(
    (player) => {
      if (!player) return;
      if (typeof onViewPlayerProfile === "function") {
        onViewPlayerProfile(player);
        return;
      }
      if (!player.profileUrl) return;
      try {
        window.open(player.profileUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error(error);
      }
    },
    [onViewPlayerProfile],
  );

  const matchDistanceLabel = useMemo(
    () =>
      distanceLabel(
        match?.distance_miles ?? match?.distanceMiles ?? match?.distance,
      ),
    [match?.distance, match?.distanceMiles, match?.distance_miles],
  );

  const playersList = useMemo(() => {
    const list = committedParticipants.map((participant, index) => {
      const profile = participant.profile || {};
      const playerId = getParticipantPlayerId(participant);
      const id = getParticipantIdentity(participant, `participant-${index}`);
      const avatar = getParticipantProfileImage(participant);
      const profileUrl = getParticipantProfileUrl(participant, playerId);
      return {
        id,
        playerId,
        name:
          profile.full_name ||
          profile.fullName ||
          profile.preferred_name ||
          profile.preferredName ||
          participant.full_name ||
          participant.fullName ||
          profile.name ||
          participant.name ||
          (playerId ? `Player ${playerId}` : `Player ${index + 1}`),
        avatar,
        isHost: match?.host_id ? idsMatch(playerId, match.host_id) : false,
        rating:
          profile.usta_rating ||
          profile.rating ||
          profile.skill_rating ||
          profile.ntrp_rating ||
          participant.rating ||
          null,
        profileUrl,
        participant,
      };
    });

    if (remainingSpots && remainingSpots > 0) {
      for (let i = 0; i < remainingSpots; i += 1) {
        list.push({ id: `placeholder-${i}`, placeholder: true });
      }
    }
    return list;
  }, [committedParticipants, match?.host_id, remainingSpots]);

  if (!isOpen || !match) return null;

  const handleCalendarAction = (type) => {
    if (!eventDetails) {
      onToast?.("Match start time not available yet", "error");
      return;
    }
    try {
      if (type === "google") {
        openGoogleCalendar(eventDetails);
      } else if (type === "outlook") {
        openOutlookCalendar(eventDetails);
      } else {
        downloadICSFile(eventDetails);
      }
    } catch (error) {
      console.error(error);
      onToast?.("Unable to open calendar. Please try again.", "error");
    }
  };

  const handleSmsReminder = () => {
    if (!eventDetails) {
      onToast?.("Match start time not available yet", "error");
      return;
    }
    const messageParts = [
      "Reminder: Tennis match",
      formatDateTime ? formatDateTime(eventDetails.start) : eventDetails.start.toLocaleString(),
    ];
    if (eventDetails.location) {
      messageParts.push(`Location: ${eventDetails.location}`);
    }
    const message = messageParts.join(" \u2022 ");
    const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
    window.location.href = smsUrl;
  };

  const joinDisabledReason = () => {
    if (!isOpenMatch) return "Private matches require an invite.";
    if (isArchived) return "This match has been archived.";
    if (isCancelled) return "This match has been cancelled.";
    if (!isUpcoming) return "This match is no longer accepting players.";
    if (isFull) return "This match is currently full.";
    return null;
  };

  const handleJoin = async () => {
    if (!match?.id) return;
    if (!currentUser) {
      onRequireSignIn?.();
      return;
    }
    const reason = joinDisabledReason();
    if (reason) {
      onToast?.(reason, "error");
      return;
    }
    try {
      setJoining(true);
      await joinMatch(match.id);
      setStatus("success");
      await onMatchRefresh?.();
      if (onReloadMatch && onUpdateMatch) {
        const updated = await onReloadMatch(match.id, { includeArchived: false });
        if (updated) {
          onUpdateMatch(updated);
        }
      }
    } catch (error) {
      const errorCodeRaw =
        error?.response?.data?.error ||
        error?.data?.error ||
        error?.message ||
        "";
      const errorCode = errorCodeRaw.toString().trim().toLowerCase();
      const responseMessage = error?.response?.data?.message || "";
      const normalizedMessage = responseMessage.toString().trim().toLowerCase();

      if (isMatchArchivedError(error)) {
        onToast?.("This match has been archived. You can't join.", "error");
      } else if (
        errorCode === "match_full" ||
        errorCode === "full" ||
        normalizedMessage.includes("full")
      ) {
        setStatus("full");
        onToast?.(
          "This match is already full. We'll let you know if a spot opens up.",
          "error",
        );
      } else if (
        errorCode === "already_joined" ||
        normalizedMessage.includes("already joined")
      ) {
        setStatus("alreadyJoined");
        onToast?.("You're already on the roster for this match.", "info");
      } else {
        const message =
          responseMessage || error?.message || "Failed to join match";
        onToast?.(message, "error");
      }
    } finally {
      setJoining(false);
    }
  };

  const handleRemoveParticipant = async (playerId, playerName) => {
    if (!match?.id || !isHost) return;
    const displayName = playerName || "this player";
    if (!window.confirm(`Remove ${displayName} from the match?`)) return;
    try {
      setRemovingParticipantId(playerId);
      await removeParticipant(match.id, playerId);
      onToast?.("Participant removed");
      await onMatchRefresh?.();
      if (onReloadMatch && onUpdateMatch) {
        const updated = await onReloadMatch(match.id, { includeArchived: false });
        if (updated) {
          onUpdateMatch(updated);
        }
      }
    } catch (error) {
      if (isMatchArchivedError(error)) {
        onToast?.(
          "This match has been archived. Participants can no longer be managed.",
          "error",
        );
      } else {
        onToast?.("Failed to remove participant", "error");
      }
    } finally {
      setRemovingParticipantId(null);
    }
  };

  const handleLeaveMatch = async () => {
    if (!match?.id) return;
    if (!currentUser) {
      onRequireSignIn?.();
      return;
    }
    if (!window.confirm("Need to back out? We'll let the organizer know you're leaving.")) {
      return;
    }
    try {
      setLeaving(true);
      await leaveMatch(match.id);
      onToast?.("You're off the roster. We'll notify the organizer.");
      onUpdateMatch?.((prev) =>
        pruneParticipantFromMatchData(prev, currentUser.id),
      );
      setStatus("details");
      await onMatchRefresh?.();
      if (onReloadMatch && onUpdateMatch) {
        const updated = await onReloadMatch(match.id, { includeArchived: false });
        if (updated) {
          onUpdateMatch(updated);
        }
      }
    } catch (error) {
      if (isMatchArchivedError(error)) {
        onToast?.("This match has been archived. There's nothing to leave.", "error");
      } else {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "Failed to leave match";
        onToast?.(message, "error");
      }
    } finally {
      setLeaving(false);
    }
  };

  const renderPlayers = () => (
    <div className="space-y-3">
      {playersList.map((player) => {
        if (player.placeholder) {
          return (
            <div
              key={player.id}
              className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-200 px-4 py-3 text-sm font-semibold text-gray-400"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-gray-300">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p>Waiting for player...</p>
              </div>
            </div>
          );
        }
        const canViewProfile =
          typeof onViewPlayerProfile === "function" || Boolean(player.profileUrl);
        return (
          <div
            key={player.id}
            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
          >
            <button
              type="button"
              onClick={() => handlePlayerProfileClick(player)}
              disabled={!canViewProfile}
              className={`flex flex-1 items-center gap-3 rounded-2xl bg-transparent p-0 text-left focus:outline-none transition-colors ${
                canViewProfile
                  ? "cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 hover:bg-white/70"
                  : "cursor-default"
              }`}
              title={
                canViewProfile ? `View ${player.name}'s profile` : undefined
              }
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 text-sm font-bold text-indigo-700">
                {player.avatar ? (
                  <img
                    src={player.avatar}
                    alt={player.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  buildAvatarLabel(player.name)
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-gray-900">
                  {player.name}
                  {player.isHost && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      Host
                    </span>
                  )}
                </p>
                {player.rating && (
                  <p className="text-xs font-semibold text-gray-500">
                    Rating {player.rating}
                  </p>
                )}
              </div>
            </button>
            {isHost &&
              !player.placeholder &&
              !player.isHost &&
              !isArchived &&
              !isCancelled && (
                <button
                  type="button"
                  onClick={() => handleRemoveParticipant(player.playerId, player.name)}
                  disabled={removingParticipantId === player.playerId}
                  className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-400 transition-colors hover:text-red-500 disabled:opacity-60"
                  aria-label={`Remove ${player.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
          </div>
        );
      })}
    </div>
  );

  const headerChips = (
    <div className="flex flex-wrap items-center gap-2">
      {startDate && (
        <span className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5 text-xs font-black text-purple-700">
          <Calendar className="h-3.5 w-3.5" />
          {formatDateTime ? formatDateTime(startDate) : startDate.toLocaleString()}
        </span>
      )}
      {matchDistanceLabel && (
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-600">
          <MapPin className="h-3.5 w-3.5" />
          {matchDistanceLabel}
        </span>
      )}
      {matchPrivacy === "private" ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-600">
          Private Match
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-600">
          Open Match
        </span>
      )}
      {isOpenMatch && suggestedSkillLevel && (
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">
          Suggested level: {suggestedSkillLevel}
        </span>
      )}
      {Number.isFinite(capacityLimit) && (
        <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-600">
          {committedCount}/{capacityLimit} players
        </span>
      )}
    </div>
  );

  const renderEditControls = () => {
    if (!isHost || isArchived || isCancelled) return null;
    return (
      <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black text-gray-900">Manage match details</p>
            <p className="text-xs font-semibold text-gray-500">
              Update the schedule and match information for your players.
            </p>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={handleStartEdit}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 transition hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" />
              Edit match
            </button>
          )}
        </div>
        {isEditing && (
          <form className="space-y-4" onSubmit={handleEditSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Date
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(event) => handleEditFieldChange("date", event.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Time
                <input
                  type="time"
                  value={editForm.time}
                  onChange={(event) => handleEditFieldChange("time", event.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  required
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Location
              <div className="rounded-xl">
                {googleApiKey ? (
                  <Autocomplete
                    apiKey={googleApiKey}
                    value={editForm.location}
                    onChange={(event) => handleEditLocationChange(event.target.value)}
                    onPlaceSelected={handleEditLocationSelect}
                    options={{
                      types: ["establishment"],
                      fields: ["formatted_address", "geometry", "name"],
                    }}
                    placeholder="Where are you playing?"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                ) : (
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(event) => handleEditLocationChange(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    placeholder="Where are you playing?"
                    required
                  />
                )}
              </div>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Match format
              <select
                value={editForm.matchFormat}
                onChange={(event) => handleEditFieldChange("matchFormat", event.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              >
                <option value="">Select format</option>
                {availableMatchFormats.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {isOpenMatch && (
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Level
                <select
                  value={editForm.level}
                  onChange={(event) => handleEditFieldChange("level", event.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Select level</option>
                  {availableSkillLevels.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.desc ? `${option.label} – ${option.desc}` : option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {isOpenMatch && (
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Notes for players
                <textarea
                  rows={3}
                  value={editForm.notes}
                  onChange={(event) => handleEditFieldChange("notes", event.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="Share extra details about parking, format, etc."
                />
              </label>
            )}
            {editError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleCancelMatch}
                disabled={editSaving || cancellingMatch}
                className="inline-flex items-center gap-2 self-start rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Ban className="h-4 w-4" />
                {cancellingMatch ? "Cancelling..." : "Cancel match"}
              </button>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={editSaving || cancellingMatch}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving || cancellingMatch || !hasEditChanges}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </form>
        )}
      </section>
    );
  };

  const renderDefaultView = () => {
    const disabledReason = joinDisabledReason();
    return (
      <div className="flex flex-col">
        <div className="flex flex-col gap-4 border-b border-gray-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-green-200 text-lg font-black text-emerald-700">
                {hostAvatar ? (
                  <img
                    src={hostAvatar}
                    alt={hostName}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  buildAvatarLabel(hostName)
                )}
              </div>
            </div>
            <div>
              <h2 id="match-details-heading" className="text-xl font-black text-gray-900">
                Match Details
              </h2>
              <p className="text-sm font-semibold text-gray-500">Hosted by {hostName}</p>
            </div>
          </div>
          {headerChips}
        </div>

        <div className="space-y-6 py-5">
          {renderEditControls()}
          <section className="rounded-2xl bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <MapPin className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-gray-900">Location</p>
                {match.location_text || match.location ? (
                  <p className="text-sm font-semibold text-gray-700">
                    {match.map_url || match.mapUrl ? (
                      <a
                        href={match.map_url || match.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 underline-offset-2 hover:underline"
                      >
                        {match.location_text || match.location}
                      </a>
                    ) : (
                      match.location_text || match.location
                    )}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-gray-500">Location coming soon</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                <Trophy className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-gray-900">Match Type</p>
                <p className="text-sm font-semibold text-gray-700">
                  {match.match_format || match.format || "Details coming soon"}
                </p>
                {suggestedSkillLevel && (
                  <p className="text-xs font-semibold text-gray-500">
                    {isOpenMatch ? "Suggested level" : "Skill level"}: {suggestedSkillLevel}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-black text-gray-900">
                Players
                {Number.isFinite(capacityLimit) && ` (${capacityLimit} max)`}
              </p>
            </div>
            {renderPlayers()}
            {canMessageParticipants && (
              <button
                type="button"
                onClick={handleMessageParticipants}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                title="Send a group text to everyone who's joined"
              >
                <MessageCircle className="h-4 w-4" />
                Message players
              </button>
            )}
          </section>

          {!isArchived && !isCancelled && (
            isOpenMatch ? (
              <section className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
                <div className="flex items-center gap-2 text-sm font-black text-emerald-900">
                  <Share2 className="h-4 w-4" />
                  Invite other players
                </div>
                <p className="text-xs font-semibold text-emerald-700">
                  Share this match link with tennis friends so they can grab a spot before it fills up.
                </p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-semibold text-gray-600">
                    <span className="flex-1 truncate font-mono text-gray-700">
                      {shareLoading
                        ? "Generating share link..."
                        : shareLinkReady
                        ? shareLink
                        : "Share link unavailable"}
                    </span>
                    <button
                      type="button"
                      onClick={shareLinkReady ? handleCopyShareLink : handleRefreshShareLink}
                      disabled={shareLoading || (!shareLinkReady && !shareError)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-white shadow-sm transition-all hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {shareCopied ? "Copied!" : shareLinkReady ? "Copy" : "Retry"}
                    </button>
                  </div>
                  {!shareLoading && shareError && (
                    <div className="flex items-start justify-between gap-2 text-xs font-semibold text-rose-600">
                      <span className="flex-1">{shareError}</span>
                      <button
                        type="button"
                        onClick={handleRefreshShareLink}
                        className="text-rose-600 underline-offset-2 hover:underline"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleShareSms}
                    disabled={!shareLinkReady}
                    className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Text link
                  </button>
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    disabled={!shareLinkReady}
                    className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={handleShareEmail}
                    disabled={!shareLinkReady}
                    className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Mail className="h-4 w-4" />
                    Email invite
                  </button>
                </div>
              </section>
            ) : (
              isHost && (
                <section className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-blue-900">
                    <UserPlus className="h-4 w-4" />
                    Invite players directly
                  </div>
                  <p className="text-xs font-semibold text-blue-700">
                    Send invites to specific players just like when you created the match.
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={handleManageInvites}
                      disabled={!canManageInvites}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <UserPlus className="h-4 w-4" />
                      Manage invites
                    </button>
                    {!canManageInvites && (
                      <p className="mt-2 text-xs font-semibold text-blue-600">
                        Invites are unavailable right now.
                      </p>
                    )}
                  </div>
                </section>
              )
            )
          )}

          {match.notes && (
            <section className="rounded-2xl border border-gray-100 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-900">Notes from Organizer</p>
                  <p className="mt-1 text-sm font-semibold text-gray-600">{match.notes}</p>
                </div>
              </div>
            </section>
          )}

          {matchPrivacy === "private" && (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
              Private matches can be joined with an invite. Reach out to the organizer if you need access.
            </div>
          )}

          {isArchived && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              This match has been archived. Actions are disabled.
            </div>
          )}

          {isCancelled && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-600">
              This match has been cancelled by the organizer.
            </div>
          )}

          {status === "full" && !isJoined && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              This match is currently full. We'll let you know if a spot opens up.
            </div>
          )}

          {status === "alreadyJoined" && !isHost && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              <Check className="mt-0.5 h-4 w-4" />
              {isOpenMatch
                ? "You're already on the roster. Need to back out? You can leave the match below."
                : "You're already on the roster. Reach out to the organizer if you need changes."}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-5">
          {isJoined && !isHost && isOpenMatch ? (
            <button
              type="button"
              onClick={handleLeaveMatch}
              disabled={leaving || isArchived || isCancelled}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {leaving ? "Leaving match..." : "Leave this match"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining || !!disabledReason || status !== "details"}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 text-sm font-black text-white shadow-lg transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                {joining ? "Joining match..." : "Join this match"}
              </button>
              {status === "details" && disabledReason && (
                <p className="mt-2 text-center text-xs font-semibold text-gray-500">{disabledReason}</p>
              )}
              {remainingSpots !== null && (
                <p className="mt-2 text-center text-xs font-semibold text-gray-500">
                  {remainingSpots} spot{remainingSpots === 1 ? "" : "s"} remaining
                </p>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderSuccessView = () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-green-200 text-lg font-black text-emerald-700">
              {hostAvatar ? (
                <img src={hostAvatar} alt={hostName} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                buildAvatarLabel(hostName)
              )}
            </div>
          </div>
          <div>
            <h2 id="match-details-heading" className="text-xl font-black text-gray-900">
              Match Details
            </h2>
            <p className="text-sm font-semibold text-gray-500">Hosted by {hostName}</p>
          </div>
        </div>
        {headerChips}
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="text-sm font-semibold text-emerald-800">
            <p className="font-black text-emerald-900">You're in!</p>
            <p>We'll email a confirmation and notify the organizer.</p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl bg-gray-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
            <MapPin className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-gray-900">Location</p>
            {match.location_text || match.location ? (
              <p className="text-sm font-semibold text-gray-700">
                {match.map_url || match.mapUrl ? (
                  <a
                    href={match.map_url || match.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 underline-offset-2 hover:underline"
                  >
                    {match.location_text || match.location}
                  </a>
                ) : (
                  match.location_text || match.location
                )}
              </p>
            ) : (
              <p className="text-sm font-semibold text-gray-500">Location coming soon</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-gray-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <Trophy className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-gray-900">Match Type</p>
            <p className="text-sm font-semibold text-gray-700">
              {match.match_format || match.format || "Details coming soon"}
            </p>
            {suggestedSkillLevel && (
              <p className="text-xs font-semibold text-gray-500">
                {isOpenMatch ? "Suggested level" : "Skill level"}: {suggestedSkillLevel}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-500" />
          <p className="text-sm font-black text-gray-900">
            Players
            {Number.isFinite(capacityLimit) && ` (${capacityLimit} max)`}
          </p>
        </div>
        {renderPlayers()}
      </section>

      {isOpenMatch && !isHost && (
        <section className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
          <div className="flex items-center gap-2 text-sm font-black text-emerald-900">
            <Share2 className="h-4 w-4" />
            Invite other players
          </div>
          <p className="text-xs font-semibold text-emerald-700">
            Share this match link with tennis friends so they can grab a spot before it fills up.
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-semibold text-gray-600">
              <span className="flex-1 truncate font-mono text-gray-700">
                {shareLoading
                  ? "Generating share link..."
                  : shareLinkReady
                  ? shareLink
                  : "Share link unavailable"}
              </span>
              <button
                type="button"
                onClick={shareLinkReady ? handleCopyShareLink : handleRefreshShareLink}
                disabled={shareLoading || (!shareLinkReady && !shareError)}
                className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-white shadow-sm transition-all hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Copy className="h-3.5 w-3.5" />
                {shareCopied ? "Copied!" : shareLinkReady ? "Copy" : "Retry"}
              </button>
            </div>
            {!shareLoading && shareError && (
              <div className="flex items-start justify-between gap-2 text-xs font-semibold text-rose-600">
                <span className="flex-1">{shareError}</span>
                <button type="button" onClick={handleRefreshShareLink} className="text-rose-600 underline-offset-2 hover:underline">
                  Try again
                </button>
              </div>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleShareSms}
              disabled={!shareLinkReady}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MessageCircle className="h-4 w-4" />
              Text link
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={!shareLinkReady}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              WhatsApp
            </button>
            <button
              type="button"
              onClick={handleShareEmail}
              disabled={!shareLinkReady}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Mail className="h-4 w-4" />
              Email invite
            </button>
          </div>
        </section>
      )}

      {match.notes && (
        <section className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">Notes from Organizer</p>
              <p className="mt-1 text-sm font-semibold text-gray-600">{match.notes}</p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-sm font-black text-gray-900">What happens next</p>
        <ul className="mt-3 space-y-2 text-sm font-semibold text-gray-600">
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
            You'll receive an email confirmation shortly.
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
            We'll remind you 24 hours before the match.
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
            The organizer is notified you're in.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-sm font-black text-gray-900">Add to calendar</p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm font-semibold">
          <button
            type="button"
            onClick={() => handleCalendarAction("google")}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Calendar className="h-4 w-4" /> Google
          </button>
          <button
            type="button"
            onClick={() => handleCalendarAction("outlook")}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50"
          >
            <Calendar className="h-4 w-4" /> Outlook
          </button>
          <button
            type="button"
            onClick={() => handleCalendarAction("ics")}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ClipboardList className="h-4 w-4" /> .ics File
          </button>
          <button
            type="button"
            onClick={handleSmsReminder}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50"
          >
            <MessageCircle className="h-4 w-4" /> SMS Reminder
          </button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleLeaveMatch}
          disabled={leaving || isArchived || isCancelled}
          className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {leaving ? "Leaving match..." : "Leave this match"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-3 text-sm font-black text-white shadow-lg transition-all hover:shadow-xl"
        >
          Back to matches
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-details-heading"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-600 shadow hover:text-gray-900"
          aria-label="Close match details"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="max-h-[80vh] overflow-y-auto px-5 pb-6 pt-10 sm:px-8">
          {status === "success" ? renderSuccessView() : renderDefaultView()}
        </div>
      </div>
    </div>
  );
};

export default MatchDetailsModal;
