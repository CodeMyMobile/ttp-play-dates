// src/InvitationPage.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays,
  MapPin,
  ClipboardList,
  Users,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Archive,
  LogIn,
  UserPlus,
} from "lucide-react";
import {
  getInvitePreview,
  claimInvite,
  acceptInvite,
} from "./services/invites";
import { forgotPassword, login, signup } from "./services/auth";
import { getMatch } from "./services/matches";
import { ARCHIVE_FILTER_VALUE, isMatchArchivedError } from "./utils/archive";
import { uniqueActiveParticipants } from "./utils/participants";
import Header from "./components/Header.jsx";
import MatchDetailsModal from "./components/MatchDetailsModal.jsx";

export default function InvitationPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [phase, setPhase] = useState("preview"); // 'preview' | 'auth'
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [archivedNotice, setArchivedNotice] = useState(false);
  const [authMode, setAuthMode] = useState("signIn");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [successModal, setSuccessModal] = useState(null);
  const [toast, setToast] = useState(null);

  const successDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  );

  const formatSuccessDateTime = useCallback(
    (value) => {
      if (!value) return "";
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return successDateFormatter.format(date);
    },
    [successDateFormatter],
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

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
        setAuthMode("signIn");
        setShowForgotPassword(false);
        setSignInEmail(invitee?.email || "");
        setForgotEmail(invitee?.email || "");
        setSignInPassword("");
        setSignUpName(invitee?.full_name || "");
        setSignUpEmail(invitee?.email || "");
        setSignUpPhone(invitee?.phone || "");
        setSignUpPassword("");
        setAuthSubmitting(false);
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
            setAuthMode("signIn");
            setShowForgotPassword(false);
            setSignInEmail(invitee?.email || "");
            setForgotEmail(invitee?.email || "");
            setSignInPassword("");
            setSignUpName(invitee?.full_name || "");
            setSignUpEmail(invitee?.email || "");
            setSignUpPhone(invitee?.phone || "");
            setSignUpPassword("");
            setAuthSubmitting(false);
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

  const persistSession = useCallback((data, fallback = {}) => {
    if (!data) return;
    const {
      access_token,
      refresh_token,
      token: legacyToken,
      profile,
      user_id,
      user_type,
      user: userFromApi,
    } = data || {};

    const tokenToStore = access_token || legacyToken || fallback.accessToken;
    if (tokenToStore) {
      try {
        localStorage.setItem("authToken", tokenToStore);
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

    let userRecord = null;

    if (user_id || profile) {
      const name = (profile?.full_name || fallback.name || fallback.email || "")
        .trim() || "Player";
      userRecord = {
        id: user_id || profile?.id,
        type: user_type,
        name,
        email: profile?.email || fallback.email || "",
        phone: profile?.phone || fallback.phone || "",
        avatar: name
          .split(" ")
          .filter(Boolean)
          .map((n) => n[0])
          .join("")
          .toUpperCase(),
        skillLevel: profile?.usta_rating || "",
      };
    } else if (userFromApi) {
      const name =
        (userFromApi.full_name ||
          userFromApi.name ||
          fallback.name ||
          fallback.email ||
          "")
          .trim() || "Player";
      userRecord = {
        id: userFromApi.id || userFromApi.user_id,
        type: userFromApi.user_type || user_type,
        name,
        email: userFromApi.email || fallback.email || "",
        phone: userFromApi.phone || fallback.phone || "",
        avatar: name
          .split(" ")
          .filter(Boolean)
          .map((n) => n[0])
          .join("")
          .toUpperCase(),
        skillLevel: userFromApi.usta_rating || "",
      };
    } else if (fallback.email || fallback.name) {
      const name = (fallback.name || fallback.email || "").trim() || "Player";
      userRecord = {
        id: null,
        type: user_type,
        name,
        email: fallback.email || "",
        phone: fallback.phone || "",
        avatar: name
          .split(" ")
          .filter(Boolean)
          .map((n) => n[0])
          .join("")
          .toUpperCase(),
        skillLevel: "",
      };
    }

    if (userRecord) {
      try {
        localStorage.setItem("user", JSON.stringify(userRecord));
      } catch {
        // ignore localStorage write errors
      }
      setCurrentUser(userRecord);
    }
  }, [setCurrentUser]);

  const getInviteDestination = useCallback(
    (authData = {}, acceptance = {}) => {
      const redirect = acceptance?.redirect || authData?.redirect;
      if (redirect) return { redirect };
      const matchId =
        acceptance?.matchId ||
        acceptance?.match_id ||
        authData?.matchId ||
        authData?.match_id ||
        preview?.match?.id ||
        preview?.match?.match_id ||
        preview?.matchId;
      return { matchId };
    },
    [preview],
  );

  const completeJoin = useCallback(
    async (authData, fallback = {}) => {
      persistSession(authData, fallback);
      const acceptance = await acceptInvite(token);
      return getInviteDestination(authData, acceptance);
    },
    [getInviteDestination, persistSession, token],
  );

  const navigateAfterJoin = useCallback(
    (destination) => {
      if (!destination) {
        navigate("/", { replace: true });
        return;
      }
      if (destination.redirect) {
        navigate(destination.redirect, { replace: true });
        return;
      }
      if (destination.matchId !== undefined && destination.matchId !== null) {
        navigate(`/matches/${destination.matchId}`, { replace: true });
        return;
      }
      navigate("/", { replace: true });
    },
    [navigate],
  );

  const loadSuccessMatch = useCallback(
    async (matchId, { includeArchived = false } = {}) => {
      if (!matchId) return null;
      try {
        if (includeArchived) {
          return await getMatch(matchId, { filter: ARCHIVE_FILTER_VALUE });
        }
        return await getMatch(matchId);
      } catch (error) {
        if (!includeArchived && isMatchArchivedError(error)) {
          return await getMatch(matchId, { filter: ARCHIVE_FILTER_VALUE });
        }
        throw error;
      }
    },
    [],
  );

  const handleJoinSuccess = useCallback(
    async (destination) => {
      if (!destination) {
        navigateAfterJoin(destination);
        return;
      }
      const { matchId } = destination;
      if (!matchId) {
        navigateAfterJoin(destination);
        return;
      }
      try {
        const matchData = await loadSuccessMatch(matchId);
        if (!matchData) {
          navigateAfterJoin(destination);
          return;
        }
        setSuccessModal({ matchData, destination });
      } catch (error) {
        console.error("Failed to load match details for success view", error);
        navigateAfterJoin(destination);
      }
    },
    [loadSuccessMatch, navigateAfterJoin],
  );

  const successMatchId = successModal?.destination?.matchId || null;

  const refreshSuccessMatch = useCallback(async () => {
    if (!successMatchId) return null;
    try {
      const updated = await loadSuccessMatch(successMatchId);
      if (updated) {
        setSuccessModal((prev) =>
          prev ? { ...prev, matchData: updated } : prev,
        );
      }
      return updated;
    } catch (error) {
      console.error("Failed to refresh match", error);
      return null;
    }
  }, [loadSuccessMatch, successMatchId]);

  const reloadSuccessMatch = useCallback(
    async (matchId, options = {}) => {
      try {
        return await loadSuccessMatch(matchId, options);
      } catch (error) {
        console.error("Failed to reload match", error);
        return null;
      }
    },
    [loadSuccessMatch],
  );

  const handleSuccessMatchUpdate = useCallback((updater) => {
    setSuccessModal((prev) => {
      if (!prev) return prev;
      const nextData =
        typeof updater === "function" ? updater(prev.matchData) : updater;
      if (!nextData) return prev;
      return { ...prev, matchData: nextData };
    });
  }, []);

  const handleSuccessClose = useCallback(() => {
    const rawMatchType =
      successModal?.matchData?.match?.match_type ||
      successModal?.matchData?.match?.matchType ||
      successModal?.matchData?.match?.type ||
      successModal?.matchData?.match_type ||
      "";
    const normalizedMatchType =
      typeof rawMatchType === "string" ? rawMatchType.toLowerCase() : "";

    if (normalizedMatchType === "open" || normalizedMatchType === "available") {
      navigate("/", { replace: true });
      setSuccessModal(null);
      return;
    }
    if (successModal?.destination) {
      navigateAfterJoin(successModal.destination);
    } else {
      navigateAfterJoin(null);
    }
    setSuccessModal(null);
  }, [navigate, navigateAfterJoin, successModal]);

  const handleToast = useCallback((message, type = "info") => {
    if (!message) return;
    setToast({ message, type });
  }, []);

  const handleSignInSubmit = async (event) => {
    event.preventDefault();
    if (authSubmitting) return;
    setError("");
    if (isArchivedMatch) {
      setError("This match has been archived. Invites are read-only.");
      return;
    }
    const trimmedEmail = signInEmail.trim();
    if (!trimmedEmail || !signInPassword) {
      setError("Please enter your email and password to sign in.");
      return;
    }
    setAuthSubmitting(true);
    try {
      const data = await login(trimmedEmail, signInPassword);
      const destination = await completeJoin(data, { email: trimmedEmail });
      await handleJoinSuccess(destination);
    } catch (err) {
      const statusCode = Number(err?.status ?? err?.response?.status);
      if (statusCode === 403) {
        setError(mapSignInError(err));
      } else if (isMatchArchivedError(err)) {
        setArchivedNotice(true);
        setError("This match has been archived. Invites are read-only.");
      } else if (isAcceptError(err)) {
        setError(mapAcceptError(err));
      } else {
        setError(mapSignInError(err));
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (event) => {
    event.preventDefault();
    if (forgotSubmitting) return;
    setError("");
    const trimmedEmail = forgotEmail.trim();
    if (!trimmedEmail) {
      setError("Enter your email to receive a reset link.");
      return;
    }
    setForgotSubmitting(true);
    try {
      await forgotPassword(trimmedEmail);
      setToast({
        message:
          "If that email exists, we'll send password reset instructions shortly.",
        type: "success",
      });
      setShowForgotPassword(false);
      setSignInEmail(trimmedEmail);
      setForgotEmail(trimmedEmail);
    } catch (err) {
      setError(err?.message || "Unable to send reset link. Please try again.");
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (event) => {
    event.preventDefault();
    if (authSubmitting) return;
    setError("");
    if (isArchivedMatch) {
      setError("This match has been archived. Invites are read-only.");
      return;
    }
    const trimmedEmail = signUpEmail.trim();
    const trimmedName = signUpName.trim();
    const trimmedPhone = signUpPhone.trim();
    if (!trimmedEmail || !signUpPassword) {
      setError("Please enter your email and create a password to sign up.");
      return;
    }
    if (!trimmedPhone) {
      setError("Please enter your mobile number to sign up.");
      return;
    }
    setAuthSubmitting(true);
    try {
      const data = await signup({
        email: trimmedEmail,
        password: signUpPassword,
        name: trimmedName,
        phone: trimmedPhone,
      });
      const destination = await completeJoin(data, {
        email: trimmedEmail,
        name: trimmedName,
        phone: trimmedPhone,
      });
      await handleJoinSuccess(destination);
    } catch (err) {
      if (isMatchArchivedError(err)) {
        setArchivedNotice(true);
        setError("This match has been archived. Invites are read-only.");
      } else if (isAcceptError(err)) {
        setError(mapAcceptError(err));
      } else {
        setError(mapSignUpError(err));
      }
    } finally {
      setAuthSubmitting(false);
    }
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
      const destination = getInviteDestination(data);
      await handleJoinSuccess(destination);
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

  const maskedIdentifier = preview?.maskedIdentifier;
  const isInviteeClaim = inviteeRequiresAccountClaim;
  const identifierDisplay = maskedIdentifier || phone || email;

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

  const authSection = (
    <div className="space-y-5 rounded-[28px] border border-slate-100 bg-white/95 p-6 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            {authMode === "signIn" ? (
              <LogIn className="h-5 w-5" />
            ) : (
              <UserPlus className="h-5 w-5" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">
              {authMode === "signIn"
                ? "Sign in to join this match"
                : "Create your Matchplay account"}
            </p>
            <p className="text-sm text-slate-500">
              {authMode === "signIn"
                ? "Enter your account details to secure your spot."
                : "We'll set up your profile so you can lock in this invite."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setPhase("preview");
            setError("");
            setShowForgotPassword(false);
          }}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => {
            setAuthMode("signIn");
            setError("");
            setShowForgotPassword(false);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
            authMode === "signIn"
              ? "bg-white text-emerald-600 shadow"
              : "text-slate-500"
          }`}
        >
          <LogIn className="h-4 w-4" />
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMode("signUp");
            setError("");
            setShowForgotPassword(false);
          }}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
            authMode === "signUp"
              ? "bg-white text-emerald-600 shadow"
              : "text-slate-500"
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Sign up
        </button>
      </div>
      {authMode === "signIn" ? (
        showForgotPassword ? (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <p className="text-sm text-slate-600">
              Enter your email address and we'll send you a password reset link.
            </p>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Email
              </span>
              <input
                type="email"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <PrimaryButton type="submit" disabled={forgotSubmitting}>
              {forgotSubmitting ? "Sending reset link..." : "Send reset link"}
            </PrimaryButton>
            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setError("");
              }}
              className="w-full text-center text-sm font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignInSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Email
              </span>
              <input
                type="email"
                value={signInEmail}
                onChange={(event) => setSignInEmail(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Password
              </span>
              <input
                type="password"
                value={signInPassword}
                onChange={(event) => setSignInPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </label>
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setError("");
                  setForgotEmail(signInEmail || inviteeEmail || "");
                }}
                className="text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
              >
                Forgot password?
              </button>
            </div>
            <PrimaryButton
              type="submit"
              disabled={authSubmitting || isArchivedMatch}
            >
              {authSubmitting ? "Joining match..." : "Sign in & Join"}
            </PrimaryButton>
          </form>
        )
      ) : (
        <form onSubmit={handleSignUpSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Full name (optional)
            </span>
            <input
              value={signUpName}
              onChange={(event) => setSignUpName(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
              placeholder="Your name"
              autoComplete="name"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Email
            </span>
            <input
              type="email"
              value={signUpEmail}
              onChange={(event) => setSignUpEmail(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Create password
            </span>
            <input
              type="password"
              value={signUpPassword}
              onChange={(event) => setSignUpPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Mobile number
            </span>
            <input
              type="tel"
              value={signUpPhone}
              onChange={(event) => setSignUpPhone(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-200"
              placeholder="(555) 123-4567"
              autoComplete="tel"
              required
            />
            <p className="mt-1 text-xs text-slate-400">
              We'll use this for match reminders and schedule updates.
            </p>
          </label>
          <PrimaryButton
            type="submit"
            disabled={authSubmitting || isArchivedMatch}
          >
            {authSubmitting ? "Creating account..." : "Sign up & Join"}
          </PrimaryButton>
        </form>
      )}
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
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg transition ${
            toast.type === "error"
              ? "bg-rose-100 text-rose-700"
              : toast.type === "success"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-900 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
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
              ) : phase === "auth" ? (
                authSection
              ) : (
                <>
                  <PrimaryButton
                  onClick={() => {
                    setPhase("auth");
                    setAuthMode("signIn");
                    setError("");
                    setShowForgotPassword(false);
                  }}
                    disabled={isArchivedMatch}
                  >
                    Join Match &amp; Play
                    <ArrowRight className="h-4 w-4" />
                  </PrimaryButton>
                  <p className="text-xs text-slate-500">
                    You'll be asked to sign in or create a free account to claim your spot.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {successModal && (
        <MatchDetailsModal
          isOpen
          matchData={successModal.matchData}
          currentUser={currentUser}
          onClose={handleSuccessClose}
          onRequireSignIn={() => {}}
          onMatchRefresh={refreshSuccessMatch}
          onReloadMatch={reloadSuccessMatch}
          onUpdateMatch={handleSuccessMatchUpdate}
          onToast={handleToast}
          formatDateTime={formatSuccessDateTime}
          onManageInvites={() => {}}
          initialStatus="success"
        />
      )}
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
function isAcceptError(error) {
  if (!error) return false;
  if (isMatchArchivedError(error)) return true;
  const status = error.status ?? error.response?.status;
  if (status && [404, 409, 410, 423].includes(status)) return true;
  const code = (error.data?.error || error.message || "")
    .toString()
    .toLowerCase();
  if (!code) return false;
  return code.includes("invite") || code.includes("match");
}

function mapSignInError(error) {
  if (!error) return "We couldn't sign you in. Try again.";
  const statusCode = Number(error.status ?? error.response?.status);
  if ([400, 401, 403].includes(statusCode)) {
    return "That email or password doesn't match our records. Double-check your details or reset your password.";
  }
  if (statusCode === 422) {
    return (
      error.data?.message ||
      "Please double-check your email and password before trying again."
    );
  }
  if (Number.isFinite(statusCode) && statusCode >= 500) {
    return "We're having trouble signing you in. Try again later.";
  }
  if (error.data?.message) return error.data.message;
  if (error.message && error.message !== "Error") return error.message;
  return "We couldn't sign you in. Try again.";
}

function mapSignUpError(error) {
  if (!error) return "We couldn't create your account. Try again.";
  const status = error.status ?? error.response?.status;
  const normalized = (error.data?.error || error.message || "")
    .toString()
    .toLowerCase();
  const normalizedMessage = (error.data?.message || "")
    .toString()
    .toLowerCase();

  const collectErrorStrings = (value, seen = new Set()) => {
    if (!value || seen.has(value)) return [];
    if (typeof value === "string") return [value.toLowerCase()];
    if (typeof value === "number" || typeof value === "boolean") {
      return [String(value).toLowerCase()];
    }
    if (Array.isArray(value)) {
      seen.add(value);
      return value.flatMap((item) => collectErrorStrings(item, seen));
    }
    if (typeof value === "object") {
      seen.add(value);
      const objectStrings = Object.keys(value).map((key) => key.toLowerCase());
      return [
        ...objectStrings,
        ...Object.values(value).flatMap((item) => collectErrorStrings(item, seen)),
      ];
    }
    return [];
  };

  const duplicateHintValues = [
    normalized,
    normalizedMessage,
    ...(error.statusText ? [error.statusText.toLowerCase()] : []),
    ...collectErrorStrings(error.data?.errors),
    ...collectErrorStrings(error.data?.error),
    ...collectErrorStrings(error.data),
    ...collectErrorStrings(error.response?.data),
  ];

  const hasDuplicateEmailHint = duplicateHintValues.some((value) =>
    value
      ? /email.*(already|taken|exists|in use)|already.*(account|registered)|account.*exists|user.*exists|duplicate.*(email|entry)|users?_email/.test(
          value,
        )
      : false,
  );

  if (status === 409 || normalized.includes("email_in_use") || hasDuplicateEmailHint) {
    return "Looks like you already have an account with that email. Try signing in instead.";
  }
  if (status === 422 || normalized.includes("validation")) {
    return (
      error.data?.message ||
      "Please double-check your details and try again."
    );
  }
  if (status && status >= 500) {
    return "We're having trouble creating your account. Try again later.";
  }
  if (error.data?.message) return error.data.message;
  if (error.message && error.message !== "Error") return error.message;
  return "We couldn't create your account. If you already have one, try signing in instead.";
}

function mapAcceptError(error) {
  if (!error) return "We couldn't add you to this match. Try again later.";
  if (isMatchArchivedError(error)) {
    return "This match has been archived. Invites are read-only.";
  }
  const status = error.status ?? error.response?.status;
  const code = (error.data?.error || error.message || "")
    .toString()
    .toLowerCase();

  if (status === 404 || code.includes("not_found")) {
    return "This invite is no longer available. Ask the host to send a new link.";
  }
  if (status === 409 || code.includes("full")) {
    return "This match is already full or unavailable.";
  }
  if (code.includes("revoked")) {
    return "The host revoked this invite. Ask them for a new link.";
  }
  if (status && status >= 500) {
    return "We're having trouble adding you to this match. Try again later.";
  }
  if (error.data?.message) return error.data.message;
  if (error.message && error.message !== "Error") return error.message;
  return "We couldn't add you to this match. Try again later.";
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

