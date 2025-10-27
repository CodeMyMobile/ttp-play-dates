import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  listMatches,
  createMatch,
  updateMatch,
  cancelMatch,
  joinMatch,
  leaveMatch,
  removeParticipant,
  searchPlayers,
  sendInvites,
  getMatch,
  getShareLink,
} from "./services/matches";
import { listNotifications } from "./services/notifications";
import { getStoredAuthToken } from "./services/authToken";
import ProfileManager from "./components/ProfileManager";
import NotificationsFeed, {
  buildNotificationPresentation,
  buildInviteNotification,
} from "./components/NotificationsFeed";
import ActivityFeed from "./components/ActivityFeed";
import {
  getInviteByToken,
  listInvites,
  acceptInvite,
  rejectInvite,
} from "./services/invites";
import { login, signup, forgotPassword, getPersonalDetails } from "./services/auth";
import {
  clearStoredAuthToken,
  clearStoredRefreshToken,
  storeAuthToken,
  storeRefreshToken,
} from "./services/authToken";
import { updatePlayerPersonalDetails } from "./services/player";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  ChevronRight,
  Plus,
  X,
  Check,
  CheckCircle2,
  Search,
  Share2,
  Menu,
  Bell,
  BellRing,
  Star,
  TrendingUp,
  Award,
  Edit3,
  Filter,
  Settings,
  LogOut,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  ChevronLeft,
  MoreVertical,
  Send,
  Copy,
  Mail,
  MessageCircle,
  Phone,
  AlertCircle,
  ArrowRight,
  Zap,
  Trophy,
  Sparkles,
  Target,
} from "lucide-react";
import Autocomplete from "react-google-autocomplete";
import AppHeader from "./components/AppHeader";
import InviteScreen from "./components/InviteScreen";
import MatchDetailsModal from "./components/MatchDetailsModal";
import LandingPage from "./pages/LandingPage.jsx";
import {
  formatPhoneNumber,
  normalizePhoneValue,
  formatPhoneDisplay,
  getPhoneDigits,
} from "./services/phone";
import {
  ARCHIVE_FILTER_VALUE,
  MATCH_ARCHIVED_ERROR,
  isMatchArchivedError,
} from "./utils/archive";
import {
  countUniqueMatchOccupants,
  getParticipantPhone,
  idsMatch,
  pruneParticipantFromMatchData,
  uniqueAcceptedInvitees,
  uniqueActiveParticipants,
  uniqueInvitees,
} from "./utils/participants";
import {
  collectMemberIds,
  collectMatchHostIds,
  memberIsMatchHost,
  memberMatchesAnyId,
  memberMatchesInvite,
  memberMatchesParticipant,
} from "./utils/memberIdentity";
import { getMatchPrivacy } from "./utils/matchPrivacy";
import { getAvatarInitials, getAvatarUrlFromPlayer } from "./utils/avatar";
import { buildRecentPartnerSuggestions } from "./utils/inviteSuggestions";
import {
  loadRecentLocations as loadStoredLocations,
  recordRecentLocation as persistRecentLocation,
  RECENT_LOCATIONS_EVENT,
} from "./utils/recentLocations";

const DEFAULT_SKILL_LEVEL = "2.5 - Beginner";

const matchFormatOptions = [
  "Singles",
  "Doubles",
  "Mixed Doubles",
  "Dingles",
  "Round Robin",
  "Other",
];

const HOME_FEED_ITEM_LIMIT = 12;

const getInitialPath = () => {
  if (typeof window === "undefined") return "/";
  const hash = window.location.hash || "";
  if (hash.startsWith("#")) {
    const pathFromHash = hash.slice(1);
    return pathFromHash || "/";
  }
  return window.location.pathname || "/";
};

const deriveScreenFromPath = (path) => {
  if (path === "/invites") return "invites";
  if (/^\/matches\/[^/]+\/invite$/.test(path)) return "invite";
  return "browse";
};

const deriveInviteMatchId = (path) => {
  const match = path.match(/^\/matches\/(\d+)\/invite$/);
  if (!match) return null;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : null;
};

