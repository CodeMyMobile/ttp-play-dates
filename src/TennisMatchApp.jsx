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
import ProfileManager from "./components/ProfileManager";
import InvitesList from "./components/InvitesList";
import {
  getInviteByToken,
  listInvites,
  acceptInvite,
  rejectInvite,
} from "./services/invites";
import { login, signup, forgotPassword } from "./services/auth";
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
  Search,
  Share2,
  Menu,
  Bell,
  Star,
  TrendingUp,
  Award,
  Filter,
  Settings,
  LogOut,
  User,
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
  Activity,
  Sparkles,
  Target,
  ClipboardList,
  FileText,
} from "lucide-react";
import Autocomplete from "react-google-autocomplete";
import AppHeader from "./components/AppHeader";
import InviteScreen from "./components/InviteScreen";
import { formatPhoneNumber, normalizePhoneValue, formatPhoneDisplay } from "./services/phone";

const DEFAULT_SKILL_LEVEL = "2.5 - Beginner";
const MATCH_ARCHIVED_ERROR = "match_archived";
const ARCHIVE_FILTER_VALUE = "archieve";

const isMatchArchivedError = (error) => {
  if (!error) return false;
  const code = error.status || error?.response?.status;
  if (code !== 410) return false;
  const errorCode = error?.data?.error || error?.response?.data?.error;
  return errorCode === MATCH_ARCHIVED_ERROR;
};

const matchFormatOptions = [
  "Singles",
  "Doubles",
  "Mixed Doubles",
  "Dingles",
  "Round Robin",
  "Other",
];

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

