import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  MapPin,
  Users,
  Check,
  Copy,
  Search,
  User,
  X,
  Send,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import {
  getMatch,
  getShareLink,
  searchPlayers,
  removeParticipant,
  updateMatch,
  sendInvites,
  listMatches,
} from "../services/matches";
import { ARCHIVE_FILTER_VALUE, isMatchArchivedError } from "../utils/archive";
import {
  idsMatch,
  uniqueActiveParticipants,
  uniqueInvitees,
  countUniqueMatchOccupants,
} from "../utils/participants";
import {
  collectMemberIds,
  memberMatchesAnyId,
  memberMatchesParticipant,
} from "../utils/memberIdentity";
import { buildRecentPartnerSuggestions } from "../utils/inviteSuggestions";
import { evaluateLowOccupancyAlert } from "../utils/matchAlerts";

const InviteScreen = ({
  matchId,
  currentUser,
  matchData,
  setMatchData,
  selectedPlayers,
  setSelectedPlayers,
  existingPlayerIds,
  setExistingPlayerIds,
  onToast,
  onDone,
  formatDateTime,
}) => {
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
  const [invitees, setInvitees] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [isArchived, setIsArchived] = useState(false);
  const [suggestedPlayers, setSuggestedPlayers] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [smartRecommendations, setSmartRecommendations] = useState([]);
  const [smartRecommendationsLoading, setSmartRecommendationsLoading] = useState(false);
  const [smartRecommendationsError, setSmartRecommendationsError] = useState("");

  const matchType =
    typeof matchData?.type === "string" ? matchData.type.toLowerCase() : "";
  const isPrivateMatch = matchType === "closed" || matchType === "private";

  const memberIdentities = useMemo(
    () => collectMemberIds(currentUser),
    [currentUser],
  );

  const formatTimeUntil = (hours) => {
    if (!Number.isFinite(hours) || hours <= 0) {
      return "less than an hour";
    }
    if (hours < 1) {
      const minutes = Math.max(Math.round(hours * 60), 1);
      return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    }
    if (hours < 24) {
      const rounded = Math.round(hours);
      return `${rounded} hour${rounded === 1 ? "" : "s"}`;
    }
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? "" : "s"}`;
  };

  const lowOccupancy = matchData?.lowOccupancy ?? null;
  const lowOccupancyStyles = {
    urgent: {
      container: "border-red-200 bg-red-50 text-red-700",
      badge: "bg-red-500 text-white",
      button: "bg-red-500 text-white hover:bg-red-600",
    },
    warning: {
      container: "border-amber-200 bg-amber-50 text-amber-700",
      badge: "bg-amber-500 text-white",
      button: "bg-amber-500 text-white hover:bg-amber-600",
    },
    soon: {
      container: "border-blue-200 bg-blue-50 text-blue-700",
      badge: "bg-blue-500 text-white",
      button: "bg-blue-500 text-white hover:bg-blue-600",
    },
  };
  const lowOccupancySeverity = lowOccupancy?.severity ?? "warning";
  const lowOccupancyTokens =
    lowOccupancyStyles[lowOccupancySeverity] || lowOccupancyStyles.warning;
  const lowOccupancyLabel =
    lowOccupancySeverity === "urgent"
      ? "Act now"
      : lowOccupancySeverity === "warning"
      ? "Needs attention"
      : "Monitor";
  const lowOccupancyTimeLabel = lowOccupancy
    ? formatTimeUntil(lowOccupancy.hoursUntil)
    : "";
  const outstandingShortfall = lowOccupancy?.shortfall ?? 0;
  const outstandingInvites = lowOccupancy?.inviteCoverage ?? 0;

  const buildSmartSearchTerms = useCallback(() => {
    const terms = new Set();
    const skill = matchData?.skillLevel;
    if (typeof skill === "string") {
      const trimmed = skill.trim();
      if (trimmed && trimmed.toLowerCase() !== "any level") {
        terms.add(trimmed);
        const rating = trimmed.split(/[\s-]/)[0];
        if (rating) terms.add(rating);
      }
    }
    const format = matchData?.format;
    if (typeof format === "string") {
      const trimmed = format.trim();
      if (trimmed) terms.add(trimmed);
    }
    const locationText = matchData?.location;
    if (typeof locationText === "string") {
      const primary = locationText.split(",")[0].trim();
      if (primary.length >= 3) terms.add(primary);
    }
    terms.add("");
    return Array.from(terms);
  }, [matchData?.format, matchData?.location, matchData?.skillLevel]);

  const recalcLowOccupancy = useCallback(
    (nextParticipants = participants, nextInvitees = invitees) => {
      setMatchData((prev) => {
        if (!prev) return prev;
        const status = prev.status || "upcoming";
        const lowOccupancyData = evaluateLowOccupancyAlert({
          status,
          startDateTime: prev.dateTime,
          playerLimit: prev.playerCount,
          activeParticipants: nextParticipants,
          dedupedInvitees: nextInvitees,
        });
        const occupiedCount = countUniqueMatchOccupants(
          nextParticipants,
          nextInvitees,
        );
        return {
          ...prev,
          occupied: occupiedCount,
          lowOccupancy: lowOccupancyData,
        };
      });
    },
    [invitees, participants, setMatchData],
  );

  const fetchSmartRecommendations = useCallback(
    async (aliveCheck = () => true) => {
      if (!lowOccupancy || outstandingShortfall <= 0) {
        if (aliveCheck()) {
          setSmartRecommendations([]);
          setSmartRecommendationsError("");
          setSmartRecommendationsLoading(false);
        }
        return;
      }

      const desired = Math.max(outstandingShortfall + 2, 4);
      const perPage = Math.max(desired * 2, 12);
      const searchTerms = buildSmartSearchTerms();
      const blockedIds = new Set(
        existingPlayerIds instanceof Set
          ? existingPlayerIds
          : Array.isArray(existingPlayerIds)
          ? existingPlayerIds
          : [],
      );
      participants.forEach((participant) => {
        const pid = Number(participant.player_id);
        if (Number.isFinite(pid) && pid > 0) {
          blockedIds.add(pid);
        }
      });
      invitees.forEach((invite) => {
        const pid = Number(invite.invitee_id || invite.player_id || invite.id);
        if (Number.isFinite(pid) && pid > 0) {
          blockedIds.add(pid);
        }
      });
      if (currentUser?.id) {
        const uid = Number(currentUser.id);
        if (Number.isFinite(uid) && uid > 0) {
          blockedIds.add(uid);
        }
      }

      setSmartRecommendationsLoading(true);
      setSmartRecommendationsError("");

      const collected = [];
      const seen = new Set();
      let lastError = null;

      for (const term of searchTerms) {
        if (!aliveCheck()) return;
        try {
          const data = await searchPlayers({
            search: term,
            page: 1,
            perPage,
          });
          const players = Array.isArray(data?.players) ? data.players : [];
          players.forEach((player) => {
            const pid = Number(player.user_id ?? player.id);
            if (!Number.isFinite(pid) || pid <= 0) return;
            if (blockedIds.has(pid) || seen.has(pid)) return;
            seen.add(pid);
            collected.push({ ...player, user_id: pid });
          });
          if (collected.length >= desired) break;
        } catch (error) {
          console.error("Failed to load smart invite recommendations", error);
          lastError = error;
        }
      }

      if (!aliveCheck()) return;

      if (collected.length === 0) {
        setSmartRecommendations([]);
        setSmartRecommendationsError(
          lastError
            ? "We couldn't load recommendations right now. Try refreshing."
            : "No ready substitutes found yet. Try searching manually or refreshing soon.",
        );
      } else {
        setSmartRecommendations(collected.slice(0, desired));
        setSmartRecommendationsError("");
      }

      if (aliveCheck()) {
        setSmartRecommendationsLoading(false);
      }
    },
    [
      buildSmartSearchTerms,
      currentUser,
      existingPlayerIds,
      invitees,
      lowOccupancy,
      outstandingShortfall,
      participants,
    ],
  );

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
          memberIdentities,
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
    [isPrivateMatch, currentUser, memberIdentities],
  );

  // Local state for manual phone invites (isolated from search input)
  const totalSelectedInvitees = useMemo(
    () => selectedPlayers.size,
    [selectedPlayers]
  );

  const copyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  useEffect(() => {
    if (!matchId) return;
    getShareLink(matchId)
      .then(({ shareUrl }) => setShareLink(shareUrl))
      .catch((error) =>
        onToast(
          error?.response?.data?.message || "Failed to generate share link",
          "error"
        )
      );
  }, [matchId, onToast]);

  // Load current participants for the match being invited
  useEffect(() => {
    if (!matchId) return;
    let alive = true;
    (async () => {
      try {
        setParticipantsLoading(true);
        setParticipantsError("");
        const loadMatch = async () => {
          try {
            return await getMatch(matchId);
          } catch (error) {
            if (!isMatchArchivedError(error)) throw error;
            return await getMatch(matchId, { filter: ARCHIVE_FILTER_VALUE });
          }
        };

        const data = await loadMatch();
        if (!alive) return;
        const archived = data.match?.status === "archived";
        setIsArchived(archived);
        if (archived) {
          setParticipants([]);
          setInvitees([]);
          setParticipantsError("This match has been archived. Invites are read-only.");
          onToast("This match has been archived. Invites are read-only.", "error");
          return;
        }
        const participantList = uniqueActiveParticipants(data.participants);
        const inviteList = uniqueInvitees(
          Array.isArray(data.invitees)
            ? data.invitees
            : Array.isArray(data.match?.invitees)
            ? data.match.invitees
            : [],
        );
        setParticipants(participantList);
        setInvitees(inviteList);
        setHostId(data.match?.host_id ?? null);
        setExistingPlayerIds(() => {
          const ids = new Set();
          participantList.forEach((participant) => {
            const pid = Number(participant.player_id);
            if (Number.isFinite(pid) && pid > 0) ids.add(pid);
          });
          inviteList.forEach((invite) => {
            const pid = Number(
              invite.invitee_id ?? invite.player_id ?? invite.id,
            );
            if (Number.isFinite(pid) && pid > 0) ids.add(pid);
          });
          return ids;
        });
        setMatchData((prev) => {
          if (!prev) return prev;
          const status = data.match?.status || prev.status || "upcoming";
          const lowOccupancyData = evaluateLowOccupancyAlert({
            status,
            startDateTime: data.match?.start_date_time || prev.dateTime,
            playerLimit: prev.playerCount,
            activeParticipants: participantList,
            dedupedInvitees: inviteList,
          });
          const occupiedCount = countUniqueMatchOccupants(
            participantList,
            inviteList,
          );
          return {
            ...prev,
            status,
            occupied: occupiedCount,
            lowOccupancy: lowOccupancyData,
          };
        });
      } catch (error) {
        console.error(error);
        if (!alive) return;
        setParticipants([]);
        setInvitees([]);
        if (isMatchArchivedError(error)) {
          setIsArchived(true);
          setParticipantsError("This match has been archived. Invites are read-only.");
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
    let alive = true;
    if (isArchived) {
      setSmartRecommendations([]);
      setSmartRecommendationsError("");
      setSmartRecommendationsLoading(false);
      return () => {
        alive = false;
      };
    }
    fetchSmartRecommendations(() => alive);
    return () => {
      alive = false;
    };
  }, [fetchSmartRecommendations, isArchived, lowOccupancy?.shortfall]);

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
  // from other inputs while the host is typing.
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

  const filteredSmartRecommendations = useMemo(() => {
    const blocked =
      existingPlayerIds instanceof Set
        ? new Set(existingPlayerIds)
        : new Set(existingPlayerIds || []);
    const selectedIds = new Set(
      Array.from(selectedPlayers.keys()).map((id) => Number(id)),
    );
    if (currentUser?.id) {
      const uid = Number(currentUser.id);
      if (Number.isFinite(uid) && uid > 0) {
        blocked.add(uid);
      }
    }
    return smartRecommendations.filter((player) => {
      const pid = Number(player.user_id);
      if (!Number.isFinite(pid) || pid <= 0) return false;
      if (blocked.has(pid)) return false;
      if (selectedIds.has(pid)) return false;
      return true;
    });
  }, [smartRecommendations, existingPlayerIds, selectedPlayers, currentUser]);

  const recommendationLimit = Math.max(
    Math.min(outstandingShortfall + 2, 6),
    Math.min(filteredSmartRecommendations.length, 3),
  );

  const displayedSmartRecommendations = useMemo(
    () => filteredSmartRecommendations.slice(0, recommendationLimit),
    [filteredSmartRecommendations, recommendationLimit],
  );

  const handleAddSmartPlayer = useCallback(
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

  const handleAddAllSmartPlayers = useCallback(() => {
    if (displayedSmartRecommendations.length === 0) return;
    let added = 0;
    setSelectedPlayers((prev) => {
      const next = new Map(prev);
      displayedSmartRecommendations.forEach((player) => {
        const pid = Number(player.user_id);
        if (!Number.isFinite(pid) || pid <= 0) return;
        if (next.has(pid)) return;
        next.set(pid, { ...player, user_id: pid });
        added += 1;
      });
      return next;
    });
    if (added > 0) {
      onToast?.(
        `Added ${added} recommended substitute${added === 1 ? "" : "s"} to your invite list.`,
        "success",
      );
    }
  }, [displayedSmartRecommendations, onToast, setSelectedPlayers]);

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
    return typeof status === "string" && status.trim().toLowerCase() === "hosting";
  };

  const canRemove = (pid) => {
    if (isArchived) return false;
    const host = hostId ?? null;
    const isHost = host
      ? memberMatchesAnyId(currentUser, host, memberIdentities)
      : participants.some(
          (participant) =>
            participantIsHost(participant) &&
            memberMatchesParticipant(currentUser, participant, memberIdentities),
        );
    if (!isHost) return false;
    return !memberMatchesAnyId(currentUser, pid, memberIdentities);
  };

  const handleRemoveParticipant = async (playerId) => {
    if (!matchId) return;
    if (!window.confirm("Remove this participant from the match?")) return;
    if (isArchived) {
      onToast("This match has been archived. Participants cannot be removed.", "error");
      return;
    }
    try {
      await removeParticipant(matchId, playerId);
      setParticipants((prev) => {
        const next = prev.filter((p) => !idsMatch(p.player_id, playerId));
        recalcLowOccupancy(next, invitees);
        return next;
      });
      setExistingPlayerIds((prev) => {
        const next = new Set([...prev]);
        next.delete(playerId);
        return next;
      });
      onToast("Participant removed");
    } catch (err) {
      if (isMatchArchivedError(err)) {
        setIsArchived(true);
        setParticipantsError("This match has been archived. Invites are read-only.");
        onToast("This match has been archived. Participants cannot be removed.", "error");
      } else {
        onToast(
          err?.response?.data?.message || "Failed to remove participant",
          "error"
        );
      }
    }
  };

  const openWhatsApp = () => {
    if (!shareLink) return;
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
    const text = encodeURIComponent(parts.join("\n"));
    const url = `https://wa.me/?text=${text}`;
    onToast("Opening WhatsApp...");
    window.open(url, "_blank");
  };

  const openSMS = () => {
    if (!shareLink) return;
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
    const body = encodeURIComponent(parts.join("\n"));
    const url = `sms:?body=${body}`;
    onToast("Opening messages...");
    window.location.href = url;
  };

  const openEmail = () => {
    if (!shareLink) return;
    const when = matchData.dateTime ? ` – ${formatDateTime(matchData.dateTime)}` : "";
    const subject = encodeURIComponent(`Tennis Match Invite${when}`);
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
    const body = encodeURIComponent(parts.join("\n"));
    const url = `mailto:?subject=${subject}&body=${body}`;
    onToast("Opening email...");
    window.location.href = url;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 pb-20">
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <h2 className="text-3xl font-black text-gray-900 mb-3">Invite Players</h2>
          <p className="text-lg font-semibold text-gray-600 mb-4">
            Need {matchData.playerCount - matchData.occupied} more{" "}
            {matchData.playerCount - matchData.occupied === 1 ? "player" : "players"}
          </p>
          {lowOccupancy && !isArchived && (
            <div
              className={`mb-4 rounded-2xl border px-4 py-4 text-sm font-semibold ${lowOccupancyTokens.container}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-black">Low occupancy alert</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${lowOccupancyTokens.badge}`}
                  >
                    {lowOccupancyLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchSmartRecommendations(() => true)}
                  disabled={smartRecommendationsLoading}
                  className="text-xs font-bold underline-offset-2 text-current hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Refresh suggestions
                </button>
              </div>
              <p className="mt-2 text-sm font-semibold">
                Need {lowOccupancy.openSpots} more player
                {lowOccupancy.openSpots === 1 ? "" : "s"} before the match starts in {lowOccupancyTimeLabel}. {" "}
                {outstandingInvites > 0
                  ? `Only ${outstandingInvites} outstanding invite${
                      outstandingInvites === 1 ? "" : "s"
                    } are out right now.`
                  : "No outstanding invites are out yet."}
              </p>
              <div className="mt-4 space-y-3">
                {smartRecommendationsLoading ? (
                  <p className="text-sm">Finding ready-to-play substitutes…</p>
                ) : smartRecommendationsError ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {smartRecommendationsError}
                  </div>
                ) : displayedSmartRecommendations.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>Smart substitutes</span>
                      <button
                        type="button"
                        onClick={handleAddAllSmartPlayers}
                        className={`rounded-lg px-3 py-1 font-black transition-colors ${lowOccupancyTokens.button}`}
                      >
                        Invite all
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {displayedSmartRecommendations.map((player) => {
                        const name = player.full_name || "Unknown player";
                        const skill = player.skill_level || player.ntrp || "";
                        const pid = Number(player.user_id);
                        return (
                          <div
                            key={pid}
                            className="rounded-xl border border-white/60 bg-white/60 px-3 py-3 shadow-sm backdrop-blur"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold text-gray-900">{name}</p>
                                {skill && (
                                  <p className="text-xs font-semibold text-gray-500">NTRP {skill}</p>
                                )}
                                {player.home_court && (
                                  <p className="text-xs font-semibold text-gray-400">
                                    {player.home_court}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddSmartPlayer(player)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all ${lowOccupancyTokens.button}`}
                              >
                                Invite
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm">
                    We'll surface nearby substitutes as soon as we spot good matches. Try searching manually in the meantime.
                  </p>
                )}
              </div>
            </div>
          )}
          {isArchived && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
              <span className="font-black">ARCHIVED</span>
              This match has been archived. Invites are read-only.
            </div>
          )}
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
                <User className="w-4 h-4" /> Host: {matchData.hostName}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-6">
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
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
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

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="space-y-5">
              <div>
                <label className="mb-3 block text-sm font-black uppercase tracking-wider text-gray-900">
                  Search & invite players
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
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
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 pl-11 font-semibold text-gray-800 focus:border-green-500 focus:ring-2 focus:ring-green-500"
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
                        disabled={pagination.page >= Math.ceil(pagination.total / pagination.perPage)}
                        className="rounded-lg border border-gray-200 px-3 py-1 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 transition-all hover:scale-105 ${
                            selected
                              ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 shadow-md"
                              : "border-gray-200 hover:border-gray-300 bg-white"
                          }`}
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black shadow-md ${
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
                      );
                    })}
                  </div>

                  {pagination && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        Previous
                      </button>
                      <span className="text-sm font-semibold text-gray-600">
                        Page {pagination.page} of {Math.ceil(pagination.total / pagination.perPage)}
                      </span>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={pagination.page >= Math.ceil(pagination.total / pagination.perPage)}
                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

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
              <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Share Link</h3>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-600 sm:flex-1"
                />
                <button
                  onClick={copyLink}
                  disabled={!shareLink}
                  className={`w-full rounded-xl px-5 py-3 font-black transition-all sm:w-auto ${
                    copiedLink
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                      : "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-xl hover:scale-105 shadow-lg"
                  }`}
                >
                  {copiedLink ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

          {selectedPlayers.size > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                  Selected ({totalSelectedInvitees})
                </h3>
                <button
                  onClick={() => setSelectedPlayers(new Map())}
                  className="w-full text-left text-sm font-bold text-gray-500 transition-colors hover:text-gray-700 sm:w-auto sm:text-right"
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
              </div>
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            <button
              onClick={() => onDone?.("cancel")}
              className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors"
            >
              SAVE FOR LATER
            </button>
            <button
              onClick={async () => {
                if (selectedPlayers.size === 0) {
                  onToast("Please select at least one player", "error");
                  return;
                }
                if (!matchId) {
                  onToast("No match selected for invites", "error");
                  return;
                }
                if (isArchived) {
                  onToast("This match has been archived. Invites cannot be sent.", "error");
                  return;
                }
                try {
                  const newIds = Array.from(selectedPlayers.keys())
                    .map((id) => Number(id))
                    .filter(
                      (id) => Number.isFinite(id) && id > 0 && !existingPlayerIds.has(id)
                    );
                  if (newIds.length === 0) {
                    onToast("No new players selected", "error");
                    return;
                  }
                  await updateMatch(matchId, { status: "upcoming" });
                  const response = await sendInvites(matchId, {
                    playerIds: newIds,
                    phoneNumbers: [],
                  });
                  const message = response?.message
                    ? response.message
                    : `Invites sent to ${newIds.length} ${
                        newIds.length === 1 ? "player" : "players"
                      }! 🎾`;
                  onToast(message);
                  onDone?.("sent");
                } catch (err) {
                  if (isMatchArchivedError(err)) {
                    setIsArchived(true);
                    onToast(
                      "This match has been archived. Invites cannot be sent.",
                      "error"
                    );
                  } else {
                    onToast(
                      err.response?.data?.message || "Failed to send invites",
                      "error"
                    );
                  }
                }
              }}
              disabled={isArchived}
              className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
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

export default InviteScreen;
