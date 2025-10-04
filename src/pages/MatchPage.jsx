import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  Sparkles,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import Header from "../components/Header.jsx";
import {
  getMatch,
  joinMatch,
  leaveMatch,
} from "../services/matches";
import { ARCHIVE_FILTER_VALUE, isMatchArchivedError } from "../utils/archive";

const SAFE_AREA_PADDING = {
  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
};

export default function MatchPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [status, setStatus] = useState("loading");
  const [data, setData] = useState(null);
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [inviteConfirmOpen, setInviteConfirmOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [currentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const fetchMatch = useCallback(
    async ({ silent = false } = {}) => {
      if (!id) return;
      if (!silent) {
        setStatus("loading");
        setError("");
      }

      const loadMatch = async () => {
        try {
          return await getMatch(id);
        } catch (err) {
          if (!isMatchArchivedError(err)) throw err;
          return getMatch(id, { filter: ARCHIVE_FILTER_VALUE });
        }
      };

      try {
        const response = await loadMatch();
        setData(response);
        setArchived(response?.match?.status === "archived");
        setStatus("ready");
      } catch (err) {
        if (isMatchArchivedError(err)) {
          setArchived(true);
        }
        if (!silent) {
          setError("Couldn't load match. Retry.");
          setStatus("error");
        }
      }
    },
    [id],
  );

  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const match = data?.match || {};
  const participants = useMemo(
    () => getActiveParticipants(data),
    [data],
  );

  const currentUserId = toNumber(currentUser?.id);
  const hostId = toNumber(match?.host_id);
  const isHost = Boolean(currentUserId && hostId && currentUserId === hostId);
  const isJoined = Boolean(
    participants.some((p) => toNumber(p.player_id) === currentUserId) || isHost,
  );

  const totalSlots = useMemo(() => {
    const candidates = [match?.player_limit, match?.playerLimit];
    for (const candidate of candidates) {
      const numeric = toNumber(candidate);
      if (numeric) return numeric;
    }
    return null;
  }, [match?.playerLimit, match?.player_limit]);

  const filledSlots = participants.length;
  const openSlots = Math.max(
    totalSlots ? totalSlots - filledSlots : 0,
    0,
  );
  const hasCapacity = totalSlots ? openSlots > 0 : true;
  const distanceLabel = formatDistance(match?.distance_miles ?? match?.distance);

  const dateTimeLabel = formatDateTimeRange(match);
  const locationLabel = match?.location_text || match?.location || "";
  const mapsLink = getMapsLink(match);
  const matchTypeLabel = formatMatchType(match);
  const skillLabel = formatSkillTag(match);
  const playerRating = formatRating(currentUser?.rating);
  const notes = match?.notes?.trim() || "";
  const isCancelled = match?.status === "cancelled";

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/", { replace: false });
  };

  const showToast = (message, type = "info") => {
    setToast({ message, type });
  };

  const handleJoin = async () => {
    if (!match?.id || joining) return;
    setJoining(true);
    try {
      await joinMatch(match.id);
      await fetchMatch({ silent: true });
      setJoinModalOpen(true);
    } catch (err) {
      if (isMatchArchivedError(err)) {
        setArchived(true);
        showToast("This match has been archived. Actions are disabled.", "error");
        await fetchMatch({ silent: true });
      } else if (err?.status === 409) {
        showToast("Match just filled up.", "error");
        await fetchMatch({ silent: true });
      } else if (err?.status === 401 || err?.status === 403) {
        showToast("Sign in to join matches.", "error");
      } else {
        const message =
          err?.data?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Could not join match. Try again.";
        showToast(message, "error");
      }
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!match?.id || leaving) return;
    setLeaving(true);
    try {
      await leaveMatch(match.id);
      setLeaveModalOpen(false);
      await fetchMatch({ silent: true });
    } catch (err) {
      if (isMatchArchivedError(err)) {
        setArchived(true);
        setLeaveModalOpen(false);
        showToast("This match has been archived. Actions are disabled.", "error");
        await fetchMatch({ silent: true });
      } else {
        showToast("Could not leave match. Try again.", "error");
      }
    } finally {
      setLeaving(false);
    }
  };

  const filledLabel = totalSlots
    ? `${filledSlots}/${totalSlots} filled`
    : `${filledSlots} player${filledSlots === 1 ? "" : "s"}`;

  const joinButtonDisabled =
    joining ||
    archived ||
    isCancelled ||
    isJoined ||
    !hasCapacity;

  const joinButtonLabel = !hasCapacity && !isJoined
    ? "Match is full"
    : joining
      ? "Joining…"
      : "Accept & Join";

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-white text-slate-900">
      <Header />
      <main
        className="mx-auto w-full max-w-2xl px-4 pt-6 sm:pt-10"
        style={SAFE_AREA_PADDING}
      >
        {status === "error" ? (
          <ErrorState onRetry={fetchMatch} message={error} />
        ) : status === "loading" ? (
          <LoadingState />
        ) : (
          <div className="space-y-8 pb-10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goBack}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                  Match Details
                </span>
                <div className="flex flex-wrap items-center gap-x-3 text-sm text-slate-500">
                  <span>{dateTimeLabel}</span>
                  {distanceLabel && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Sparkles className="h-3.5 w-3.5" />
                      {distanceLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                      {match?.title || matchTypeLabel || "Match"}
                    </h1>
                    <p className="mt-2 text-sm font-semibold text-slate-500">
                      Organized by {getHostName(match)}
                      {isHost && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Host
                        </span>
                      )}
                    </p>
                  </div>
                  {(isCancelled || archived) && (
                    <div className="flex flex-wrap gap-2">
                      {isCancelled && (
                        <StatusPill color="rose">
                          Cancelled
                        </StatusPill>
                      )}
                      {archived && (
                        <StatusPill color="slate">Archived</StatusPill>
                      )}
                    </div>
                  )}
                </header>

                <div className="mt-6 space-y-4">
                  <InfoRow
                    icon={CalendarDays}
                    label="Date & Time"
                    value={dateTimeLabel}
                  />
                  {locationLabel && (
                    <InfoRow
                      icon={MapPin}
                      label="Location"
                      value={locationLabel}
                      action={
                        mapsLink
                          ? {
                              href: mapsLink,
                              label: "View in Maps",
                            }
                          : null
                      }
                    />
                  )}
                  {matchTypeLabel && (
                    <InfoRow
                      icon={ClipboardList}
                      label="Match Type"
                      value={matchTypeLabel}
                    />
                  )}
                  {skillLabel && (
                    <InfoRow
                      icon={Sparkles}
                      label="Skill Level"
                      value={skillLabel}
                      accent
                    />
                  )}
                  {playerRating && (
                    <InfoRow
                      icon={Star}
                      label="Rating"
                      value={playerRating}
                    />
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                      Players
                      {totalSlots ? ` (${filledSlots}/${totalSlots})` : ""}
                    </h2>
                    <p className="text-sm font-semibold text-slate-500">
                      {filledLabel}
                    </p>
                  </div>
                  {isHost && (
                    <button
                      type="button"
                      onClick={() => setInviteConfirmOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-100"
                    >
                      <UserPlus className="h-4 w-4" /> Invite more players
                    </button>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  {participants.map((participant, index) => (
                    <ParticipantRow
                      key={participant.id || participant.player_id || index}
                      participant={participant}
                      isCurrentUser={
                        currentUserId &&
                        toNumber(participant.player_id) === currentUserId
                      }
                    />
                  ))}
                  {totalSlots && openSlots > 0 &&
                    Array.from({ length: openSlots }).map((_, index) => (
                      <WaitingRow key={`open-${index}`} />
                    ))}
                  {!participants.length && (!totalSlots || openSlots === 0) && (
                    <p className="text-sm font-semibold text-slate-500">
                      No confirmed players yet.
                    </p>
                  )}
                </div>
              </section>

              {notes && (
                <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900">
                    Notes from Organizer
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {notes}
                  </p>
                </section>
              )}

              <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="space-y-3">
                  {!archived && !isCancelled && !isJoined && (
                    <button
                      type="button"
                      onClick={handleJoin}
                      disabled={joinButtonDisabled}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {joining && <Loader2 className="h-5 w-5 animate-spin" />}
                      {joinButtonLabel}
                    </button>
                  )}

                  {isJoined && !archived && (
                    <button
                      type="button"
                      onClick={() => setLeaveModalOpen(true)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-base font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Leave Match
                    </button>
                  )}

                  {(!hasCapacity || isCancelled || archived) && !isJoined && (
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-6 py-3 text-base font-bold text-slate-400"
                    >
                      Match is full
                    </button>
                  )}

                  {(archived || isCancelled) && (
                    <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actions are disabled for this match.
                    </p>
                  )}

                  {isHost && (
                    <button
                      type="button"
                      onClick={() => setInviteConfirmOpen(true)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-6 py-3 text-base font-bold text-emerald-600 transition hover:bg-emerald-100"
                    >
                      <UserPlus className="h-5 w-5" /> Invite more players
                    </button>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      <ConfirmationModal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        title="You're in!"
        description="We’ve added this to your Matches."
        matchSummary={{
          dateTime: dateTimeLabel,
          location: locationLabel,
          matchType: matchTypeLabel,
        }}
        primaryLabel="OK"
        onPrimary={() => setJoinModalOpen(false)}
      />

      <DecisionModal
        open={leaveModalOpen}
        title="Leave this match?"
        description="Are you sure you want to remove yourself from this match?"
        confirmLabel={leaving ? "Leaving…" : "Leave"}
        confirmTone="danger"
        onClose={() => (leaving ? null : setLeaveModalOpen(false))}
        onConfirm={handleLeave}
        confirmDisabled={leaving}
      />

      <DecisionModal
        open={inviteConfirmOpen}
        title="Invite more players?"
        description="We’ll take you to the invite screen to add more players."
        confirmLabel="Invite players"
        onClose={() => setInviteConfirmOpen(false)}
        onConfirm={() => {
          setInviteConfirmOpen(false);
          if (match?.id) {
            navigate(`/matches/${match.id}/invite`);
          }
        }}
      />

      {toast && (
        <div
          className={`pointer-events-none fixed bottom-6 left-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white shadow-xl ${toast.type === "error" ? "bg-rose-500" : "bg-slate-900"}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-slate-200/80" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded-full bg-slate-200" />
          <div className="h-4 w-48 rounded-full bg-slate-200" />
        </div>
      </div>

      <SkeletonCard rows={4} />
      <SkeletonCard rows={3} />
    </div>
  );
}

function SkeletonCard({ rows = 3 }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="h-5 w-32 rounded-full bg-slate-200" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-4 w-full rounded-full bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-base font-semibold text-slate-600">{message}</p>
      <button
        type="button"
        onClick={() => onRetry({ silent: false })}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl"
      >
        Try again
      </button>
    </div>
  );
}

function ParticipantRow({ participant, isCurrentUser }) {
  const name = getParticipantName(participant);
  const rating = formatRating(
    participant?.profile?.usta_rating ??
      participant?.profile?.rating ??
      participant?.rating,
  );
  const initials = getInitials(name);

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-600 text-base font-bold text-white shadow-md">
          {initials || "🎾"}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {name}
            {isCurrentUser && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                You
              </span>
            )}
          </p>
          {rating && (
            <p className="text-xs font-semibold text-slate-500">
              Rating {rating}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function WaitingRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-emerald-200 text-emerald-500">
        <Users className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500">
          Waiting for player
        </p>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, action, accent = false }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${accent ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-700"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="text-sm font-semibold text-slate-900">
            {value}
          </p>
        </div>
      </div>
      {action && action.href && (
        <a
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-bold text-emerald-600 hover:text-emerald-700"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}

function StatusPill({ children, color }) {
  const styles =
    color === "rose"
      ? "bg-rose-50 text-rose-600 border border-rose-200"
      : "bg-slate-100 text-slate-600 border border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${styles}`}>
      {children}
    </span>
  );
}

function ConfirmationModal({
  open,
  onClose,
  onPrimary,
  title,
  description,
  matchSummary,
  primaryLabel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-2xl font-black text-slate-900">{title}</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">{description}</p>

        <div className="mt-5 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          {matchSummary?.dateTime && (
            <SummaryRow label="Date & Time" value={matchSummary.dateTime} />
          )}
          {matchSummary?.location && (
            <SummaryRow label="Location" value={matchSummary.location} />
          )}
          {matchSummary?.matchType && (
            <SummaryRow label="Match Type" value={matchSummary.matchType} />
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onPrimary?.();
            onClose?.();
          }}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:shadow-xl"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

function DecisionModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  confirmTone = "primary",
  confirmDisabled = false,
}) {
  if (!open) return null;

  const confirmStyles =
    confirmTone === "danger"
      ? "bg-rose-500 hover:bg-rose-600"
      : "bg-gradient-to-r from-emerald-500 to-green-600 hover:shadow-xl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-black text-slate-900">{title}</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">{description}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={() => onConfirm?.()}
            className={`inline-flex flex-1 items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${confirmStyles}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function getActiveParticipants(data) {
  const list = Array.isArray(data?.participants)
    ? data.participants
    : Array.isArray(data?.match?.participants)
      ? data.match.participants
      : [];
  return list.filter((participant) => participant && participant.status !== "left");
}

function getHostName(match) {
  return (
    match?.host_profile?.full_name ||
    match?.host_name ||
    match?.organizer_name ||
    "Match Host"
  );
}

function getParticipantName(participant) {
  return (
    participant?.profile?.full_name ||
    participant?.full_name ||
    (participant?.player_id ? `Player ${participant.player_id}` : "Player")
  );
}

function getInitials(name) {
  const clean = (name || "").trim();
  if (!clean) return "";
  return clean
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatDateTimeRange(match) {
  if (!match?.start_date_time) return "Date & time to be announced";
  const start = new Date(match.start_date_time);
  if (Number.isNaN(start.getTime())) return "Date & time to be announced";

  const end = getMatchEndTime(match, start);

  const date = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const endTime = end
    ? end.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return endTime ? `${date} • ${startTime}–${endTime}` : `${date} • ${startTime}`;
}

function getMatchEndTime(match, start) {
  if (match?.end_date_time) {
    const fromMatch = new Date(match.end_date_time);
    if (!Number.isNaN(fromMatch.getTime())) return fromMatch;
  }

  const durationHours = parseDurationHours(match);
  if (!durationHours) return null;
  const millis = durationHours * 60 * 60 * 1000;
  if (!Number.isFinite(millis) || millis <= 0) return null;
  return new Date(start.getTime() + millis);
}

function parseDurationHours(match) {
  const candidates = [
    match?.duration_hours,
    match?.duration,
    match?.durationHours,
    match?.duration_in_hours,
    match?.durationMinutes,
    match?.duration_minutes,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (candidate === match?.durationMinutes || candidate === match?.duration_minutes) {
      return value / 60;
    }
    return value;
  }
  return null;
}

function formatMatchType(match) {
  const value = match?.match_format || match?.match_type || match?.format;
  if (!value) return "";
  const normalized = String(value).replace(/_/g, " ");
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSkillTag(match) {
  if (match?.skill_level) return String(match.skill_level);
  const min = match?.skill_level_min;
  const max = match?.skill_level_max;
  return formatSkillRange(min, max);
}

function formatSkillRange(min, max) {
  const minNum = Number(min);
  const maxNum = Number(max);
  const hasMin = Number.isFinite(minNum);
  const hasMax = Number.isFinite(maxNum);

  if (hasMin && hasMax) {
    if (minNum === maxNum) return minNum.toFixed(1);
    return `${minNum.toFixed(1)} - ${maxNum.toFixed(1)}`;
  }
  if (hasMin) return `${minNum.toFixed(1)}+`;
  if (hasMax) return `Up to ${maxNum.toFixed(1)}`;
  return "";
}

function formatRating(rating) {
  if (rating === null || rating === undefined || rating === "") return "";
  const numeric = Number(rating);
  if (Number.isFinite(numeric)) {
    return numeric % 1 === 0 ? `${numeric.toFixed(1)}` : `${numeric.toFixed(1)}`;
  }
  return String(rating);
}

function formatDistance(distance) {
  const numeric = Number(distance);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  if (numeric < 10) return `${numeric.toFixed(1)} miles away`;
  return `${Math.round(numeric)} miles away`;
}

function getMapsLink(match) {
  if (match?.map_url) return match.map_url;
  if (match?.mapUrl) return match.mapUrl;
  if (match?.location_url) return match.location_url;
  const lat = match?.latitude || match?.lat;
  const lng = match?.longitude || match?.lng || match?.long;
  const address = match?.location_text || match?.location;
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address,
    )}`;
  }
  return "";
}