const TennisMatchApp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialPath = getInitialPath();
  const [currentUser, setCurrentUser] = useState(null);
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
  const [viewMatch, setViewMatch] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState("");
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
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  const displayToast = useCallback((message, type = "success") => {
    setShowToast({ message, type });
    setTimeout(() => setShowToast(null), 3000);
  }, []);

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
        setGeoError(
          error?.message || "Unable to retrieve your location. Please search manually.",
        );
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
      setMatchCounts({ ...counts, archived: archivedCount });
      setMatchPagination(data.pagination);
      let transformed = rawMatches.map((m) => {
        const participantCount = (m.participants || []).filter(
          (p) => p.status !== "left",
        ).length;
        const acceptedInvites = (m.invitees || []).filter(
          (i) => i.status === "accepted",
        ).length;
        const occupied = participantCount + acceptedInvites;

        const matchId = m.match_id || m.id;
        const isHost = m.host_id === currentUser?.id;
        const isJoined =
          !isHost &&
          (m.joined_at ||
            (m.participants || []).some(
              (p) => p.player_id === currentUser?.id && p.status !== "left",
            ));

        return {
          id: matchId,
          type: isHost ? "hosted" : isJoined ? "joined" : "available",
          status: m.status || "upcoming",
          privacy: m.match_type || "open",
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
          playerLimit: (() => {
            const raw = m.player_limit;
            const numeric =
              typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
            return Number.isFinite(numeric) ? numeric : null;
          })(),
          occupied,
          spotsAvailable: (() => {
            const limit =
              typeof m.player_limit === "number"
                ? m.player_limit
                : Number.parseInt(m.player_limit, 10);
            return Number.isFinite(limit)
              ? Math.max(limit - occupied, 0)
              : null;
          })(),
        };
      });
      if (activeFilter === "draft") {
        transformed = transformed.filter((m) => m.status === "draft");
      } else if (activeFilter === "archived") {
        transformed = transformed.filter((m) => m.status === "archived");
      } else {
        transformed = transformed.filter((m) => m.status !== "archived");
      }
      setMatches(transformed);
    } catch (err) {
      displayToast(
        err.response?.data?.message || "Failed to load matches",
        "error",
      );
    }
  }, [
    activeFilter,
    currentUser,
    distanceFilter,
    displayToast,
    locationFilter,
    matchPage,
    matchSearch,
  ]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    fetchPendingInvites();
  }, [fetchPendingInvites]);

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
      } catch (err) {
        const errorCode = err?.response?.data?.error || err?.data?.error;
        if (isMatchArchivedError(err) || errorCode === MATCH_ARCHIVED_ERROR) {
          displayToast("This match has been archived. Invites can no longer be updated.", "error");
          fetchPendingInvites();
          fetchMatches();
        } else {
          displayToast(
            err?.response?.data?.message || err?.message || "Failed to update invite",
            "error",
          );
        }
      }
    },
    [displayToast, fetchMatches, fetchPendingInvites],
  );

  const handleInviteResponse = useCallback(() => {
    fetchMatches();
    fetchPendingInvites();
  }, [fetchMatches, fetchPendingInvites]);

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

  const openInviteScreen = useCallback(
    async (matchId, { skipNavigation = false, onClose } = {}) => {
      const numericMatchId = Number(matchId);
      if (!Number.isFinite(numericMatchId) || numericMatchId <= 0) {
        displayToast("Match not found", "error");
        return;
      }

      try {
        const data = await getMatch(numericMatchId);
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

        const validParticipants = participantsSource.filter(
          (p) => p && p.status !== "left",
        );
        const acceptedInvites = inviteesSource.filter(
          (i) => i && i.status === "accepted",
        ).length;
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
        const occupied = validParticipants.length + acceptedInvites;

        validParticipants.forEach((p) => {
          const pid = Number(p.player_id);
          if (!Number.isFinite(pid) || pid <= 0) return;
          const profile = p.profile || {};
          initial.set(pid, {
            user_id: pid,
            full_name: profile.full_name || `Player ${pid}`,
            email: profile.email,
            hosting: p.status === "hosting" || pid === match.host_id,
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
        setMatchData((prev) => ({
          ...prev,
          type:
            match.match_type === "private" || match.match_type === "closed"
              ? "closed"
              : "open",
          skillLevel:
            match.skill_level_min || match.skill_level || prev.skillLevel || "",
          format: match.match_format || prev.format || "",
          playerCount: match.player_limit ?? prev.playerCount,
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
        }));
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
    // Do not override other in-app screens (e.g., details/create) when the URL
    // doesn't explicitly target a special route.
    if (currentScreen !== "browse" && currentScreen !== "details" && currentScreen !== "create") {
      setCurrentScreen("browse");
    }
  }, [currentScreen, location.pathname, openInviteScreen]);

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
                setViewMatch(data);
                setCurrentScreen("details");
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

  const handleViewDetails = async (matchId) => {
    try {
      const data = await fetchMatchDetailsWithArchivedFallback(matchId);
      if (!data) {
        displayToast("Match not found", "error");
        return;
      }
      if ((data.match || {}).status === "archived" && activeFilter !== "archived") {
        setActiveFilter("archived");
      }
      setViewMatch(data);
      setCurrentScreen("details");
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
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
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
    if (!hasLocationFilter) {
      return matchesWithDistance;
    }

    const filtered = matchesWithDistance.filter((match) => {
      if (!Number.isFinite(match.distanceMiles)) return false;
      return match.distanceMiles <= distanceFilter;
    });

    return [...filtered].sort((a, b) => {
      const distanceA = Number.isFinite(a.distanceMiles)
        ? a.distanceMiles
        : Number.POSITIVE_INFINITY;
      const distanceB = Number.isFinite(b.distanceMiles)
        ? b.distanceMiles
        : Number.POSITIVE_INFINITY;
      if (distanceA === distanceB) return 0;
      return distanceA - distanceB;
    });
  }, [distanceFilter, hasLocationFilter, matchesWithDistance]);

  const distanceOptions = useMemo(() => [5, 10, 20, 50], []);
  const activeLocationLabel = hasLocationFilter
    ? locationFilter?.label || "Saved location"
    : "";

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
      <div className="bg-gradient-to-br from-white via-green-50/20 to-emerald-50/30 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-green-600" />
            <span className="text-sm font-bold text-green-600 uppercase tracking-wide">
              Active Now
            </span>
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-3">
            {currentUser
              ? `Welcome back, ${currentUser.name.split(" ")[0]}!`
              : "Find Your Next Match"}
          </h2>
          <p className="text-lg font-medium text-gray-600 mb-8">
            {currentUser
              ? "You have 2 upcoming matches this week"
              : "Join 500+ players in North County"}
          </p>

          {/* Prominent Action Button */}
          <button
            onClick={() => {
              if (!currentUser) {
                setShowSignInModal(true);
              } else {
                navigate("/create");
              }
            }}
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white rounded-2xl font-black text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
            <Sparkles className="w-6 h-6 relative" />
            <span className="relative">Create New Match</span>
            <ArrowRight className="w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
          </button>
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

            {invitesLoading ? (
              <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6 text-sm text-gray-500 font-semibold">
                Checking for outstanding invites...
              </div>
            ) : invitesError ? (
              <div className="bg-red-50 border border-red-200 rounded-3xl shadow-sm p-6 text-sm text-red-700 font-semibold">
                {invitesError}
              </div>
            ) : pendingInvites.length > 0 ? (
              <section className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white rounded-3xl shadow-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide font-bold text-white/80">
                      Pending Invites
                    </p>
                    <h3 className="text-2xl font-black leading-tight">
                      You have {pendingInvites.length} invite
                      {pendingInvites.length === 1 ? "" : "s"} waiting for a response
                    </h3>
                  </div>
                  <button
                    onClick={goToInvites}
                    className="px-4 py-2 rounded-xl bg-white text-amber-600 font-bold text-sm shadow hover:bg-amber-50 transition-colors"
                  >
                    Review all
                  </button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {pendingInvites.slice(0, 4).map((invite) => {
                    const startTime = invite.match?.start_date_time
                      ? new Date(invite.match.start_date_time).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "TBD";
                    return (
                      <div
                        key={invite.token}
                        className="min-w-[220px] bg-white/15 backdrop-blur-sm rounded-2xl p-4 flex flex-col gap-3 border border-white/30"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-white/90">
                            {invite.match?.match_format || "Match Invite"}
                          </div>
                          <span className="px-2 py-1 text-[10px] font-black tracking-wide rounded-full bg-white/25 text-white">
                            PENDING
                          </span>
                        </div>
                        <div>
                          <p className="text-lg font-black leading-tight">
                            {invite.match?.location_text || "Location TBA"}
                          </p>
                          <p className="text-sm text-white/80 font-semibold">{startTime}</p>
                        </div>
                        <div className="text-xs font-semibold text-white/80 space-y-1">
                          <p className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {invite.match?.player_limit || "Open"} player cap
                          </p>
                          {invite.inviter?.full_name && (
                            <p className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5" /> Hosted by {invite.inviter.full_name}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                          <button
                            onClick={() => respondToInvite(invite.token, "reject")}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-white/15 text-white font-bold text-xs border border-white/30 hover:bg-white/25 transition-colors"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => respondToInvite(invite.token, "accept")}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-white text-amber-600 font-black text-xs shadow hover:bg-amber-50 transition-colors"
                          >
                            Accept
                          </button>
                          {invite.match?.id && (
                            <button
                              onClick={() => handleViewDetails(invite.match.id)}
                              className="w-full px-3 py-1.5 rounded-xl bg-white/10 text-white font-bold text-xs border border-white/30 hover:bg-white/20 transition-colors"
                            >
                              View details
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6 text-sm text-gray-500 font-semibold">
                You're all caught up on invites. 🎉
              </div>
            )}
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
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Actions Bar */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <h3 className="text-xl font-black mb-1">
                Looking for a quick game?
              </h3>
              <p className="text-blue-100 font-medium">
                3 players near you are ready to play now
              </p>
            </div>
            <button className="px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:shadow-lg hover:scale-105 transition-all">
              Find Players
            </button>
          </div>
        </div>

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
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setMatchPage((p) => Math.max(1, p - 1))}
              disabled={matchPage === 1}
              className="px-3 py-1.5 rounded-lg border-2 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed border-gray-200 text-gray-700 hover:bg-gray-50"
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
              className="px-3 py-1.5 rounded-lg border-2 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed border-gray-200 text-gray-700 hover:bg-gray-50"
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
    const isArchived = match.status === "archived";
    const isUpcoming = match.status === "upcoming";
    const playerCapacityLabel = Number.isFinite(match.playerLimit)
      ? `${match.occupied}/${match.playerLimit} players`
      : `${match.occupied} players`;

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
        <div className="flex justify-between items-start mb-4">
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
            {match.status === "draft" && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-yellow-50 to-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-black">
                DRAFT
              </span>
            )}
            {match.status === "cancelled" && (
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
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative opacity-0 group-hover:opacity-100"
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
                  "Location TBA"
                )}
              </p>
              <p className="text-xs font-semibold text-gray-500">{locationSubtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-gray-700">
              {match.format}
            </span>
          </div>
          {match.type === "open" && getNTRPDisplay(match.skillLevel) && (
            <>
              <span className="text-gray-300">•</span>
              <span className="text-sm font-black text-gray-900 bg-gradient-to-r from-amber-50 to-orange-50 px-2.5 py-1 rounded-lg">
                NTRP {getNTRPDisplay(match.skillLevel)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
            <Users className="w-4 h-4" /> {playerCapacityLabel}
          </div>
          <span className="text-xs text-gray-600 font-bold">
            {isArchived
              ? "ARCHIVED"
              : Number.isFinite(match.spotsAvailable)
              ? match.spotsAvailable === 0
                ? "FULL"
                : `${match.spotsAvailable} SPOT${
                    match.spotsAvailable === 1 ? "" : "S"
                  } LEFT`
              : ""}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleViewDetails(match.id)}
            className="px-4 py-2 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            View details
          </button>
          {match.type === "available" && isUpcoming && !isArchived && (
            <button
              onClick={async () => {
                if (!currentUser) {
                  setShowSignInModal(true);
                } else {
                  try {
                    await joinMatch(match.id);
                    displayToast("Successfully joined the match! 🎾");
                    fetchMatches();
                    fetchPendingInvites();
                  } catch (err) {
                    if (isMatchArchivedError(err)) {
                      displayToast(
                        "This match has been archived. You can't join.",
                        "error",
                      );
                      fetchMatches();
                      return;
                    }
                    displayToast(
                      err.response?.data?.message || "Failed to join match",
                      "error",
                    );
                  }
                }
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-black hover:shadow-xl hover:scale-105 transition-all flex items-center gap-1.5 shadow-lg"
            >
              <Zap className="w-4 h-4" />
              Join match
            </button>
          )}
          {isHosted && !isArchived && (
            <button
              onClick={() => {
                setEditMatch({
                  id: match.id,
                  dateTime: new Date(match.dateTime).toISOString().slice(0, 16),
                  location: match.location,
                  latitude: match.latitude,
                  longitude: match.longitude,
                  notes: match.notes || "",
                });
                setShowEditModal(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-black hover:shadow-xl hover:scale-105 transition-all shadow-lg"
            >
              Manage match
            </button>
          )}
          {isArchived && (
            <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
              Archived matches are read-only
            </span>
          )}
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
                    displayToast(
                      err.response?.data?.message || "Failed to publish match",
                      "error"
                    );
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
                  displayToast(
                    err.response?.data?.message || "Failed to cancel match",
                    "error"
                  );
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
              <Calendar className="w-4 h-4 text-gray-500" /> View Details
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
                  displayToast("Left match");
                  onClose();
                  fetchMatches();
                } catch (err) {
                  displayToast(
                    err.response?.data?.message || "Failed to leave match",
                    "error"
                  );
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
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-3 gap-3">
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
          setParticipants((data.participants || []).filter((p) => p.status !== "left"));
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
    }, [matchId]);

    useEffect(() => {
      if (searchTerm === "" || searchTerm.length >= 2) {
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
    }, [searchTerm, page, onToast]);

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

    const canRemove = (pid) => {
      const host = hostId ?? currentUser?.id;
      return currentUser?.id && host && currentUser.id === host && pid !== host;
    };

    const handleRemoveParticipant = async (playerId) => {
      if (!matchId) return;
      if (!window.confirm("Remove this participant from the match?")) return;
      try {
        await removeParticipant(matchId, playerId);
        setParticipants((prev) => prev.filter((p) => p.player_id !== playerId));
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
                        {(p.player_id === (hostId ?? currentUser?.id)) && (
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

            {/* Search players to invite */}
            <div>
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 font-semibold text-gray-800"
              />
            </div>
            {/* Quick Share */}
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

              <div className="grid grid-cols-3 gap-3">
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

            {/* Players list from backend */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                  Players
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {players.map((player) => {
                  const name = player.full_name;
                  return (
                    <button
                      key={player.user_id}
                      onClick={() => {
                        const pid = Number(player.user_id);
                        if (!Number.isFinite(pid) || pid <= 0) return;
                        setSelectedPlayers((prev) => {
                          const newMap = new Map(prev);
                          if (newMap.has(pid)) {
                            newMap.delete(pid);
                          } else {
                            newMap.set(pid, { ...player, user_id: pid });
                          }
                          return newMap;
                        });
                      }}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all hover:scale-105 ${

                        selectedPlayers.has(player.user_id)
                          ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 shadow-md"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-md ${

                          selectedPlayers.has(player.user_id)

                            ? "bg-gradient-to-br from-green-500 to-emerald-600 text-white"
                            : "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700"
                        }`}
                      >
                        {name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-700 font-bold">
                        {name}
                      </span>

                      {selectedPlayers.has(player.user_id) && (

                        <Check className="w-4 h-4 text-green-600 ml-auto" />
                      )}
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
                    disabled={pagination.page >= Math.ceil(pagination.total / pagination.perPage)}
                    className="px-3 py-1.5 rounded-lg border-2 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
          </div>

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
                    if (
                      err.data?.error === "invalid_phone_numbers" &&
                      Array.isArray(err.data?.details)
                    ) {
                      onToast(
                        `Fix these numbers: ${err.data.details.join(", ")}`,
                        "error"
                      );
                    } else {
                      onToast(
                        err.response?.data?.message || err.message || "Failed to send invites",
                        "error"
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

  const MatchDetailsScreen = () => {
    const [joining, setJoining] = useState(false);
    const matchData = viewMatch;
    if (!matchData) return null;
    const { match, participants = [], invitees = [] } = matchData;
    const isHost = currentUser?.id === match.host_id;
    const isJoined = participants.some(
      (p) => p.player_id === currentUser?.id && p.status !== "left",
    );
    const isArchived = match.status === "archived";
    const committedParticipants = participants.filter((p) => p.status !== "left");
    const acceptedInviteCount = invitees.filter((i) => i.status === "accepted").length;
    const totalCommitted = committedParticipants.length + acceptedInviteCount;
    const numericPlayerLimit =
      typeof match.player_limit === "number"
        ? match.player_limit
        : Number.parseInt(match.player_limit, 10);
    const remainingSpots = Number.isFinite(numericPlayerLimit)
      ? Math.max(numericPlayerLimit - totalCommitted, 0)
      : null;
    const canJoin =
      !isHost &&
      !isJoined &&
      !isArchived &&
      match.status === "upcoming" &&
      (remainingSpots === null || remainingSpots > 0);

    const handleRemoveParticipant = async (playerId) => {
      if (isArchived) {
        displayToast("Archived matches cannot be edited", "error");
        return;
      }
      if (!window.confirm("Remove this participant from the match?")) return;
      try {
        await removeParticipant(match.id, playerId);
        setViewMatch({
          ...viewMatch,
          participants: participants.filter((p) => p.player_id !== playerId),
        });
        displayToast("Participant removed");
        fetchMatches();
      } catch {
        displayToast("Failed to remove participant", "error");
      }
    };

    const handleJoinMatch = async () => {
      if (!currentUser) {
        setShowSignInModal(true);
        return;
      }

      try {
        setJoining(true);
        await joinMatch(match.id);
        displayToast("You're in! Match details updated. 🎾");
        fetchMatches();
        fetchPendingInvites();
        const updated = await fetchMatchDetails(match.id, { includeArchived: false });
        setViewMatch(updated);
      } catch (err) {
        if (isMatchArchivedError(err)) {
          displayToast("This match has been archived. You can't join.", "error");
          fetchMatches();
        } else {
          displayToast(
            err?.response?.data?.message || err?.message || "Failed to join match",
            "error",
          );
        }
      } finally {
        setJoining(false);
      }
    };

    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow p-6">
          <button
            onClick={() => {
              setViewMatch(null);
              goToBrowse();
            }}
            className="mb-4 flex items-center text-sm font-bold text-gray-600 hover:text-gray-800"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </button>
          <h2 className="text-2xl font-black mb-2">Match Details</h2>
          {match?.status === "cancelled" && (
            <div className="mb-4">
              <span className="inline-block px-3 py-1.5 bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200 rounded-full text-xs font-black">
                CANCELLED
              </span>
            </div>
          )}
          {isArchived && (
            <div className="mb-4">
              <span className="inline-block px-3 py-1.5 bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border border-slate-300 rounded-full text-xs font-black">
                ARCHIVED
              </span>
              <p className="mt-2 text-sm text-slate-600 font-semibold">
                This match has been archived. Actions are disabled.
              </p>
            </div>
          )}
          {match && (
            <div className="space-y-1 mb-6">
              <p className="text-gray-700 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formatDateTime(match.start_date_time)}
              </p>
              {match.location_text && (
                <p className="text-gray-700 flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {match.location_text}
                </p>
              )}
              {match.match_format && (
                <p className="text-gray-700 flex items-center gap-1">
                  <ClipboardList className="w-4 h-4" /> {match.match_format}
                </p>
              )}
              {match.player_limit && (
                <p className="text-gray-700 flex items-center gap-1">
                  <Users className="w-4 h-4" /> Player limit: {match.player_limit}
                </p>
              )}
              {match.notes && (
                <p className="text-gray-700 flex items-center gap-1">
                  <FileText className="w-4 h-4" /> {match.notes}
                </p>
              )}
            </div>
          )}
          {canJoin && (
            <div className="mb-6">
              <button
                onClick={handleJoinMatch}
                disabled={joining}
                className="w-full px-5 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {joining ? "Joining match..." : "Join this match"}
              </button>
              {remainingSpots !== null && (
                <p className="text-xs text-gray-500 font-semibold mt-2 text-center">
                  {remainingSpots} spot{remainingSpots === 1 ? "" : "s"} remaining
                </p>
              )}
            </div>
          )}
          {!canJoin && !isHost && !isJoined && remainingSpots === 0 && (
            <p className="mb-6 text-sm font-semibold text-red-500">
              This match is currently full. Check back later or explore other matches.
            </p>
          )}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-1">
              <Users className="w-4 h-4" /> Participants
            </h3>
            {participants.length ? (
              <ul className="space-y-1">
                {participants.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between text-gray-700"
                  >
                    <span>
                      {p.profile?.full_name || `Player ${p.player_id}`}
                    {p.player_id === match.host_id && (
                      <span className="ml-1 text-blue-700 text-xs">Host</span>
                    )}
                  </span>
                    {isHost && !isArchived && p.player_id !== match.host_id && (
                      <button
                        onClick={() => handleRemoveParticipant(p.player_id)}
                        className="text-red-600 hover:text-red-800"
                        aria-label="Remove participant"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No participants yet.</p>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold mb-2 flex items-center gap-1">
              <User className="w-4 h-4" /> Invitees
            </h3>
            {invitees.length ? (
              <ul className="space-y-1">
                {invitees.map((i) => (
                  <li
                    key={i.id || i.invitee_id}
                    className="flex items-start justify-between gap-3 text-gray-700 bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <div>
                      <div className="font-semibold">
                        {i.profile?.full_name || `Player ${i.invitee_id}`}
                      </div>
                      {(() => {
                        const phone =
                          i.profile?.phone ||
                          i.profile?.phone_number ||
                          i.phone_number ||
                          i.phone;
                        const email = i.profile?.email;
                        const isPlaceholderEmail =
                          typeof email === "string" && email.endsWith("@ttpplaydates.com");
                        return (
                          <>
                            {phone && (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {formatPhoneDisplay(String(phone))}
                              </div>
                            )}
                            {isPlaceholderEmail && (
                              <div className="text-xs text-blue-600 font-semibold">
                                SMS invite active
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {i.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No invites sent.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const SignInModal = () => {
    if (!showSignInModal) return null;

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
        const res = await signup({
          email: formData.email,
          password: pwd ?? "0000",
          name: formData.name,
          phone: formData.phone,
        });
        // Ensure tokens are persisted (services already store them; this is defensive)
        if (res?.access_token) localStorage.setItem("authToken", res.access_token);
        if (res?.refresh_token) localStorage.setItem("refreshToken", res.refresh_token);
        // Update profile details using access token
        const digits = (formData.phone || "").replace(/\D/g, "");
        const signupToken =
          res?.access_token || localStorage.getItem("authToken") || "";
        if (signupToken && res?.user_id) {
          await updatePlayerPersonalDetails({
            player: signupToken,
            id: res.user_id,
            date_of_birth: formData.dateOfBirth || null,
            usta_rating: 0,
            uta_rating: 0,
            fullName: formData.name,
            mobile: digits || null,
            about_me: null,
          });
        }
        const newUser = {
          id: res?.user_id,
          type: res?.user_type,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          skillLevel: formData.skillLevel,
          avatar: formData.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase(),
          rating: 4.2,
        };
        localStorage.setItem("user", JSON.stringify(newUser));
        setCurrentUser(newUser);
        setShowSignInModal(false);
        setSignInStep("initial");
        setFormData({ name: "", email: "", phone: "", skillLevel: "", dateOfBirth: "" });
        setPassword("");
        setSignupErrors({});
        displayToast(
          `Welcome to Matchplay, ${formData.name.split(" ")[0]}! 🎾`,
          "success",
        );
      } catch (err) {
        const data = err?.response?.data;
        if (data?.err?.constraint === "users_email_unique") {
          setSignupErrors((prev) => ({ ...prev, email: "Email Already Exists" }));
          displayToast("Email Already Exists", "error");
        } else {
          console.error(err);
          displayToast("Signup failed", "error");
        }
      }
    };

    // OAuth completion step
    if (signInStep === "oauth-complete") {
      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-slideUp">
            <button
              onClick={() => {
                setSignInStep("initial");
                setFormData({ name: "", email: "", phone: "", skillLevel: "" });
              }}
              className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSignInModal(false);
                setSignInStep("initial");
                setFormData({ name: "", email: "", phone: "", skillLevel: "" });
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
    login(formData.email, password)
      .then((res) => {
        // Support both payload shapes:
        // 1) { access_token, refresh_token, profile, user_id, user_type }
        // 2) { token, user: { ... } }
        const {
          access_token,
          refresh_token,
          profile,
          user_id,
          user_type,
          token,
          user: userFromApi,
        } = res || {};

        let user;

        if (access_token) {
          // Newer shape with profile & tokens
          localStorage.setItem("authToken", access_token);
          if (refresh_token) localStorage.setItem("refreshToken", refresh_token);

          const name = profile?.full_name || formData.email;
          user = {
            id: user_id,
            type: user_type,
            name,
            email: formData.email,
            avatar: name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase(),
            skillLevel: profile?.usta_rating || "",
          };
        } else {
          // Legacy/alternative shape with single token + user object
          if (token) localStorage.setItem("authToken", token);

          const fallbackName = (userFromApi?.name || formData.email || "").trim();
          user =
            userFromApi ||
            {
              name: fallbackName,
              email: formData.email,
              avatar: fallbackName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase(),
            };
        }

        // Persist user for session restore
        localStorage.setItem("user", JSON.stringify(user));

        setCurrentUser(user);
        setShowSignInModal(false);
        setSignInStep("initial");
        setFormData({ name: "", email: "", phone: "", skillLevel: "" });
        setPassword("");

        const safeFirst = (user.name || "").split(" ")[0] || "Player";
        displayToast(`Welcome back, ${safeFirst}! 🎾`, "success");
      })
      .catch((err) =>
        displayToast(err.response?.data?.message || err.message, "error")
      );
  };


      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-slideUp">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-slideUp">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-slideUp">
            <button
              onClick={() => {
                setSignInStep("initial");
                setFormData({ name: "", email: "", phone: "", skillLevel: "" });
              }}
              className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSignInModal(false);
                setSignInStep("initial");
                setFormData({ name: "", email: "", phone: "", skillLevel: "" });
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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-slideUp">
          <button
            onClick={() => {
              setShowSignInModal(false);
              setSignInStep("initial");
              setFormData({ name: "", email: "", phone: "", skillLevel: "" });
            }}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <span className="text-white text-3xl">🎾</span>
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">
              Welcome to Matchplay
            </h2>
            <p className="text-gray-500 font-semibold">
              Sign in to create and join matches
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
              setFormData({ name: "", email: "", phone: "", skillLevel: "" });
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
          setParticipants((data.participants || []).filter((p) => p.status !== "left"));
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

    const isHost = currentUser?.id && hostId && currentUser.id === hostId;

    const handleRemoveParticipant = async (playerId) => {
      if (!matchId) return;
      if (!window.confirm("Remove this participant from the match?")) return;
      try {
        await removeParticipant(matchId, playerId);
        setParticipants((prev) => prev.filter((p) => p.player_id !== playerId));
        setRemoveErr("");
      } catch (error) {
        console.error(error);
        setRemoveErr("Failed to remove participant");
        setTimeout(() => setRemoveErr(""), 2500);
      }
    };

    if (!isOpen || !matchId) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-lg w-full p-6 relative animate-slideUp">
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
                    <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="text-gray-800">
                        {p.profile?.full_name || `Player ${p.player_id}`}
                        {p.player_id === hostId && (
                          <span className="ml-2 text-blue-700 text-xs font-bold">Host</span>
                        )}
                      </span>
                      {isHost && p.player_id !== hostId ? (
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
          setParticipants((data.participants || []).filter((p) => p.status !== "left"));
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

    const isHost = currentUser?.id && hostId && currentUser.id === hostId;

    const handleRemoveParticipant = async (playerId) => {
      if (!window.confirm("Remove this participant from the match?")) return;
      try {
        if (!matchToEdit?.id) return;
        await removeParticipant(matchToEdit.id, playerId);
        setParticipants((prev) => prev.filter((p) => p.player_id !== playerId));
        setRemoveErr("");
      } catch (error) {
        console.error(error);
        setRemoveErr("Failed to remove participant");
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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-lg w-full p-6 relative animate-slideUp">
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
                      <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="text-gray-800">
                          {p.profile?.full_name || `Player ${p.player_id}`}
                          {p.player_id === hostId && (
                            <span className="ml-2 text-blue-700 text-xs font-bold">Host</span>
                          )}
                        </span>
                        {p.player_id !== hostId && (
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

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{styles}</style>

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
      {currentScreen === "details" && <MatchDetailsScreen />}
      {currentScreen === "invites" && (
        <InvitesList onInviteResponse={handleInviteResponse} />
      )}

      {SignInModal()}
      <EditModal isOpen={showEditModal} matchToEdit={editMatch} />
      <ParticipantsModal
        isOpen={showParticipantsModal}
        matchId={participantsMatchId}
      />
      {Toast()}
      <ProfileManager
        isOpen={showProfileManager}
        onClose={() => setShowProfileManager(false)}
      />
    </div>
  );
};

export default TennisMatchApp;
