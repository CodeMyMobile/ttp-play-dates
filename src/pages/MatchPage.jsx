// src/pages/MatchPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  BellRing,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Lock,
  MapPin,
  Sparkles,
  Users,
  UserRound,
} from "lucide-react";
import Header from "../components/Header.jsx";
import { getMatch, joinMatch, leaveMatch } from "../services/matches";

const DEFAULT_DURATION_MINUTES = 90;

const formatDateTime = (value) => {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatTimeRange = (match) => {
  const start = match?.start_date_time ? new Date(match.start_date_time) : null;
  if (!start || Number.isNaN(start.getTime())) return null;
  const duration = getDurationMinutes(match);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const dateFormatter = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  });
  return {
    headline: `${dateFormatter.format(start)} at ${timeFormatter.format(start)}`,
    start,
    end,
  };
};

const formatCalendarDate = (date) => {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

const getDurationMinutes = (match) => {
  if (!match) return DEFAULT_DURATION_MINUTES;
  if (typeof match.duration_minutes === "number") return match.duration_minutes;
  if (typeof match.duration === "number") return match.duration * 60;
  if (typeof match.duration === "string") {
    const parsed = Number.parseFloat(match.duration);
    if (Number.isFinite(parsed)) return parsed * 60;
  }
  if (typeof match.duration_hours === "number") return match.duration_hours * 60;
  return DEFAULT_DURATION_MINUTES;
};

const buildCalendarLinks = (match) => {
  const range = formatTimeRange(match);
  if (!range) {
    return {
      google: null,
      outlook: null,
      ics: null,
    };
  }
  const title =
    match?.title ||
    match?.name ||
    match?.match_format ||
    (match?.match_type === "private" ? "Private Tennis Match" : "Tennis Match");
  const details = match?.notes || "";
  const location = match?.location_text || "TBD";
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    title,
  )}&dates=${formatCalendarDate(range.start)}/${formatCalendarDate(
    range.end,
  )}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(
    location,
  )}`;
  const outlook = `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(
    title,
  )}&body=${encodeURIComponent(details)}&startdt=${range.start.toISOString()}&enddt=${range.end.toISOString()}&location=${encodeURIComponent(
    location,
  )}`;
  const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//TTP Play Dates//Match//EN\nBEGIN:VEVENT\nUID:${
    match?.id || match?.match_id || Date.now()
  }@ttp-play-dates\nDTSTAMP:${formatCalendarDate(
    new Date(),
  )}\nDTSTART:${formatCalendarDate(range.start)}\nDTEND:${formatCalendarDate(
    range.end,
  )}\nSUMMARY:${title}\nDESCRIPTION:${details.replace(/\n/g, "\\n")}\nLOCATION:${location}\nEND:VEVENT\nEND:VCALENDAR`;
  const ics = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
  return { google, outlook, ics };
};

const deriveStatusPill = (match, isJoined) => {
  if (!match) return null;
  if (match.status === "cancelled")
    return { label: "Cancelled", tone: "danger", description: "This match has been cancelled." };
  if (isJoined) return { label: "You’re in", tone: "success" };
  if (match.match_type === "private") return { label: "Private match", tone: "muted" };
  return { label: "Public match", tone: "muted" };
};

const toneStyles = {
  success:
    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  danger: "bg-rose-50 text-rose-700 border border-rose-200",
  muted: "bg-slate-100 text-slate-700 border border-slate-200",
};

