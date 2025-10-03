// src/pages/MatchPage.jsx
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Calendar,
  MapPin,
  ClipboardList,
  FileText,
  X,
  ChevronLeft,
  User,
  Check,
  Clock,
  CheckCircle2,
} from "lucide-react";
import Header from "../components/Header.jsx";
import { getMatch, joinMatch, removeParticipant } from "../services/matches";
import { ARCHIVE_FILTER_VALUE, isMatchArchivedError } from "../utils/archive";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const parsePlayerLimit = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const formatDistanceLabel = (match) => {
  const distanceRaw =
    match.distanceMiles ?? match.distance_miles ?? match.distance ?? null;
  const distance =
    typeof distanceRaw === "string" ? Number.parseFloat(distanceRaw) : distanceRaw;
  if (!Number.isFinite(distance)) return "";
  const rounded = Math.round(distance * 10) / 10;
  return `${rounded} miles away`;
};

const getInitials = (name) => {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return name.charAt(0).toUpperCase();
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return initials.join("") || name.charAt(0).toUpperCase();
};

const toTitleCase = (value) => {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .replace(/(^|\s)\w/g, (match) => match.toUpperCase());
};

const getRatingLabel = (profile = {}) => {
  const { usta_rating, uta_rating, rating, skill_level, skillLevel } = profile;
  const ratingValue =
    usta_rating ?? uta_rating ?? rating ?? skill_level ?? skillLevel ?? null;
  if (ratingValue === null || ratingValue === undefined || ratingValue === "")
    return "";
  if (typeof ratingValue === "number") {
    return (Math.round(ratingValue * 10) / 10).toString();
  }
  return String(ratingValue);
};

const formatTimeRange = (start, end) => {
  if (!start) return "";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "";
  const startLabel = timeFormatter.format(startDate);
  if (!end) return startLabel;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return startLabel;
  return `${startLabel} – ${timeFormatter.format(endDate)}`;
};

