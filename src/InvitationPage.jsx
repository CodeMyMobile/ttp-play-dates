// src/InvitationPage.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  MapPin,
  ClipboardList,
  Users,
  MessageCircle,
  Mail,
  Send,
  ArrowRight,
  AlertCircle,
  Archive,
} from "lucide-react";
import {
  getInvitePreview,
  beginInviteVerification,
  verifyInviteCode,
  claimInvite,
} from "./services/invites";
import { ARCHIVE_FILTER_VALUE, isMatchArchivedError } from "./utils/archive";
import { uniqueActiveParticipants } from "./utils/participants";
import Header from "./components/Header.jsx";

export default function InvitationPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [phase, setPhase] = useState("preview"); // 'preview'|'otp'
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showPicker, setShowPicker] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [identifier, setIdentifier] = useState("");
  const [lastChannel, setLastChannel] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [archivedNotice, setArchivedNotice] = useState(false);
  const autoVerifyAttemptRef = useRef(null);

  const codeFromQuery = useMemo(() => {
    const search = location?.search || "";
    if (!search) return "";
    const params = new URLSearchParams(search);
    const raw = params.get("code");
    return (raw || "").trim();
  }, [location?.search]);

  // 1s ticker for resend countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const canResend = useMemo(() => {
    if (!resendAt) return true;
    return now >= new Date(resendAt).getTime();
  }, [resendAt, now]);

  const inviteeEmail = preview?.invitee?.email || "";
  const inviteeRequiresAccountClaim = useMemo(() => {
    if (!inviteeEmail) return false;
    return inviteeEmail.toLowerCase().endsWith("@ttpplaydates.com");
  }, [inviteeEmail]);

  const isArchivedMatch = (preview?.match?.status === "archived") || archivedNotice;

  // Load minimal invite preview
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setLoadError(null);
    const fetchPreview = async (includeArchived = false) => {
      const filter = includeArchived ? ARCHIVE_FILTER_VALUE : undefined;
      return getInvitePreview(token, { filter });
    };

    (async () => {
      try {
        const data = await fetchPreview(false);
        if (!alive) return;
        setPreview(data);
        setPhase("preview");
        // Initialize channel preference from available channels
        const channels = data?.availableChannels || [];
        const defaultChannel = channels.includes("sms")
          ? "sms"
          : channels[0] || null;
        setSelectedChannel(defaultChannel);
        setLastChannel(null);
        setShowPicker(false);
        setIdentifier("");
        const invitee = data?.invitee || null;
        if (invitee) {
          setFullName(invitee.full_name || "");
          setEmail(invitee.email || "");
          setPhone(invitee.phone || "");
        } else {
          setFullName("");
          setEmail("");
          setPhone("");
        }
        setPassword("");
        setAgreeTerms(false);
        setArchivedNotice(data?.match?.status === "archived");
      } catch (err) {
        if (!alive) return;
        if (isMatchArchivedError(err)) {
          try {
            const archived = await fetchPreview(true);
            if (!alive) return;
            setPreview(archived);
            setArchivedNotice(true);
            setPhase("preview");
            setSelectedChannel(null);
            setLastChannel(null);
            setShowPicker(false);
            setIdentifier("");
            const invitee = archived?.invitee || null;
            if (invitee) {
              setFullName(invitee.full_name || "");
              setEmail(invitee.email || "");
              setPhone(invitee.phone || "");
            } else {
              setFullName("");
              setEmail("");
              setPhone("");
            }
            setPassword("");
            setAgreeTerms(false);
            setLoadError({
              emoji: "🗂️",
              title: "Match archived",
              message: "This match has been archived. You can review the details but no actions are available.",
            });
          } catch {
            setPreview(null);
            setLoadError({
              emoji: "🗂️",
              title: "Match archived",
              message: "This match has been archived and is no longer accessible.",
            });
          }
        } else {
          setPreview(null);
          setPhase("preview");
          setSelectedChannel(null);
          setLastChannel(null);
          setShowPicker(false);
          setIdentifier("");
          const isNotFound = err?.status === 404 || err?.message === "not_found";
          setLoadError(
            isNotFound
              ? {
                  emoji: "🔍",
                  title: "Invite not found",
                  message:
                    "This invite link is invalid or has expired. Ask the host to send a new one.",
                }
              : {
                  emoji: "😵",
                  title: "Something went wrong",
                  message:
                    "We couldn't load this invite. Refresh the page or try again later.",
                }
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const persistSession = useCallback((data) => {
    if (!data) return;
    const {
      access_token,
      refresh_token,
      profile,
      user_id,
      user_type,
    } = data || {};

    if (access_token) {
      try {
        localStorage.setItem("authToken", access_token);
      } catch {
        // ignore localStorage write errors
      }
    }
    if (refresh_token) {
      try {
        localStorage.setItem("refreshToken", refresh_token);
      } catch {
        // ignore localStorage write errors
      }
    }

    if (user_id || profile) {
      const name = (profile?.full_name || "").trim() || "Player";
      const user = {
        id: user_id,
        type: user_type,
        name,
        email: profile?.email || "",
        phone: profile?.phone || "",
        avatar: name
          .split(" ")
          .filter(Boolean)
          .map((n) => n[0])
          .join("")
          .toUpperCase(),
        skillLevel: profile?.usta_rating || "",
      };
      try {
        localStorage.setItem("user", JSON.stringify(user));
      } catch {
        // ignore localStorage write errors
      }
    }
  }, []);

  const begin = async () => {
    setError("");
    if (isArchivedMatch) {
      setError("This match has been archived. Invites are read-only.");
      return;
    }
    try {
      const payload = {};
      if (selectedChannel) payload.channel = selectedChannel;
      if (identifier) payload.identifier = identifier.trim();
      const resp = await beginInviteVerification(token, payload);
      if (resp?.channel) setLastChannel(resp.channel);
      setResendAt(resp?.resendAt || null);
      setPhase("otp");
      setCode("");
      setShowPicker(false);
    } catch (e) {
      if (isMatchArchivedError(e)) {
        setArchivedNotice(true);
        setError("This match has been archived. Invites are read-only.");
      } else {
        const msg = mapBeginError(e?.message);
        setError(msg);
      }
    }
  };

  const verify = async () => {
    setError("");
    if (isArchivedMatch) {
      setError("This match has been archived. Invites are read-only.");
      return;
    }
    try {
      const data = await verifyInviteCode(token, code);

      persistSession(data);
      setPhase("done");
      navigate(data.redirect || `/matches/${data.matchId}`, { replace: true });
    } catch (error) {
      if (isMatchArchivedError(error)) {
        setArchivedNotice(true);
        setError("This match has been archived. Invites are read-only.");
      } else {
        setError("Invalid or expired code. Try again.");
      }
    }
  };

  useEffect(() => {
    if (!preview || !codeFromQuery) return;
    if (inviteeRequiresAccountClaim) return; // signup flow continues unchanged

    const attemptKey = `${token}:${codeFromQuery}`;
    if (autoVerifyAttemptRef.current === attemptKey) return;
    autoVerifyAttemptRef.current = attemptKey;

    let alive = true;
    setError("");
    setCode(codeFromQuery);

    (async () => {
      try {
        const data = await verifyInviteCode(token, codeFromQuery);
        if (!alive) return;
        persistSession(data);
        setPhase("done");
        navigate(data.redirect || `/matches/${data.matchId}`, { replace: true });
      } catch (err) {
        if (!alive) return;
        if (isMatchArchivedError(err)) {
          setArchivedNotice(true);
          setError("This match has been archived. Invites are read-only.");
          setCode("");
          setPhase("preview");
          setShowPicker(false);
        } else {
          const message = mapAutoVerifyError(err);
          setError(message);
          setCode("");
          setPhase("otp");
          setShowPicker(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    codeFromQuery,
    inviteeRequiresAccountClaim,
    navigate,
    persistSession,
    preview,
    token,
  ]);

  const resend = async () => {
    if (!canResend) return;
    await begin();
  };

  const handleClaimSubmit = async (event) => {
    event.preventDefault();
    if (claiming) return;
    setError("");
    if (isArchivedMatch) {
      setError("This match has been archived. Invites are read-only.");
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();

    if (!trimmedEmail || !password) {
      setError("Please enter your email and create a password.");
      return;
    }
    if (!agreeTerms) {
      setError("Please accept the invite terms to continue.");
      return;
    }

    setClaiming(true);
    try {
      const payload = {
        email: trimmedEmail,
        password,
      };
      if (trimmedName) payload.fullName = trimmedName;
      const data = await claimInvite(token, payload);
      persistSession(data);
      navigate(data.redirect || `/matches/${data.matchId}`, {
        replace: true,
      });
    } catch (err) {
      if (isMatchArchivedError(err)) {
        setArchivedNotice(true);
        setError("This match has been archived. Invites are read-only.");
        return;
      }
      const claimMessage = mapClaimError(err);
      if (err?.status === 404 || err?.message === "not_found") {
        setPreview(null);
        setLoadError({
          emoji: "🔍",
          title: "Invite not found",
          message:
            "This invite is no longer available. Ask the host to send a new link.",
        });
      } else if (claimMessage) {
        setError(claimMessage);
      } else {
        setError("We couldn't complete your signup. Try again later.");
      }
    } finally {
      setClaiming(false);
    }
  };

  // Render states
  if (loading)
    return (
      <InvitationLayout>
        <StatusCard
          emoji="⏳"
          title="Loading invite"
          message="Hang tight while we get the match details ready."
        />
      </InvitationLayout>
    );
  if (!preview)
    return (
      <InvitationLayout>
        <StatusCard
          emoji={loadError?.emoji || "😕"}
          title={loadError?.title || "Invite not found"}
          message={
            loadError?.message ||
            "This invite may have been removed or the link is incorrect."
          }
        />
      </InvitationLayout>
    );
  if (preview.status === "expired")
    return (
      <InvitationLayout>
        <StatusCard
          emoji="⌛"
          title="This invite has expired"
          message="Ask the host to send a fresh invite so you can still join the match."
        />
      </InvitationLayout>
    );
  if (preview.status === "revoked")
    return (
      <InvitationLayout>
        <StatusCard
          emoji="🚫"
          title="Invite no longer available"
          message="The host revoked this invite. Reach out to them if you think this was a mistake."
        />
      </InvitationLayout>
    );
  if (preview.status === "full")
    return (
      <InvitationLayout>
        <StatusCard
          emoji="🎉"
          title="This match is full"
          message="All spots have been claimed, but you can ask the host to open up another session."
        />
      </InvitationLayout>
    );

  const match = preview.match || {};
  const startDate = match.start_date_time
    ? new Date(match.start_date_time)
    : null;
  const formattedDate = startDate ? formatInviteDate(startDate) : "";
  const formattedTime = startDate ? formatInviteTime(startDate) : "";
  const locationLabel = match.location_text || preview?.location_text || "";
  const skill = formatSkillRange(
    match.skill_level_min,
    match.skill_level_max,
  );
  const matchType = [
    match.match_format,
    skill ? `${skill} Level` : "",
  ]
    .filter(Boolean)
    .join(" • ");
  const matchHeading = match.match_format
    ? `${match.match_format} Match`
    : "Private Match";

  const participants = getActiveParticipants(match, preview);
  const playerLimit =
    asNumber(match.player_limit) ?? asNumber(match.playerLimit);
  const occupancyFromMatch =
    asNumber(match.occupied) ??
    asNumber(match.current_players) ??
    asNumber(match.currentPlayers);
  const avatarPlayers =
    participants.length > 0
      ? participants
      : preview?.inviter
        ? [{ profile: { full_name: preview.inviter.full_name } }]
        : [];
  const effectivePlayers = participants.length
    ? participants.length
    : occupancyFromMatch ?? null;
  const occupancyLabel = playerLimit
    ? `${effectivePlayers ?? avatarPlayers.length}/${playerLimit}`
    : effectivePlayers ?? avatarPlayers.length
    ? `${effectivePlayers ?? avatarPlayers.length}`
    : null;

  const inviterName = (preview?.inviter?.full_name || "").trim();
  const inviterFirstName = inviterName.split(" ").filter(Boolean)[0] || "";
  const inviterInitials = getInitials(inviterName || "Matchplay");

  const availableChannels = preview?.availableChannels || [];
  const maskedIdentifier = preview?.maskedIdentifier;
  const activeChannel = lastChannel || selectedChannel;
  const activeChannelMeta = getChannelMeta(activeChannel);
  const isInviteeClaim = inviteeRequiresAccountClaim;
  const identifierDisplay = maskedIdentifier || phone || email;
  const channelLabels = availableChannels.map(
    (ch) => getChannelMeta(ch).label,
  );

  const infoItems = [];
  if (startDate) {
    infoItems.push({
      key: "datetime",
      icon: CalendarDays,
      accent: "bg-rose-100 text-rose-600",
      label: "Date & Time",
      value: `${formattedDate}${formattedTime ? `, ${formattedTime}` : ""}`,
    });
  }
  if (locationLabel) {
    infoItems.push({
      key: "location",
      icon: MapPin,
      accent: "bg-sky-100 text-sky-600",
      label: "Location",
      value: locationLabel,
    });
  }
  if (matchType) {
    infoItems.push({
      key: "matchType",
      icon: ClipboardList,
      accent: "bg-purple-100 text-purple-600",
      label: "Match Type",
      value: matchType,
    });
  }

  const claimSection = (
    <form
      onSubmit={handleClaimSubmit}
      className="space-y-5 rounded-[28px] border border-slate-100 bg-white/95 p-6 text-left shadow-xl"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <Users className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            Quick signup to join the match
          </p>
          <p className="text-sm text-slate-500">
            We pre-filled your details from the invite so you can claim your
            profile and get playing faster.
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900">
        <dl className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="font-semibold text-emerald-900/80">Status</dt>
            <dd className="text-right capitalize">
              {prettyInviteStatus(preview.status)}
            </dd>
          </div>
          {identifierDisplay && (
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold text-emerald-900/80">Sent to</dt>
              <dd className="text-right text-emerald-900">
                {identifierDisplay}
              </dd>
            </div>
          )}
          {channelLabels.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold text-emerald-900/80">Delivery</dt>
              <dd className="text-right text-emerald-900">
                {channelLabels.join(", ")}
              </dd>
            </div>
          )}
        </dl>
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">
            Your Name
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Enter your name"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">
            Email
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">
            Phone
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
            value={phone}
            readOnly
            disabled
            placeholder="+1 (555) 123-4567"
          />
          <p className="mt-1 text-xs text-slate-400">
            We'll connect this invite to your profile after signup.
          </p>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">
            Create Password
          </span>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            required
          />
        </label>
      </div>
      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
          checked={agreeTerms}
          onChange={(event) => setAgreeTerms(event.target.checked)}
        />
        <span>
          I accept the match invite and agree to Matchplay's terms.
        </span>
      </label>
      <PrimaryButton
        type="submit"
        disabled={claiming || isArchivedMatch}
        className="w-full"
      >
        {claiming ? (
          "Completing signup..."
        ) : (
          <>
            Join Match
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </PrimaryButton>
      {error && <ErrorText>{error}</ErrorText>}
    </form>
  );

  const channelPicker = showPicker ? (
    <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-inner backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800/80">
        <MessageCircle className="h-4 w-4" />
        Choose where to receive your code
      </div>
      <div className="space-y-3">
        {availableChannels.map((ch) => {
          const meta = getChannelMeta(ch);
          const ChannelIcon = meta.icon;
          return (
            <label
              key={ch}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all ${
                selectedChannel === ch
                  ? "border-amber-400 bg-white shadow-sm shadow-amber-200/50"
                  : "border-transparent bg-white/70 hover:border-amber-200"
              }`}
            >
              <input
                type="radio"
                name="channel"
                value={ch}
                checked={selectedChannel === ch}
                onChange={() => setSelectedChannel(ch)}
                className="h-4 w-4 text-amber-600 focus:ring-amber-500"
              />
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${meta.accent}`}
              >
                <ChannelIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  {meta.label}
                </p>
                {maskedIdentifier && (
                  <p className="text-xs text-amber-700/80">
                    Send to {maskedIdentifier}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>
      {preview?.identifierRequired && (
        <label className="block text-sm font-semibold text-amber-900/90">
          <span className="mb-1 block text-xs uppercase tracking-wide text-amber-700/80">
            Enter your {prettyRequirement(preview?.requires)}
          </span>
          <input
            className="w-full rounded-xl border border-amber-200 bg-white/90 px-3 py-2 text-amber-900 placeholder:text-amber-400 focus:border-amber-400 focus:outline-none focus:ring focus:ring-amber-200"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={placeholderFor(preview?.requires)}
          />
        </label>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={begin}
          disabled={isArchivedMatch}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 font-semibold text-white shadow-lg shadow-amber-200 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          Send access code
        </button>
        <button
          onClick={() => setShowPicker(false)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white/70 px-4 py-2.5 font-semibold text-amber-700 transition-colors hover:bg-white"
        >
          Cancel
        </button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  ) : null;

  const secondsUntilResend = resendAt
    ? Math.max(
        0,
        Math.ceil((new Date(resendAt).getTime() - now) / 1000),
      )
    : 0;

  const otpSection = (
    <div className="space-y-5 rounded-[28px] border border-slate-100 bg-white/95 p-6 shadow-xl">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${activeChannelMeta.accent}`}
        >
          <activeChannelMeta.icon className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            Check your {activeChannelMeta.label.toLowerCase()}
          </p>
          <p className="text-sm text-slate-500">
            We sent a six-digit code
            {maskedIdentifier ? ` to ${maskedIdentifier}` : ""}. Enter it
            below to join the match.
          </p>
        </div>
      </div>
      <label className="block">
        <span className="sr-only">Verification code</span>
        <input
          className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-4 text-center text-2xl font-semibold tracking-[0.65em] text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="••••••"
        />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <PrimaryButton
          onClick={verify}
          disabled={isArchivedMatch}
          className="w-full sm:w-auto"
        >
          Verify &amp; Join
        </PrimaryButton>
        <button
          onClick={resend}
          disabled={!canResend || isArchivedMatch}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white sm:w-auto"
          aria-disabled={!canResend || isArchivedMatch}
        >
          {canResend && !isArchivedMatch
            ? "Resend code"
            : !isArchivedMatch
            ? `Resend in ${secondsUntilResend}s`
            : "Resend unavailable"}
        </button>
        <button
          onClick={() => {
            setPhase("preview");
            setShowPicker(true);
            setError("");
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 sm:w-auto"
        >
          Change channel
        </button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );

  const avatarPalette = [
    "bg-emerald-500",
    "bg-sky-500",
    "bg-indigo-500",
    "bg-purple-500",
    "bg-amber-500",
  ];
  const extraPlayers =
    avatarPlayers.length > 4 ? avatarPlayers.length - 4 : 0;

  return (
    <InvitationLayout>
      <div className="w-full max-w-xl">
        <div className="overflow-hidden rounded-[32px] border border-white/20 bg-white/10 shadow-[0_24px_60px_-15px_rgba(24,24,27,0.45)] backdrop-blur">
          <div className="bg-gradient-to-br from-[#fef08a] via-[#fbbf24] to-[#f97316] px-8 pt-8 pb-24 text-center text-amber-900">
            <div className="flex justify-center">
              <div className="flex items-center gap-2 rounded-full bg-white/35 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-amber-900 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xl text-amber-500 shadow-inner">
                  🎾
                </div>
                Matchplay
              </div>
            </div>
            <div className="mt-6 flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-black text-amber-500 shadow-lg shadow-amber-200/70">
                {inviterInitials}
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {inviterFirstName
                    ? `${inviterFirstName} invited you!`
                    : "You're invited!"}
                </p>
                <p className="text-sm text-amber-800/80">
                  You're invited to play tennis on Matchplay.
                </p>
              </div>
            </div>
          </div>
          <div className="relative -mt-16 px-6 pb-8">
            <div className="rounded-[28px] border border-white/70 bg-white/95 p-6 shadow-xl shadow-slate-900/5 backdrop-blur">
              <div className="space-y-1 text-center">
                <h2 className="text-xl font-semibold text-slate-900">
                  {matchHeading}
                </h2>
                <p className="text-sm text-slate-500">
                  {inviterFirstName
                    ? `Hosted by ${inviterFirstName}`
                    : "Hosted on Matchplay"}
                </p>
              </div>
              {isArchivedMatch && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                  <Archive className="h-4 w-4" />
                  This match has been archived. Actions are disabled.
                </div>
              )}
              <div className="mt-5 grid gap-3">
                {infoItems.length ? (
                  infoItems.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 shadow-sm"
                      >
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.accent}`}
                        >
                          <ItemIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {item.label}
                          </p>
                          <p className="text-sm font-medium text-slate-900">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-center text-sm text-slate-500">
                    Match details will appear here once the host finalizes them.
                  </div>
                )}
              </div>
              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Users className="h-4 w-4 text-slate-400" />
                      Current players{occupancyLabel ? ` (${occupancyLabel})` : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {avatarPlayers.length
                        ? "Who's already in the game"
                        : "Be the first to lock in a spot."}
                    </p>
                  </div>
                  <div className="flex items-center -space-x-3">
                    {avatarPlayers.length ? (
                      avatarPlayers.slice(0, 4).map((player, index) => {
                        const name = participantDisplayName(player) || "Player";
                        const initials = getInitials(name) || "P";
                        const color =
                          avatarPalette[index % avatarPalette.length];
                        const key =
                          player?.player_id ||
                          player?.id ||
                          player?.invitee_id ||
                          `${name}-${index}`;
                        return (
                          <div
                            key={key}
                            title={name}
                            className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-sm font-semibold text-white shadow ${color}`}
                          >
                            {initials}
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-400">
                        +
                      </div>
                    )}
                    {extraPlayers > 0 && (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-slate-900/80 text-sm font-semibold text-white shadow">
                        +{extraPlayers}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {isInviteeClaim ? (
                claimSection
              ) : phase === "otp" ? (
                otpSection
              ) : (
                <>
                  <PrimaryButton
                    onClick={() => {
                      const channels = preview?.availableChannels || [];
                      if (channels.length > 1 || preview?.identifierRequired) {
                        setShowPicker((v) => !v);
                      } else {
                        setShowPicker(false);
                        setSelectedChannel(channels[0] || selectedChannel);
                        begin();
                      }
                    }}
                    disabled={isArchivedMatch}
                  >
                    Join Match &amp; Play
                    <ArrowRight className="h-4 w-4" />
                  </PrimaryButton>
                  {channelPicker}
                  {!showPicker && error && <ErrorText>{error}</ErrorText>}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </InvitationLayout>
  );
}

function InvitationLayout({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4c1d95] via-[#4338ca] to-[#2563eb]">
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center px-4 py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function PrimaryButton({
  onClick,
  children,
  className = "",
  disabled,
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 px-6 py-3 text-base font-semibold text-white shadow-xl shadow-emerald-500/30 transition-transform hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100 ${className}`}
    >
      {children}
    </button>
  );
}

function ErrorText({ children }) {
  return (
    <p className="flex items-center gap-2 text-sm font-medium text-red-600">
      <AlertCircle className="h-4 w-4" />
      <span>{children}</span>
    </p>
  );
}

function StatusCard({ emoji, title, message }) {
  return (
    <div className="w-full max-w-xl">
      <div className="space-y-4 rounded-[32px] border border-white/40 bg-white/85 px-8 py-10 text-center shadow-[0_24px_60px_-15px_rgba(24,24,27,0.45)] backdrop-blur">
        <div className="text-4xl" aria-hidden="true">
          {emoji}
        </div>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}

// Helpers
function mapBeginError(code) {
  switch (code) {
    case "invalid_channel":
      return "Please choose a valid delivery channel.";
    case "identifier_required":
    case "identifier_missing":
      return "Please enter the required phone or email.";
    case "expired":
      return "This invite has expired.";
    case "invalid_status":
      return "This invite cannot be used right now.";
    case "not_found":
      return "Invite not found.";
    case "bad_request":
      return "Couldn't send code. Check details and try again.";
    default:
      return "Couldn't send code. Please try again.";
  }
}

function mapAutoVerifyError(error) {
  if (!error) {
    return "We couldn't verify this link. Request a new code below.";
  }

  const message =
    (typeof error === "string" && error) ||
    error?.message ||
    error?.data?.message ||
    error?.data?.error ||
    "";
  const normalized = message.toString().toLowerCase();

  if (normalized.includes("expired")) {
    return "This login link has expired. Request a new code below.";
  }
  if (normalized.includes("invalid")) {
    return "This login link is invalid. Request a new code below.";
  }
  if (normalized.includes("not_found")) {
    return "This login link is no longer valid. Request a new code below.";
  }

  if (error?.status && error.status >= 500) {
    return "We're having trouble verifying this link. Request a new code below.";
  }

  return "We couldn't verify this link. Request a new code below.";
}

function mapClaimError(error) {
  if (!error) return null;
  if (error.status === 409 || error.message === "email_in_use") {
    return "That email is already in use. Try a different email or sign in instead.";
  }
  if (error.status === 404 || error.message === "not_found") {
    return null;
  }
  if (error.status >= 500) {
    return "We couldn't complete your signup. Try again later.";
  }
  if (error.data?.message) return error.data.message;
  switch (error.message) {
    case "email_required":
      return "Email is required. Enter a valid email address.";
    case "invalid_email":
      return "That email doesn't look right. Double-check and try again.";
    case "password_required":
      return "Create a password to continue.";
    case "invalid_status":
      return "This invite can't be claimed right now.";
    case "expired":
      return "This invite has expired. Ask the host for a new link.";
    case "invitee_missing":
      return "We couldn't find the invitee profile for this link.";
    default:
      return "We couldn't complete your signup. Check your details and try again.";
  }
}

function prettyRequirement(req) {
  if (req === "phone") return "phone";
  if (req === "email") return "email";
  return "identifier";
}

function placeholderFor(req) {
  if (req === "phone") return "+1 555 555 5555";
  if (req === "email") return "you@example.com";
  return "Enter identifier";
}

function formatInviteDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatInviteTime(date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSkillRange(min, max) {
  const minNum = Number(min);
  const maxNum = Number(max);
  const hasMin = Number.isFinite(minNum);
  const hasMax = Number.isFinite(maxNum);
  if (hasMin && hasMax) {
    return `${minNum} - ${maxNum}`;
  }
  if (hasMin) return `${minNum}+`;
  if (hasMax) return `Up to ${maxNum}`;
  return "";
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

function asNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function prettyInviteStatus(status) {
  if (!status) return "Unknown";
  const normalized = status.replace(/_/g, " ");
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getActiveParticipants(match, preview) {
  const fromMatch = Array.isArray(match?.participants)
    ? match.participants
    : [];
  const fromPreview = Array.isArray(preview?.participants)
    ? preview.participants
    : [];
  const source = fromMatch.length ? fromMatch : fromPreview;
  return uniqueActiveParticipants(source);
}

function participantDisplayName(participant) {
  if (!participant) return "";
  return (
    participant.profile?.full_name ||
    participant.full_name ||
    participant.profile?.name ||
    (participant.player_id ? `Player ${participant.player_id}` : "") ||
    (participant.invitee_id ? `Invitee ${participant.invitee_id}` : "")
  );
}

const CHANNEL_META = {
  sms: {
    label: "Text message",
    accent: "bg-emerald-100 text-emerald-600",
    icon: MessageCircle,
  },
  email: {
    label: "Email",
    accent: "bg-sky-100 text-sky-600",
    icon: Mail,
  },
  whatsapp: {
    label: "WhatsApp",
    accent: "bg-emerald-100 text-emerald-600",
    icon: MessageCircle,
  },
};

function getChannelMeta(channel) {
  return CHANNEL_META[channel] || {
    label: "Message",
    accent: "bg-slate-100 text-slate-600",
    icon: Send,
  };
}