export default function MatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null);
  const [phase, setPhase] = useState("details");
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem("match-reminder:" + id);
      return stored ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  const [currentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const response = await getMatch(id);
        if (!alive) return;
        setData(response);
      } catch (err) {
        if (!alive) return;
        setError(
          err?.response?.data?.message || err?.message || "Match not found or access denied.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    try {
      localStorage.setItem("match-reminder:" + id, reminderEnabled ? "true" : "false");
    } catch {
      // ignore
    }
  }, [id, reminderEnabled]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [banner]);

  const refreshMatch = async () => {
    try {
      const updated = await getMatch(id);
      setData(updated);
      return updated;
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to refresh match data.");
      return null;
    }
  };

  const match = data?.match || null;
  const participants = useMemo(
    () => (Array.isArray(data?.participants) ? data.participants : []),
    [data?.participants],
  );
  const invitees = useMemo(
    () => (Array.isArray(data?.invitees) ? data.invitees : []),
    [data?.invitees],
  );

  const committedParticipants = useMemo(
    () => participants.filter((p) => p && p.status !== "left"),
    [participants],
  );
  const acceptedInviteCount = useMemo(
    () => invitees.filter((i) => i?.status === "accepted").length,
    [invitees],
  );

  const isJoined = useMemo(
    () =>
      Boolean(
        committedParticipants.find((p) =>
          p?.player_id === currentUser?.id || p?.profile?.user_id === currentUser?.id,
        ),
      ),
    [committedParticipants, currentUser],
  );

  useEffect(() => {
    if (isJoined && phase === "confirmation") {
      return;
    }
    if (isJoined && phase !== "confirmation") {
      setPhase("details");
    }
  }, [isJoined, phase]);

  const statusPill = deriveStatusPill(match, isJoined);
  const range = useMemo(() => formatTimeRange(match), [match]);
  const calendarLinks = useMemo(() => buildCalendarLinks(match), [match]);

  const remainingSpots = useMemo(() => {
    if (!match || typeof match.player_limit !== "number") return null;
    return Math.max(match.player_limit - committedParticipants.length - acceptedInviteCount, 0);
  }, [acceptedInviteCount, committedParticipants, match]);

  const isFull = remainingSpots !== null && remainingSpots <= 0;
  const isCancelled = match?.status === "cancelled";
  const isPast = match?.start_date_time ? new Date(match.start_date_time) < new Date() : false;

  const viewerStatus = useMemo(() => {
    if (isJoined) return "accepted";
    const invite = invitees.find((i) => i?.invitee_id === currentUser?.id);
    return invite?.status || "pending";
  }, [currentUser?.id, invitees, isJoined]);

  const canAccept =
    !isJoined &&
    !isCancelled &&
    !isPast &&
    (remainingSpots === null || remainingSpots > 0);
  const canCancel = isJoined && !isCancelled && !isPast;

  const hostName =
    match?.host_profile?.full_name ||
    match?.host_name ||
    (match?.host_id ? `Player ${match.host_id}` : "Match Host");

  const handleAccept = async () => {
    if (!match) return;
    try {
      setJoining(true);
      await joinMatch(match.id);
      const updated = await refreshMatch();
      if (updated) {
        setPhase("confirmation");
        setBanner({ type: "success", message: "You’re all set! We saved your spot." });
      }
    } catch (err) {
      setBanner({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Could not accept invite.",
      });
    } finally {
      setJoining(false);
    }
  };

  const handleCancel = async () => {
    if (!match) return;
    try {
      setLeaving(true);
      await leaveMatch(match.id);
      await refreshMatch();
      setShowCancelConfirm(false);
      setPhase("details");
      setBanner({ type: "info", message: "You’re no longer on the roster." });
    } catch (err) {
      setBanner({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Unable to update your RSVP.",
      });
    } finally {
      setLeaving(false);
    }
  };

  const renderBanner = () => {
    if (!banner) return null;
    const tone =
      banner.type === "error"
        ? "bg-rose-50 text-rose-700 border border-rose-200"
        : banner.type === "success"
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-blue-50 text-blue-700 border border-blue-200";
    const Icon = banner.type === "error" ? AlertCircle : banner.type === "success" ? CheckCircle2 : Sparkles;
    return (
      <div className={`mb-4 px-4 py-3 rounded-2xl flex items-start gap-3 ${tone}`}>
        <Icon className="w-5 h-5 mt-0.5" />
        <p className="text-sm font-semibold">{banner.message}</p>
      </div>
    );
  };

  if (loading)
    return (
      <>
        <Header />
        <Shell>
          <Card>
            <p className="text-sm font-semibold text-slate-500">Loading match details…</p>
          </Card>
        </Shell>
      </>
    );

  if (error)
    return (
      <>
        <Header />
        <Shell>
          <Card>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5" />
              <div>
                <h1 className="text-lg font-bold text-slate-900">We couldn’t load this match</h1>
                <p className="text-sm text-slate-600 mt-1">{error}</p>
                <button
                  type="button"
                  onClick={() => navigate("/", { replace: true })}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Go back home
                </button>
              </div>
            </div>
          </Card>
        </Shell>
      </>
    );

  const Details = (
    <Card>
      {renderBanner()}
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-black tracking-[0.2em] text-emerald-500 uppercase">
              Match details
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">
              {match?.match_type === "private" ? "Private court invite" : "Upcoming tennis match"}
            </h1>
            {range?.headline && (
              <p className="text-sm font-semibold text-slate-500 mt-1">{range.headline}</p>
            )}
          </div>
          {statusPill && (
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black ${
                toneStyles[statusPill.tone]
              }`}
            >
              {statusPill.tone === "danger" ? <AlertCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {statusPill.label}
            </span>
          )}
        </div>
        {statusPill?.description && (
          <p className="mt-3 text-sm font-semibold text-rose-600">{statusPill.description}</p>
        )}
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <InfoTile icon={CalendarDays} label="Date & Time" value={formatDateTime(match?.start_date_time)} />
        <InfoTile icon={Clock} label="Duration" value={`${getDurationMinutes(match)} minutes`} />
        <InfoTile
          icon={MapPin}
          label="Where"
          value={match?.location_text || "Location to be announced"}
        />
        <InfoTile
          icon={Users}
          label="Players"
          value={
            match?.player_limit
              ? `${committedParticipants.length + acceptedInviteCount}/${match.player_limit} spots taken`
              : `${committedParticipants.length + acceptedInviteCount} players confirmed`
          }
          caption={
            remainingSpots !== null
              ? `${remainingSpots} spot${remainingSpots === 1 ? "" : "s"} left`
              : undefined
          }
        />
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-black text-slate-600 tracking-[0.2em] uppercase">Hosted by</h2>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center text-emerald-700 font-black text-lg">
            {hostName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join("") || "H"}
          </div>
          <div>
            <p className="text-sm font-black text-slate-900">{hostName}</p>
            {match?.match_type === "private" ? (
              <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Private match
              </p>
            ) : (
              <p className="text-xs font-semibold text-slate-500">Open to the community</p>
            )}
          </div>
        </div>
      </section>

      {match?.notes && (
        <section className="mt-6">
          <h2 className="text-sm font-black text-slate-600 tracking-[0.2em] uppercase flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-400" /> Notes from the organizer
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            {match.notes}
          </p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-black text-slate-600 tracking-[0.2em] uppercase flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" /> Players confirmed
        </h2>
        {committedParticipants.length ? (
          <ul className="mt-3 grid gap-3">
            {committedParticipants.map((participant) => {
              const name =
                participant?.profile?.full_name ||
                participant?.name ||
                (participant?.player_id ? `Player ${participant.player_id}` : "Player");
              const initials = name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("") || "P";
              const isYou = participant?.player_id === currentUser?.id;
              return (
                <li
                  key={participant?.player_id || participant?.id || name}
                  className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center border border-slate-200 text-sm font-black text-slate-600">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {name}
                        {isYou && <span className="ml-2 text-xs font-black text-emerald-600">(You)</span>}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">
                        {participant?.status === "hosting" ? "Host" : "Confirmed"}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            <UserRound className="w-5 h-5" />
            No players have confirmed yet.
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="bg-slate-900 text-white rounded-3xl p-6">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">Your RSVP</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black">
                  {isCancelled
                    ? "This match has been cancelled"
                    : viewerStatus === "accepted"
                      ? "You’re locked in!"
                      : viewerStatus === "pending"
                        ? "Your spot is waiting"
                        : viewerStatus === "declined"
                          ? "You declined this invite"
                          : "RSVP status"}
                </p>
                <p className="text-sm text-slate-200">
                  {isCancelled
                    ? "No action needed"
                    : viewerStatus === "accepted"
                      ? "We’ll keep you posted with updates."
                      : viewerStatus === "pending"
                        ? "Confirm now to reserve your spot."
                        : viewerStatus === "declined"
                          ? "Changed your mind? You can still join if there’s space."
                          : "Respond to the invite."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canAccept && (
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={joining}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {joining ? "Saving…" : "Accept & continue"}
                  </button>
                )}
                {canCancel && (
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/30 px-4 py-2 text-sm font-black text-white transition hover:border-white"
                  >
                    Cancel RSVP
                  </button>
                )}
              </div>
            </div>
            {isFull && !isJoined && !isCancelled && (
              <p className="text-xs font-semibold text-emerald-200/80">
                The roster is currently full. Try checking back later in case a spot opens up.
              </p>
            )}
          </div>
        </div>
      </section>

      {showCancelConfirm && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          <p className="font-semibold">Cancel your RSVP?</p>
          <p className="mt-1 text-xs text-rose-600">
            We’ll release your spot so someone else can join. You can always rejoin later if there’s space.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={leaving}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {leaving ? "Cancelling…" : "Yes, cancel RSVP"}
            </button>
            <button
              type="button"
              onClick={() => setShowCancelConfirm(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-white"
            >
              Keep my spot
            </button>
          </div>
        </div>
      )}
    </Card>
  );

  const Confirmation = (
    <Card>
      {renderBanner()}
      <div className="flex items-center gap-3 rounded-3xl bg-emerald-50 border border-emerald-200 px-5 py-4">
        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
        <div>
          <h1 className="text-xl font-black text-emerald-700">You’re in!</h1>
          <p className="text-sm font-semibold text-emerald-600/80">
            We saved your spot for {range?.headline || "this match"}.
          </p>
        </div>
      </div>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-black text-slate-600 tracking-[0.2em] uppercase flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-400" /> Add to calendar
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <CalendarButton label="Google" href={calendarLinks.google} primary />
          <CalendarButton label="Outlook" href={calendarLinks.outlook} />
          <CalendarButton label="Download .ics" href={calendarLinks.ics} download="match.ics" />
        </div>
        <p className="text-xs font-semibold text-slate-500">
          Choose where you want this reminder to show up. We recommend Google Calendar if you’re unsure.
        </p>
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-start gap-3">
          {reminderEnabled ? (
            <BellRing className="w-5 h-5 text-emerald-500 mt-0.5" />
          ) : (
            <Bell className="w-5 h-5 text-slate-400 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900">Play date reminders</p>
            <p className="text-xs text-slate-600 mt-1">
              We’ll nudge you about the time, location, and any updates from {hostName}. You can toggle reminders anytime.
            </p>
            <button
              type="button"
              onClick={() => setReminderEnabled((prev) => !prev)}
              className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black transition ${
                reminderEnabled
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "bg-white text-slate-600 border border-slate-200 hover:text-slate-800"
              }`}
            >
              {reminderEnabled ? "Reminders on" : "Turn reminders on"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Want to double-check the details?
          </p>
          <p className="text-xs text-slate-500">You can always review the full match info again.</p>
        </div>
        <button
          type="button"
          onClick={() => setPhase("details")}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          View match details
        </button>
      </section>
    </Card>
  );

  return (
    <>
      <Header />
      <Shell>{phase === "confirmation" ? Confirmation : Details}</Shell>
    </>
  );
}

const Shell = ({ children }) => (
  <main className="min-h-[calc(100vh-64px)] bg-slate-100/70">
    <div className="mx-auto max-w-3xl px-4 py-10">{children}</div>
  </main>
);

const Card = ({ children }) => (
  <div className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-100">{children}</div>
);

const InfoTile = ({ icon, label, value, caption }) => {
  const Icon = icon;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {Icon ? <Icon className="w-4 h-4 text-slate-400" /> : null}
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
      {caption && <p className="mt-1 text-xs font-semibold text-slate-500">{caption}</p>}
    </div>
  );
};

const CalendarButton = ({ label, href, download, primary = false }) => {
  if (!href) {
    return (
      <span className="inline-flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-400">
        {label} unavailable
      </span>
    );
  }
  return (
    <a
      href={href}
      target={download ? undefined : "_blank"}
      rel={download ? undefined : "noreferrer"}
      download={download}
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-xs font-black transition ${
        primary
          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600"
          : "border border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </a>
  );
};