const PlayerSlot = ({ participant, isHost, canRemove, onRemove }) => {
  if (!participant) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-3 py-3 sm:px-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-300 text-gray-400">
          <User className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-gray-600">Waiting for player</p>
          <p className="text-xs text-gray-500">Open spot</p>
        </div>
      </div>
    );
  }

  const name =
    participant.profile?.full_name ||
    participant.profile?.name ||
    `Player ${participant.player_id}`;
  const rating = getRatingLabel(participant.profile);
  const statusLabel = participant.status ? toTitleCase(participant.status) : "Confirmed";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-3 shadow-sm sm:px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-lg font-semibold text-white">
        {getInitials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-gray-900">{name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {rating && (
            <span className="font-semibold text-gray-600">
              Rating <span className="font-semibold text-gray-900">{rating}</span>
            </span>
          )}
          {participant.status && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              {statusLabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isHost && (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Host
          </span>
        )}
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove?.(participant.player_id)}
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Remove participant"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const ConfirmationModal = ({ open, match, players, onClose }) => {
  if (!open || !match) return null;

  const distanceLabel = formatDistanceLabel(match);
  const matchType = match.type === "private" ? "Private Match" : "Open Match";
  const matchFormat = match.match_format || match.format || match.matchType || "Tennis";
  const dateLabel = match.start_date_time
    ? dateFormatter.format(new Date(match.start_date_time))
    : "";
  const timeLabel = formatTimeRange(match.start_date_time, match.end_date_time);

  const nextSteps = [
    "We'll email match details",
    "Expect a reminder before the match",
    "Organizer will be notified you joined",
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[28px] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative bg-gradient-to-b from-emerald-400 via-emerald-500 to-emerald-600 px-6 py-10 text-center text-white sm:px-10">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Close confirmation"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
            Match Joined!
          </h2>
          <p className="mt-2 text-sm text-white/80">
            You're successfully joined this match.
          </p>
        </div>
        <div className="space-y-6 px-6 py-6 sm:px-10 sm:py-10">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-5 text-left text-emerald-900">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
              Match Confirmed
            </p>
            <div className="mt-3 space-y-3 text-sm text-emerald-900">
              {dateLabel && (
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-semibold">{dateLabel}</p>
                    {timeLabel && <p className="text-emerald-700">{timeLabel}</p>}
                  </div>
                </div>
              )}
              {match.location_text && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-semibold">{match.location_text}</p>
                    {distanceLabel && (
                      <p className="text-emerald-700">{distanceLabel}</p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-semibold">{matchFormat}</p>
                  <p className="text-emerald-700">{matchType}</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-900">What happens next</h3>
            <ul className="mt-3 space-y-2">
              {nextSteps.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                  <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-900">Add to calendar</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Google", key: "google" },
                { label: "Outlook", key: "outlook" },
                { label: ".ics File", key: "ics" },
              ].map(({ label, key }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => console.info(`Calendar action selected: ${key}`)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-700 transition hover:border-emerald-200 hover:text-emerald-600"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-700">
            <div>
              <p className="font-semibold">Match reminders</p>
              <p className="text-xs text-gray-500">SMS notifications before the match</p>
            </div>
            <div className="relative inline-flex h-7 w-12 items-center rounded-full bg-emerald-500">
              <span className="absolute right-1 h-5 w-5 rounded-full bg-white shadow" />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Link
                to="/"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 sm:w-auto"
              >
                Back to home
              </Link>
              <Link
                to="/"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center rounded-full border border-emerald-200 px-5 py-3 text-sm font-semibold text-emerald-600 transition hover:border-emerald-300 hover:text-emerald-700 sm:w-auto"
              >
                Find more matches
              </Link>
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
              Invite friends to fill the last spot
            </p>
          </div>

          {players?.length ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Players</h3>
              <div className="mt-3 grid gap-3">
                {players.map((slot, index) => (
                  <PlayerSlot
                    key={slot?.player_id ?? `slot-${index}`}
                    participant={slot}
                    isHost={slot?.player_id === match.host_id}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ icon, children }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
      {icon}
    </div>
    <div className="text-sm text-gray-600">{children}</div>
  </div>
);

export default function MatchPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [archived, setArchived] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [currentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const loadMatch = useCallback(async () => {
    try {
      const fetchMatch = async () => {
        try {
          return await getMatch(id);
        } catch (error) {
          if (!isMatchArchivedError(error)) throw error;
          return await getMatch(id, { filter: ARCHIVE_FILTER_VALUE });
        }
      };

      const resp = await fetchMatch();
      setArchived(resp?.match?.status === "archived");
      setData(resp);
      setErr("");
    } catch (error) {
      if (isMatchArchivedError(error)) {
        setArchived(true);
        setErr("This match has been archived and is no longer accessible.");
      } else {
        setErr("Not found or access denied.");
      }
    }
  }, [id]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  const handleRemoveParticipant = async (playerId) => {
    if (!data) return;
    if (!window.confirm("Remove this participant from the match?")) return;
    if (archived) {
      setRemoveError("This match has been archived. Participants cannot be removed.");
      setTimeout(() => setRemoveError(""), 3000);
      return;
    }
    try {
      await removeParticipant(data.match.id, playerId);
      await loadMatch();
    } catch (error) {
      if (isMatchArchivedError(error)) {
        setArchived(true);
        setRemoveError("This match has been archived. Participants cannot be removed.");
      } else {
        setRemoveError("Failed to remove participant");
      }
      setTimeout(() => setRemoveError(""), 3000);
    }
  };

  const handleJoinMatch = async () => {
    if (!data?.match) return;
    if (archived) {
      setJoinError("This match has been archived. Joining is disabled.");
      return;
    }
    setJoinError("");
    try {
      setJoining(true);
      await joinMatch(data.match.id);
      await loadMatch();
      setShowConfirmation(true);
    } catch (error) {
      if (isMatchArchivedError(error)) {
        setArchived(true);
        setJoinError("This match has been archived. Joining is disabled.");
      } else {
        const apiMessage = error?.response?.data?.message || error?.message;
        setJoinError(apiMessage || "Failed to join match. Please try again.");
      }
    } finally {
      setJoining(false);
    }
  };

  if (err) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gray-50 pb-12">
          <div className="mx-auto max-w-3xl px-4 pt-10">
            <div className="rounded-3xl border border-red-100 bg-white p-6 text-red-600 shadow-sm">
              {err}
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gray-50 pb-12">
          <div className="mx-auto max-w-3xl px-4 pt-10">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 text-gray-600 shadow-sm">
              Loading match details…
            </div>
          </div>
        </main>
      </>
    );
  }

  const { match, participants = [], invitees = [] } = data;
  const isHost = currentUser?.id === match.host_id;
  const committedParticipants = participants.filter((p) => p.status !== "left");
  const sortedParticipants = [...committedParticipants].sort((a, b) => {
    if (a.player_id === match.host_id) return -1;
    if (b.player_id === match.host_id) return 1;
    const aJoined = new Date(a.joined_at || a.created_at || 0).getTime();
    const bJoined = new Date(b.joined_at || b.created_at || 0).getTime();
    return aJoined - bJoined;
  });

  const numericPlayerLimit = parsePlayerLimit(match.player_limit);
  const remainingSpots = Number.isFinite(numericPlayerLimit)
    ? Math.max(numericPlayerLimit - sortedParticipants.length, 0)
    : 0;
  const slotParticipants = Number.isFinite(numericPlayerLimit)
    ? [
        ...sortedParticipants,
        ...Array.from({ length: remainingSpots }, () => null),
      ]
    : sortedParticipants;

  const isJoined = sortedParticipants.some(
    (participant) => participant.player_id === currentUser?.id,
  );
  const matchTypeLabel = match.type === "private" ? "Private Match" : "Open Match";
  const matchFormatLabel = match.match_format || match.format || match.matchType || "Match";
  const dateLabel = match.start_date_time
    ? dateFormatter.format(new Date(match.start_date_time))
    : "TBD";
  const timeLabel = formatTimeRange(match.start_date_time, match.end_date_time);
  const distanceLabel = formatDistanceLabel(match);
  const isUpcoming = !match.status || match.status === "upcoming";

  const canJoin =
    !isHost &&
    !isJoined &&
    !archived &&
    isUpcoming &&
    (!Number.isFinite(numericPlayerLimit) || remainingSpots > 0);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white pb-20">
        <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-8 sm:pt-12">
          <div className="mb-4 flex items-center text-sm font-semibold text-emerald-600">
            <Link to="/" className="inline-flex items-center gap-1 transition hover:text-emerald-700">
              <ChevronLeft className="h-4 w-4" /> Back
            </Link>
          </div>
          <div className="overflow-hidden rounded-[32px] border border-emerald-100 bg-white shadow-xl shadow-emerald-100/40">
            <div className="border-b border-emerald-50 bg-gradient-to-r from-emerald-50 via-white to-white px-6 py-8 sm:px-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                    {matchTypeLabel}
                  </p>
                  <h1 className="mt-2 text-2xl font-black text-gray-900 sm:text-3xl">Match Details</h1>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-emerald-500" />
                      {dateLabel}
                    </span>
                    {timeLabel && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-4 w-4 text-emerald-500" />
                        {timeLabel}
                      </span>
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {Number.isFinite(numericPlayerLimit)
                    ? `${sortedParticipants.length}/${numericPlayerLimit} players`
                    : `${sortedParticipants.length} players`}
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <InfoRow icon={<MapPin className="h-5 w-5 text-emerald-500" />}>
                  <p className="font-semibold text-gray-900">{match.location_text || "Location TBA"}</p>
                  {distanceLabel && <p className="text-sm text-gray-500">{distanceLabel}</p>}
                </InfoRow>
                <InfoRow icon={<ClipboardList className="h-5 w-5 text-emerald-500" />}>
                  <p className="font-semibold text-gray-900">{matchFormatLabel}</p>
                  <p className="text-sm text-gray-500">{matchTypeLabel}</p>
                </InfoRow>
              </div>
              {match.notes && (
                <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                  <div className="flex items-start gap-2 text-sm text-emerald-900">
                    <FileText className="mt-0.5 h-4 w-4" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        Notes from organizer
                      </p>
                      <p className="mt-1 text-sm font-medium text-emerald-900">{match.notes}</p>
                    </div>
                  </div>
                </div>
              )}
              {match.status === "cancelled" && (
                <div className="mt-6">
                  <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-600">
                    Cancelled
                  </span>
                </div>
              )}
              {archived && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  This match has been archived. Actions are disabled.
                </div>
              )}
            </div>
            <div className="px-6 py-6 sm:px-10 sm:py-10">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Players
                      {Number.isFinite(numericPlayerLimit) && (
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          ({sortedParticipants.length}/{numericPlayerLimit})
                        </span>
                      )}
                    </h2>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                      {matchTypeLabel}
                    </p>
                  </div>
                  {removeError && (
                    <p className="mt-2 text-sm text-red-600">{removeError}</p>
                  )}
                  <div className="mt-4 grid gap-3">
                    {slotParticipants.length ? (
                      slotParticipants.map((participant, index) => (
                        <PlayerSlot
                          key={participant?.player_id ?? `slot-${index}`}
                          participant={participant}
                          isHost={participant?.player_id === match.host_id}
                          canRemove={Boolean(
                            participant &&
                              isHost &&
                              !archived &&
                              participant.player_id !== match.host_id,
                          )}
                          onRemove={handleRemoveParticipant}
                        />
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                        No players yet. Be the first to join!
                      </div>
                    )}
                  </div>
                </div>
                {invitees.length > 0 && (
                  <div className="rounded-3xl border border-gray-100 bg-gray-50 px-4 py-4">
                    <h3 className="text-sm font-semibold text-gray-800">Invited players</h3>
                    <ul className="mt-3 space-y-2 text-sm text-gray-600">
                      {invitees.map((invite) => (
                        <li
                          key={invite.id || invite.invitee_id}
                          className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm shadow-sm"
                        >
                          <span className="font-medium text-gray-900">
                            {invite.profile?.full_name ||
                              invite.profile?.name ||
                              invite.email ||
                              invite.phone_number ||
                              "Player"}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            {toTitleCase(invite.status)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-emerald-50 bg-gradient-to-r from-white to-emerald-50 px-6 py-6 sm:px-10 sm:py-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2 text-sm text-gray-600">
                  <p className="font-semibold text-gray-900">Ready to play?</p>
                  <p>
                    {Number.isFinite(numericPlayerLimit)
                      ? `${remainingSpots} spot${remainingSpots === 1 ? "" : "s"} left`
                      : "Spots available"}
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  {isHost && (
                    <Link
                      to={`/matches/${match.id}/invite`}
                      className="inline-flex w-full items-center justify-center rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-600 transition hover:border-emerald-300 hover:text-emerald-700 sm:w-auto"
                    >
                      Invite more players
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleJoinMatch}
                    disabled={!canJoin || joining}
                    className={`inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 sm:w-auto ${
                      !canJoin || joining
                        ? "cursor-not-allowed bg-emerald-300"
                        : "bg-emerald-500 hover:bg-emerald-600"
                    }`}
                  >
                    {isJoined
                      ? "You're in this match"
                      : joining
                      ? "Joining match..."
                      : canJoin
                      ? "Join this match"
                      : remainingSpots === 0
                      ? "Match full"
                      : "Join unavailable"}
                  </button>
                </div>
              </div>
              {joinError && <p className="mt-3 text-sm text-red-600">{joinError}</p>}
              {isJoined && !joinError && (
                <p className="mt-3 text-sm font-medium text-emerald-600">
                  You're confirmed for this match.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
      <ConfirmationModal
        open={showConfirmation}
        match={match}
        players={sortedParticipants}
        onClose={() => setShowConfirmation(false)}
      />
    </>
  );
}
