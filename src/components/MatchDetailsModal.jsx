import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  getShareLink,
  joinMatch,
  leaveMatch,
  removeParticipant,
} from "../services/matches";
import { isMatchArchivedError } from "../utils/archive";
import {
  countUniqueMatchOccupants,
  idsMatch,
  pruneParticipantFromMatchData,
  uniqueAcceptedInvitees,
  uniqueActiveParticipants,
  uniqueParticipants,
} from "../utils/participants";
import {
  DEFAULT_EVENT_DURATION_MINUTES,
  downloadICSFile,
  ensureEventEnd,
  openGoogleCalendar,
  openOutlookCalendar,
} from "../utils/calendar";

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
  if (match.skill_level) {
    parts.push(`Skill level: ${match.skill_level}`);
  }
  if (match.notes) {
    parts.push(match.notes);
  }
  return parts.join(". ");
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
}) => {
  const [status, setStatus] = useState("details");
  const [joining, setJoining] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
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

  const hostParticipant = useMemo(() => {
    if (!match?.host_id) return null;
    return (
      participants.find((p) => idsMatch(p.player_id, match.host_id)) || null
    );
  }, [match?.host_id, participants]);

  const hostProfile = match?.host_profile || hostParticipant?.profile || null;
  const hostName =
    hostProfile?.full_name ||
    hostProfile?.fullName ||
    match?.host_name ||
    hostParticipant?.profile?.name ||
    "Match Organizer";

  const hostAvatar = hostProfile?.avatar_url || hostProfile?.avatar || null;

  const committedParticipants = useMemo(
    () => uniqueActiveParticipants(participants),
    [participants],
  );

  const acceptedInvitees = useMemo(
    () => uniqueAcceptedInvitees(invitees),
    [invitees],
  );

  const numericPlayerLimit = useMemo(() => {
    const candidate =
      match?.player_limit ??
      match?.playerLimit ??
      match?.player_count ??
      match?.match_player_limit;
    const numeric = Number(candidate);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }, [match]);

  const totalCommitted = countUniqueMatchOccupants(participants, invitees);

  const remainingSpots =
    numericPlayerLimit === null
      ? null
      : Math.max(numericPlayerLimit - totalCommitted, 0);

  const isHost =
    currentUser?.id && match?.host_id
      ? idsMatch(currentUser.id, match.host_id)
      : false;
  const isParticipant = committedParticipants.some((p) =>
    idsMatch(p.player_id, currentUser?.id),
  );
  const hasAcceptedInvite = acceptedInvitees.some(
    (invite) =>
      idsMatch(invite.invitee_id, currentUser?.id) ||
      idsMatch(invite.player_id, currentUser?.id),
  );
  const isJoined = isHost || isParticipant || hasAcceptedInvite;

  const isArchived = match?.status === "archived";
  const isCancelled = match?.status === "cancelled";
  const isUpcoming = match?.status === "upcoming";
  const isOpenMatch = match?.privacy !== "private";
  const isFull = remainingSpots === 0;

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
      setStatus("details");
      setJoining(false);
      setLeaving(false);
      return;
    }
    if (status === "success") return;
    if (isJoined) {
      setStatus("alreadyJoined");
    } else if (isFull) {
      setStatus("full");
    } else {
      setStatus("details");
    }
  }, [isOpen, isJoined, isFull, status]);

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

  const shareEmailSubject = useMemo(() => {
    const base = shareMatchLabel || "Tennis Match";
    if (!shareDateTimeLabel) return `${base} Invite`;
    return `${base} – ${shareDateTimeLabel}`;
  }, [shareDateTimeLabel, shareMatchLabel]);

  const shareLinkReady = !!shareLink && !shareLoading;

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

  const handleRefreshShareLink = () => {
    if (shareLoading || !isOpenMatch || !match?.id) return;
    requestShareLink({ silent: false });
  };

  const matchDistanceLabel = useMemo(
    () =>
      distanceLabel(
        match?.distance_miles ?? match?.distanceMiles ?? match?.distance,
      ),
    [match?.distance, match?.distanceMiles, match?.distance_miles],
  );

  const playersList = useMemo(() => {
    const list = committedParticipants.map((participant) => {
      const profile = participant.profile || {};
      return {
        id: participant.id || participant.player_id,
        playerId: participant.player_id,
        name:
          profile.full_name ||
          profile.fullName ||
          profile.name ||
          `Player ${participant.player_id}`,
        avatar: profile.avatar_url || profile.avatar,
        isHost: participant.player_id === match?.host_id,
        rating:
          profile.usta_rating ||
          profile.rating ||
          profile.skill_rating ||
          profile.ntrp_rating ||
          null,
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
      if (isMatchArchivedError(error)) {
        onToast?.("This match has been archived. You can't join.", "error");
      } else {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          "Failed to join match";
        onToast?.(message, "error");
      }
      if (error?.response?.data?.error === "match_full") {
        setStatus("full");
      } else if (error?.response?.data?.error === "already_joined") {
        setStatus("alreadyJoined");
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
        return (
          <div
            key={player.id}
            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
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
                <p className="text-xs font-semibold text-gray-500">Rating {player.rating}</p>
              )}
            </div>
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
      {match.privacy === "private" ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-600">
          Private Match
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-600">
          Open Match
        </span>
      )}
      {Number.isFinite(numericPlayerLimit) && (
        <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-600">
          {totalCommitted}/{numericPlayerLimit} players
        </span>
      )}
    </div>
  );

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
                {match.skill_level && (
                  <p className="text-xs font-semibold text-gray-500">Skill level: {match.skill_level}</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-black text-gray-900">
                Players
                {Number.isFinite(numericPlayerLimit) && ` (${numericPlayerLimit} max)`}
              </p>
            </div>
            {renderPlayers()}
          </section>

          {isOpenMatch && !isArchived && !isCancelled && (
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

          {match.privacy === "private" && (
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
    <div className="flex flex-col">
      <div className="rounded-t-3xl bg-gradient-to-br from-emerald-500 to-green-500 p-6 text-center text-white">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 id="match-details-heading" className="text-2xl font-black">
          Match Joined!
        </h2>
        <p className="mt-1 text-sm font-semibold text-white/80">
          You're successfully on the roster. We'll send the organizer a heads-up.
        </p>
      </div>

      <div className="space-y-6 p-6">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-900">Match Confirmed</p>
              <p className="text-sm font-semibold text-emerald-800">
                {startDate
                  ? formatDateTime
                    ? formatDateTime(startDate)
                    : startDate.toLocaleString()
                  : "Date coming soon"}
              </p>
              {eventDetails?.location && (
                <p className="text-xs font-semibold text-emerald-700">
                  {eventDetails.location}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-black text-gray-900">What happens next</p>
          <ul className="space-y-2 text-sm font-semibold text-gray-600">
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
        </div>

        <div className="space-y-3">
          <p className="text-sm font-black text-gray-900">Add to calendar</p>
          <div className="grid grid-cols-2 gap-3 text-sm font-semibold">
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
        </div>

        <div className="space-y-2 rounded-2xl bg-gray-50 p-4 text-sm font-semibold text-gray-600">
          <div className="flex items-center gap-2 text-gray-700">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Invite friends to fill the last spot!
          </div>
          <p className="text-xs text-gray-500">
            Share this match with your crew so you can lock in doubles partners.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back to Matches
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-3 text-sm font-black text-white shadow-lg transition-all hover:shadow-xl"
          >
            Find More Matches
          </button>
        </div>
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