const buildMapsUrl = (lat, lng, address) => {
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address,
    )}`;
  }
  return "";
};

const calculateDistanceMiles = (lat1, lon1, lat2, lon2) => {
  const parsedLat1 = Number(lat1);
  const parsedLon1 = Number(lon1);
  const parsedLat2 = Number(lat2);
  const parsedLon2 = Number(lon2);

  if (
    [parsedLat1, parsedLon1, parsedLat2, parsedLon2].some((value) =>
      Number.isNaN(value),
    )
  ) {
    return null;
  }

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const dLat = toRad(parsedLat2 - parsedLat1);
  const dLon = toRad(parsedLon2 - parsedLon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(parsedLat1)) *
      Math.cos(toRad(parsedLat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadiusMiles * c;

  if (!Number.isFinite(distance)) return null;
  return Math.round(distance * 10) / 10;
};

const collectHostContactDetails = (match) => {
  const emails = new Set();
  const normalizedPhones = new Set();
  const phoneDigits = new Set();

  const addEmail = (value) => {
    if (typeof value !== "string") return;
    const normalized = value.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) return;
    emails.add(normalized);
  };

  const addPhone = (value) => {
    if (typeof value !== "string" && typeof value !== "number") return;
    const stringValue = value.toString().trim();
    if (!stringValue) return;
    const normalized = normalizePhoneValue(stringValue);
    const digits = getPhoneDigits(stringValue);
    if (normalized) normalizedPhones.add(normalized);
    if (digits) phoneDigits.add(digits);
  };

  const visitContactRecord = (record) => {
    if (!record) return;
    if (Array.isArray(record)) {
      record.forEach(visitContactRecord);
      return;
    }
    if (typeof record === "object") {
      visitContactRecord(record.email);
      visitContactRecord(record.contact_email);
      visitContactRecord(record.contactEmail);
      visitContactRecord(record.profile);
      visitContactRecord(record.user);
      visitContactRecord(record.person);
      visitContactRecord(record.member);
      visitContactRecord(record.account);
      visitContactRecord(record.details);
      visitContactRecord(record.contact);
      return;
    }
    const stringValue = record.toString().trim();
    if (!stringValue) return;
    if (stringValue.includes("@")) {
      addEmail(stringValue);
    } else {
      addPhone(stringValue);
    }
  };

  const directSources = [
    match?.host_email,
    match?.hostEmail,
    match?.organizer_email,
    match?.organiser_email,
    match?.organizerEmail,
    match?.organiserEmail,
    match?.owner_email,
    match?.ownerEmail,
    match?.created_by_email,
    match?.createdByEmail,
    match?.creator_email,
    match?.creatorEmail,
    match?.host_phone,
    match?.hostPhone,
    match?.organizer_phone,
    match?.organiser_phone,
    match?.organizerPhone,
    match?.organiserPhone,
    match?.owner_phone,
    match?.ownerPhone,
    match?.created_by_phone,
    match?.createdByPhone,
    match?.creator_phone,
    match?.creatorPhone,
  ];

  directSources.forEach(visitContactRecord);

  const nestedSources = [
    match?.host,
    match?.host_profile,
    match?.hostProfile,
    match?.host_contact,
    match?.hostContact,
    match?.organizer,
    match?.organiser,
    match?.organizer_profile,
    match?.organizerProfile,
    match?.organiser_profile,
    match?.organiserProfile,
    match?.organized_by,
    match?.organizedBy,
    match?.organised_by,
    match?.organisedBy,
    match?.creator,
    match?.created_by,
    match?.createdBy,
    match?.owner,
  ];

  nestedSources.forEach(visitContactRecord);

  return { emails, normalizedPhones, phoneDigits };
};

const toPlainObject = (value) =>
  value && typeof value === "object" ? { ...value } : null;

const collectMembershipRecords = (...sources) => {
  const records = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      records.push({ ...value });
    }
  };
  sources.forEach(visit);
  return records;
};

const collectIdentityHints = (...sources) => {
  const hints = [];
  const visit = (value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      visit(value.id);
      visit(value.user_id);
      visit(value.userId);
      visit(value.player_id);
      visit(value.playerId);
      visit(value.member_id);
      visit(value.memberId);
      visit(value.identity);
      visit(value.identity_id);
      visit(value.identityId);
      return;
    }
    hints.push(value);
  };
  sources.forEach(visit);
  return hints;
};

const buildLocalUser = ({
  id,
  type,
  name,
  email,
  phone,
  skillLevel,
  profile,
  account,
  person,
  member,
  userRecord,
  memberships,
  identityHints,
}) => {
  const safeName = (name || email || "Matchplay Player").trim();
  const normalizedProfile = toPlainObject(profile);
  const normalizedAccount = toPlainObject(account);
  const normalizedPerson = toPlainObject(person);
  const normalizedMember = toPlainObject(member);
  const normalizedUserRecord = toPlainObject(userRecord);

  const membershipRecords = collectMembershipRecords(
    memberships,
    normalizedProfile?.memberships,
    normalizedProfile?.membership,
    normalizedAccount?.memberships,
    normalizedAccount?.membership,
    normalizedPerson?.memberships,
    normalizedPerson?.membership,
    normalizedMember?.memberships,
    normalizedMember?.membership,
    normalizedUserRecord?.memberships,
    normalizedUserRecord?.membership,
  );

  const identityHintsList = collectIdentityHints(
    identityHints,
    normalizedProfile?.identity,
    normalizedProfile?.identity_id,
    normalizedProfile?.identityId,
    normalizedProfile?.identities,
    normalizedAccount?.identity,
    normalizedAccount?.identity_id,
    normalizedAccount?.identityId,
    normalizedAccount?.identities,
    normalizedPerson?.identity,
    normalizedPerson?.identity_id,
    normalizedPerson?.identityId,
    normalizedPerson?.identities,
    normalizedMember?.identity,
    normalizedMember?.identity_id,
    normalizedMember?.identityId,
    normalizedMember?.identities,
    normalizedUserRecord?.identity,
    normalizedUserRecord?.identity_id,
    normalizedUserRecord?.identityId,
    normalizedUserRecord?.identities,
  );

  const baseUser = {
    id,
    type,
    name: safeName,
    email,
    phone: phone || "",
    skillLevel: skillLevel || "",
    avatar: getAvatarInitials(safeName, email),
    avatarUrl: getAvatarUrlFromPlayer({
      profile: normalizedProfile,
      player: normalizedProfile,
      user: normalizedUserRecord,
      account: normalizedAccount,
      member: normalizedMember,
    }),
    rating: 4.2,
    profile: normalizedProfile,
    account: normalizedAccount,
    person: normalizedPerson,
    member: normalizedMember,
    userRecord: normalizedUserRecord,
    memberships: membershipRecords,
    identityHints: identityHintsList,
  };

  return {
    ...baseUser,
    identityIds: collectMemberIds(baseUser),
  };
};

const resolveAuthSession = (data = {}, fallback = {}) => {
  const normalizedData = data && typeof data === "object" ? data : {};
  const fallbackData = fallback && typeof fallback === "object" ? fallback : {};

  const pickString = (...values) => {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const normalized = String(value).trim();
      if (normalized) return normalized;
    }
    return "";
  };

  const profile =
    normalizedData?.profile && typeof normalizedData.profile === "object"
      ? normalizedData.profile
      : null;
  const userFromApi =
    normalizedData?.user && typeof normalizedData.user === "object"
      ? normalizedData.user
      : null;

  const deriveId = () => {
    const candidates = [
      profile?.id,
      userFromApi?.id,
      userFromApi?.user_id,
      normalizedData?.user_id,
      fallbackData?.id,
    ];
    for (const candidate of candidates) {
      if (candidate === undefined || candidate === null) continue;
      if (typeof candidate === "number") return candidate;
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
    return null;
  };

  const derivedId = deriveId();
  const derivedType =
    normalizedData?.user_type ??
    userFromApi?.user_type ??
    fallbackData?.type ??
    fallbackData?.user_type ??
    null;

  const derivedName = pickString(
    profile?.full_name,
    userFromApi?.full_name,
    userFromApi?.name,
    fallbackData?.name,
    fallbackData?.email,
  );

  const derivedEmail = pickString(
    profile?.email,
    userFromApi?.email,
    fallbackData?.email,
  );

  const derivedPhone = pickString(
    profile?.mobile,
    profile?.phone,
    userFromApi?.mobile,
    userFromApi?.phone,
    fallbackData?.phone,
  );

  const derivedSkill = pickString(
    profile?.usta_rating,
    profile?.skill_level,
    profile?.skillLevel,
    userFromApi?.usta_rating,
    userFromApi?.skill_level,
    userFromApi?.skillLevel,
    fallbackData?.skillLevel,
  );

  const user = buildLocalUser({
    id: derivedId,
    type: derivedType,
    name: derivedName,
    email: derivedEmail,
    phone: derivedPhone,
    skillLevel: derivedSkill,
    profile,
    account:
      normalizedData?.account ?? userFromApi?.account ?? profile?.account ?? null,
    person:
      normalizedData?.person ?? userFromApi?.person ?? profile?.person ?? null,
    member:
      normalizedData?.member ?? userFromApi?.member ?? profile?.member ?? null,
    userRecord: userFromApi,
    memberships: [
      normalizedData?.memberships,
      normalizedData?.membership,
      normalizedData?.member?.memberships,
      normalizedData?.member?.membership,
      normalizedData?.account?.memberships,
      normalizedData?.account?.membership,
      normalizedData?.person?.memberships,
      normalizedData?.person?.membership,
      profile?.memberships,
      profile?.membership,
      profile?.account?.memberships,
      profile?.account?.membership,
      profile?.person?.memberships,
      profile?.person?.membership,
      userFromApi?.memberships,
      userFromApi?.membership,
    ],
    identityHints: [
      normalizedData?.identity,
      normalizedData?.identity_id,
      normalizedData?.identityId,
      normalizedData?.identity_ids,
      normalizedData?.identityIds,
      normalizedData?.identities,
      normalizedData?.matchplay_member_id,
      normalizedData?.matchplayMemberId,
      normalizedData?.matchplay_player_id,
      normalizedData?.matchplayPlayerId,
      normalizedData?.member_id,
      normalizedData?.memberId,
      normalizedData?.player_id,
      normalizedData?.playerId,
      userFromApi?.identity,
      userFromApi?.identity_id,
      userFromApi?.identityId,
      userFromApi?.identity_ids,
      userFromApi?.identityIds,
      userFromApi?.identities,
      userFromApi?.matchplay_member_id,
      userFromApi?.matchplayMemberId,
      userFromApi?.matchplay_player_id,
      userFromApi?.matchplayPlayerId,
      userFromApi?.member_id,
      userFromApi?.memberId,
      userFromApi?.player_id,
      userFromApi?.playerId,
      profile?.identity,
      profile?.identity_id,
      profile?.identityId,
      profile?.identity_ids,
      profile?.identityIds,
      profile?.identities,
    ],
  });

  return {
    token: pickString(
      normalizedData?.access_token,
      normalizedData?.token,
      fallbackData?.accessToken,
      fallbackData?.token,
    ),
    refreshToken: pickString(
      normalizedData?.refresh_token,
      fallbackData?.refreshToken,
    ),
    user,
    userId: derivedId,
    userType: derivedType,
  };
};

const TennisMatchApp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialPath = getInitialPath();
  const [currentUser, setCurrentUser] = useState(null);
  const memberIdentityIds = useMemo(
    () => collectMemberIds(currentUser),
    [currentUser],
  );
  const [currentScreen, setCurrentScreen] = useState(() =>
    deriveScreenFromPath(initialPath),
  );
  const [activeFilter, setActiveFilter] = useState("my");
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showToast, setShowToast] = useState(null);
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState(new Map());
  const [manualContacts, setManualContacts] = useState(new Map());
  const [inviteMatchId, setInviteMatchId] = useState(() =>
    deriveInviteMatchId(initialPath),
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participantsMatchId, setParticipantsMatchId] = useState(null);
  const [showMatchMenu, setShowMatchMenu] = useState(null);
  const [signInStep, setSignInStep] = useState("initial");
  const [password, setPassword] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    skillLevel: "",
    dateOfBirth: "",
  });
  const [signupErrors, setSignupErrors] = useState({});
  // Removed OTP verification; no verification code needed

  const [matchData, setMatchData] = useState({
    type: "open",
    playerCount: 4,
    occupied: 1,
    skillLevel: null,
    format: "Doubles",
    dateTime: "",
    location: "",
    latitude: null,
    longitude: null,
    mapUrl: "",
    notes: "",
    hostId: null,
    hostName: "",
  });

  const [matches, setMatches] = useState([]);
  const [matchCounts, setMatchCounts] = useState({
    my: 0,
    open: 0,
    today: 0,
    tomorrow: 0,
    weekend: 0,
    draft: 0,
    archived: 0,
  });
  const [matchPagination, setMatchPagination] = useState(null);
  const [matchPage, setMatchPage] = useState(1);
  const [matchSearch, setMatchSearch] = useState("");
  // Track players already part of the match (participants or previously invited)
  const [existingPlayerIds, setExistingPlayerIds] = useState(new Set());
  const [editMatch, setEditMatch] = useState(null);
  const [viewMatch, setViewMatchState] = useState(null);
  const setViewMatch = useCallback((value) => {
    setViewMatchState((previous) => {
      const nextValue =
        typeof value === "function" ? value(previous) : value;
      if (
        nextValue &&
        typeof nextValue === "object" &&
        previous &&
        typeof previous === "object" &&
        previous.viewerInvite &&
        !nextValue.viewerInvite
      ) {
        return { ...nextValue, viewerInvite: previous.viewerInvite };
      }
      return nextValue;
    });
  }, []);
  const [showMatchDetailsModal, setShowMatchDetailsModal] = useState(false);
  const [matchDetailsOrigin, setMatchDetailsOrigin] = useState("browse");
  const [pendingInvites, setPendingInvites] = useState([]);
  const [notificationSummary, setNotificationSummary] = useState({
    total: 0,
    unread: 0,
    latest: null,
  });
  const [notificationsSupported, setNotificationsSupported] = useState(true);
  const [lastSeenNotificationAt, setLastSeenNotificationAt] = useState(null);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState("");
  const [homeFeedNotifications, setHomeFeedNotifications] = useState([]);
  const [homeFeedLoading, setHomeFeedLoading] = useState(false);
  const [homeFeedError, setHomeFeedError] = useState("");
  const [locationFilter, setLocationFilter] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem("matchLocationFilter");
      return stored ? JSON.parse(stored) : null;
    } catch (err) {
      console.warn("Failed to read stored location filter", err);
      return null;
    }
  });
  const [distanceFilter, setDistanceFilter] = useState(() => {
    if (typeof window === "undefined") return 5;
    const stored = Number(window.localStorage.getItem("matchDistanceFilter"));
    return Number.isFinite(stored) && stored > 0 ? stored : 5;
  });
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [locationSearchTerm, setLocationSearchTerm] = useState(
    () => locationFilter?.label || "",
  );

  const totalSelectedInvitees = selectedPlayers.size + manualContacts.size;
  const lastInviteLoadRef = useRef(null);
  const autoDetectAttemptedRef = useRef(false);
  const hydratedProfileIdsRef = useRef(new Set());
  const notificationSummaryErrorLoggedRef = useRef(false);
  const inviteSummaryErrorLoggedRef = useRef(false);
  const inviteSummaryFallbackSupportedRef = useRef(true);
  const notificationSummaryRetryAtRef = useRef(0);
  const handleNotificationsAvailabilityChange = useCallback((supported) => {
    setNotificationsSupported(Boolean(supported));
  }, []);

  const mergeProfileDetails = useCallback(
    (profileDetails, { persist = true } = {}) => {
      if (!profileDetails || typeof profileDetails !== "object") return;

      const pickFirstValue = (...candidates) => {
        for (const candidate of candidates) {
          if (candidate === undefined || candidate === null) continue;
          if (typeof candidate === "string") {
            const trimmed = candidate.trim();
            if (trimmed) return trimmed;
            continue;
          }
          if (typeof candidate === "number") {
            if (!Number.isNaN(candidate)) {
              return String(candidate);
            }
          }
        }
        return "";
      };

      setCurrentUser((prev) => {
        if (!prev || typeof prev !== "object") return prev;

        const mergedProfile = {
          ...(prev.profile && typeof prev.profile === "object" ? prev.profile : {}),
          ...profileDetails,
        };

        const derivedName = pickFirstValue(
          profileDetails.full_name,
          profileDetails.fullName,
          profileDetails.name,
        );

        const derivedSkill = pickFirstValue(
          profileDetails.usta_rating,
          profileDetails.ustaRating,
          profileDetails.skill_level,
          profileDetails.skillLevel,
        );

        const derivedAvatarUrl = getAvatarUrlFromPlayer({
          profile: profileDetails,
          player: profileDetails,
          user: profileDetails,
        });

        const nextUser = {
          ...prev,
          profile: mergedProfile,
        };

        if (derivedName) {
          nextUser.name = derivedName;
        }

        if (derivedSkill) {
          nextUser.skillLevel = derivedSkill;
        }

        if (derivedAvatarUrl) {
          nextUser.avatarUrl = derivedAvatarUrl;
        }

        const profilePicture = pickFirstValue(
          profileDetails.profile_picture,
          profileDetails.profilePicture,
          profileDetails.profile_picture_url,
          profileDetails.profilePictureUrl,
          profileDetails.photo_url,
          profileDetails.photoUrl,
          profileDetails.image_url,
          profileDetails.imageUrl,
          profileDetails.avatar_url,
          profileDetails.avatarUrl,
        );

        if (profilePicture) {
          nextUser.profile_picture = profilePicture;
        }

        if (persist) {
          try {
            localStorage.setItem("user", JSON.stringify(nextUser));
          } catch (storageError) {
            console.warn("Unable to persist player profile", storageError);
          }
        }

        return nextUser;
      });
    },
    [setCurrentUser],
  );

  useEffect(() => {
    setMatchPage(1);
  }, [matchSearch, activeFilter]);

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(15, 0, 0, 0);
    setMatchData((prev) => ({
      ...prev,
      dateTime: tomorrow.toISOString().slice(0, 16),
    }));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (locationFilter?.lat && locationFilter?.lng) {
      window.localStorage.setItem(
        "matchLocationFilter",
        JSON.stringify(locationFilter),
      );
    } else {
      window.localStorage.removeItem("matchLocationFilter");
    }
  }, [locationFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("matchDistanceFilter", String(distanceFilter));
  }, [distanceFilter]);

  useEffect(() => {
    setLocationSearchTerm(locationFilter?.label || "");
  }, [locationFilter]);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed === "object") {
          const withIdentity = Array.isArray(parsed.identityIds)
            ? parsed
            : { ...parsed, identityIds: collectMemberIds(parsed) };
          setCurrentUser(withIdentity);
        }
      } catch (error) {
        console.warn("Failed to parse stored user", error);
      }
    }
  }, []);

  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;
    if (hydratedProfileIdsRef.current.has(userId)) return;

    let isActive = true;

    const hydrateProfile = async () => {
      try {
        const profileDetails = await getPersonalDetails();
        if (!isActive) return;
        hydratedProfileIdsRef.current.add(userId);
        if (profileDetails && typeof profileDetails === "object") {
          mergeProfileDetails(profileDetails);
        }
      } catch (error) {
        console.error("Failed to refresh player profile", error);
      }
    };

    hydrateProfile();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id, mergeProfileDetails]);

  const displayToast = useCallback((message, type = "success") => {
    setShowToast({ message, type });
    setTimeout(() => setShowToast(null), 3000);
  }, []);

  const applyAuthSession = useCallback(
    (session, fallback = {}) => {
      if (!session) return null;
      const { token, refreshToken, user } = session;
      const safeToken = typeof token === "string" ? token.trim() : "";
      const safeRefresh = typeof refreshToken === "string" ? refreshToken.trim() : "";
      const fallbackData = fallback && typeof fallback === "object" ? fallback : {};

      if (safeToken) {
        storeAuthToken(safeToken);
      }
      if (safeRefresh) {
        storeRefreshToken(safeRefresh, { maxAgeDays: 60 });
      }

      if (!safeToken) return null;

      const nextUser =
        user ||
        buildLocalUser({
          id: fallbackData?.id ?? null,
          type: fallbackData?.user_type ?? fallbackData?.type ?? null,
          name: fallbackData?.name ?? fallbackData?.email ?? "",
          email: fallbackData?.email ?? "",
          phone: fallbackData?.phone ?? "",
          skillLevel: fallbackData?.skillLevel ?? "",
        });

      if (nextUser) {
        try {
          localStorage.setItem("user", JSON.stringify(nextUser));
        } catch {
          // ignore storage errors
        }
        setCurrentUser(nextUser);
      }

      return nextUser;
    },
    [setCurrentUser],
  );

  const performSignup = useCallback(
    async ({
      name,
      email,
      phone,
      password,
      skillLevel,
      dateOfBirth,
    }) => {
      const trimmedName = name?.trim() ?? "";
      const normalizedPhoneDigits = getPhoneDigits(phone);

      if (!trimmedName) {
        const message = "Please enter your full name to continue.";
        const missingNameError = new Error(message);
        missingNameError.fieldErrors = { fullName: "Please enter your full name" };
        throw missingNameError;
      }

      const parseSignupError = (error) => {
        const fieldErrors = {};
        const assignFieldError = (field, value) => {
          if (!field || !value) return;
          const normalizedField = (() => {
            switch (field) {
              case "full_name":
              case "name":
                return "name";
              case "phone":
              case "mobile":
                return "phone";
              default:
                return field;
            }
          })();
          const message = Array.isArray(value) ? value.find(Boolean) : value;
          if (message) {
            fieldErrors[normalizedField] = message;
          }
        };

        const data = error?.response?.data ?? error?.data ?? {};

        if (error?.response?.data?.err?.constraint === "users_email_unique") {
          assignFieldError("email", "An account with that email already exists.");
        }

        const possibleFieldSources = [data?.errors, data?.err?.errors];
        possibleFieldSources.forEach((source) => {
          if (!source) return;
          if (Array.isArray(source)) {
            source.forEach((entry) => {
              if (!entry) return;
              if (typeof entry === "string") {
                assignFieldError("general", entry);
                return;
              }
              const field = entry.field || entry.name || entry.path || entry.attribute;
              const message =
                entry.message || entry.msg || entry.error || entry.detail || entry.title;
              if (field) {
                assignFieldError(field, message || entry);
              } else if (message) {
                assignFieldError("general", message);
              }
            });
          } else if (typeof source === "object") {
            Object.entries(source).forEach(([field, value]) => {
              if (!field) return;
              assignFieldError(field, value);
            });
          }
        });

        const extractMessage = () => {
          const candidates = [
            data?.message,
            data?.error,
            data?.err?.message,
            data?.err?.error,
            data?.err?.detail,
          ];

          const firstFieldMessage = Object.values(fieldErrors).find(Boolean);
          if (firstFieldMessage) candidates.push(firstFieldMessage);
          candidates.push(error?.message);

          return (
            candidates.find((value) => typeof value === "string" && value.trim()) ||
            "Signup failed. Please try again."
          );
        };

        return {
          message: extractMessage(),
          fieldErrors,
        };
      };

      try {
        const response = await signup({
          email,
          password,
          name: trimmedName,
          phone: normalizedPhoneDigits,
        });

        const fallbackDetails = {
          email,
          name: trimmedName,
          phone: normalizedPhoneDigits,
          skillLevel,
          id: response?.user_id ?? null,
        };

        let authPayload = response;
        let session = resolveAuthSession(authPayload, fallbackDetails);
        let persistedUser = applyAuthSession(session, fallbackDetails);

        if (!session.token) {
          try {
            const fallbackLogin = await login(email, password);
            authPayload = { ...authPayload, ...fallbackLogin };
            session = resolveAuthSession(authPayload, {
              ...fallbackDetails,
              id: fallbackLogin?.user_id ?? fallbackDetails.id,
            });
            persistedUser = applyAuthSession(session, fallbackDetails) || persistedUser;
          } catch (fallbackError) {
            console.error("Automatic login after signup failed", fallbackError);
          }
        }

        const signupToken =
          (typeof session.token === "string" ? session.token.trim() : "") ||
          localStorage.getItem("authToken") ||
          "";

        if (!signupToken) {
          throw new Error(
            "We created your account but couldn't start your session automatically. Please sign in with your new credentials.",
          );
        }

        const userId =
          session.userId ??
          authPayload?.user_id ??
          response?.user_id ??
          persistedUser?.id ??
          null;

        const normalizedPhone = normalizedPhoneDigits;

        let profileUpdateError = null;
        if (userId) {
          const attemptProfileUpdate = async (tokenForRequest) =>
            updatePlayerPersonalDetails({
              player: tokenForRequest,
              id: userId,
              ...(dateOfBirth
                ? {
                    date_of_birth: dateOfBirth,
                  }
                : {}),
              fullName: trimmedName || null,
              ...(normalizedPhone ? { mobile: normalizedPhone } : {}),
            });

          try {
            await attemptProfileUpdate(signupToken);
          } catch (profileError) {
            const status = Number(profileError?.status ?? profileError?.response?.status);
            const message =
              profileError?.response?.data?.message ||
              profileError?.response?.data?.error ||
              profileError?.data?.message ||
              profileError?.message ||
              "";
            const tokenIssue =
              [400, 401, 403].includes(status) || /token/i.test(message || "");

            if (tokenIssue) {
              try {
                const retryLogin = await login(email, password);
                authPayload = { ...authPayload, ...retryLogin };
                session = resolveAuthSession(authPayload, {
                  ...fallbackDetails,
                  id:
                    retryLogin?.user_id ??
                    session.userId ??
                    response?.user_id ??
                    userId,
                });
                persistedUser = applyAuthSession(session, fallbackDetails) || persistedUser;
                const retryToken =
                  (typeof session.token === "string" ? session.token.trim() : "") ||
                  localStorage.getItem("authToken") ||
                  "";
                if (retryToken) {
                  await attemptProfileUpdate(retryToken);
                } else {
                  profileUpdateError = profileError;
                }
              } catch (retryError) {
                console.error("Retrying profile update after login failed", retryError);
                profileUpdateError = profileError;
              }
            } else {
              profileUpdateError = profileError;
            }
          }
        }

        if (profileUpdateError) {
          console.error("Failed to update profile after signup", profileUpdateError);
        }

        const storedPhone = normalizedPhoneDigits || phone;
        const finalUser = buildLocalUser({
          id: userId,
          type: authPayload?.user_type ?? session.userType ?? persistedUser?.type,
          name: trimmedName,
          email,
          phone: storedPhone,
          skillLevel,
        });
        try {
          localStorage.setItem("user", JSON.stringify(finalUser));
        } catch {
          // ignore storage errors
        }
        setCurrentUser(finalUser);
        const safeFirst = (finalUser.name || "").split(" ")[0] || "Player";
        displayToast(`Welcome to Matchplay, ${safeFirst}! 🎾`, "success");
        return finalUser;
      } catch (error) {
        const { message, fieldErrors } = parseSignupError(error);
        const normalizedError = new Error(message);
        normalizedError.fieldErrors = fieldErrors;
        normalizedError.cause = error;
        throw normalizedError;
      }
    },
    [applyAuthSession, displayToast, setCurrentUser],
  );

  const performLogin = useCallback(
    async ({ email, password }) => {
      try {
        const response = await login(email, password);
        const session = resolveAuthSession(response, { email });
        const user = applyAuthSession(session, { email });
        if (!session.token || !user) {
          throw new Error(
            "We couldn't start your session. Please try signing in again.",
          );
        }
        const safeFirst = (user.name || "").split(" ")[0] || "Player";
        displayToast(`Welcome back, ${safeFirst}! 🎾`, "success");
        return user;
      } catch (error) {
        const statusCode = Number(error?.status ?? error?.response?.status);
        let message;
        if ([400, 401, 403].includes(statusCode)) {
          message =
            "That email or password doesn't match our records. Double-check your details or reset your password.";
        } else if (statusCode === 422) {
          message =
            error?.response?.data?.message ||
            error?.data?.message ||
            "Please double-check your email and password, then try again.";
        } else if (Number.isFinite(statusCode) && statusCode >= 500) {
          message =
            "We're having trouble signing you in right now. Please try again later.";
        } else if (error?.message) {
          message = error.message;
        } else {
          message =
            error?.response?.data?.message ||
            error?.data?.message ||
            "We couldn't sign you in. Please try again.";
        }
        const normalizedError = new Error(message);
        normalizedError.cause = error;
        throw normalizedError;
      }
    },
    [applyAuthSession, displayToast],
  );

  const fetchPendingInvites = useCallback(async () => {
    if (!currentUser) {
      setPendingInvites([]);
      setInvitesError("");
      return;
    }

    try {
      setInvitesLoading(true);
      const data = await listInvites({ status: "pending", perPage: 50 });
      const invitesArray = Array.isArray(data?.invites) ? data.invites : data || [];
      setPendingInvites(invitesArray);
      setInvitesError("");
    } catch (err) {
      console.error("Failed to load invites", err);
      if (isMatchArchivedError(err) || err?.response?.data?.error === MATCH_ARCHIVED_ERROR) {
        setInvitesError("Some invites belong to archived matches and can't be loaded.");
      } else {
        setInvitesError(
          err?.response?.data?.message || err?.message || "Failed to load invites",
        );
      }
    } finally {
      setInvitesLoading(false);
    }
  }, [currentUser]);


  const detectCurrentLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Geolocation is not supported in this browser.");
      return;
    }

    setIsDetectingLocation(true);
    setGeoError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position?.coords || {};
        if (
          typeof latitude === "number" &&
          !Number.isNaN(latitude) &&
          typeof longitude === "number" &&
          !Number.isNaN(longitude)
        ) {
          setLocationFilter({
            label: "Current location",
            lat: latitude,
            lng: longitude,
          });
          setShowLocationPicker(false);
        } else {
          setGeoError("Could not determine your location. Try searching manually.");
        }
        setIsDetectingLocation(false);
      },
      (error) => {
        const defaultMessage =
          "We couldn't access your location. Please enable location permissions or search manually.";
        const messageFromCode = (() => {
          if (!error || typeof error !== "object") return "";
          const numericCode = Number.isFinite(error.code)
            ? error.code
            : Number.parseInt(error.code, 10);
          switch (numericCode) {
            case 1:
              return "Please enable location permissions for your browser to use this feature.";
            case 2:
              return "We couldn't determine your location right now. Please try again or search manually.";
            case 3:
              return "Locating timed out. Try again or search for a location manually.";
            default:
              return "";
          }
        })();
        const fallbackMessage =
          typeof error?.message === "string" && error.message.trim()
            ? error.message.trim()
            : "";
        setGeoError(messageFromCode || fallbackMessage || defaultMessage);
        setIsDetectingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }, []);

  useEffect(() => {
    if (autoDetectAttemptedRef.current) return;
    if (!currentUser) return;

    if (locationFilter?.lat && locationFilter?.lng) {
      autoDetectAttemptedRef.current = true;
      return;
    }

    autoDetectAttemptedRef.current = true;
    detectCurrentLocation();
  }, [currentUser, detectCurrentLocation, locationFilter]);

  // Match loading helpers
  const fetchMatches = useCallback(async () => {
    if (!currentUser) {
      setMatches([]);
      setMatchCounts({});
      setMatchPagination(null);
      return;
    }

    try {
      const apiFilter = (() => {
        if (activeFilter === "draft") return "my";
        if (activeFilter === "archived") return ARCHIVE_FILTER_VALUE;
        return activeFilter;
      })();
      const status = activeFilter === "draft" ? "draft" : undefined;
      const parsedLat = (() => {
        const raw = locationFilter?.lat;
        const numeric =
          typeof raw === "string" ? Number.parseFloat(raw) : raw;
        return Number.isFinite(numeric) ? numeric : null;
      })();
      const parsedLng = (() => {
        const raw = locationFilter?.lng;
        const numeric =
          typeof raw === "string" ? Number.parseFloat(raw) : raw;
        return Number.isFinite(numeric) ? numeric : null;
      })();
      const locationParams =
        parsedLat !== null && parsedLng !== null
          ? {
              latitude: parsedLat,
              longitude: parsedLng,
              distance: distanceFilter,
            }
          : {};
      const data = await listMatches(apiFilter, {
        status,
        search: matchSearch,
        page: matchPage,
        perPage: 10,
        ...locationParams,
      });
      const rawMatches = data.matches || [];
      const counts = data.counts || {};
      const archivedCount =
        counts.archived ?? counts.archieve ?? counts.archive ?? 0;
      setMatchPagination(data.pagination);

      const DEPARTURE_KEYS = [
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
      const PARTICIPANT_STATUS_KEYS = [
        "participant_status",
        "participantStatus",
        "status_reason",
        "statusReason",
      ];
      const INACTIVE_PARTICIPANT_STATUSES = new Set([
        "left",
        "removed",
        "cancelled",
        "canceled",
        "declined",
        "rejected",
        "withdrawn",
        "expired",
      ]);
      const hasAnyValue = (subject, keys = []) => {
        if (!subject) return false;
        return keys.some((key) => {
          const value = subject?.[key];
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
      const hasInactiveStatus = (subject) => {
        if (!subject) return false;
        return PARTICIPANT_STATUS_KEYS.some((key) => {
          const value = subject?.[key];
          if (!value) return false;
          const normalized = value.toString().trim().toLowerCase();
          return INACTIVE_PARTICIPANT_STATUSES.has(normalized);
        });
      };

      const isInviteRelevant = (invite) => {
        if (!invite || typeof invite !== "object") return false;
        const status = invite.status
          ? invite.status.toString().trim().toLowerCase()
          : "";
        if (status && INACTIVE_PARTICIPANT_STATUSES.has(status)) {
          return false;
        }
        if (invite.is_active === false || invite.active === false) {
          return false;
        }
        const statusReason = invite.status_reason
          ? invite.status_reason.toString().trim().toLowerCase()
          : invite.statusReason
          ? invite.statusReason.toString().trim().toLowerCase()
          : "";
        if (statusReason && INACTIVE_PARTICIPANT_STATUSES.has(statusReason)) {
          return false;
        }
        if (hasAnyValue(invite, DEPARTURE_KEYS)) {
          return false;
        }
        return true;
      };

      let hiddenPrivateMatches = 0;
      const memberIds = memberIdentityIds;

      const now = Date.now();
      let transformed = rawMatches.map((m) => {
        const activeParticipants = uniqueActiveParticipants(m.participants);
        const acceptedInvitees = uniqueAcceptedInvitees(m.invitees);
        const invitees = uniqueInvitees(
          Array.isArray(m.invitees)
            ? m.invitees.filter((invite) => isInviteRelevant(invite))
            : [],
        );

        const capacityInfo =
          m && typeof m.capacity === "object" ? m.capacity : null;
        const confirmedFromCapacity = Number(
          capacityInfo?.confirmed ?? capacityInfo?.players,
        );
        const limitFromCapacity = Number(
          capacityInfo?.limit ?? capacityInfo?.max ?? capacityInfo?.capacity,
        );
        const openFromCapacity = Number(capacityInfo?.open);

        const fallbackOccupied = countUniqueMatchOccupants(
          m.participants,
          m.invitees,
        );
        const occupied =
          Number.isFinite(confirmedFromCapacity) && confirmedFromCapacity >= 0
            ? confirmedFromCapacity
            : fallbackOccupied;

        const normalizedPlayerLimit = (() => {
          if (Number.isFinite(limitFromCapacity) && limitFromCapacity > 0) {
            return limitFromCapacity;
          }
          const raw = m.player_limit;
          const numeric =
            typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
          return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
        })();

        const rosterSpotsRemaining =
          normalizedPlayerLimit !== null
            ? Math.max(normalizedPlayerLimit - fallbackOccupied, 0)
            : null;

        const computedSpotsAvailable = Number.isFinite(openFromCapacity)
          ? Math.max(openFromCapacity, 0)
          : rosterSpotsRemaining;

        const matchId = m.match_id || m.id;
        const normalizedUserEmail = currentUser?.email
          ? currentUser.email.toString().trim().toLowerCase()
          : "";
        const normalizedUserPhone = currentUser?.phone
          ? normalizePhoneValue(currentUser.phone)
          : "";
        const userPhoneDigits = currentUser?.phone
          ? getPhoneDigits(currentUser.phone)
          : "";
        const hostContactDetails = collectHostContactDetails(m);
        const hostMatchByIds = memberIsMatchHost(currentUser, m, memberIds);
        const matchesHostEmail = normalizedUserEmail
          ? hostContactDetails.emails.has(normalizedUserEmail)
          : false;
        const matchesHostPhone = (() => {
          if (!normalizedUserPhone && !userPhoneDigits) return false;
          if (
            normalizedUserPhone &&
            hostContactDetails.normalizedPhones.has(normalizedUserPhone)
          ) {
            return true;
          }
          if (
            userPhoneDigits &&
            hostContactDetails.phoneDigits.has(userPhoneDigits)
          ) {
            return true;
          }
          return false;
        })();
        const isHost = hostMatchByIds || matchesHostEmail || matchesHostPhone;

        const matchStartDate = (() => {
          if (!m || !m.start_date_time) return null;
          const candidate = new Date(m.start_date_time);
          return Number.isNaN(candidate.getTime()) ? null : candidate;
        })();
        const startTimestamp = matchStartDate ? matchStartDate.getTime() : null;
        const hoursUntilStartRaw =
          startTimestamp !== null ? (startTimestamp - now) / (1000 * 60 * 60) : null;
        const hoursUntilStart =
          hoursUntilStartRaw !== null
            ? Math.max(Math.round(hoursUntilStartRaw * 10) / 10, 0)
            : null;
        const isUpcomingSoon =
          hoursUntilStartRaw !== null &&
          hoursUntilStartRaw >= 0 &&
          hoursUntilStartRaw <= 48;

        const hasActiveParticipant = activeParticipants.some((participant) =>
          memberMatchesParticipant(currentUser, participant, memberIds),
        );
        const hasAcceptedInvite = acceptedInvitees.some((invite) =>
            memberMatchesInvite(currentUser, invite, memberIds),
          );
          const inviteMatchesCurrentUser = (invite) => {
            if (!invite || typeof invite !== "object") return false;
            if (memberMatchesInvite(currentUser, invite, memberIds)) {
              return true;
            }
          if (normalizedUserEmail) {
            const candidateEmails = [
              invite.email,
              invite.invitee_email,
              invite.inviteeEmail,
              invite.profile?.email,
              invite.player?.email,
              invite.contact_email,
              invite.contactEmail,
            ]
              .map((value) =>
                typeof value === "string" ? value.trim().toLowerCase() : "",
              )
              .filter(Boolean);
            if (candidateEmails.some((email) => email === normalizedUserEmail)) {
              return true;
            }
          }
          if (normalizedUserPhone || userPhoneDigits) {
            const candidatePhones = [
              invite.phone,
              invite.invitee_phone,
              invite.inviteePhone,
              invite.profile?.phone,
              invite.player?.phone,
              invite.contact_phone,
              invite.contactPhone,
            ];
            if (
              candidatePhones.some((value) => {
                const normalized = normalizePhoneValue(value);
                if (
                  normalized &&
                  normalizedUserPhone &&
                  normalized === normalizedUserPhone
                ) {
                  return true;
                }
                if (userPhoneDigits) {
                  const digits = getPhoneDigits(value);
                  if (digits && digits === userPhoneDigits) {
                    return true;
                  }
                }
                return false;
              })
            ) {
              return true;
            }
          }
          return false;
        };
        const isInvited = !isHost && invitees.some(inviteMatchesCurrentUser);
        const participantRecord = Array.isArray(m.participants)
          ? m.participants.find((participant) =>
              memberMatchesParticipant(currentUser, participant, memberIds),
            )
          : null;
        const joinedTimestamp =
          m.joined_at ??
          m.joinedAt ??
          m.joined ??
          participantRecord?.joined_at ??
          participantRecord?.joinedAt ??
          participantRecord?.joined;
        const hasDeparted =
          hasAnyValue(m, DEPARTURE_KEYS) ||
          hasAnyValue(participantRecord, DEPARTURE_KEYS) ||
          hasInactiveStatus(m) ||
          hasInactiveStatus(participantRecord) ||
          (Boolean(joinedTimestamp) &&
            !hasActiveParticipant &&
            !hasAcceptedInvite);
        const joinedTimestampActive = Boolean(joinedTimestamp) && !hasDeparted;
        const isJoined =
          !isHost &&
          (hasActiveParticipant || hasAcceptedInvite || joinedTimestampActive);

        const matchPrivacy = getMatchPrivacy(m);
        const isPrivateMatch = matchPrivacy === "private";
        if (isPrivateMatch && !isHost && !isJoined && !isInvited) {
          hiddenPrivateMatches += 1;
          return null;
        }

        const lowOccupancyAlertActive =
          isHost &&
          isUpcomingSoon &&
          rosterSpotsRemaining !== null &&
          rosterSpotsRemaining > 0 &&
          (m.status || "upcoming")?.toString().toLowerCase() === "upcoming";

        return {
          id: matchId,
          type: isHost ? "hosted" : isJoined ? "joined" : "available",
          status: m.status || "upcoming",
          privacy: matchPrivacy,
          dateTime: m.start_date_time,
          location: m.location_text,
          latitude: (() => {
            const numeric =
              typeof m.latitude === "string"
                ? Number.parseFloat(m.latitude)
                : m.latitude;
            return Number.isFinite(numeric) ? numeric : null;
          })(),
          longitude: (() => {
            const numeric =
              typeof m.longitude === "string"
                ? Number.parseFloat(m.longitude)
                : m.longitude;
            return Number.isFinite(numeric) ? numeric : null;
          })(),
          mapUrl: buildMapsUrl(m.latitude, m.longitude, m.location_text),
          distanceMiles: (() => {
            const raw =
              m.distanceMiles ??
              m.distance_miles ??
              m.distance;
            const numeric =
              typeof raw === "string" ? Number.parseFloat(raw) : raw;
            return Number.isFinite(numeric) ? numeric : null;
          })(),
          format: m.match_format,
          skillLevel: m.skill_level_min,
          notes: m.notes,
          invitees: m.invitees || [],
          participants: m.participants || [],
          playerLimit: normalizedPlayerLimit,
          occupied,
          rosterCount: fallbackOccupied,
          rosterSpotsRemaining,
          spotsAvailable: computedSpotsAvailable,
          capacity: capacityInfo,
          isInvited,
          alerts: {
            ...(lowOccupancyAlertActive
              ? {
                  lowOccupancy: {
                    active: true,
                    spotsNeeded: rosterSpotsRemaining,
                    rosterCount: fallbackOccupied,
                    playerLimit: normalizedPlayerLimit,
                    hoursUntilStart,
                    startTime: matchStartDate ? matchStartDate.toISOString() : null,
                  },
                }
              : {
                  lowOccupancy: {
                    active: false,
                    spotsNeeded: rosterSpotsRemaining,
                    rosterCount: fallbackOccupied,
                    playerLimit: normalizedPlayerLimit,
                    hoursUntilStart,
                    startTime: matchStartDate ? matchStartDate.toISOString() : null,
                  },
                }),
          },
        };
      }).filter(Boolean);
      if (activeFilter === "draft") {
        transformed = transformed.filter((m) => m.status === "draft");
      } else if (activeFilter === "archived") {
        transformed = transformed.filter((m) => m.status === "archived");
      } else {
        transformed = transformed.filter((m) => m.status !== "archived");
      }

      const normalizedCounts = { ...counts, archived: archivedCount };
      if (hiddenPrivateMatches > 0) {
        const countKey = (() => {
          if (activeFilter === "archived") return "archived";
          if (activeFilter === "draft") return "draft";
          return activeFilter;
        })();
        if (countKey) {
          const currentCount = Number(normalizedCounts[countKey]) || 0;
          normalizedCounts[countKey] = Math.max(
            currentCount - hiddenPrivateMatches,
            transformed.length,
            0,
          );
        }
      }

      setMatchCounts(normalizedCounts);
      setMatches(transformed);
    } catch (err) {
      displayToast(
        err.response?.data?.message || "Failed to load matches",
        "error",
      );
    }
  }, [
    activeFilter,
    distanceFilter,
    displayToast,
    locationFilter,
    matchPage,
    matchSearch,
    memberIdentityIds,
    currentUser,
  ]);

  const deriveInviteStatus = useCallback((invite = {}) => {
    if (invite?.accepted) return "accepted";
    if (invite?.rejected) return "rejected";
    const candidates = [
      invite?.status,
      invite?.state,
      invite?.invite_status,
      invite?.context?.status,
      invite?.meta?.status,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const normalized = candidate.toString().toLowerCase();
      if (normalized.includes("accept")) return "accepted";
      if (normalized.includes("reject") || normalized.includes("declin")) {
        return "rejected";
      }
      if (normalized.includes("pending") || normalized.includes("open")) {
        return "pending";
      }
      if (normalized.includes("sent") || normalized.includes("invite")) {
        return "sent";
      }
    }
    return "pending";
  }, []);

  const parsePossibleDate = useCallback((value) => {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const date = new Date(trimmed);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  }, []);

  const pickInviteTimestamp = useCallback(
    (invite) => {
      if (!invite) return null;
      const candidates = [
        invite.updated_at,
        invite.updatedAt,
        invite.created_at,
        invite.createdAt,
        invite.sent_at,
        invite.sentAt,
      ];
      for (const candidate of candidates) {
        const parsed = parsePossibleDate(candidate);
        if (parsed) return parsed;
      }
      return null;
    },
    [parsePossibleDate],
  );

  const handleNotificationsSummaryChange = useCallback(
    (summary = {}) => {
      const normalizeCount = (value, fallback) => {
        if (value === undefined || value === null) return fallback;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
      };

      const normalizeDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) {
          return Number.isNaN(value.getTime()) ? null : value;
        }
        if (typeof value === "number") {
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? null : date;
        }
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (!trimmed) return null;
          const date = new Date(trimmed);
          return Number.isNaN(date.getTime()) ? null : date;
        }
        return null;
      };

      const latestDate = normalizeDate(summary.latest);

      setNotificationSummary((prev) => ({
        total: normalizeCount(summary.total, prev.total ?? 0),
        unread: normalizeCount(summary.unread, prev.unread ?? 0),
        latest: latestDate || prev.latest || null,
      }));

      if (currentScreen === "invites" && latestDate) {
        setLastSeenNotificationAt(latestDate);
      }
    },
    [currentScreen],
  );

  const loadInviteSummary = useCallback(async () => {
    const emptySummary = { total: 0, unread: 0, latest: null };
    if (!inviteSummaryFallbackSupportedRef.current) {
      handleNotificationsSummaryChange(emptySummary);
      setHomeFeedNotifications([]);
      return { success: false, notifications: [] };
    }

    try {
      const data = await listInvites({ perPage: 50 });
      const invitesArray = Array.isArray(data?.invites)
        ? data.invites
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];

      const normalizedNotifications = invitesArray
        .map((invite) => {
          try {
            return buildInviteNotification(invite);
          } catch (inviteError) {
            console.error(
              "Failed to normalize invite for activity feed",
              inviteError,
              invite,
            );
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => {
          const aTime = a.createdAt ? a.createdAt.getTime() : 0;
          const bTime = b.createdAt ? b.createdAt.getTime() : 0;
          return bTime - aTime;
        });

      const unreadCount = invitesArray.filter((invite) => {
        const status = deriveInviteStatus(invite);
        return status === "pending" || status === "sent";
      }).length;

      const latestDate = invitesArray.reduce((latest, invite) => {
        const timestamp = pickInviteTimestamp(invite);
        if (!timestamp) return latest;
        if (!latest) return timestamp;
        return timestamp.getTime() > latest.getTime() ? timestamp : latest;
      }, null);

      handleNotificationsSummaryChange({
        total: normalizedNotifications.length,
        unread: unreadCount,
        latest: latestDate || null,
      });

      setHomeFeedNotifications(normalizedNotifications.slice(0, HOME_FEED_ITEM_LIMIT));
      inviteSummaryFallbackSupportedRef.current = true;
      inviteSummaryErrorLoggedRef.current = false;
      return { success: true, notifications: normalizedNotifications };
    } catch (fallbackError) {
      const statusCode = Number(
        fallbackError?.status ?? fallbackError?.response?.status,
      );
      if (statusCode === 404) {
        inviteSummaryFallbackSupportedRef.current = false;
        handleNotificationsSummaryChange(emptySummary);
        setHomeFeedNotifications([]);
        return { success: false, notifications: [] };
      }
      if (!inviteSummaryErrorLoggedRef.current) {
        console.error("Failed to load invite summary fallback", fallbackError);
        inviteSummaryErrorLoggedRef.current = true;
      }
      return { success: false, notifications: [] };
    }
  }, [
    buildInviteNotification,
    deriveInviteStatus,
    handleNotificationsSummaryChange,
    pickInviteTimestamp,
  ]);

  const fetchNotificationSummary = useCallback(
    async ({ forceRetry = false } = {}) => {
      const hasToken = !!getStoredAuthToken();
      if (!currentUser || !hasToken) {
        handleNotificationsSummaryChange({ total: 0, unread: 0, latest: null });
        setHomeFeedNotifications([]);
        setHomeFeedError("");
        setHomeFeedLoading(false);
        setLastSeenNotificationAt(null);
        return;
      }

      setHomeFeedLoading(true);
      setHomeFeedError("");

      const now = Date.now();
      const retryAt = notificationSummaryRetryAtRef.current || 0;
      const shouldAttemptNotifications =
        notificationsSupported || forceRetry || (retryAt && now >= retryAt);

      if (!shouldAttemptNotifications) {
        const fallbackResult = await loadInviteSummary();
        if (!fallbackResult.success) {
          setHomeFeedNotifications([]);
          setHomeFeedError("We couldn't load updates. Try again soon.");
        } else {
          setHomeFeedError("");
        }
        setHomeFeedLoading(false);
        return;
      }

      try {
        const data = await listNotifications({ perPage: HOME_FEED_ITEM_LIMIT });
        const rawList = (() => {
          if (Array.isArray(data?.notifications)) return data.notifications;
          if (Array.isArray(data?.data)) return data.data;
          if (Array.isArray(data?.items)) return data.items;
          if (Array.isArray(data)) return data;
          return [];
        })();
        const latestRaw =
          rawList.length > 0
            ? rawList[0]?.created_at ??
              rawList[0]?.createdAt ??
              rawList[0]?.timestamp ??
              rawList[0]?.time ??
              null
            : null;
        handleNotificationsSummaryChange({
          total: data?.total ?? data?.count ?? rawList.length,
          unread:
            data?.unread ??
            data?.unread_count ??
            data?.meta?.unread ??
            data?.meta?.unread_count ??
            data?.summary?.unread ??
            0,
          latest: latestRaw,
        });

        const normalizedNotifications = rawList
          .map((item) => {
            try {
              return buildNotificationPresentation(item);
            } catch (presentationError) {
              console.error(
                "Failed to normalize notification for activity feed",
                presentationError,
                item,
              );
              return null;
            }
          })
          .filter(Boolean);

        setHomeFeedNotifications(normalizedNotifications.slice(0, HOME_FEED_ITEM_LIMIT));
        setHomeFeedError("");
        notificationSummaryErrorLoggedRef.current = false;
        notificationSummaryRetryAtRef.current = 0;
        setNotificationsSupported(true);
      } catch (error) {
        const statusCode = Number(error?.status ?? error?.response?.status);
        if (statusCode === 401 || statusCode === 403) {
          setHomeFeedNotifications([]);
          handleNotificationsSummaryChange({ total: 0, unread: 0, latest: null });
          setLastSeenNotificationAt(null);
          notificationSummaryErrorLoggedRef.current = false;
          notificationSummaryRetryAtRef.current = 0;
          setNotificationsSupported(true);
          setHomeFeedError("");
        } else {
          const fallbackResult = await loadInviteSummary();
          if (!fallbackResult.success) {
            setHomeFeedNotifications([]);
            if (!notificationSummaryErrorLoggedRef.current) {
              console.error("Failed to load notification summary", error);
              notificationSummaryErrorLoggedRef.current = true;
            }
            setHomeFeedError("We couldn't load updates. Try again soon.");
          } else {
            notificationSummaryErrorLoggedRef.current = false;
            setHomeFeedError("");
          }
          setNotificationsSupported(false);
          const backoffMs = forceRetry ? 60000 : 5 * 60 * 1000;
          notificationSummaryRetryAtRef.current = Date.now() + backoffMs;
        }
      } finally {
        setHomeFeedLoading(false);
      }
    }, [
      buildNotificationPresentation,
      currentUser,
      handleNotificationsSummaryChange,
      loadInviteSummary,
      notificationsSupported,
    ]);

  const refreshMatchesAndInvites = useCallback(async () => {
    await Promise.all([
      fetchMatches(),
      fetchPendingInvites(),
      fetchNotificationSummary(),
    ]);
  }, [fetchMatches, fetchPendingInvites, fetchNotificationSummary]);

  const respondToInvite = useCallback(
    async (token, action) => {
      if (!token) return;
      try {
        if (action === "accept") {
          await acceptInvite(token);
          displayToast("Invite accepted! See you on the court. 🎾");
        } else {
          await rejectInvite(token);
          displayToast("Invite declined", "info");
        }
        fetchPendingInvites();
        fetchMatches();
        fetchNotificationSummary();
      } catch (err) {
        const errorCode = err?.response?.data?.error || err?.data?.error;
        if (isMatchArchivedError(err) || errorCode === MATCH_ARCHIVED_ERROR) {
          displayToast(
            "This match has been archived. Invites can no longer be updated.",
            "error",
          );
          fetchPendingInvites();
          fetchMatches();
          fetchNotificationSummary();
        } else {
          displayToast(
            err?.response?.data?.message ||
              err?.message ||
              "Failed to update invite",
            "error",
          );
        }
      }
    },
    [
      displayToast,
      fetchMatches,
      fetchPendingInvites,
      fetchNotificationSummary,
    ],
  );

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    fetchPendingInvites();
  }, [fetchPendingInvites]);

  useEffect(() => {
    fetchNotificationSummary();
  }, [fetchNotificationSummary]);

  useEffect(() => {
    if (!currentUser) return undefined;
    const interval = setInterval(() => {
      fetchNotificationSummary();
    }, 60000);
    return () => clearInterval(interval);
  }, [currentUser, fetchNotificationSummary]);

  const goToBrowse = useCallback(
    (options = {}) => {
      setCurrentScreen("browse");
      if (location.pathname !== "/") {
        navigate("/", { replace: options.replace ?? false });
      }
    },
    [location.pathname, navigate],
  );

  const goToInvites = useCallback(() => {
    setCurrentScreen("invites");
    if (location.pathname !== "/invites") {
      navigate("/invites");
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (currentScreen !== "invites") return;
    if (!notificationSummary.latest) return;
    setLastSeenNotificationAt((previous) => {
      if (!previous) return notificationSummary.latest;
      const previousDate = previous instanceof Date ? previous : new Date(previous);
      const previousTime = previousDate.getTime();
      const latestTime = notificationSummary.latest.getTime?.()
        ? notificationSummary.latest.getTime()
        : new Date(notificationSummary.latest).getTime();
      if (!Number.isFinite(previousTime) || !Number.isFinite(latestTime)) {
        return notificationSummary.latest;
      }
      if (latestTime > previousTime) {
        return notificationSummary.latest;
      }
      return previous;
    });
  }, [currentScreen, notificationSummary.latest]);

  const openInviteScreen = useCallback(
    async (matchId, { skipNavigation = false, onClose } = {}) => {
      const numericMatchId = Number(matchId);
      if (!Number.isFinite(numericMatchId) || numericMatchId <= 0) {
        displayToast("Match not found", "error");
        return;
      }

      try {
        const loadMatch = async () => {
          try {
            return await getMatch(numericMatchId);
          } catch (error) {
            if (!isMatchArchivedError(error)) throw error;
            return await getMatch(numericMatchId, {
              filter: ARCHIVE_FILTER_VALUE,
            });
          }
        };

        const data = await loadMatch();
        const match = data.match || {};
        if (match.status === "archived") {
          displayToast(
            "This match has been archived. Invites can no longer be managed.",
            "error",
          );
          return;
        }
        const participantsSource = Array.isArray(data.participants)
          ? data.participants
          : match.participants || [];
        const inviteesSource = Array.isArray(data.invitees)
          ? data.invitees
          : match.invitees || [];

        const validParticipants = uniqueActiveParticipants(participantsSource);
        const participantIds = validParticipants
          .map((p) => Number(p.player_id))
          .filter((id) => Number.isFinite(id) && id > 0);
        const inviteeIds = inviteesSource
          .map((i) => Number(i.invitee_id))
          .filter((id) => Number.isFinite(id) && id > 0);

        const initial = new Map();
        const hostParticipant = validParticipants.find(
          (p) => p.status === "hosting",
        );
        const computedHostId = hostParticipant?.player_id || match.host_id;
        const computedHostName = hostParticipant
          ? hostParticipant.profile?.full_name ||
            `Player ${hostParticipant.player_id}`
          : match.host_profile?.full_name ||
            match.host_name ||
            (computedHostId ? `Player ${computedHostId}` : "");
        const capacityInfo =
          match && typeof match.capacity === "object" ? match.capacity : null;
        const confirmedFromCapacity = Number(
          capacityInfo?.confirmed ?? capacityInfo?.players,
        );
        const limitFromCapacity = Number(
          capacityInfo?.limit ?? capacityInfo?.max ?? capacityInfo?.capacity,
        );

        const fallbackOccupied = countUniqueMatchOccupants(
          participantsSource,
          inviteesSource,
        );
        const occupied =
          Number.isFinite(confirmedFromCapacity) && confirmedFromCapacity >= 0
            ? confirmedFromCapacity
            : fallbackOccupied;

        validParticipants.forEach((p) => {
          const pid = Number(p.player_id);
          if (!Number.isFinite(pid) || pid <= 0) return;
          const profile = p.profile || {};
          initial.set(pid, {
            user_id: pid,
            full_name: profile.full_name || `Player ${pid}`,
            email: profile.email,
            hosting: p.status === "hosting" || idsMatch(pid, match.host_id),
          });
        });

        inviteesSource.forEach((i) => {
          const id = Number(i.invitee_id);
          if (!Number.isFinite(id) || id <= 0) return;
          const profile = i.profile || {};
          initial.set(id, {
            user_id: id,
            full_name: profile.full_name || `Player ${id}`,
            email: profile.email,
            hosting: false,
          });
        });

        setSelectedPlayers(initial);
        setManualContacts(new Map());
        setExistingPlayerIds(new Set([...participantIds, ...inviteeIds]));
        lastInviteLoadRef.current = numericMatchId;
        setMatchData((prev) => {
          const fallbackPlayerLimit = (() => {
            const rawLimit = match.player_limit;
            if (Number.isFinite(rawLimit)) return rawLimit;
            if (typeof rawLimit === "string") {
              const parsed = Number.parseInt(rawLimit, 10);
              return Number.isFinite(parsed) ? parsed : null;
            }
            return null;
          })();
          const playerCount =
            Number.isFinite(limitFromCapacity) && limitFromCapacity > 0
              ? limitFromCapacity
              : fallbackPlayerLimit ?? prev.playerCount;
          return {
            ...prev,
            type:
              match.match_type === "private" || match.match_type === "closed"
                ? "closed"
                : "open",
            skillLevel:
              match.skill_level_min || match.skill_level || prev.skillLevel || "",
            format: match.match_format || prev.format || "",
            playerCount,
            occupied,
          dateTime: match.start_date_time || prev.dateTime,
          location: match.location_text || prev.location,
          latitude: match.latitude ?? prev.latitude,
          longitude: match.longitude ?? prev.longitude,
          mapUrl: buildMapsUrl(
            match.latitude,
            match.longitude,
            match.location_text,
          ),
          notes: match.notes || "",
          hostId: computedHostId ?? prev.hostId,
          hostName: computedHostName || prev.hostName || "",
          };
        });
        setInviteMatchId((prev) =>
          prev === numericMatchId ? prev : numericMatchId,
        );
        setCurrentScreen("invite");

        if (typeof onClose === "function") {
          onClose();
        }

        if (!skipNavigation) {
          navigate(`/matches/${numericMatchId}/invite`);
        }
      } catch (err) {
        if (isMatchArchivedError(err)) {
          displayToast(
            "This match has been archived. Invites can no longer be managed.",
            "error",
          );
        } else {
          displayToast(
            err.response?.data?.message || "Failed to load match details",
            "error",
          );
        }
        lastInviteLoadRef.current = null;
        setInviteMatchId((prev) => (prev === numericMatchId ? null : prev));
        goToBrowse({ replace: true });
      }
    },
    [displayToast, goToBrowse, navigate],
  );

  const closeMatchDetailsModal = useCallback(() => {
    setShowMatchDetailsModal(false);
    setViewMatch(null);
    if (matchDetailsOrigin === "browse") {
      goToBrowse({ replace: true });
    } else if (matchDetailsOrigin === "invites") {
      goToInvites();
    } else if (matchDetailsOrigin === "create") {
      setCurrentScreen("create");
    }
    setMatchDetailsOrigin("browse");
  }, [goToBrowse, goToInvites, matchDetailsOrigin]);

  const handleManageInvitesFromDetails = useCallback(
    (matchId) => {
      if (!matchId) return;
      openInviteScreen(matchId, { onClose: closeMatchDetailsModal });
    },
    [closeMatchDetailsModal, openInviteScreen],
  );

  useEffect(() => {
    const path = location.pathname;
    if (path === "/invites") {
      lastInviteLoadRef.current = null;
      if (currentScreen !== "invites") {
        setCurrentScreen("invites");
      }
      return;
    }

    const inviteRouteMatch = path.match(/^\/matches\/(\d+)\/invite$/);
    if (inviteRouteMatch) {
      const matchIdFromPath = Number(inviteRouteMatch[1]);
      if (Number.isFinite(matchIdFromPath)) {
        if (lastInviteLoadRef.current !== matchIdFromPath) {
          lastInviteLoadRef.current = matchIdFromPath;
          openInviteScreen(matchIdFromPath, { skipNavigation: true });
        } else if (currentScreen !== "invite") {
          setCurrentScreen("invite");
        }
      }
      return;
    }

    lastInviteLoadRef.current = null;
    // Do not override other in-app screens (e.g., create) when the URL
    // doesn't explicitly target a special route.
    if (currentScreen !== "browse" && currentScreen !== "create") {
      setCurrentScreen("browse");
    }
  }, [currentScreen, location.pathname, openInviteScreen]);

  const formatDateTime = (dateTime) => {
    const date = new Date(dateTime);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatHoursUntilStart = useCallback((hours) => {
    if (hours === null || hours === undefined) return null;
    if (!Number.isFinite(hours)) return null;
    if (hours < 0) return null;
    if (hours < 1) {
      return "in under 1 hour";
    }
    if (hours < 24) {
      const rounded = Math.round(hours);
      return `in ${rounded} hour${rounded === 1 ? "" : "s"}`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    if (remainingHours <= 0) {
      return `in ${days} day${days === 1 ? "" : "s"}`;
    }
    return `in ${days} day${days === 1 ? "" : "s"} ${remainingHours} hour${
      remainingHours === 1 ? "" : "s"
    }`;
  }, []);

  const fetchMatchDetails = useCallback(
    async (matchId, { includeArchived = false } = {}) => {
      if (!matchId) return null;
      const options = includeArchived ? { filter: ARCHIVE_FILTER_VALUE } : undefined;
      return getMatch(matchId, options);
    },
    [],
  );

  const fetchMatchDetailsWithArchivedFallback = useCallback(
    async (matchId) => {
      try {
        return await fetchMatchDetails(matchId, { includeArchived: false });
      } catch (err) {
        if (isMatchArchivedError(err)) {
          displayToast("This match has been archived.", "info");
          return await fetchMatchDetails(matchId, { includeArchived: true });
        }
        throw err;
      }
    },
    [displayToast, fetchMatchDetails],
  );

  const fetchInviteByTokenWithArchivedFallback = useCallback(async (token) => {
    try {
      return await getInviteByToken(token);
    } catch (err) {
      if (isMatchArchivedError(err)) {
        return await getInviteByToken(token, { filter: ARCHIVE_FILTER_VALUE });
      }
      throw err;
    }
  }, []);

  // phone helpers imported from ./services/phone

  // Manual contact handlers live inside InviteScreen

  useEffect(() => {
    const tokenMatch = window.location.pathname.match(/^\/m\/([^/]+)$/);
    if (tokenMatch) {
      const token = tokenMatch[1];
      fetchInviteByTokenWithArchivedFallback(token)
        .then(async (invite) => {
          const matchId = invite.match?.id || invite.match_id;
          if (matchId) {
            try {
              const data = await fetchMatchDetailsWithArchivedFallback(matchId);
              if (data) {
                setMatchDetailsOrigin("browse");
                const nextData =
                  data && typeof data === "object"
                    ? { ...data, viewerInvite: invite }
                    : data;
                setViewMatch(nextData);
                setShowMatchDetailsModal(true);
              }
            } catch (error) {
              if (!isMatchArchivedError(error)) {
                throw error;
              }
            }
          }
        })
        .catch(() => {
          displayToast("Failed to open match", "error");
        });
    }
  }, [
    displayToast,
    fetchInviteByTokenWithArchivedFallback,
    fetchMatchDetailsWithArchivedFallback,
  ]);

  const matchIdsEqual = (a, b) => {
    if (a === undefined || a === null) return false;
    if (b === undefined || b === null) return false;
    if (a === b) return true;
    const aString = a.toString();
    const bString = b.toString();
    return aString === bString;
  };

  const handleViewDetails = async (matchId, options = {}) => {
    try {
      const data = await fetchMatchDetailsWithArchivedFallback(matchId);
      if (!data) {
        displayToast("Match not found", "error");
        return;
      }
      if ((data.match || {}).status === "archived" && activeFilter !== "archived") {
        setActiveFilter("archived");
      }
      const viewerInvite = (() => {
        if (options.pendingInvite) return options.pendingInvite;
        return pendingInvites.find((invite) => {
          const inviteMatchId =
            invite?.match?.id ?? invite?.match_id ?? invite?.matchId;
          return matchIdsEqual(inviteMatchId, matchId);
        });
      })();
      setMatchDetailsOrigin(currentScreen);
      const nextData =
        viewerInvite && data && typeof data === "object"
          ? { ...data, viewerInvite }
          : data;
      setViewMatch(nextData);
      setShowMatchDetailsModal(true);
    } catch (err) {
      if (isMatchArchivedError(err)) {
        displayToast("This match has been archived.", "error");
      } else {
        displayToast(
          err.response?.data?.message || "Failed to load match details",
          "error",
        );
      }
    }
  };

  const handleLogout = () => {
    clearStoredAuthToken();
    clearStoredRefreshToken();
    hydratedProfileIdsRef.current.clear();
    setCurrentUser(null);
    displayToast("Logged out", "success");
  };
  // Removed inline Header in favor of components/AppHeader

  const hasLocationFilter =
    Number.isFinite(
      typeof locationFilter?.lat === "string"
        ? Number.parseFloat(locationFilter.lat)
        : locationFilter?.lat,
    ) &&
    Number.isFinite(
      typeof locationFilter?.lng === "string"
        ? Number.parseFloat(locationFilter.lng)
        : locationFilter?.lng,
    );

  const getMatchTimestamp = useCallback((match) => {
    if (!match?.dateTime) return null;
    const parsed = new Date(match.dateTime);
    const ts = parsed.getTime();
    return Number.isNaN(ts) ? null : ts;
  }, []);

  const sortMatchesByRecency = useCallback(
    (list) => {
      const now = Date.now();
      return [...list].sort((a, b) => {
        const aTime = getMatchTimestamp(a);
        const bTime = getMatchTimestamp(b);

        if (aTime === null && bTime === null) return 0;
        if (aTime === null) return 1;
        if (bTime === null) return -1;

        const aIsPast = aTime < now;
        const bIsPast = bTime < now;
        if (aIsPast !== bIsPast) {
          return aIsPast ? 1 : -1;
        }

        const aDiff = Math.abs(aTime - now);
        const bDiff = Math.abs(bTime - now);
        if (aDiff !== bDiff) {
          return aDiff - bDiff;
        }

        if (aIsPast) {
          return bTime - aTime;
        }
        return aTime - bTime;
      });
    },
    [getMatchTimestamp],
  );

  const matchesWithDistance = useMemo(() => {
    return matches.map((match) => {
      const hasServerDistance = Number.isFinite(match.distanceMiles);
      const fallbackDistance = hasLocationFilter
        ? calculateDistanceMiles(
            locationFilter?.lat,
            locationFilter?.lng,
            match.latitude,
            match.longitude,
          )
        : null;
      const normalizedFallback = Number.isFinite(fallbackDistance)
        ? fallbackDistance
        : null;
      const distance = hasServerDistance ? match.distanceMiles : normalizedFallback;
      return { ...match, distanceMiles: distance };
    });
  }, [hasLocationFilter, locationFilter, matches]);

  const displayedMatches = useMemo(() => {
    const baseMatches = hasLocationFilter
      ? matchesWithDistance.filter((match) => {
          if (!Number.isFinite(match.distanceMiles)) return false;
          return match.distanceMiles <= distanceFilter;
        })
      : matchesWithDistance;

    return sortMatchesByRecency(baseMatches);
  }, [
    distanceFilter,
    hasLocationFilter,
    matchesWithDistance,
    sortMatchesByRecency,
  ]);

  const distanceOptions = useMemo(() => [5, 10, 20, 50], []);
  const activeLocationLabel = hasLocationFilter
    ? locationFilter?.label || "Saved location"
    : "";

  const matchesNeedingAttention = useMemo(() => {
    const getTimestamp = (match) => {
      const alertStart = match?.alerts?.lowOccupancy?.startTime;
      if (alertStart) {
        const parsed = new Date(alertStart);
        const ts = parsed.getTime();
        if (!Number.isNaN(ts)) return ts;
      }
      if (match?.dateTime) {
        const parsed = new Date(match.dateTime);
        const ts = parsed.getTime();
        if (!Number.isNaN(ts)) return ts;
      }
      return Number.POSITIVE_INFINITY;
    };

    return matches
      .filter((match) => match?.alerts?.lowOccupancy?.active)
      .sort((a, b) => getTimestamp(a) - getTimestamp(b));
  }, [matches]);

  const parseDateValue = useCallback((value) => {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) return date;
    }
    return null;
  }, []);

  const formatRelativeTimeFromNow = useCallback((date) => {
    if (!(date instanceof Date)) return "";
    const now = Date.now();
    const diffSeconds = Math.round((date.getTime() - now) / 1000);
    const absSeconds = Math.abs(diffSeconds);
    const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const units = [
      { limit: 60, unit: "second", divisor: 1 },
      { limit: 3600, unit: "minute", divisor: 60 },
      { limit: 86400, unit: "hour", divisor: 3600 },
      { limit: 604800, unit: "day", divisor: 86400 },
      { limit: 2629800, unit: "week", divisor: 604800 },
      { limit: 31557600, unit: "month", divisor: 2629800 },
    ];

    for (const { limit, unit, divisor } of units) {
      if (absSeconds < limit) {
        const value = Math.round(diffSeconds / divisor);
        return formatter.format(value, unit);
      }
    }

    const years = Math.round(diffSeconds / 31557600);
    return formatter.format(years, "year");
  }, []);

  const activityFeedItems = useMemo(() => {
    if (!currentUser) return [];

    const items = [];

    const pickString = (...candidates) => {
      for (const candidate of candidates) {
        if (!candidate) continue;
        if (typeof candidate === "string") {
          const trimmed = candidate.trim();
          if (trimmed) return trimmed;
        }
      }
      return "";
    };

    const pickNumber = (...candidates) => {
      for (const candidate of candidates) {
        if (candidate === undefined || candidate === null) continue;
        const numeric = Number(candidate);
        if (Number.isFinite(numeric)) return numeric;
      }
      return null;
    };

    pendingInvites.forEach((invite) => {
      const match = invite?.match || {};
      const matchId =
        match?.id ?? match?.match_id ?? match?.matchId ?? invite?.match_id ?? invite?.matchId;
      const formatLabel =
        pickString(
          match.match_format,
          match.matchFormat,
          match.format,
          match.title,
          match.name,
        ) || "Match invite";
      const locationLabel = pickString(
        match.location_text,
        match.locationText,
        match.location,
        match.venue,
        match.court_name,
        match.courtName,
      );
      const hostLabel = pickString(
        match.host_name,
        match.hostName,
        invite?.inviter?.full_name,
        invite?.inviter?.fullName,
        invite?.inviter?.name,
      );
      const startDate =
        parseDateValue(match.start_date_time) ||
        parseDateValue(match.startDateTime) ||
        parseDateValue(match.start_time) ||
        parseDateValue(match.dateTime);
      const updatedAt =
        parseDateValue(invite?.updated_at) ||
        parseDateValue(invite?.updatedAt) ||
        parseDateValue(invite?.created_at) ||
        parseDateValue(invite?.createdAt) ||
        parseDateValue(invite?.sent_at) ||
        startDate;
      const relativeTime = formatRelativeTimeFromNow(updatedAt || startDate);
      const playerLimit = pickNumber(
        match.player_limit,
        match.playerLimit,
        match.player_cap,
        match.max_players,
        match.capacity,
      );
      const rosterCount = pickNumber(
        match.roster_count,
        match.rosterCount,
        match.player_count,
        match.playerCount,
        match.occupied,
      );
      const capacityLabel = (() => {
        if (Number.isFinite(playerLimit) && Number.isFinite(rosterCount)) {
          return `${rosterCount}/${playerLimit} players`;
        }
        if (Number.isFinite(playerLimit)) {
          return `${playerLimit} player cap`;
        }
        return "";
      })();

      const meta = [];
      if (startDate) {
        meta.push({ icon: Calendar, label: formatDateTime(startDate) });
      }
      if (locationLabel) {
        meta.push({ icon: MapPin, label: locationLabel });
      }
      if (capacityLabel) {
        meta.push({ icon: Users, label: capacityLabel });
      }

      const inviteStatus = deriveInviteStatus(invite) || "pending";
      const tone = inviteStatus === "pending" || inviteStatus === "sent" ? "pending" : "info";
      const statusLabel = inviteStatus === "sent" ? "Invite Sent" : "Pending Invite";

      const actions = [
        {
          label: "Accept",
          onClick: () => respondToInvite(invite.token, "accept"),
          variant: "success",
        },
        {
          label: "Decline",
          onClick: () => respondToInvite(invite.token, "reject"),
          variant: "danger",
        },
      ];

      if (matchId) {
        actions.push({
          label: "View match",
          onClick: () => handleViewDetails(matchId, { pendingInvite: invite }),
          variant: "outline",
        });
      } else {
        actions.push({
          label: "Review invites",
          onClick: () => goToInvites(),
          variant: "outline",
        });
      }

      items.push({
        id: `invite-${invite.token || invite.id}`,
        statusLabel,
        tone,
        icon: Mail,
        title: locationLabel ? `${formatLabel} at ${locationLabel}` : formatLabel,
        description: hostLabel ? `Hosted by ${hostLabel}` : "Respond to secure your spot.",
        meta,
        timestamp: updatedAt || startDate || null,
        timestampLabel:
          (updatedAt || startDate)?.toLocaleString?.() ||
          (startDate ? startDate.toLocaleString() : ""),
        relativeTime,
        actions,
      });
    });

    const notificationTypeMap = {
      invite_accepted: { statusLabel: "Player Accepted", tone: "success", icon: UserCheck },
      invite_declined: { statusLabel: "Invite Declined", tone: "danger", icon: UserX },
      invite_sent: { statusLabel: "Invite Sent", tone: "info", icon: CheckCircle2 },
      match_created: { statusLabel: "Match Created", tone: "info", icon: Sparkles },
      match_updated: { statusLabel: "Match Updated", tone: "info", icon: Edit3 },
      match_full: { statusLabel: "Match Full", tone: "warning", icon: Users },
      match_cancelled: { statusLabel: "Match Cancelled", tone: "danger", icon: AlertCircle },
      player_joined: { statusLabel: "Player Joined", tone: "success", icon: UserPlus },
      player_left: { statusLabel: "Player Left", tone: "neutral", icon: UserMinus },
      general: { statusLabel: "Update", tone: "neutral", icon: BellRing },
    };

    homeFeedNotifications.forEach((notification) => {
      const styles = notificationTypeMap[notification.canonicalType] || notificationTypeMap.general;
      const meta = [];
      if (notification.matchLabel) {
        meta.push({ icon: Calendar, label: notification.matchLabel });
      }
      if (notification.startLabel) {
        meta.push({ icon: Clock, label: notification.startLabel });
      }
      if (Array.isArray(notification.tags)) {
        notification.tags
          .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
          .filter(Boolean)
          .forEach((tag) => {
            meta.push({ icon: null, label: tag });
          });
      }

      const actions = [];
      if (notification.matchId) {
        actions.push({
          label: "View match",
          onClick: () => handleViewDetails(notification.matchId),
          variant: "outline",
        });
      }

      items.push({
        id: `notification-${notification.id}`,
        statusLabel: styles.statusLabel,
        tone: styles.tone,
        icon: styles.icon,
        title: notification.title || styles.statusLabel,
        description: notification.body || "",
        meta,
        timestamp: notification.createdAt || null,
        timestampLabel: notification.createdAtLabel || "",
        relativeTime: notification.relativeTime || "",
        actions,
      });
    });

    matchesNeedingAttention.forEach((match) => {
      const lowOccupancy = match?.alerts?.lowOccupancy || {};
      const spotsNeeded = Number(lowOccupancy.spotsNeeded ?? match.rosterSpotsRemaining ?? 0);
      const matchId = match?.id;
      const formatLabel =
        pickString(
          match.match_format,
          match.matchFormat,
          match.format,
          match.title,
          match.name,
        ) || "Match";
      const locationLabel = pickString(
        match.location,
        match.location_text,
        match.locationText,
        match.venue,
        match.court_name,
        match.courtName,
      ) || "Location TBA";
      const startDate = parseDateValue(match.dateTime);
      const alertStart = parseDateValue(lowOccupancy.startTime);
      const timestamp = alertStart || startDate || null;
      const relativeTime = (() => {
        if (Number.isFinite(lowOccupancy.hoursUntilStart)) {
          return formatHoursUntilStart(lowOccupancy.hoursUntilStart);
        }
        return formatRelativeTimeFromNow(timestamp);
      })();

      const playerLimit = pickNumber(lowOccupancy.playerLimit, match.playerLimit);
      const rosterCount = pickNumber(lowOccupancy.rosterCount, match.rosterCount, match.occupied);
      const capacityLabel = (() => {
        if (Number.isFinite(playerLimit) && Number.isFinite(rosterCount)) {
          return `${rosterCount}/${playerLimit} confirmed`;
        }
        if (Number.isFinite(rosterCount)) {
          return `${rosterCount} confirmed`;
        }
        return "";
      })();

      const meta = [];
      if (startDate) {
        meta.push({ icon: Calendar, label: formatDateTime(startDate) });
      }
      if (locationLabel) {
        meta.push({ icon: MapPin, label: locationLabel });
      }
      if (capacityLabel) {
        meta.push({ icon: Users, label: capacityLabel });
      }

      const actions = [];
      if (matchId) {
        actions.push({
          label: "Manage invites",
          onClick: () => openInviteScreen(matchId),
          variant: "danger",
        });
        actions.push({
          label: "View match",
          onClick: () => handleViewDetails(matchId),
          variant: "outline",
        });
      }

      items.push({
        id: `attention-${matchId}`,
        statusLabel: "Needs Players",
        tone: "danger",
        icon: Users,
        title:
          Number.isFinite(spotsNeeded) && spotsNeeded > 0
            ? `Need ${spotsNeeded} more ${spotsNeeded === 1 ? "player" : "players"}`
            : "Help fill this match",
        description: `${formatLabel} at ${locationLabel}`,
        meta,
        timestamp,
        timestampLabel: timestamp?.toLocaleString?.() || "",
        relativeTime,
        actions,
      });
    });

    return items
      .sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : -Infinity;
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : -Infinity;
        return bTime - aTime;
      })
      .slice(0, HOME_FEED_ITEM_LIMIT);
  }, [
    currentUser,
    deriveInviteStatus,
    formatDateTime,
    formatHoursUntilStart,
    formatRelativeTimeFromNow,
    goToInvites,
    handleViewDetails,
    homeFeedNotifications,
    matchesNeedingAttention,
    openInviteScreen,
    parseDateValue,
    pendingInvites,
    respondToInvite,
  ]);

  const getMatchCount = useCallback(
    (filterId) => {
      if (!matchCounts) return 0;
      if (filterId === "archived") {
        return (
          matchCounts.archived ??
          matchCounts.archieve ??
          matchCounts.archive ??
          0
        );
      }
      return matchCounts[filterId] ?? 0;
    },
    [matchCounts],
  );

  const BrowseScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30">
      {/* Hero Section with Action Button */}
      <div className="border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl sm:text-3xl font-black text-gray-900">
                {currentUser ? "Browse Local Matches" : "Find Your Next Match"}
              </h2>
              <p className="mt-1 text-xs font-semibold text-gray-500 sm:text-base sm:font-medium">
                {currentUser
                  ? "See what's nearby and jump back in."
                  : "Discover active players around North County."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    setShowSignInModal(true);
                  } else {
                    navigate("/create");
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-transform hover:-translate-y-0.5 hover:shadow-lg sm:text-base"
              >
                <Sparkles className="h-4 w-4" />
                <span>Create Match</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/courts")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 sm:text-base"
              >
                <MapPin className="h-4 w-4" />
                <span>Find Courts</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {currentUser ? (
        <>
          <div className="max-w-7xl mx-auto px-4 pt-6 space-y-6">
            <section className="bg-white/80 border border-gray-100 rounded-3xl shadow-sm p-5 space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold shadow ${
                      hasLocationFilter
                        ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    <span className="truncate max-w-[220px] sm:max-w-[320px]">
                      {hasLocationFilter
                        ? activeLocationLabel
                        : "Showing matches from every location"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowLocationPicker((prev) => !prev);
                      setGeoError("");
                    }}
                    className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold shadow hover:bg-gray-700 transition-colors"
                  >
                    {showLocationPicker
                      ? "Hide location tools"
                      : hasLocationFilter
                      ? "Change location"
                      : "Set location"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {distanceOptions.map((distance) => (
                    <button
                      key={distance}
                      onClick={() => setDistanceFilter(distance)}
                      disabled={!hasLocationFilter && distance !== distanceFilter}
                      className={`px-3 py-1.5 text-sm font-bold rounded-full border transition-colors ${
                        distanceFilter === distance
                          ? "bg-green-500 text-white border-green-500 shadow"
                          : "bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600"
                      } ${
                        !hasLocationFilter && distance !== distanceFilter
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                      type="button"
                    >
                      {distance} mi
                    </button>
                  ))}
                </div>
              </div>
              {hasLocationFilter && (
                <p className="text-xs font-semibold text-gray-500">
                  Showing matches within {distanceFilter} miles of your selected location.
                </p>
              )}
              {showLocationPicker && (
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <Autocomplete
                    apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
                    placeholder="Search for a city, club, or court"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm font-semibold text-gray-700"
                    value={locationSearchTerm}
                    onChange={(event) => setLocationSearchTerm(event.target.value)}
                    onPlaceSelected={(place) => {
                      if (!place) {
                        setGeoError("Please choose a location from the suggestions.");
                        return;
                      }
                      const lat = place.geometry?.location?.lat?.();
                      const lng = place.geometry?.location?.lng?.();
                      const label =
                        place.formatted_address || place.name || locationSearchTerm || "Custom location";
                      if (
                        typeof lat === "number" &&
                        !Number.isNaN(lat) &&
                        typeof lng === "number" &&
                        !Number.isNaN(lng)
                      ) {
                        setLocationFilter({ label, lat, lng });
                        setGeoError("");
                        setShowLocationPicker(false);
                      } else {
                        setGeoError(
                          "We couldn't read that location's coordinates. Try another search.",
                        );
                      }
                    }}
                    options={{
                    types: ["geocode", "establishment"],
                    fields: [
                      "formatted_address",
                      "geometry",
                      "name",
                      "address_components",
                    ],
                  }}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={detectCurrentLocation}
                      disabled={isDetectingLocation}
                      className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-sm border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isDetectingLocation ? "Detecting location..." : "Use my current location"}
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      {hasLocationFilter && (
                        <button
                          type="button"
                          onClick={() => {
                            setLocationFilter(null);
                            setLocationSearchTerm("");
                            setShowLocationPicker(false);
                            setGeoError("");
                          }}
                          className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors"
                        >
                          Clear location
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setShowLocationPicker(false);
                          setGeoError("");
                          setLocationSearchTerm(locationFilter?.label || "");
                        }}
                        className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-700 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  {geoError && (
                    <p className="text-sm font-semibold text-red-600">{geoError}</p>
                  )}
                  {!import.meta.env.VITE_GOOGLE_API_KEY && (
                    <p className="text-xs text-amber-600 font-semibold">
                      Tip: Provide a Google Places API key to enable location search suggestions.
                    </p>
                  )}
                </div>
              )}
            </section>

            <ActivityFeed
              items={activityFeedItems}
              loading={homeFeedLoading || invitesLoading}
              errors={[homeFeedError, invitesError]}
              onRefresh={() => refreshMatchesAndInvites()}
              onViewAll={goToInvites}
              pendingInviteCount={pendingInvites.length}
              unreadUpdateCount={Number(notificationSummary.unread ?? 0)}
            />
          </div>

      {/* Filter Tabs */}
      <div className="bg-white sticky top-[65px] z-40 border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2 py-4 overflow-x-auto scrollbar-hide">
            {[
              {
                id: "my",
                label: "My Matches",
                count: getMatchCount("my"),
                color: "violet",
                icon: "⭐",
              },
              {
                id: "open",
                label: "Open Matches",
                count: getMatchCount("open"),
                color: "green",
                icon: "🔥",
              },
              {
                id: "today",
                label: "Today",
                count: getMatchCount("today"),
                color: "blue",
                icon: "📅",
              },
              {
                id: "tomorrow",
                label: "Tomorrow",
                count: getMatchCount("tomorrow"),
                color: "amber",
                icon: "⏰",
              },
              {
                id: "weekend",
                label: "Weekend",
                count: getMatchCount("weekend"),
                color: "purple",
                icon: "🎉",
              },
              {
                id: "draft",
                label: "Drafts",
                count: getMatchCount("draft"),
                color: "gray",
                icon: "📝",
              },
              {
                id: "archived",
                label: "Archived",
                count: getMatchCount("archived"),
                color: "slate",
                icon: "🗂️",
              },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeFilter === filter.id
                    ? "text-white shadow-lg scale-105"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                style={
                  activeFilter === filter.id
                  ? {
                      background:
                        filter.color === "violet"
                          ? "linear-gradient(135deg, rgb(139 92 246), rgb(124 58 237))"
                          : filter.color === "green"
                          ? "linear-gradient(135deg, rgb(34 197 94), rgb(16 185 129))"
                          : filter.color === "blue"
                          ? "linear-gradient(135deg, rgb(59 130 246), rgb(37 99 235))"
                          : filter.color === "amber"
                          ? "linear-gradient(135deg, rgb(245 158 11), rgb(217 119 6))"
                          : filter.color === "slate"
                          ? "linear-gradient(135deg, rgb(148 163 184), rgb(100 116 139))"
                          : "linear-gradient(135deg, rgb(168 85 247), rgb(147 51 234))",
                    }
                  : {}
              }
              >
                <span className="text-base">{filter.icon}</span>
                {filter.label}
                {filter.count > 0 && (
                  <span
                    className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
                      activeFilter === filter.id
                        ? "bg-white/25 text-white"
                        : "bg-white text-gray-600"
                    }`}
                  >
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Match Cards */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <div className="mb-6">
          <input
            type="search"
            placeholder="Search matches..."
            value={matchSearch}
            onChange={(e) => setMatchSearch(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 font-semibold text-gray-800"
          />
        </div>

        {hasLocationFilter && displayedMatches.length === 0 && (
          <div className="bg-white border border-dashed border-emerald-200 rounded-2xl p-8 text-center text-sm font-semibold text-emerald-700 mb-6">
            No matches within {distanceFilter} miles of your location yet. Try expanding the distance filter or check back soon!
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>

        {matchPagination && !hasLocationFilter && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => setMatchPage((p) => Math.max(1, p - 1))}
              disabled={matchPage === 1}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Previous
            </button>
            <span className="text-sm font-semibold text-gray-600">
              Page {matchPagination.page} of
              {" "}
              {Math.max(
                1,
                Math.ceil(
                  getMatchCount(activeFilter) /
                    matchPagination.perPage
                )
              )}
            </span>
            <button
              onClick={() => setMatchPage((p) => p + 1)}
              disabled={
                matchPagination.page >=
                Math.ceil(
                  getMatchCount(activeFilter) /
                    matchPagination.perPage
                )
              }
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Next
            </button>
          </div>
        )}
      </div>
        </>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-10 text-center">
          <p className="text-gray-600 font-semibold mb-6">
            Sign up or log in to view available matches.
          </p>
          <button
            onClick={() => setShowSignInModal(true)}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            Sign Up / Log In
          </button>
        </div>
      )}
    </div>
  );

  const MatchCard = ({ match }) => {
    const isHosted = match.type === "hosted";
    const isJoined = match.type === "joined";
    const statusValue = typeof match.status === "string" ? match.status.toLowerCase() : match.status;
    const isArchived = statusValue === "archived";
    const isUpcoming = statusValue === "upcoming";
    const playerCapacityLabel = Number.isFinite(match.playerLimit)
      ? `${match.occupied}/${match.playerLimit} players`
      : `${match.occupied} players`;

    const lowOccupancy = match?.alerts?.lowOccupancy;
    const hasLowOccupancyAlert = Boolean(lowOccupancy?.active);
    const rosterCount = lowOccupancy?.rosterCount ?? match.rosterCount ?? match.occupied;
    const playerLimit = lowOccupancy?.playerLimit ?? match.playerLimit ?? null;
    const spotsNeeded = lowOccupancy?.spotsNeeded ?? match.rosterSpotsRemaining ?? 0;
    const hoursUntilStart = lowOccupancy?.hoursUntilStart ?? null;
    const timeUntilStartLabel = useMemo(
      () => formatHoursUntilStart(hoursUntilStart),
      [formatHoursUntilStart, hoursUntilStart],
    );

    const existingPlayerIds = useMemo(() => {
      const ids = new Set();
      uniqueActiveParticipants(match.participants || []).forEach((participant) => {
        const candidate = Number(
          participant?.player_id ??
            participant?.user_id ??
            participant?.id ??
            participant?.profile?.player_id ??
            participant?.profile?.id,
        );
        if (Number.isFinite(candidate) && candidate > 0) {
          ids.add(candidate);
        }
      });
      uniqueInvitees(match.invitees || []).forEach((invite) => {
        const candidate = Number(
          invite?.invitee_id ??
            invite?.player_id ??
            invite?.user_id ??
            invite?.id ??
            invite?.profile?.player_id ??
            invite?.profile?.id,
        );
        if (Number.isFinite(candidate) && candidate > 0) {
          ids.add(candidate);
        }
      });
      return ids;
    }, [match.invitees, match.participants]);

    const hostIdentityIds = useMemo(() => {
      if (!isHosted) return [];
      try {
        return collectMatchHostIds(match) || [];
      } catch (error) {
        console.error("Failed to collect host identity ids", error);
        return [];
      }
    }, [isHosted, match]);

    const participantPhoneRecipients = useMemo(() => {
      if (!isHosted) return [];
      const hostIds = Array.isArray(hostIdentityIds) ? hostIdentityIds : [];
      const recipients = [];
      const seen = new Set();
      const participants = uniqueActiveParticipants(match.participants || []);

      const participantIdentityCandidates = (participant) => {
        if (!participant || typeof participant !== "object") return [];
        const profile = participant.profile || {};
        const player = participant.player || {};
        const user = participant.user || {};
        const member = participant.member || {};
        const contact = participant.contact || {};
        return [
          participant.match_participant_id,
          participant.matchParticipantId,
          participant.participant_id,
          participant.participantId,
          participant.player_id,
          participant.playerId,
          participant.invitee_id,
          participant.inviteeId,
          participant.user_id,
          participant.userId,
          participant.member_id,
          participant.memberId,
          participant.id,
          profile.id,
          profile.user_id,
          profile.userId,
          profile.player_id,
          profile.playerId,
          profile.member_id,
          profile.memberId,
          player.id,
          player.user_id,
          player.userId,
          player.player_id,
          player.playerId,
          player.member_id,
          player.memberId,
          user.id,
          user.user_id,
          user.userId,
          user.player_id,
          user.playerId,
          user.member_id,
          user.memberId,
          member.id,
          member.user_id,
          member.userId,
          member.player_id,
          member.playerId,
          member.member_id,
          member.memberId,
          contact.id,
          contact.user_id,
          contact.userId,
          contact.player_id,
          contact.playerId,
          contact.member_id,
          contact.memberId,
        ];
      };

      for (const participant of participants) {
        if (!participant || typeof participant !== "object") continue;
        const isHostParticipant = (() => {
          if (typeof participant.status === "string") {
            const status = participant.status.trim().toLowerCase();
            if (status === "hosting" || status === "host") {
              return true;
            }
          }
          return participantIdentityCandidates(participant).some((candidate) =>
            hostIds.some((hostId) => idsMatch(candidate, hostId)),
          );
        })();
        if (isHostParticipant) {
          continue;
        }

        const phoneRaw = getParticipantPhone(participant);
        const normalized = normalizePhoneValue(phoneRaw);
        if (!normalized || seen.has(normalized)) {
          continue;
        }
        seen.add(normalized);
        recipients.push(normalized);
      }

      return recipients;
    }, [hostIdentityIds, isHosted, match.participants]);

    const canMessageGroup = participantPhoneRecipients.length > 0;
    const messageGroupLabel = participantPhoneRecipients.length === 1 ? "Message player" : "Message group";
    const messageGroupDescription = canMessageGroup
      ? participantPhoneRecipients.length === 1
        ? "Start a text thread with the confirmed player."
        : `Start a group text with ${participantPhoneRecipients.length} players.`
      : "Add player phone numbers to enable group texts.";

    const handleMessageGroup = useCallback(
      (event) => {
        event?.stopPropagation?.();
        if (!canMessageGroup) {
          displayToast(messageGroupDescription, "info");
          return;
        }
        try {
          const recipients = participantPhoneRecipients;
          const ua =
            typeof navigator !== "undefined" && navigator.userAgent
              ? navigator.userAgent
              : "";
          const isAndroid = /Android/i.test(ua);
          const isAppleMobile = /(iPad|iPhone|iPod)/i.test(ua);

          let url = "sms:";
          if (recipients.length > 0) {
            if (isAndroid) {
              const path = recipients.map((value) => encodeURIComponent(value)).join(";");
              const addresses = encodeURIComponent(recipients.join(";"));
              url = `smsto:${path}?addresses=${addresses}`;
            } else if (isAppleMobile) {
              const addresses = encodeURIComponent(recipients.join(","));
              url = `sms:&addresses=${addresses}`;
            } else {
              const path = recipients.map((value) => encodeURIComponent(value)).join(",");
              url = `sms:${path}`;
            }
          }

          const toastMessage = isAppleMobile ? "Opening Messages..." : "Opening messages...";
          displayToast(toastMessage, "info");
          if (typeof window !== "undefined") {
            window.location.href = url;
          }
        } catch (error) {
          console.error(error);
          displayToast("We couldn't open messages", "error");
        }
      },
      [canMessageGroup, displayToast, messageGroupDescription, participantPhoneRecipients],
    );

    const [showRecommendations, setShowRecommendations] = useState(false);
    const [recommendationStatus, setRecommendationStatus] = useState("idle");
    const [recommendationError, setRecommendationError] = useState("");
    const [recommendations, setRecommendations] = useState([]);
    const [inviteProgress, setInviteProgress] = useState({});

    const loadRecommendations = useCallback(async () => {
      if (!hasLowOccupancyAlert) return;
      if (!currentUser) {
        setRecommendationStatus("empty");
        setRecommendationError("");
        return;
      }
      setRecommendationStatus("loading");
      setRecommendationError("");

      const suggestionMeta = new Map();
      let suggestedIds = [];

      try {
        const history = await listMatches("my", { perPage: 25 });
        const matches = Array.isArray(history?.matches) ? history.matches : [];
        const suggestions = buildRecentPartnerSuggestions({
          matches,
          currentUser,
          memberIdentities: memberIdentityIds,
        });
        suggestedIds = suggestions
          .map((player) => Number(player.user_id))
          .filter(
            (id) => Number.isFinite(id) && id > 0 && !existingPlayerIds.has(id),
          );
        suggestions.forEach((suggestion) => {
          const id = Number(suggestion.user_id);
          if (Number.isFinite(id) && id > 0) {
            suggestionMeta.set(id, suggestion);
          }
        });
      } catch (historyError) {
        console.error("Failed to load match history for suggestions", historyError);
      }

      try {
        let players = [];
        if (suggestedIds.length > 0) {
          const limitedIds = suggestedIds.slice(0, 12);
          const data = await searchPlayers({ ids: limitedIds, perPage: limitedIds.length });
          players = Array.isArray(data?.players) ? data.players : [];
        }

        if (!players.length) {
          const fallbackTerm = (() => {
            if (typeof match.skillLevel === "string" && match.skillLevel.trim()) {
              const [ntrp] = match.skillLevel.split(" - ");
              return ntrp || match.skillLevel;
            }
            if (typeof match.format === "string" && match.format.trim()) {
              return match.format;
            }
            return "tennis";
          })();
          const fallback = await searchPlayers({ search: fallbackTerm, perPage: 12 });
          players = Array.isArray(fallback?.players) ? fallback.players : [];
        }

        const filtered = players.filter((player) => {
          const pid = Number(
            player?.user_id ??
              player?.id ??
              player?.player_id ??
              player?.playerId ??
              player?.profile?.player_id ??
              player?.profile?.id,
          );
          if (!Number.isFinite(pid) || pid <= 0) return false;
          if (existingPlayerIds.has(pid)) return false;
          if (currentUser && memberMatchesAnyId(currentUser, pid, memberIdentityIds)) {
            return false;
          }
          return true;
        });

        if (filtered.length === 0) {
          setRecommendations([]);
          setRecommendationStatus("empty");
          return;
        }

        const limitedFiltered = filtered.slice(0, 6).map((player) => {
          const pid = Number(
            player?.user_id ??
              player?.id ??
              player?.player_id ??
              player?.playerId ??
              player?.profile?.player_id ??
              player?.profile?.id,
          );
          const meta = Number.isFinite(pid) ? suggestionMeta.get(pid) : null;
          if (meta && meta.lastPlayedAt) {
            return { ...player, lastPlayedAt: meta.lastPlayedAt };
          }
          return player;
        });

        setRecommendations(limitedFiltered);
        setRecommendationStatus("ready");
      } catch (error) {
        console.error("Failed to load recommendations", error);
        setRecommendationError(
          error?.response?.data?.message ||
            error?.message ||
            "Failed to load recommendations",
        );
        setRecommendationStatus("error");
      }
    }, [
      currentUser,
      existingPlayerIds,
      hasLowOccupancyAlert,
      match.format,
      match.skillLevel,
      memberIdentityIds,
    ]);

    useEffect(() => {
      if (showRecommendations && recommendationStatus === "idle") {
        loadRecommendations();
      }
    }, [loadRecommendations, recommendationStatus, showRecommendations]);

    useEffect(() => {
      setShowRecommendations(false);
      setRecommendationStatus("idle");
      setRecommendationError("");
      setRecommendations([]);
      setInviteProgress({});
    }, [match.id]);

    const handleQuickInvite = useCallback(
      async (player) => {
        const pid = Number(
          player?.user_id ??
            player?.id ??
            player?.player_id ??
            player?.playerId ??
            player?.profile?.player_id ??
            player?.profile?.id,
        );
        if (!Number.isFinite(pid) || pid <= 0) {
          displayToast("We couldn't determine this player's account", "error");
          return;
        }

        setInviteProgress((prev) => ({ ...prev, [pid]: "sending" }));

        try {
          await sendInvites(match.id, { playerIds: [pid] });
          setInviteProgress((prev) => ({ ...prev, [pid]: "sent" }));
          setRecommendations((prev) =>
            prev.filter((candidate) => {
              const candidateId = Number(
                candidate?.user_id ??
                  candidate?.id ??
                  candidate?.player_id ??
                  candidate?.playerId ??
                  candidate?.profile?.player_id ??
                  candidate?.profile?.id,
              );
              return candidateId !== pid;
            }),
          );
          displayToast(
            `Invite sent to ${
              player?.full_name || player?.name || `Player ${pid}`
            }!`,
          );
          fetchMatches();
        } catch (error) {
          console.error("Failed to send invite", error);
          setInviteProgress((prev) => ({ ...prev, [pid]: "error" }));
          displayToast(
            error?.response?.data?.message ||
              error?.message ||
              "Failed to send invite",
            "error",
          );
        }
      },
      [displayToast, fetchMatches, match.id],
    );

    const getNTRPDisplay = (skillLevel) => {
      if (!skillLevel || skillLevel === "Any Level") return null;
      const ntrp = skillLevel.split(" - ")[0];
      return ntrp;
    };

    const formatDistance = (value) => {
      if (!Number.isFinite(value)) return null;
      const normalized = Math.round(value * 10) / 10;
      const display = Number.isInteger(normalized)
        ? normalized.toString()
        : normalized.toFixed(1);
      const plural = Math.abs(normalized - 1) < 0.05 ? "" : "s";
      return `${display} mile${plural} away`;
    };

    const distanceLabel = formatDistance(match.distanceMiles);
    const locationSubtitle = distanceLabel
      ? distanceLabel
      : hasLocationFilter
      ? "Distance unavailable"
      : match.mapUrl
      ? "Tap for directions"
      : "Location details coming soon";

    return (
      <div
        className={`bg-white rounded-2xl shadow-sm transition-all p-6 border border-gray-100 group ${
          isArchived ? "opacity-90" : "hover:shadow-2xl hover:scale-[1.02]"
        }`}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {match.privacy === "open" && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200 rounded-full text-xs font-black flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                OPEN
              </span>
            )}
            {match.privacy === "private" && (
              <span className="px-3 py-1.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-full text-xs font-black">
                PRIVATE
              </span>
            )}
            {statusValue === "draft" && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-yellow-50 to-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-black">
                DRAFT
              </span>
            )}
            {statusValue === "cancelled" && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200 rounded-full text-xs font-black">
                CANCELLED
              </span>
            )}
            {isArchived && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border border-slate-300 rounded-full text-xs font-black">
                ARCHIVED
              </span>
            )}
            {isHosted && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 border border-violet-200 rounded-full text-xs font-black">
                HOSTING
              </span>
            )}
            {isJoined && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 rounded-full text-xs font-black">
                PLAYING
              </span>
            )}
          </div>
          {(isHosted || isJoined) && !isArchived && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMatchMenu(showMatchMenu === match.id ? null : match.id);
              }}
              className="relative rounded-lg p-2 transition-colors hover:bg-gray-100"
            >
              <MoreVertical className="w-4 h-4 text-gray-400" />
              {showMatchMenu === match.id && (
                <MatchMenu
                  type={isHosted ? "host" : "player"}
                  matchId={match.id}
                  onClose={() => setShowMatchMenu(null)}
                />
              )}
            </button>
          )}
        </div>

        {hasLowOccupancyAlert && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-sm font-black text-amber-900">
                    Need {spotsNeeded}{" "}
                    {spotsNeeded === 1 ? "player" : "players"}{" "}
                    {timeUntilStartLabel || "soon"}
                  </p>
                  <p className="text-xs font-semibold text-amber-700">
                    Roster: {rosterCount}
                    {playerLimit ? ` / ${playerLimit}` : ""} players confirmed
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => openInviteScreen(match.id)}
                    className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-50"
                  >
                    Manage invites
                  </button>
                  <button
                    onClick={() => setShowRecommendations((prev) => !prev)}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow transition-colors hover:bg-amber-600"
                  >
                    <Sparkles className="h-4 w-4" />
                    {showRecommendations ? "Hide recommendations" : "Smart invite suggestions"}
                  </button>
                </div>
                {showRecommendations && (
                  <div className="space-y-3 rounded-lg bg-white/80 p-3">
                    {recommendationStatus === "loading" ? (
                      <p className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                        <Sparkles className="h-4 w-4 animate-spin" /> Finding likely substitutes…
                      </p>
                    ) : recommendationStatus === "error" ? (
                      <p className="text-xs font-semibold text-red-600">{recommendationError}</p>
                    ) : recommendationStatus === "empty" ? (
                      <p className="text-xs font-semibold text-amber-700">
                        We couldn't find ready-made recommendations. Try the full invite tool for more options.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {recommendations.map((player) => {
                          const pid = Number(
                            player?.user_id ??
                              player?.id ??
                              player?.player_id ??
                              player?.playerId ??
                              player?.profile?.player_id ??
                              player?.profile?.id,
                          );
                          const inviteState = inviteProgress[pid];
                          return (
                            <li
                              key={`${match.id}-${pid}`}
                              className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-100 bg-white/70 px-3 py-2"
                            >
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-black text-amber-800">
                                {getAvatarInitials(player).slice(0, 2)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-amber-900">
                                  {player?.full_name || player?.name || (Number.isFinite(pid) ? `Player ${pid}` : "Unknown player")}
                                </p>
                                {player?.lastPlayedAt && (
                                  <p className="text-[11px] font-semibold text-amber-600">
                                    Last played {formatDateTime(player.lastPlayedAt)}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleQuickInvite(player)}
                                disabled={inviteState === "sending" || inviteState === "sent"}
                                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                                  inviteState === "sent"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : inviteState === "sending"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-amber-500 text-white hover:bg-amber-600"
                                }`}
                              >
                                {inviteState === "sent" ? (
                                  <>
                                    <Check className="h-3.5 w-3.5" /> Sent
                                  </>
                                ) : inviteState === "sending" ? (
                                  "Sending…"
                                ) : (
                                  <>
                                    <Send className="h-3.5 w-3.5" /> Invite
                                  </>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">
                {formatDateTime(match.dateTime)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-pink-100 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">
                {match.location ? (
                  match.mapUrl ? (
                    <a
                      href={match.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {match.location}
                    </a>
                  ) : (
                    match.location
                  )
                ) : (
                  <span className="text-gray-500">Location details coming soon</span>
                )}
              </p>
              <p className="text-xs font-semibold text-gray-500">{locationSubtitle}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">{playerCapacityLabel}</p>
              {match.spotsAvailable !== null && (
                <p className="text-xs font-semibold text-gray-500">
                  {match.spotsAvailable > 0
                    ? `${match.spotsAvailable} spot${
                        match.spotsAvailable === 1 ? "" : "s"
                      } available`
                    : "Roster is full"}
                </p>
              )}
            </div>
          </div>
          {match.skillLevel && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-black text-gray-900">
                  Skill level: {match.skillLevel}
                </p>
                {getNTRPDisplay(match.skillLevel) && (
                  <p className="text-xs font-semibold text-gray-500">
                    Suggested NTRP {getNTRPDisplay(match.skillLevel)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4 mt-4">
          <p className="text-sm font-semibold text-gray-600 mb-3">Actions</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleViewDetails(match.id)}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 sm:w-auto"
            >
              View & manage
            </button>
            {isHosted && !isArchived && (
              <button
                type="button"
                onClick={handleMessageGroup}
                title={messageGroupDescription}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors sm:w-auto ${
                  canMessageGroup
                    ? "border-2 border-purple-200 text-purple-700 hover:border-purple-300 hover:bg-purple-50"
                    : "border-2 border-gray-200 text-gray-400 cursor-not-allowed opacity-60"
                }`}
              >
                <MessageCircle
                  className={`h-4 w-4 ${
                    canMessageGroup ? "text-purple-500" : "text-gray-400"
                  }`}
                />
                {messageGroupLabel}
              </button>
            )}
            {match.type === "available" && isUpcoming && !isArchived && (
              <button
                onClick={async () => {
                  if (!currentUser) {
                    setShowSignInModal(true);
                  } else {
                    try {
                      await joinMatch(match.id);

                      try {
                        const data = await fetchMatchDetailsWithArchivedFallback(
                          match.id,
                        );
                        if (data) {
                          setMatchDetailsOrigin(currentScreen);
                          const viewerInvite = pendingInvites.find((invite) => {
                            const inviteMatchId =
                              invite?.match?.id ?? invite?.match_id ?? invite?.matchId;
                            return matchIdsEqual(inviteMatchId, match.id);
                          });
                          const nextData =
                            viewerInvite && data && typeof data === "object"
                              ? { ...data, viewerInvite }
                              : data;
                          setViewMatch(nextData);
                          setShowMatchDetailsModal(true);
                        }
                      } catch (detailsError) {
                        console.error(detailsError);
                        displayToast(
                          "Joined the match, but we couldn't load the details. Try again in a moment.",
                          "info",
                        );
                      }

                      await Promise.all([
                        fetchMatches(),
                        fetchPendingInvites(),
                      ]);
                    } catch (err) {
                      if (isMatchArchivedError(err)) {
                        displayToast(
                          "This match has been archived. You can't join.",
                          "error",
                        );
                        fetchMatches();
                        return;
                      }

                      const errorCodeRaw =
                        err?.response?.data?.error ||
                        err?.data?.error ||
                        err?.message ||
                        "";
                      const errorCode = errorCodeRaw.toString().trim().toLowerCase();
                      const responseMessage = err?.response?.data?.message || "";
                      const normalizedMessage = responseMessage
                        .toString()
                        .trim()
                        .toLowerCase();

                      if (
                        errorCode === "match_full" ||
                        errorCode === "full" ||
                        normalizedMessage.includes("full")
                      ) {
                        displayToast(
                          "This match is already full. We'll let you know if a spot opens up.",
                          "error",
                        );
                      } else if (
                        errorCode === "already_joined" ||
                        normalizedMessage.includes("already joined")
                      ) {
                        displayToast(
                          "You're already on the roster for this match.",
                          "info",
                        );
                      } else {
                        displayToast(
                          responseMessage || err?.message || "Failed to join match",
                          "error",
                        );
                      }
                    }
                  }
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl sm:w-auto"
              >
                <Zap className="w-4 h-4" />
                Join match
              </button>
            )}
            {isArchived && (
              <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
                Archived matches are read-only
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };
  const MatchMenu = ({ type, matchId, onClose }) => {
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (!e.target.closest(".match-menu")) {
          onClose();
        }
      };
      setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 0);
      return () => document.removeEventListener("click", handleClickOutside);
    }, [onClose]);

    const match = matches.find((m) => m.id === matchId);

    return (
      <div className="match-menu absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
        {type === "host" ? (
          <>
            <button
              onClick={() => {
                const matchToEdit = matches.find((m) => m.id === matchId);
                if (matchToEdit) {
                  setEditMatch({
                    id: matchToEdit.id,
                    dateTime: new Date(matchToEdit.dateTime)
                      .toISOString()
                      .slice(0, 16),
                    location: matchToEdit.location,
                    notes: matchToEdit.notes || "",
                  });
                  setShowEditModal(true);
                }
                onClose();
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Settings className="w-4 h-4 text-gray-500" /> Edit Match
            </button>
            <button
              onClick={() => {
                displayToast("Sending reminders...");
                onClose();
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Bell className="w-4 h-4 text-gray-500" /> Send Reminder
            </button>
            <button
              onClick={() => {
                setParticipantsMatchId(matchId);
                setShowParticipantsModal(true);
                onClose();
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Users className="w-4 h-4 text-gray-500" /> Manage Participants
            </button>
            {match?.status === "draft" && (
              <button
                onClick={async () => {
                  try {
                    await updateMatch(matchId, { status: "upcoming" });
                    displayToast("Match published");
                    onClose();
                    fetchMatches();
                  } catch (err) {
                    if (isMatchArchivedError(err)) {
                      displayToast(
                        "This match has been archived and can no longer be published.",
                        "error",
                      );
                      fetchMatches();
                    } else {
                      displayToast(
                        err.response?.data?.message || "Failed to publish match",
                        "error",
                      );
                    }
                  }
                }}
                className="w-full px-4 py-3 text-left text-sm font-bold text-green-700 hover:bg-green-50 flex items-center gap-2 transition-colors"
              >
                <Zap className="w-4 h-4 text-green-500" /> Publish Match
              </button>
            )}
            <button
              onClick={() => {
                openInviteScreen(matchId, { onClose });
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4 text-gray-500" /> Invite More
            </button>
            <div className="border-t border-gray-100" />
            <button
              onClick={async () => {
                try {
                  await cancelMatch(matchId);
                  displayToast("Match cancelled");
                  onClose();
                  fetchMatches();
                } catch (err) {
                  if (isMatchArchivedError(err)) {
                    displayToast(
                      "This match has been archived. There is nothing to cancel.",
                      "error",
                    );
                    fetchMatches();
                  } else {
                    displayToast(
                      err.response?.data?.message || "Failed to cancel match",
                      "error",
                    );
                  }
                }
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
            >
              <X className="w-4 h-4" /> Cancel Match
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                handleViewDetails(matchId);
                onClose();
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Calendar className="w-4 h-4 text-gray-500" /> View & manage
            </button>
            <button
              onClick={() => {
                displayToast("Opening chat...");
                onClose();
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-gray-500" /> Contact Host
            </button>
            <div className="border-t border-gray-100" />
            <button
              onClick={async () => {
                try {
                  await leaveMatch(matchId);
                  setMatches((prevMatches) => {
                    if (!Array.isArray(prevMatches)) return prevMatches;
                    const updated = [];
                    for (const match of prevMatches) {
                      if (!match || match.id !== matchId) {
                        updated.push(match);
                        continue;
                      }
                      const pruned = pruneParticipantFromMatchData(
                        match,
                        memberIdentityIds,
                      );
                      const participants = Array.isArray(pruned?.participants)
                        ? pruned.participants
                        : Array.isArray(match.participants)
                        ? match.participants
                        : [];
                      const invitees = Array.isArray(pruned?.invitees)
                        ? pruned.invitees
                        : Array.isArray(match.invitees)
                        ? match.invitees
                        : [];
                      const occupied = countUniqueMatchOccupants(
                        participants,
                        invitees,
                      );
                      const playerLimit = Number.isFinite(match.playerLimit)
                        ? match.playerLimit
                        : Number.isFinite(pruned?.playerLimit)
                        ? pruned.playerLimit
                        : null;
                      const spotsAvailable =
                        playerLimit !== null
                          ? Math.max(playerLimit - occupied, 0)
                          : pruned?.spotsAvailable ??
                            match.spotsAvailable ??
                            null;
                      const nextMatch = {
                        ...match,
                        ...pruned,
                        type: match.type === "hosted" ? "hosted" : "available",
                        occupied,
                        spotsAvailable,
                      };
                      if (activeFilter === "joined" && nextMatch.type !== "hosted") {
                        continue;
                      }
                      updated.push(nextMatch);
                    }
                    return updated;
                  });
                  displayToast("Left match");
                  onClose();
                  fetchMatches();
                } catch (err) {
                  if (isMatchArchivedError(err)) {
                    displayToast(
                      "This match has been archived. You are no longer on the roster.",
                      "error",
                    );
                    fetchMatches();
                  } else {
                    displayToast(
                      err.response?.data?.message || "Failed to leave match",
                      "error",
                    );
                  }
                }
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-orange-600 hover:bg-orange-50 flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Leave Match
            </button>
          </>
        )}
      </div>
    );
  };

  const CreateMatchScreen = () => {
    const [recentLocations, setRecentLocations] = useState(() => loadStoredLocations());

    useEffect(() => {
      const syncRecentLocations = () => {
        setRecentLocations(loadStoredLocations());
      };

      syncRecentLocations();

      if (typeof window === "undefined") {
        return undefined;
      }

      window.addEventListener("storage", syncRecentLocations);
      window.addEventListener(RECENT_LOCATIONS_EVENT, syncRecentLocations);

      return () => {
        window.removeEventListener("storage", syncRecentLocations);
        window.removeEventListener(RECENT_LOCATIONS_EVENT, syncRecentLocations);
      };
    }, [loadStoredLocations, setRecentLocations]);

    const recordRecentLocation = useCallback(
      (locationLabel, latitude, longitude) => {
        const updated = persistRecentLocation(locationLabel, latitude, longitude);
        setRecentLocations(updated);
      },
      [persistRecentLocation, setRecentLocations],
    );

    const handleUseRecentLocation = useCallback(
      (entry) => {
        if (!entry?.label) return;
        const latitude = typeof entry.latitude === "number" ? entry.latitude : null;
        const longitude = typeof entry.longitude === "number" ? entry.longitude : null;
        setMatchData((prev) => ({
          ...prev,
          location: entry.label,
          latitude,
          longitude,
          mapUrl: buildMapsUrl(latitude, longitude, entry.label),
        }));
      },
      [setMatchData, buildMapsUrl],
    );

    const ProgressBar = () => (
      <div className="flex justify-between items-center mb-10 relative">
        <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 rounded-full" />
        <div
          className="absolute top-4 left-0 h-1 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-500"
          style={{
            width: `${
              ((createStep - 1) / ((matchData.type === "closed" ? 2 : 3) - 1)) *
              100
            }%`,
          }}
        />
        {[1, 2, matchData.type === "closed" ? null : 3]
          .filter(Boolean)
          .map((step) => (
            <div
              key={step}
              className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                step < createStep
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-xl scale-110"
                  : step === createStep
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-xl ring-4 ring-green-100 scale-110"
                  : "bg-white border-2 border-gray-200 text-gray-400"
              }`}
            >
              {step < createStep ? <Check className="w-6 h-6" /> : step}
            </div>
          ))}
      </div>
    );

    const buildMatchPayload = (status) => {
      let isoDate;
      if (matchData.dateTime) {
        const parsed = new Date(matchData.dateTime);
        if (!Number.isNaN(parsed.getTime())) {
          isoDate = parsed.toISOString();
        }
      }

      const privacy = matchData.type === "closed" ? "private" : "open";
      const skillLevelValue =
        matchData.type === "closed"
          ? DEFAULT_SKILL_LEVEL
          : matchData.skillLevel || undefined;

      const basePayload = {
        status,
        match_type: privacy,
        start_date_time: isoDate,
        dateTime: isoDate,
        location_text: matchData.location || undefined,
        location: matchData.location || undefined,
        latitude: matchData.latitude ?? undefined,
        longitude: matchData.longitude ?? undefined,
        player_limit: matchData.playerCount,
        playerCount: matchData.playerCount,
        skill_level_min: skillLevelValue,
        skillLevel: skillLevelValue,
        match_format: matchData.format || undefined,
        format: matchData.format || undefined,
        notes: matchData.notes || undefined,
      };

      return Object.fromEntries(
        Object.entries(basePayload).filter(([, value]) => value !== undefined)
      );
    };

    const createMatchWithCompatibility = async (payload) => {
      try {
        return await createMatch(payload);
      } catch (err) {
        const message = (
          err.response?.data?.message ||
          err.response?.data ||
          err.message ||
          ""
        ).toLowerCase();
        const hasStatusFields = payload.status && payload.match_type;
        if (hasStatusFields && message.includes("match_status_enum")) {
          const fallbackPayload = {
            ...payload,
            status: payload.match_type,
            match_type: payload.status,
          };

          return await createMatch(fallbackPayload);
        }

        throw err;
      }
    };

    const handlePublish = async () => {
      try {
        const payload = buildMatchPayload("upcoming");
        await createMatchWithCompatibility(payload);
        if (matchData.location) {
          recordRecentLocation(matchData.location, matchData.latitude, matchData.longitude);
        }
        displayToast("Match published successfully! 🎾");
        goToBrowse();
        setCreateStep(1);
        setShowPreview(false);
        fetchMatches();
      } catch (err) {
        displayToast(
          err.response?.data?.message || err.message || "Failed to publish match",
          "error"
        );
      }
    };

    // Preview Screen for Closed Matches
    if (showPreview && matchData.type === "closed") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 pb-20">
          <div className="max-w-2xl mx-auto p-6">
            <h2 className="text-3xl font-black text-gray-900 mb-8">
              Review Match Details
            </h2>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
              <div className="mb-4">
                <span className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 rounded-full text-xs font-black">
                  PRIVATE MATCH • INVITE ONLY
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-6 h-6 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                      WHEN
                    </h3>
                    <p className="font-black text-gray-900 text-lg">
                      {formatDateTime(matchData.dateTime)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-6 h-6 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                      WHERE
                    </h3>
                    <p className="font-black text-gray-900 text-lg">
                      <a
                        href={matchData.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {matchData.location}
                      </a>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="w-6 h-6 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                      DETAILS
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-gray-900 text-lg">
                        {matchData.playerCount} players
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="font-black text-gray-900 text-lg">
                        {matchData.format}
                      </span>
                    </div>
                  </div>
                </div>

                {matchData.type === "open" &&
                  matchData.skillLevel &&
                  matchData.skillLevel !== "Any Level" && (
                    <div className="flex items-start gap-3">
                      <Trophy className="w-6 h-6 text-gray-400 mt-0.5" />
                      <div>
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                          SKILL LEVEL
                        </h3>
                        <span className="inline-block px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 rounded-lg text-sm font-black">
                          NTRP {matchData.skillLevel}
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 text-center mb-6 border border-blue-100">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">
                Ready to Invite Players
              </h3>
              <p className="text-base font-semibold text-gray-600">
                You'll need to invite {matchData.playerCount - 1}{" "}
                {matchData.playerCount - 1 === 1 ? "player" : "players"} to join
                this match
              </p>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
              <div className="max-w-2xl mx-auto flex gap-3">
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setCreateStep(2);
                  }}
                  className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={async () => {
                    let targetMatchId = inviteMatchId;
                    if (!targetMatchId) {
                      try {
                        const payload = buildMatchPayload("draft");
                        const created = await createMatchWithCompatibility(
                          payload
                        );
                        const newId =
                          created.match?.id || created.match_id || created.id;
                        if (newId) {
                          targetMatchId = newId;
                          setInviteMatchId(newId);
                          if (matchData.location) {
                            recordRecentLocation(
                              matchData.location,
                              matchData.latitude,
                              matchData.longitude,
                            );
                          }
                          fetchMatches();
                        }
                      } catch (err) {
                        displayToast(
                          err.response?.data?.message ||
                            err.message ||
                            "Failed to create match",
                          "error"
                        );
                        return;
                      }
                    }
                    setShowPreview(false);
                    if (targetMatchId) {
                      await openInviteScreen(targetMatchId);
                    }
                  }}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  CONTINUE <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (createStep === 1) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30 pb-20">
          <div className="max-w-2xl mx-auto p-6">
            <ProgressBar />

            <h2 className="text-3xl font-black text-gray-900 mb-10">
              Create a Match
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-4 uppercase tracking-wider">
                  Match Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    {
                      id: "open",
                      label: "Open Match",
                      desc: "Anyone can join",
                      icon: "🌍",
                      gradient: "from-green-50 to-emerald-50",
                      border: "border-green-300",
                    },
                    {
                      id: "closed",
                      label: "Private Match",
                      desc: "Invite only",
                      icon: "🔒",
                      gradient: "from-blue-50 to-indigo-50",
                      border: "border-blue-300",
                    },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() =>
                        setMatchData((prev) => ({
                          ...prev,
                          type: type.id,
                          skillLevel:
                            type.id === "closed" ? DEFAULT_SKILL_LEVEL : null,
                        }))
                      }
                      className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 ${
                        matchData.type === type.id
                          ? `bg-gradient-to-br ${type.gradient} ${type.border} shadow-xl`
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="text-3xl mb-3">{type.icon}</div>
                      <div className="font-black text-gray-900 mb-1 text-lg">
                        {type.label}
                      </div>
                      <div className="text-xs font-semibold text-gray-600">
                        {type.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={matchData.dateTime}
                  onChange={(e) =>
                    setMatchData((prev) => ({
                      ...prev,
                      dateTime: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">
                  Location
                </label>
                {recentLocations.length > 0 && (
                  <div className="mb-3">
                    <span className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-2">
                      Recent Locations
                    </span>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {recentLocations.map((location) => {
                        const isActive =
                          matchData.location?.trim().toLowerCase() ===
                          location.label.toLowerCase();
                        return (
                          <button
                            key={location.label}
                            type="button"
                            onClick={() => handleUseRecentLocation(location)}
                            className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors whitespace-nowrap flex items-center gap-2 ${
                              isActive
                                ? "bg-green-500 text-white border-green-500"
                                : "bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200"
                            }`}
                          >
                            <MapPin className="w-4 h-4" />
                            {location.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="relative">
                  <MapPin className="absolute left-3 top-4 w-5 h-5 text-gray-400" />
                  <Autocomplete
                    apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
                    type="search"
                    placeholder="e.g., Oceanside Tennis Center"
                    value={matchData.location}
                    onChange={(e) =>
                      setMatchData((prev) => ({
                        ...prev,
                        location: e.target.value,
                        latitude: null,
                        longitude: null,
                        mapUrl: buildMapsUrl(null, null, e.target.value),
                      }))
                    }
                    onPlaceSelected={(place) => {
                      const placeName =
                        typeof place?.name === "string" ? place.name.trim() : "";
                      const formattedAddress =
                        typeof place?.formatted_address === "string"
                          ? place.formatted_address.trim()
                          : "";
                      const lat = place.geometry?.location?.lat?.();
                      const lng = place.geometry?.location?.lng?.();
                      const mapQuery = formattedAddress || placeName || "";
                      setMatchData((prev) => {
                        const nextLocation =
                          placeName || formattedAddress || prev.location || "";
                        const nextLat =
                          typeof lat === "number"
                            ? lat
                            : (prev.latitude ?? null);
                        const nextLng =
                          typeof lng === "number"
                            ? lng
                            : (prev.longitude ?? null);
                        return {
                          ...prev,
                          location: nextLocation,
                          latitude: nextLat,
                          longitude: nextLng,
                          mapUrl: buildMapsUrl(
                            nextLat,
                            nextLng,
                            mapQuery || nextLocation
                          ),
                        };
                      });
                    }}
                    options={{
                      types: ["geocode", "establishment"],
                      fields: [
                        "formatted_address",
                        "geometry",
                        "name",
                        "address_components",
                      ],
                    }}
                    className="w-full pl-11 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800 placeholder:font-semibold"
                  />
                </div>
                <p className="text-xs font-semibold text-gray-500 mt-2">
                  Players will see the exact address after joining
                </p>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-4 uppercase tracking-wider">
                  Number of Players
                </label>
                <div className="flex items-center justify-center gap-10 p-10 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl">
                  <button
                    onClick={() =>
                      setMatchData((prev) => ({
                        ...prev,
                        playerCount: Math.max(2, prev.playerCount - 1),
                      }))
                    }
                    className="w-14 h-14 rounded-full bg-white border-2 border-gray-300 hover:border-green-500 hover:shadow-lg transition-all flex items-center justify-center hover:scale-110"
                  >
                    <span className="text-2xl font-bold text-gray-600">−</span>
                  </button>
                  <div className="text-center">
                    <div className="text-6xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      {matchData.playerCount}
                    </div>
                    <div className="text-base font-bold text-gray-600 mt-2">
                      Total Players
                    </div>
                    <div className="text-sm font-semibold text-gray-500 mt-1">
                      You + {matchData.playerCount - 1}{" "}
                      {matchData.playerCount - 1 === 1 ? "other" : "others"}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setMatchData((prev) => ({
                        ...prev,
                        playerCount: Math.min(8, prev.playerCount + 1),
                      }))
                    }
                    className="w-14 h-14 rounded-full bg-white border-2 border-gray-300 hover:border-green-500 hover:shadow-lg transition-all flex items-center justify-center hover:scale-110"
                  >
                    <span className="text-2xl font-bold text-gray-600">+</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
              <div className="max-w-2xl mx-auto flex gap-3">
                <button
                  onClick={() => {
                    goToBrowse();
                    setShowPreview(false);
                    setCreateStep(1);
                  }}
                  className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => {
                    if (!matchData.location || !matchData.dateTime) {
                      displayToast(
                        "Please fill in all required fields",
                        "error"
                      );
                      return;
                    }
                    setCreateStep(2);
                  }}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  NEXT <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (createStep === 2) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30 pb-20">
          <div className="max-w-2xl mx-auto p-6">
            <ProgressBar />

            <h2 className="text-3xl font-black text-gray-900 mb-10">
              Match Settings
            </h2>

            <div className="space-y-6">
              {matchData.type === "open" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                      NTRP Skill Level
                    </label>
                    <span className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-full font-black">
                      REQUIRED
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        value: "2.5 - Beginner",
                        label: "2.5",
                        desc: "Beginner",
                        color: "from-blue-400 to-blue-500",
                      },
                      {
                        value: "3.0 - Adv. Beginner",
                        label: "3.0",
                        desc: "Developing",
                        color: "from-green-400 to-green-500",
                      },
                      {
                        value: "3.5 - Intermediate",
                        label: "3.5",
                        desc: "Intermediate",
                        color: "from-yellow-400 to-amber-500",
                      },
                      {
                        value: "4.0 - Adv. Intermediate",
                        label: "4.0",
                        desc: "Advanced",
                        color: "from-orange-400 to-orange-500",
                      },
                      {
                        value: "4.5+ - Advanced",
                        label: "4.5+",
                        desc: "Expert",
                        color: "from-red-400 to-red-500",
                      },
                    ].map((level) => (
                      <button
                        key={level.value}
                        onClick={() =>
                          setMatchData((prev) => ({
                            ...prev,
                            skillLevel: level.value,
                          }))
                        }
                        className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                          matchData.skillLevel === level.value
                            ? "border-gray-900 shadow-xl"
                            : "border-gray-200 hover:border-gray-400 bg-white"
                        }`}
                      >
                        <div
                          className={`text-xl font-black mb-1 ${
                            matchData.skillLevel === level.value
                              ? `bg-gradient-to-r ${level.color} bg-clip-text text-transparent`
                              : "text-gray-700"
                          }`}
                        >
                          {level.label}
                        </div>
                        <div className="text-xs font-bold text-gray-600">
                          {level.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs font-semibold text-gray-500 mt-3">
                    Helps players find appropriate skill matches
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">
                  Match Format
                </label>
                <div className="relative">
                  <Trophy className="absolute left-3 top-4 w-5 h-5 text-gray-400" />
                  <select
                    value={matchData.format}
                    onChange={(e) =>
                      setMatchData((prev) => ({
                        ...prev,
                        format: e.target.value,
                      }))
                    }
                    className="w-full pl-11 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors appearance-none bg-white font-bold text-gray-800"
                  >
                    {matchFormatOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">
                  Additional Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Any special instructions, what to bring, parking info..."
                  value={matchData.notes}
                  onChange={(e) =>
                    setMatchData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors resize-none font-semibold text-gray-800 placeholder:font-semibold"
                />
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
              <div className="max-w-2xl mx-auto flex gap-3">
                <button
                  onClick={() => setCreateStep(1)}
                  className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={() => {
                    if (matchData.type === "open" && !matchData.skillLevel) {
                      displayToast("Please select a skill level", "error");
                      return;
                    }
                    if (matchData.type === "closed") {
                      setShowPreview(true);
                    } else {
                      setCreateStep(3);
                    }
                  }}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  NEXT <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (createStep === 3) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30 pb-20">
          <div className="max-w-2xl mx-auto p-6">
            <ProgressBar />

            <h2 className="text-3xl font-black text-gray-900 mb-10">
              Review & Publish
            </h2>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
              <h3 className="font-black text-gray-900 text-lg mb-5">
                MATCH SUMMARY
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-gray-700">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="font-bold text-base">
                    {formatDateTime(matchData.dateTime)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <span className="font-bold text-base">
                    <a
                      href={matchData.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {matchData.location}
                    </a>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <Users className="w-5 h-5 text-gray-400" />
                  <span className="font-bold text-base">
                    {matchData.playerCount} players total
                  </span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <Trophy className="w-5 h-5 text-gray-400" />
                  <span className="font-bold text-base">
                    {matchData.format} •{" "}
                    {matchData.skillLevel &&
                    matchData.skillLevel !== "Any Level"
                      ? `NTRP ${matchData.skillLevel}`
                      : "Any Level"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-10 text-center border border-green-200">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-xl">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">
                Ready to Publish!
              </h3>
              <p className="text-lg font-semibold text-gray-600">
                Your match will be visible to all players in the area
              </p>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
              <div className="max-w-2xl mx-auto flex gap-3">
                <button
                  onClick={() => setCreateStep(2)}
                  className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={handlePublish}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  PUBLISH <Check className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null; // Add a null return for completeness
  };

  const InviteScreen = ({ matchId, onToast }) => {
    const searchInputRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [players, setPlayers] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const perPage = 12;
    const [copiedLink, setCopiedLink] = useState(false);
    const [shareLink, setShareLink] = useState("");
    const [participants, setParticipants] = useState([]);
    const [participantsLoading, setParticipantsLoading] = useState(false);
    const [participantsError, setParticipantsError] = useState("");
    const [hostId, setHostId] = useState(null);
    const [suggestedPlayers, setSuggestedPlayers] = useState([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [suggestionsError, setSuggestionsError] = useState("");

    const matchType =
      typeof matchData?.type === "string" ? matchData.type.toLowerCase() : "";
    const isPrivateMatch = matchType === "closed" || matchType === "private";

    // Local state for manual phone invites (isolated from search input)
    const [localContactName, setLocalContactName] = useState("");
    const [localContactPhone, setLocalContactPhone] = useState("");
    const [localContactError, setLocalContactError] = useState("");

    const addManualContact = () => {
      setLocalContactError("");
      const normalized = normalizePhoneValue(localContactPhone);
      if (!normalized) {
        setLocalContactError(
          "Enter a valid phone number with country code or 10 digits."
        );
        return;
      }
      if (manualContacts.has(normalized)) {
        setLocalContactError("That phone number is already selected.");
        return;
      }
      const name = localContactName.trim();
      setManualContacts((prev) => {
        const next = new Map(prev);
        next.set(normalized, {
          key: normalized,
          phone: normalized,
          name,
        });
        return next;
      });
      setLocalContactName("");
      setLocalContactPhone("");
    };

    const handleRemoveManualContact = (key) => {
      setManualContacts((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    };

    const buildShareMessage = () => {
      const parts = [];
      const host = matchData.hostName || currentUser?.name || currentUser?.email || "";
      parts.push("You're invited to a tennis match!");
      if (host) parts.push(`Host: ${host}`);
      if (matchData.dateTime) parts.push(`When: ${formatDateTime(matchData.dateTime)}`);
      if (matchData.location) parts.push(`Where: ${matchData.location}`);
      if (matchData.format) parts.push(`Format: ${matchData.format}`);
      if (matchData.skillLevel && matchData.skillLevel !== "Any Level") {
        parts.push(`Level: NTRP ${matchData.skillLevel}`);
      }
      if (matchData.playerCount) parts.push(`Players: ${matchData.playerCount}`);
      if (shareLink) parts.push(`Join here: ${shareLink}`);
      return parts.join("\n");
    };

    const buildEmailSubject = () => {
      const when = matchData.dateTime ? ` – ${formatDateTime(matchData.dateTime)}` : "";
      return `Tennis Match Invite${when}`;
    };

    const openWhatsApp = () => {
      if (!shareLink) return;
      const text = encodeURIComponent(buildShareMessage());
      const url = `https://wa.me/?text=${text}`;
      onToast("Opening WhatsApp...");
      window.open(url, "_blank");
    };

    const openSMS = () => {
      if (!shareLink) return;
      const body = encodeURIComponent(buildShareMessage());
      // Using query parameter form to maximize cross-platform support
      const url = `sms:?body=${body}`;
      onToast("Opening messages...");
      window.location.href = url;
    };

    const openEmail = () => {
      if (!shareLink) return;
      const subject = encodeURIComponent(buildEmailSubject());
      const body = encodeURIComponent(buildShareMessage());
      const url = `mailto:?subject=${subject}&body=${body}`;
      onToast("Opening email...");
      window.location.href = url;
    };

    const copyLink = () => {
      if (!shareLink) return;
      navigator.clipboard.writeText(shareLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    };

    const fetchSuggestedPlayers = useCallback(
      async (aliveCheck = () => true) => {
        if (!aliveCheck()) return;
        if (!isPrivateMatch || !currentUser) {
          if (aliveCheck()) {
            setSuggestedPlayers([]);
            setSuggestionsError("");
            setSuggestionsLoading(false);
          }
          return;
        }

        setSuggestionsLoading(true);
        setSuggestionsError("");

        try {
          const data = await listMatches("my", { perPage: 25 });
          if (!aliveCheck()) return;
          const matches = Array.isArray(data?.matches) ? data.matches : [];
          const suggestions = buildRecentPartnerSuggestions({
            matches,
            currentUser,
            memberIdentities: memberIdentityIds,
          });
          if (!aliveCheck()) return;
          setSuggestedPlayers(suggestions);
        } catch (error) {
          console.error("Failed to load suggested players", error);
          if (!aliveCheck()) return;
          setSuggestedPlayers([]);
          setSuggestionsError(
            "We couldn't load suggestions right now. Try refreshing.",
          );
        } finally {
          if (aliveCheck()) {
            setSuggestionsLoading(false);
          }
        }
      },
      [isPrivateMatch, currentUser, memberIdentityIds],
    );

    const toastShareError = React.useCallback(
      (error) => {
        onToast(
          error?.response?.data?.message || "Failed to generate share link",
          "error",
        );
      },
      [onToast],
    );

    useEffect(() => {
      if (!matchId) return;
      getShareLink(matchId)
        .then(({ shareUrl }) => setShareLink(shareUrl))
        .catch(toastShareError);
    }, [matchId, toastShareError]);

    // Load current participants for the match being invited
    useEffect(() => {
      if (!matchId) return;
      let alive = true;
      (async () => {
        try {
          setParticipantsLoading(true);
          setParticipantsError("");
          const data = await getMatch(matchId);
          if (!alive) return;
          if (data.match?.status === "archived") {
            setParticipants([]);
            setParticipantsError("This match has been archived.");
            onToast("This match has been archived. Invites are read-only.", "error");
            return;
          }
          setParticipants(uniqueActiveParticipants(data.participants));
          setHostId(data.match?.host_id ?? null);
        } catch (error) {
          console.error(error);
          if (!alive) return;
          setParticipants([]);
          if (isMatchArchivedError(error)) {
            setParticipantsError("This match has been archived.");
            onToast("This match has been archived. Invites are read-only.", "error");
          } else {
            setParticipantsError("Failed to load participants");
          }
        } finally {
          if (alive) setParticipantsLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [matchId, onToast]);

    useEffect(() => {
      const shouldSearch =
        (!isPrivateMatch && (searchTerm === "" || searchTerm.length >= 2)) ||
        (isPrivateMatch && searchTerm.length >= 2);

      if (shouldSearch) {
        searchPlayers({ search: searchTerm, page, perPage })
          .then((data) => {
            setPlayers(data.players || []);
            setPagination(data.pagination);
          })
          .catch((err) =>
            onToast(
              err.response?.data?.message || "Failed to load players",
              "error"
            )
          );
      } else {
        setPlayers([]);
        setPagination(null);
      }
    }, [searchTerm, page, onToast, isPrivateMatch]);

    // Focus the search box when the invite screen opens, but don't steal focus
    // from other inputs (like the phone contact form) while the host is typing.
    useEffect(() => {
      const input = searchInputRef.current;
      if (!input) return;
      const activeElement = document.activeElement;
      const isEditingAnotherField =
        activeElement &&
        activeElement !== input &&
        ((activeElement.tagName === "INPUT" && activeElement.type !== "hidden") ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.isContentEditable);
      if (isEditingAnotherField) return;
      input.focus();
    }, []);

    useEffect(() => {
      let alive = true;
      const aliveCheck = () => alive;
      fetchSuggestedPlayers(aliveCheck);
      return () => {
        alive = false;
      };
    }, [fetchSuggestedPlayers, matchId]);

    const filteredSuggestions = useMemo(() => {
      if (!Array.isArray(suggestedPlayers) || suggestedPlayers.length === 0) {
        return [];
      }
      const blockedIds =
        existingPlayerIds instanceof Set
          ? existingPlayerIds
          : new Set(existingPlayerIds || []);
      return suggestedPlayers.filter((player) => {
        const pid = Number(player.user_id);
        if (!Number.isFinite(pid) || pid <= 0) return false;
        if (blockedIds.has(pid)) return false;
        if (selectedPlayers.has(pid)) return false;
        return true;
      });
    }, [suggestedPlayers, existingPlayerIds, selectedPlayers]);

    const topSuggestions = useMemo(
      () => filteredSuggestions.slice(0, 6),
      [filteredSuggestions],
    );

    const handleAddSuggestedPlayer = useCallback(
      (player) => {
        const pid = Number(player.user_id);
        if (!Number.isFinite(pid) || pid <= 0) return;
        setSelectedPlayers((prev) => {
          if (prev.has(pid)) return prev;
          const next = new Map(prev);
          next.set(pid, { ...player, user_id: pid });
          return next;
        });
      },
      [setSelectedPlayers],
    );

    const participantIsHost = (participant) => {
      if (!participant) return false;
      if (hostId) {
        const candidates = [
          participant.player_id,
          participant.playerId,
          participant.id,
          participant.match_participant_id,
          participant.matchParticipantId,
        ];
        return candidates.some((value) => idsMatch(value, hostId));
      }
      return memberMatchesParticipant(currentUser, participant, memberIdentityIds);
    };

    const canRemove = (pid) => {
      const host = hostId ?? currentUser?.id ?? null;
      if (!host) return false;
      const isHost = memberMatchesAnyId(currentUser, host, memberIdentityIds);
      if (!isHost) return false;
      return !memberMatchesAnyId(currentUser, pid, memberIdentityIds);
    };

    const handleRemoveParticipant = async (playerId) => {
      if (!matchId) return;
      if (!window.confirm("Remove this participant from the match?")) return;
        try {
          await removeParticipant(matchId, playerId);
          setParticipants((prev) =>
            prev.filter((p) => !idsMatch(p.player_id, playerId)),
          );
        setExistingPlayerIds((prev) => {
          const next = new Set([...prev]);
          next.delete(playerId);
          return next;
        });
        setMatchData((prev) => ({
          ...prev,
          occupied: Math.max((prev.occupied || 1) - 1, 0),
        }));
        onToast("Participant removed");
      } catch (err) {
        onToast(
          err?.response?.data?.message || "Failed to remove participant",
          "error"
        );
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 pb-20">
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
            <h2 className="text-3xl font-black text-gray-900 mb-3">
              Invite Players
            </h2>
            <p className="text-lg font-semibold text-gray-600 mb-4">
              Need {matchData.playerCount - matchData.occupied} more{" "}
              {matchData.playerCount - matchData.occupied === 1
                ? "player"
                : "players"}
            </p>
            <div className="flex items-center gap-4 text-sm font-bold text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDateTime(matchData.dateTime)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <a
                  href={matchData.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {matchData.location}
                </a>
              </span>
              {matchData.hostName && (
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  Host: {matchData.hostName}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {/* Current Participants */}
            {!isPrivateMatch && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4" /> Current Participants
                </h3>
                {participantsLoading ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : participantsError ? (
                  <p className="text-sm text-red-600">{participantsError}</p>
                ) : participants.length ? (
                  <ul className="divide-y divide-gray-100 border rounded-xl">
                    {participants.map((p) => (
                      <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-gray-800">
                          {p.profile?.full_name || `Player ${p.player_id}`}
                          {participantIsHost(p) && (
                            <span className="ml-2 text-blue-700 text-xs font-bold">Host</span>
                          )}
                        </span>
                        {canRemove(p.player_id) ? (
                          <button
                            onClick={() => handleRemoveParticipant(p.player_id)}
                            className="px-2 py-1 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50 flex items-center gap-1"
                          >
                            <X className="w-4 h-4" /> Remove
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">No actions</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No participants yet.</p>
                )}
              </div>
            )}

            {/* Search players to invite */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-black text-gray-900 uppercase tracking-wider mb-3">
                    Search & invite players
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      ref={searchInputRef}
                      type="search"
                      aria-label="Search players"
                      autoComplete="off"
                      placeholder="Search players..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 font-semibold text-gray-800"
                    />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-gray-500">
                    {isPrivateMatch
                      ? "Type at least two letters to search your player list."
                      : "Browse or search the player community to add invitees."}
                  </p>
                </div>

                {isPrivateMatch ? (
                  <div className="space-y-3">
                    {searchTerm.length < 2 ? (
                      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">
                        Start typing a name to search players.
                      </div>
                    ) : players.length > 0 ? (
                      <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
                        {players.map((player) => {
                          const name = player.full_name || "Unknown player";
                          const pid = Number(player.user_id);
                          const selected = Number.isFinite(pid) && selectedPlayers.has(pid);
                          return (
                            <li key={player.user_id}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!Number.isFinite(pid) || pid <= 0) return;
                                  setSelectedPlayers((prev) => {
                                    const next = new Map(prev);
                                    if (next.has(pid)) next.delete(pid);
                                    else next.set(pid, { ...player, user_id: pid });
                                    return next;
                                  });
                                }}
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                                  selected
                                    ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700"
                                    : "bg-white hover:bg-gray-50"
                                }`}
                              >
                                <div
                                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black shadow-md ${
                                    selected
                                      ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white"
                                      : "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700"
                                  }`}
                                >
                                  {name
                                    .split(" ")
                                    .filter(Boolean)
                                    .map((part) => part[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </div>
                                <span className="text-sm font-bold text-gray-700">{name}</span>
                                {selected && <Check className="ml-auto h-4 w-4 text-green-600" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">
                        No players found. Try another search.
                      </div>
                    )}

                    {pagination && pagination.total > pagination.perPage && (
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="rounded-lg border border-gray-200 px-3 py-1 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span>
                          Page {pagination.page} of {Math.ceil(pagination.total / pagination.perPage)}
                        </span>
                        <button
                          onClick={() => setPage((p) => p + 1)}
                          disabled={
                            pagination.page >= Math.ceil(pagination.total / pagination.perPage)
                          }
                          className="rounded-lg border border-gray-200 px-3 py-1 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {players.map((player) => {
                        const name = player.full_name || "Unknown player";
                        const pid = Number(player.user_id);
                        const selected = Number.isFinite(pid) && selectedPlayers.has(pid);
                        return (
                          <button
                            key={player.user_id}
                            onClick={() => {
                              if (!Number.isFinite(pid) || pid <= 0) return;
                              setSelectedPlayers((prev) => {
                                const next = new Map(prev);
                                if (next.has(pid)) next.delete(pid);
                                else next.set(pid, { ...player, user_id: pid });
                                return next;
                              });
                            }}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all hover:scale-105 ${
                              selected
                                ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 shadow-md"
                                : "border-gray-200 hover:border-gray-300 bg-white"
                            }`}
                          >
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-md ${
                                selected
                                  ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white"
                                  : "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700"
                              }`}
                            >
                              {name
                                .split(" ")
                                .filter(Boolean)
                                .map((part) => part[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <span className="text-sm text-gray-700 font-bold">{name}</span>
                            {selected && <Check className="w-4 h-4 text-green-600 ml-auto" />}
                          </button>
                        );
                      })}
                    </div>

                    {pagination && (
                      <div className="flex items-center justify-between mt-4">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-3 py-1.5 rounded-lg border-2 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                          Previous
                        </button>
                        <span className="text-sm font-semibold text-gray-600">
                          Page {pagination.page} of {Math.ceil(pagination.total / pagination.perPage)}
                        </span>
                        <button
                          onClick={() => setPage((p) => p + 1)}
                          disabled={
                            pagination.page >= Math.ceil(pagination.total / pagination.perPage)
                          }
                          className="px-3 py-1.5 rounded-lg border-2 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed border-gray-200 text-gray-700 hover:bg-gray-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {/* Quick Share */}
            {isPrivateMatch ? (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Suggested players
                  </h3>
                  <button
                    type="button"
                    onClick={() => fetchSuggestedPlayers(() => true)}
                    disabled={suggestionsLoading}
                    className="text-xs font-bold text-blue-600 transition-colors hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
                {suggestionsLoading ? (
                  <p className="text-sm text-gray-500">
                    Finding players you've teamed up with recently…
                  </p>
                ) : suggestionsError ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 sm:flex-row sm:items-center sm:justify-between">
                    <span>{suggestionsError}</span>
                    <button
                      type="button"
                      onClick={() => fetchSuggestedPlayers(() => true)}
                      className="text-xs font-bold text-red-700 hover:text-red-800"
                    >
                      Try again
                    </button>
                  </div>
                ) : topSuggestions.length > 0 ? (
                  <ul className="space-y-3">
                    {topSuggestions.map((player) => {
                      const name = player.full_name || "Unknown player";
                      const pid = Number(player.user_id);
                      const selected = Number.isFinite(pid) && selectedPlayers.has(pid);
                      return (
                        <li
                          key={pid}
                          className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3"
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-xs font-black text-gray-700">
                            {name
                              .split(" ")
                              .filter(Boolean)
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-800">{name}</p>
                            {player.lastPlayedAt && (
                              <p className="text-xs font-semibold text-gray-500">
                                Last played {formatDateTime(player.lastPlayedAt)}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddSuggestedPlayer(player)}
                            disabled={selected}
                            className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                              selected
                                ? "bg-gray-100 text-gray-400 cursor-default"
                                : "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-md hover:scale-105"
                            }`}
                          >
                            {selected ? "Added" : "Invite"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-600">
                    We'll suggest partners you recently played with once we have a little more history.
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">
                  Share Link
                </h3>
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600"
                  />
                  <button
                    onClick={copyLink}
                    disabled={!shareLink}
                    className={`px-5 py-3 rounded-xl font-black transition-all ${
                      copiedLink
                        ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                        : "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-xl hover:scale-105 shadow-lg"
                    }`}
                  >
                    {copiedLink ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={openWhatsApp}
                    disabled={!shareLink}
                    className={`py-3 rounded-xl text-sm font-black transition-all border-2 ${
                      shareLink
                        ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-300 hover:shadow-lg hover:scale-105"
                        : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                    }`}
                  >
                    WHATSAPP
                  </button>
                  <button
                    onClick={openSMS}
                    disabled={!shareLink}
                    className={`py-3 rounded-xl text-sm font-black transition-all border-2 ${
                      shareLink
                        ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-300 hover:shadow-lg hover:scale-105"
                        : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                    }`}
                  >
                    SMS
                  </button>
                  <button
                    onClick={openEmail}
                    disabled={!shareLink}
                    className={`py-3 rounded-xl text-sm font-black transition-all border-2 ${
                      shareLink
                        ? "bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border-purple-300 hover:shadow-lg hover:scale-105"
                        : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed"
                    }`}
                  >
                    EMAIL
                  </button>
                </div>
              </div>
            )}

          {/* Selected players display */}
          <form
            className="bg-white rounded-2xl shadow-lg border border-blue-100 p-6 mb-6"
            onSubmit={(e) => {
              e.preventDefault();
              addManualContact();
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                  Invite by phone number
                </h3>
                <p className="text-sm text-gray-600">
                  Enter a mobile number and we'll text them a magic link so they can RSVP
                  instantly.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <input
                type="text"
                value={localContactName}
                onChange={(e) => {
                  setLocalContactName(e.target.value);
                  setLocalContactError("");
                }}
                placeholder="Full name (optional)"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-300"
              />
              <input
                type="tel"
                value={localContactPhone}
                onChange={(e) => {
                  setLocalContactPhone(e.target.value);
                  setLocalContactError("");
                }}
                placeholder="+15551234567"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-300"
              />
            </div>
            {localContactError && (
              <p className="text-xs font-semibold text-red-600 mb-2">{localContactError}</p>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-gray-500">
                Phone-only contacts will still get SMS reminders and a magic-link login.
              </p>
              <button
                type="submit"
                disabled={!localContactPhone.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add contact
              </button>
            </div>
          </form>

          {totalSelectedInvitees > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                    Selected ({totalSelectedInvitees})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlayers(new Map());
                      setManualContacts(new Map());
                      setLocalContactName("");
                      setLocalContactPhone("");
                      setLocalContactError("");
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700 font-bold"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[...selectedPlayers.values()]
                    .filter((p) => Number.isFinite(p.user_id) && p.user_id > 0)
                    .map((player) => (
                    <span
                      key={player.user_id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-full text-sm font-bold text-gray-700"
                    >
                      {player.full_name}
                      {player.hosting && (
                        <span className="ml-1 text-blue-700 text-xs">Host</span>
                      )}
                      {existingPlayerIds.has(player.user_id) && (
                        <span className="ml-1 text-green-700 text-xs">Added</span>
                      )}
                      {!existingPlayerIds.has(player.user_id) && (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPlayers((prev) => {
                              const m = new Map(prev);
                              m.delete(player.user_id);
                              return m;
                            })
                          }
                          className="ml-1 text-green-700 hover:text-green-900"
                          aria-label={`Remove ${player.full_name}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                    ))}
                  {Array.from(manualContacts.values()).map((contact) => (
                    <span
                      key={contact.key}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm font-bold text-blue-700"
                    >
                      {contact.name || formatPhoneDisplay(contact.phone)}
                      <span className="ml-1 text-xs text-blue-500">SMS</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveManualContact(contact.key)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                        aria-label={`Remove ${contact.name || contact.phone}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
              <div className="max-w-2xl mx-auto flex gap-3">
                <button
                  onClick={async () => {
                    onToast("Match saved as draft!");
                    goToBrowse();
                    setShowPreview(false);
                    setCreateStep(1);
                    setSelectedPlayers(new Map());
                    setManualContacts(new Map());
                    setLocalContactName("");
                    setLocalContactPhone("");
                    setLocalContactError("");
                    setExistingPlayerIds(new Set());
                    setInviteMatchId(null);
                    fetchMatches();
                  }}
                  className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors"
                >
                  SAVE FOR LATER
                </button>
                <button
                  onClick={async () => {
                    if (totalSelectedInvitees === 0) {
                      onToast("Please add at least one invitee", "error");
                      return;
                    }
                    if (!matchId) {
                      onToast("No match selected for invites", "error");
                      return;
                    }
                    try {
                      const newIds = Array.from(selectedPlayers.keys())
                        .map((id) => Number(id))
                        .filter(
                          (id) => Number.isFinite(id) && id > 0 && !existingPlayerIds.has(id)
                        );
                      const phoneNumbers = Array.from(manualContacts.values()).map(
                        (contact) =>
                          contact.name
                            ? { phone: contact.phone, fullName: contact.name }
                            : contact.phone
                      );
                      if (newIds.length === 0 && phoneNumbers.length === 0) {
                        onToast("Everyone you picked is already invited", "error");
                        return;
                      }
                      await updateMatch(matchId, { status: "upcoming" });
                      const response = await sendInvites(matchId, {
                        playerIds: newIds,
                        phoneNumbers,
                      });

                      const message = response?.message
                        ? response.message
                        : `Invites sent to ${newIds.length + phoneNumbers.length} ${
                            newIds.length + phoneNumbers.length === 1
                              ? "player"
                              : "players"
                          }! 🎾`;
                      onToast(message);
                      goToBrowse();
                      setSelectedPlayers(new Map());
                      setManualContacts(new Map());
                      setLocalContactName("");
                      setLocalContactPhone("");
                      setLocalContactError("");
                      setExistingPlayerIds(new Set());

                      setShowPreview(false);
                      setCreateStep(1);
                      setInviteMatchId(null);
                      fetchMatches();
                    } catch (err) {
                      if (isMatchArchivedError(err)) {
                        onToast(
                          "This match has been archived. Invites can no longer be sent.",
                          "error",
                        );
                        fetchMatches();
                      } else if (
                        err.data?.error === "invalid_phone_numbers" &&
                        Array.isArray(err.data?.details)
                      ) {
                        onToast(
                          `Fix these numbers: ${err.data.details.join(", ")}`,
                          "error",
                        );
                      } else {
                        onToast(
                          err.response?.data?.message || err.message || "Failed to send invites",
                          "error",
                        );
                      }
                    }
                }}
                className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Send className="w-5 h-5" />
                SEND INVITES
                {totalSelectedInvitees > 0 && ` (${totalSelectedInvitees})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SignInModal = () => {
    if (!showSignInModal) return null;

    const overlayClassName =
      "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm sm:items-center sm:py-10";
    const baseModalClassName =
      "relative w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-lg animate-slideUp max-h-[calc(100vh-3rem)] overflow-y-auto";

    const handleOAuthSignIn = (provider) => {
      // Simulate OAuth response
      if (provider === "google") {
        setFormData((prev) => ({
          ...prev,
          name: "John Smith",
          email: "john.smith@gmail.com",
        }));
      } else if (provider === "apple") {
        setFormData((prev) => ({
          ...prev,
          name: "John Smith",
          email: "j.smith@icloud.com",
        }));
      }
      setSignInStep("oauth-complete");
    };

    const completeSignup = async (pwd) => {
      try {
        await performSignup({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: pwd ?? "matchplay",
          skillLevel: formData.skillLevel,
          dateOfBirth: formData.dateOfBirth,
        });
        setShowSignInModal(false);
        setSignInStep("initial");
        setFormData({ name: "", email: "", phone: "", skillLevel: "", dateOfBirth: "" });
        setPassword("");
        setSignupErrors({});
      } catch (error) {
        const fieldErrors = error?.fieldErrors || {};
        setSignupErrors(fieldErrors);
        displayToast(error?.message || "Signup failed", "error");
      }
    };

    // OAuth completion step
    if (signInStep === "oauth-complete") {
      return (
        <div className={overlayClassName}>
          <div className={baseModalClassName}>
            <button
              onClick={() => {
                setSignInStep("initial");
                setFormData({ name: "", email: "", phone: "", skillLevel: "", dateOfBirth: "" });
              }}
              className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSignInModal(false);
                setSignInStep("initial");
                setFormData({ name: "", email: "", phone: "", skillLevel: "", dateOfBirth: "" });
              }}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6 mt-4">
              <h2 className="text-3xl font-black text-gray-900 mb-2">
                Almost Done!
              </h2>
              <p className="text-gray-500 font-semibold">
                Just need a few more details
              </p>
            </div>

            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="text-sm text-green-700">
                  <p className="font-black mb-1">
                    Account connected successfully
                  </p>
                  <p className="font-semibold">Signed in as {formData.email}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                  Mobile Number
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone: formatPhoneNumber(e.target.value),
                    }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                  maxLength="14"
                  autoFocus
                />
                <p className="text-xs font-semibold text-gray-500 mt-2">
                  Required for match coordination and reminders
                </p>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
              </div>

              {/* NTRP Skill Level removed from signup */}

              <button
                onClick={async () => {
                  if (formData.phone) {
                    await completeSignup();
                  } else {
                    displayToast("Please fill in all required fields", "error");
                  }
                }}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all shadow-lg"
              >
                COMPLETE SIGN UP
              </button>
            </div>

            <p className="text-xs text-center text-gray-500 mt-6 font-semibold">
              By continuing, you agree to our Terms of Service and Privacy
              Policy
            </p>
          </div>
        </div>
      );
    }

    // Email/password login step
    if (signInStep === "login") {
      const handleLogin = () => {
        performLogin({ email: formData.email, password })
          .then(() => {
            setShowSignInModal(false);
            setSignInStep("initial");
            setFormData({ name: "", email: "", phone: "", skillLevel: "", dateOfBirth: "" });
            setPassword("");
          })
          .catch((error) => {
            displayToast(
              error?.message || "We couldn't sign you in. Please try again.",
              "error",
            );
          });
      };

      return (
        <div className={overlayClassName}>
          <div className={baseModalClassName}>
            <button
              onClick={() => setSignInStep("initial")}
              className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSignInModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <h2 className="text-3xl font-black text-gray-900 mb-2">Sign In</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
              </div>
              <button
                onClick={handleLogin}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all shadow-lg"
              >
                SIGN IN
              </button>
              <button
                onClick={() => setSignInStep("forgot")}
                className="w-full text-gray-500 text-xs hover:text-gray-700 transition-colors font-bold"
              >
                Forgot password?
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (signInStep === "forgot") {
      return (
        <div className={overlayClassName}>
          <div className={baseModalClassName}>
            <button
              onClick={() => setSignInStep("login")}
              className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSignInModal(false);
                setSignInStep("initial");
              }}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6 mt-4">
              <h2 className="text-3xl font-black text-gray-900 mb-2">Forgot Password</h2>
              <p className="text-gray-500 font-semibold">Enter your account email</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
              </div>
              <button
                onClick={async () => {
                  if (!formData.email?.trim()) {
                    displayToast("Please enter your email", "error");
                    return;
                  }
                  try {
                    await forgotPassword(formData.email.trim());
                    displayToast("If the email exists, a reset link was sent", "success");
                    setSignInStep("login");
                  } catch (err) {
                    displayToast(err?.message || "Failed to send reset link", "error");
                  }
                }}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all shadow-lg"
              >
                SEND RESET LINK
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (signInStep === "form") {
      return (
        <div className={overlayClassName}>
          <div className={baseModalClassName}>
            <button
              onClick={() => {
                setSignInStep("initial");
            setFormData({ name: "", email: "", phone: "", skillLevel: "", dateOfBirth: "" });
              }}
              className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSignInModal(false);
                setSignInStep("initial");
            setFormData({ name: "", email: "", phone: "", skillLevel: "", dateOfBirth: "" });
              }}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6 mt-4">
              <h2 className="text-3xl font-black text-gray-900 mb-2">
                Create Your Account
              </h2>
              <p className="text-gray-500 font-semibold">
                Join the tennis community
              </p>
            </div>

            {/* Phone verification removed */}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                    Full Name
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="John Smith"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                  />
                  {signupErrors.fullName && (
                    <p className="text-xs text-red-600 mt-1">{signupErrors.fullName}</p>
                  )}
                </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                  Email Address
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
                {signupErrors.email && (
                  <p className="text-xs text-red-600 mt-1">{signupErrors.email}</p>
                )}
              </div>

                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                    Mobile Number
                    <span className="ml-1 text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: formatPhoneNumber(e.target.value),
                      }))
                    }
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                    maxLength="14"
                  />
                  <p className="text-xs font-semibold text-gray-500 mt-2">
                    We'll text you match reminders and updates
                  </p>
                  {signupErrors.mobile && (
                    <p className="text-xs text-red-600 mt-1">{signupErrors.mobile}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))
                    }
                    className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                  />
                </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                  Password
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
                {signupErrors.password && (
                  <p className="text-xs text-red-600 mt-1">{signupErrors.password}</p>
                )}
              </div>

              {/* NTRP Skill Level removed from signup */}

              <button
                onClick={async () => {
                  const errors = {};
                  const isValidEmail = (v) => /\S+@\S+\.\S+/.test(v);
                  if (!formData.name?.trim()) errors.fullName = "Please enter your full name";
                  if (!formData.email?.trim()) errors.email = "Please enter your email";
                  else if (!isValidEmail(formData.email)) errors.email = "Please enter a valid email";
                  if (!formData.phone?.trim()) errors.mobile = "Please enter your mobile";
                  if (!password?.trim()) errors.password = "Please enter your password";
                  setSignupErrors(errors);
                  if (Object.keys(errors).length > 0) {
                    displayToast("Please correct the errors", "error");
                    return;
                  }
                  await completeSignup(password);
                }}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all shadow-lg"
              >
                CONTINUE
              </button>
            </div>

            <p className="text-xs text-center text-gray-500 mt-6 font-semibold">
              By continuing, you agree to our Terms of Service and Privacy
              Policy
            </p>
          </div>
        </div>
      );
    }

    // 'verify' step removed

    return (
      <div className={overlayClassName}>
        <div className={baseModalClassName}>
          <button
            onClick={() => {
              setShowSignInModal(false);
              setSignInStep("initial");
              setFormData({ name: "", email: "", phone: "", skillLevel: "", dateOfBirth: "" });
            }}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <span className="text-white text-3xl">🎾</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2 sm:text-3xl">
              Sign in to Matchplay
            </h2>
            <p className="text-gray-500 font-semibold">
              Create and join matches in your area
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                setSignInStep("form");
              }}
              className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Mail className="w-5 h-5" />
              SIGN UP WITH EMAIL
            </button>

            <button
              onClick={() => handleOAuthSignIn("google")}
              className="w-full py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              CONTINUE WITH GOOGLE
            </button>

            <button
              onClick={() => handleOAuthSignIn("apple")}
              className="w-full py-3.5 bg-black text-white rounded-xl font-black hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              CONTINUE WITH APPLE
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-500 font-bold">
                Already have an account?
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setSignInStep("login");
            }}
            className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-black hover:bg-gray-200 transition-colors"
          >
            SIGN IN WITH EXISTING ACCOUNT
          </button>

          <button
            onClick={() => {
              setShowSignInModal(false);
              setSignInStep("initial");
              setFormData({ name: "", email: "", phone: "", skillLevel: "", dateOfBirth: "" });
            }}
            className="w-full text-gray-500 text-sm hover:text-gray-700 transition-colors mt-3 font-bold"
          >
            Continue as guest
          </button>
        </div>
      </div>
    );
  }; // FIX: Removed comma here

  const ParticipantsModal = ({ isOpen, matchId }) => {
    // Always call hooks first; guard inside effects instead of early-returning
    const [participants, setParticipants] = React.useState([]);
    const [hostId, setHostId] = React.useState(null);
    const [loadingParts, setLoadingParts] = React.useState(true);
    const [removeErr, setRemoveErr] = React.useState("");
    const overlayClassName =
      "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm sm:items-center sm:py-10";
    const modalClassName =
      "relative w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-lg animate-slideUp max-h-[calc(100vh-3rem)] overflow-y-auto";

    React.useEffect(() => {
      if (!isOpen || !matchId) return;
      let alive = true;
      (async () => {
        try {
          setLoadingParts(true);
          const data = await getMatch(matchId);
          if (!alive) return;
          if (data.match?.status === "archived") {
            setParticipants([]);
            setRemoveErr("This match has been archived.");
            return;
          }
          setParticipants(uniqueActiveParticipants(data.participants));
          setHostId(data.match?.host_id ?? null);
        } catch (error) {
          console.error(error);
          if (isMatchArchivedError(error)) {
            setRemoveErr("This match has been archived.");
          }
        } finally {
          if (alive) setLoadingParts(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [isOpen, matchId]);

    const participantIsHost = (participant) => {
      if (!participant) return false;
      if (hostId) {
        const candidates = [
          participant.player_id,
          participant.playerId,
          participant.id,
          participant.match_participant_id,
          participant.matchParticipantId,
        ];
        return candidates.some((value) => idsMatch(value, hostId));
      }
      const status =
        participant.status ||
        participant.participant_status ||
        participant.participantStatus ||
        participant.role ||
        "";
      return (
        typeof status === "string" && status.trim().toLowerCase() === "hosting"
      );
    };

    const isHost = (() => {
      if (hostId) {
        return memberMatchesAnyId(currentUser, hostId, memberIdentityIds);
      }
      if (!participants.length) return false;
      return participants.some(
        (participant) =>
          participantIsHost(participant) &&
          memberMatchesParticipant(currentUser, participant, memberIdentityIds),
      );
    })();

    const handleRemoveParticipant = async (playerId) => {
      if (!matchId) return;
      if (!window.confirm("Remove this participant from the match?")) return;
      try {
        await removeParticipant(matchId, playerId);
        setParticipants((prev) =>
          prev.filter((p) => !idsMatch(p.player_id, playerId)),
        );
        setRemoveErr("");
      } catch (error) {
        console.error(error);
        if (isMatchArchivedError(error)) {
          setRemoveErr("This match has been archived. Participants can no longer be managed.");
        } else {
          setRemoveErr("Failed to remove participant");
        }
        setTimeout(() => setRemoveErr(""), 2500);
      }
    };

    if (!isOpen || !matchId) return null;

    return (
      <div className={overlayClassName}>
        <div className={modalClassName}>
          <button
            onClick={() => {
              setShowParticipantsModal(false);
              setParticipantsMatchId(null);
            }}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Manage Participants</h2>
          <p className="text-sm text-gray-500 mb-6 font-semibold">Remove players from this match</p>
          {removeErr && (
            <p className="text-red-600 text-sm font-semibold mb-2">{removeErr}</p>
          )}
          {loadingParts ? (
            <p className="text-sm text-gray-500">Loading participants…</p>
          ) : (
            <div>
              {participants.length ? (
                <ul className="divide-y divide-gray-100 border rounded-xl">
                  {participants.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="text-gray-800">
                        {p.profile?.full_name || `Player ${p.player_id}`}
                        {participantIsHost(p) && (
                          <span className="ml-2 text-blue-700 text-xs font-bold">
                            Host
                          </span>
                        )}
                      </span>
                      {isHost && !participantIsHost(p) ? (
                        <button
                          onClick={() => handleRemoveParticipant(p.player_id)}
                          className="px-2 py-1 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50 flex items-center gap-1"
                        >
                          <X className="w-4 h-4" /> Remove
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">No actions</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">No participants yet.</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => {
                setShowParticipantsModal(false);
                setParticipantsMatchId(null);
              }}
              className="px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    );
  };

  const EditModal = ({ isOpen, matchToEdit }) => {
    // Always call hooks first; guard inside effects instead of early-returning
    // Load participants for the match being edited so hosts can remove players
    const [participants, setParticipants] = React.useState([]);
    const [hostId, setHostId] = React.useState(null);
    const [loadingParts, setLoadingParts] = React.useState(true);
    const [removeErr, setRemoveErr] = React.useState("");

    const overlayClassName =
      "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm sm:items-center sm:py-10";
    const modalClassName =
      "relative w-full max-w-xl rounded-2xl bg-white p-5 sm:p-6 shadow-lg animate-slideUp max-h-[calc(100vh-3rem)] overflow-y-auto";

    React.useEffect(() => {
      if (!isOpen || !matchToEdit?.id) return;
      let alive = true;
      (async () => {
        try {
          setLoadingParts(true);
          const data = await getMatch(matchToEdit.id);
          if (!alive) return;
          if (data.match?.status === "archived") {
            setParticipants([]);
            setRemoveErr("This match has been archived.");
            return;
          }
          setParticipants(uniqueActiveParticipants(data.participants));
          setHostId(data.match?.host_id ?? null);
        } catch (error) {
          console.error(error);
          if (isMatchArchivedError(error)) {
            setRemoveErr("This match has been archived.");
          }
          // ignore; leave list empty
        } finally {
          if (alive) setLoadingParts(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [isOpen, matchToEdit?.id]);

    const participantIsHost = (participant) => {
      if (!participant) return false;
      if (hostId) {
        const candidates = [
          participant.player_id,
          participant.playerId,
          participant.id,
          participant.match_participant_id,
          participant.matchParticipantId,
        ];
        return candidates.some((value) => idsMatch(value, hostId));
      }
      const status =
        participant.status ||
        participant.participant_status ||
        participant.participantStatus ||
        participant.role ||
        "";
      return (
        typeof status === "string" && status.trim().toLowerCase() === "hosting"
      );
    };

    const isHost = (() => {
      if (hostId) {
        return memberMatchesAnyId(currentUser, hostId, memberIdentityIds);
      }
      if (!participants.length) return false;
      return participants.some(
        (participant) =>
          participantIsHost(participant) &&
          memberMatchesParticipant(currentUser, participant, memberIdentityIds),
      );
    })();

    const handleRemoveParticipant = async (playerId) => {
      if (!window.confirm("Remove this participant from the match?")) return;
      try {
        if (!matchToEdit?.id) return;
        await removeParticipant(matchToEdit.id, playerId);
        setParticipants((prev) =>
          prev.filter((p) => !idsMatch(p.player_id, playerId)),
        );
        setRemoveErr("");
      } catch (error) {
        console.error(error);
        if (isMatchArchivedError(error)) {
          setRemoveErr("This match has been archived. Participants can no longer be managed.");
        } else {
          setRemoveErr("Failed to remove participant");
        }
        setTimeout(() => setRemoveErr(""), 2500);
      }
    };

    if (!isOpen || !matchToEdit) return null;

    const handleSave = async () => {
      if (!matchToEdit?.id) return;
      try {
        await updateMatch(matchToEdit.id, {
          start_date_time: new Date(matchToEdit.dateTime).toISOString(),
          location_text: matchToEdit.location,
          latitude: matchToEdit.latitude,
          longitude: matchToEdit.longitude,
          notes: matchToEdit.notes,
        });
        if (matchToEdit.location) {
          persistRecentLocation(
            matchToEdit.location,
            matchToEdit.latitude,
            matchToEdit.longitude,
          );
        }
        displayToast("Match updated successfully!");
        setShowEditModal(false);
        setEditMatch(null);
        fetchMatches();
      } catch (err) {
        displayToast(
          err.response?.data?.message || "Failed to update match",
          "error"
        );
      }
    };

    return (
      <div className={overlayClassName}>
        <div className={modalClassName}>
          <button
            onClick={() => {
              setShowEditModal(false);
              setEditMatch(null);
            }}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Edit Match</h2>
          <p className="text-sm text-gray-500 mb-6 font-semibold">
            Changes will notify all confirmed players
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                Date & Time
              </label>
              <input
                type="datetime-local"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-bold text-gray-800"
                value={matchToEdit.dateTime}
                onChange={(e) =>
                  setEditMatch({ ...matchToEdit, dateTime: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-4 w-5 h-5 text-gray-400" />
                <Autocomplete
                  apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
                  type="search"
                  value={matchToEdit.location}
                  onChange={(e) =>
                    setEditMatch({
                      ...matchToEdit,
                      location: e.target.value,
                      latitude: null,
                      longitude: null,
                    })
                  }
                  onPlaceSelected={(place) => {
                    const placeName =
                      typeof place?.name === "string" ? place.name.trim() : "";
                    const formattedAddress =
                      typeof place?.formatted_address === "string"
                        ? place.formatted_address.trim()
                        : "";
                    const lat = place.geometry?.location?.lat?.();
                    const lng = place.geometry?.location?.lng?.();
                    setEditMatch((prev) => {
                      const current = prev ?? {};
                      const nextLocation =
                        placeName || formattedAddress || current.location || "";
                      const nextLat =
                        typeof lat === "number"
                          ? lat
                          : (current.latitude ?? null);
                      const nextLng =
                        typeof lng === "number"
                          ? lng
                          : (current.longitude ?? null);
                      return {
                        ...current,
                        location: nextLocation,
                        latitude: nextLat,
                        longitude: nextLng,
                      };
                    });
                  }}
                  options={{
                    types: ["geocode", "establishment"],
                    fields: [
                      "formatted_address",
                      "geometry",
                      "name",
                      "address_components",
                    ],
                  }}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-bold text-gray-800"
                />
              </div>
              <input
                type="text"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-bold text-gray-800"
                value={matchToEdit.location}
                onChange={(e) =>
                  setEditMatch({ ...matchToEdit, location: e.target.value })
                }
              />

            </div>

            <div>
              <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                Notes
              </label>
              <textarea
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-bold text-gray-800"
                rows={3}
                value={matchToEdit.notes}
                onChange={(e) =>
                  setEditMatch({ ...matchToEdit, notes: e.target.value })
                }
              />
            </div>

            {isHost && (
              <div className="pt-2">
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" /> Participants
                </label>
                {removeErr && (
                  <p className="text-red-600 text-sm font-semibold mb-2">{removeErr}</p>
                )}
                {loadingParts ? (
                  <p className="text-sm text-gray-500">Loading participants…</p>
                ) : participants.length ? (
                  <ul className="divide-y divide-gray-100 border rounded-xl">
                    {participants.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <span className="text-gray-800">
                          {p.profile?.full_name || `Player ${p.player_id}`}
                          {participantIsHost(p) && (
                            <span className="ml-2 text-blue-700 text-xs font-bold">
                              Host
                            </span>
                          )}
                        </span>
                        {!participantIsHost(p) && (
                          <button
                            onClick={() => handleRemoveParticipant(p.player_id)}
                            className="px-2 py-1 text-red-600 hover:text-red-800 rounded-lg hover:bg-red-50 flex items-center gap-1"
                          >
                            <X className="w-4 h-4" />
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No participants yet.</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => {
                setShowEditModal(false);
                setEditMatch(null);
              }}
              className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl shadow-lg"
            >
              SAVE CHANGES
            </button>
          </div>
        </div>
      </div>
    );
  }; // FIX: Removed comma here

  const Toast = () => {
    if (!showToast) return null;

    return (
      <div
        className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl shadow-xl z-50 animate-slideDown flex items-center gap-2 ${
          showToast.type === "error"
            ? "bg-red-500 text-white"
            : "bg-gray-900 text-white"
        }`}
      >
        {showToast.type === "error" ? (
          <AlertCircle className="w-5 h-5" />
        ) : (
          <Check className="w-5 h-5" />
        )}
        <span className="font-black">{showToast.message}</span>
      </div>
    );
  }; // FIX: Removed comma here

  // Add the CSS animations
  const styles = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translate(-50%, -20px);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }
    
    .animate-slideUp {
      animation: slideUp 0.3s ease-out;
    }
    
    .animate-slideDown {
      animation: slideDown 0.3s ease-out;
    }
    
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    
    .bg-size-200 {
      background-size: 200% 100%;
    }
    
    .bg-pos-0 {
      background-position: 0% 50%;
    }
    
    .bg-pos-100 {
      background-position: 100% 50%;
    }
  `;

  const hasNotificationIndicator = useMemo(() => {
    if (pendingInvites.length > 0) return true;
    const unreadCount = Number(notificationSummary.unread ?? 0);
    if (currentScreen !== "invites" && unreadCount > 0) return true;
    const latestDate = notificationSummary.latest;
    if (!latestDate) return false;
    const latestTime = latestDate instanceof Date
      ? latestDate.getTime()
      : new Date(latestDate).getTime();
    if (!Number.isFinite(latestTime)) return false;
    if (currentScreen === "invites") return false;
    if (!lastSeenNotificationAt) return true;
    const seenDate =
      lastSeenNotificationAt instanceof Date
        ? lastSeenNotificationAt
        : new Date(lastSeenNotificationAt);
    const seenTime = seenDate.getTime();
    if (!Number.isFinite(seenTime)) return true;
    return latestTime > seenTime;
  }, [
    currentScreen,
    lastSeenNotificationAt,
    notificationSummary.latest,
    notificationSummary.unread,
    pendingInvites.length,
  ]);

  const shouldShowLanding = !currentUser && currentScreen === "browse";

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{styles}</style>

      {shouldShowLanding ? (
        <LandingPage
          onSignup={(payload) =>
            performSignup({
              ...payload,
              dateOfBirth: null,
            })
          }
          onLogin={performLogin}
          onForgotPassword={(email) => forgotPassword(email)}
        />
      ) : (
        <>
          <AppHeader
            currentScreen={currentScreen}
            currentUser={currentUser}
            showPreview={showPreview}
            goToInvites={goToInvites}
            goToBrowse={() => goToBrowse()}
            onOpenProfile={() => setShowProfileManager(true)}
            onLogout={handleLogout}
            onOpenSignIn={() => setShowSignInModal(true)}
            setShowPreview={setShowPreview}
            hasUpdates={hasNotificationIndicator}
          />

          {currentScreen === "browse" && BrowseScreen()}
          {currentScreen === "create" && CreateMatchScreen()}
          {currentScreen === "invite" && (
            <InviteScreen
              matchId={inviteMatchId}
              currentUser={currentUser}
              matchData={matchData}
              setMatchData={setMatchData}
              selectedPlayers={selectedPlayers}
              setSelectedPlayers={setSelectedPlayers}
              existingPlayerIds={existingPlayerIds}
              setExistingPlayerIds={setExistingPlayerIds}
              onToast={displayToast}
              onDone={() => {
                setCurrentScreen("browse");
                setInviteMatchId(null);
                fetchMatches();
              }}
              formatDateTime={formatDateTime}
            />
          )}
          {currentScreen === "invites" && (
            <NotificationsFeed
              currentUser={currentUser}
              onSummaryChange={handleNotificationsSummaryChange}
              onOpenMatch={handleViewDetails}
              notificationsSupported={notificationsSupported}
              onAvailabilityChange={handleNotificationsAvailabilityChange}
            />
          )}
        </>
      )}

      {SignInModal()}
      <EditModal isOpen={showEditModal} matchToEdit={editMatch} />
      <ParticipantsModal
        isOpen={showParticipantsModal}
        matchId={participantsMatchId}
      />
      <MatchDetailsModal
        isOpen={showMatchDetailsModal && !!viewMatch}
        matchData={viewMatch}
        currentUser={currentUser}
        onClose={closeMatchDetailsModal}
        onRequireSignIn={() => setShowSignInModal(true)}
        onMatchRefresh={refreshMatchesAndInvites}
        onReloadMatch={fetchMatchDetails}
        onUpdateMatch={setViewMatch}
        onToast={displayToast}
        formatDateTime={formatDateTime}
        onManageInvites={handleManageInvitesFromDetails}
      />
      {Toast()}
      <ProfileManager
        isOpen={showProfileManager}
        onClose={() => setShowProfileManager(false)}
        onProfileUpdate={mergeProfileDetails}
      />
    </div>
  );
};

export default TennisMatchApp;
