// src/pages/MatchPage.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Autocomplete from "react-google-autocomplete";
import {
  Calendar,
  MapPin,
  Users,
  ClipboardList,
  FileText,
  X,
  Share2,
  Link as LinkIcon,
  Pencil,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Header from "../components/Header.jsx";
import { ARCHIVE_FILTER_VALUE, isMatchArchivedError } from "../utils/archive";
import {
  idsMatch,
  uniqueActiveParticipants,
} from "../utils/participants";
import {
  getMatch,
  getShareLink,
  removeParticipant,
  updateMatch,
} from "../services/matches";
import {
  MATCH_FORMAT_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  ensureOptionPresent,
  isValidOptionValue,
} from "../utils/matchOptions";
import { buildDateTimePayload } from "../utils/datetime";
import { isPrivateMatch } from "../utils/matchPrivacy";
import { buildMatchUpdatePayload } from "../utils/matchPayload";

const DEFAULT_FORM = {
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

const buildInitialForm = (match) => {
  if (!match) return { ...DEFAULT_FORM };
  const latitude =
    parseCoordinate(match.latitude) ?? parseCoordinate(match.lat);
  const longitude =
    parseCoordinate(match.longitude) ?? parseCoordinate(match.lng);
  const privateMatch = isPrivateMatch(match);
  return {
    date: toDateInput(match.start_date_time),
    time: toTimeInput(match.start_date_time),
    location: match.location_text || match.location || "",
    latitude,
    longitude,
    matchFormat: match.match_format || match.format || "",
    level: privateMatch
      ? ""
      : match.skill_level || match.skill_level_min || "",
    notes: match.notes || "",
  };
};

export default function MatchPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [shareLink, setShareLink] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY;

  const [currentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const {
    data,
    error,
    isError,
    isLoading,
  } = useQuery({
    queryKey: ["match", id],
    enabled: Boolean(id),
    retry: false,
    queryFn: async () => {
      if (!id) return null;
      try {
        return await getMatch(id);
      } catch (err) {
        if (!isMatchArchivedError(err)) throw err;
        return await getMatch(id, { filter: ARCHIVE_FILTER_VALUE });
      }
    },
  });

  const match = data?.match || null;
  const participants = useMemo(
    () => uniqueActiveParticipants(data?.participants || []),
    [data?.participants],
  );

  const originalForm = useMemo(() => buildInitialForm(match), [match]);

  const availableMatchFormats = useMemo(
    () => ensureOptionPresent(MATCH_FORMAT_OPTIONS, originalForm.matchFormat),
    [originalForm.matchFormat],
  );

  const availableSkillLevels = useMemo(
    () => ensureOptionPresent(SKILL_LEVEL_OPTIONS, originalForm.level),
    [originalForm.level],
  );

  useEffect(() => {
    setFormState(originalForm);
  }, [originalForm]);

  useEffect(() => {
    if (shareLink) setShareCopied(false);
  }, [shareLink]);

  const archived = match?.status === "archived";
  const cancelled = match?.status === "cancelled";
  const isPrivate = isPrivateMatch(match);
  const isOpenMatch = Boolean(match) && !isPrivate;
  const isHost = Boolean(match?.host_id) && idsMatch(currentUser?.id, match.host_id);
  const canEdit = isHost && !archived && !cancelled;

  const hasChanges = useMemo(() => {
    return JSON.stringify(formState) !== JSON.stringify(originalForm);
  }, [formState, originalForm]);

  const scheduleChanged =
    originalForm.date !== formState.date ||
    originalForm.time !== formState.time ||
    originalForm.location.trim() !== formState.location.trim();

  const updateMatchMutation = useMutation({
    mutationFn: async (updates) => {
      if (!match?.id) return null;
      return updateMatch(match.id, updates);
    },
    onSuccess: async () => {
      setFeedback({ type: "success", message: "Match updated successfully." });
      setFormError("");
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["match", id] });
    },
    onError: (err) => {
      const message =
        err?.response?.data?.message || err?.message || "Failed to update match.";
      setFeedback({ type: "error", message });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (playerId) => {
      if (!match?.id) return null;
      return removeParticipant(match.id, playerId);
    },
    onSuccess: (_, playerId) => {
      queryClient.setQueryData(["match", id], (prev) => {
        if (!prev) return prev;
        const filtered = (prev.participants || []).filter(
          (participant) => !idsMatch(participant.player_id, playerId),
        );
        return { ...prev, participants: filtered };
      });
      setFeedback({ type: "success", message: "Participant removed." });
    },
    onError: (err) => {
      const message =
        err?.response?.data?.message || err?.message || "Failed to remove participant.";
      setFeedback({ type: "error", message });
    },
  });

  const shareLinkMutation = useMutation({
    mutationFn: async () => {
      if (!match?.id) return null;
      return getShareLink(match.id);
    },
    onSuccess: (result) => {
      const link = result?.shareUrl || result?.share_url || result?.url || "";
      if (!link) {
        setFeedback({
          type: "error",
          message: "We couldn't generate a share link. Try again.",
        });
        setShareLink("");
        return;
      }
      setShareLink(link);
      setFeedback({ type: "success", message: "Share link ready to copy." });
    },
    onError: (err) => {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "We couldn't generate a share link. Try again.";
      setFeedback({ type: "error", message });
    },
  });

  const handleEditToggle = () => {
    if (!canEdit) return;
    setFeedback(null);
    setFormError("");
    setIsEditing((prev) => !prev);
  };

  const handleLocationInputChange = useCallback((value) => {
    setFormState((prev) => ({
      ...prev,
      location: value,
      latitude: null,
      longitude: null,
    }));
  }, []);

  const handleLocationSelect = useCallback((place) => {
    if (!place) return;
    setFormState((prev) => {
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

  const handleFormChange = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    setFormState(originalForm);
    setIsEditing(false);
    setFormError("");
    setFeedback(null);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!match?.id) return;
    setFormError("");
    setFeedback(null);
    const trimmedLocation = formState.location.trim();
    if (!formState.date || !formState.time || !trimmedLocation) {
      setFormError("Date, time, and location are required.");
      return;
    }
    const dateTimeInfo = buildDateTimePayload(formState.date, formState.time);
    const isoDate = dateTimeInfo?.isoString;
    if (!isoDate) {
      setFormError("Please provide a valid date and time.");
      return;
    }
    if (scheduleChanged) {
      const confirmed = window.confirm(
        "Changing the schedule will notify participants. Continue?",
      );
      if (!confirmed) return;
    }

    const matchFormat = formState.matchFormat?.trim?.() ?? "";
    if (matchFormat && !isValidOptionValue(availableMatchFormats, matchFormat)) {
      setFormError("Select a valid match format.");
      return;
    }

    const level = formState.level?.trim?.() ?? "";
    if (isOpenMatch && level && !isValidOptionValue(availableSkillLevels, level)) {
      setFormError("Select a valid level.");
      return;
    }

    const notes = formState.notes.trim();
    const latitude = parseCoordinate(formState.latitude);
    const longitude = parseCoordinate(formState.longitude);

    const payload = buildMatchUpdatePayload({
      startDateTime: isoDate,
      startDateTimeLocal: dateTimeInfo?.localDateTime || null,
      startDateTimeOffsetMinutes: dateTimeInfo?.timezoneOffsetMinutes,
      startDateTimeTimezone: dateTimeInfo?.timezoneName || null,
      locationText: trimmedLocation,
      matchFormat,
      previousMatchFormat: originalForm.matchFormat,
      notes,
      isOpenMatch,
      skillLevel: level,
      previousSkillLevel: originalForm.level,
      latitude,
      longitude,
      previousLatitude: originalForm.latitude,
      previousLongitude: originalForm.longitude,
    });

    try {
      await updateMatchMutation.mutateAsync(payload);
    } catch {
      // mutation handles error state
    }
  };

  const handleRemoveParticipant = async (playerId) => {
    if (!canEdit || !match?.id) return;
    const participant = participants.find((p) => idsMatch(p.player_id, playerId));
    if (participant && idsMatch(participant.player_id, match.host_id)) return;
    if (!window.confirm("Remove this participant from the match?")) return;
    setRemovingId(playerId);
    try {
      await removeParticipantMutation.mutateAsync(playerId);
    } catch {
      // handled in mutation
    } finally {
      setRemovingId(null);
    }
  };

  const handleGenerateShareLink = async () => {
    setShareCopied(false);
    try {
      await shareLinkMutation.mutateAsync();
    } catch {
      // handled in mutation
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareCopied(true);
      setFeedback({ type: "success", message: "Link copied to clipboard." });
    } catch {
      setShareCopied(false);
      setFeedback({
        type: "error",
        message: "Unable to copy link. Copy it manually instead.",
      });
    }
  };

  if (isLoading)
    return (
      <>
        <Header />
        <Page>
          <p>Loading…</p>
        </Page>
      </>
    );

  if (isError)
    return (
      <>
        <Header />
        <Page>
          <Alert>
            {isMatchArchivedError(error)
              ? "This match has been archived and is no longer accessible."
              : "Not found or access denied."}
          </Alert>
        </Page>
      </>
    );

  if (!match)
    return (
      <>
        <Header />
        <Page>
          <Alert>Match unavailable.</Alert>
        </Page>
      </>
    );

  return (
    <>
      <Header />
      <Page>
        <header className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Match Details</h1>
              <p className="text-sm text-gray-500">
                Hosted by {match.host_name || "Match Organizer"}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={handleEditToggle}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
              >
                <Pencil className="h-4 w-4" />
                {isEditing ? "Close editor" : "Edit match"}
              </button>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {cancelled && (
              <Badge intent="warning">CANCELLED</Badge>
            )}
            {archived && <Badge intent="neutral">ARCHIVED</Badge>}
          </div>
        </header>

        {feedback && (
          <div
            className={`mb-6 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm font-semibold ${
              feedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {feedback.type === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <section className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          {isEditing ? (
            <form className="space-y-5" onSubmit={handleSave}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date" required>
                  <input
                    type="date"
                    value={formState.date}
                    onChange={(event) =>
                      handleFormChange("date", event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </Field>
                <Field label="Time" required>
                  <input
                    type="time"
                    value={formState.time}
                    onChange={(event) =>
                      handleFormChange("time", event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </Field>
              </div>
              <Field label="Location" required>
                {googleApiKey ? (
                  <Autocomplete
                    apiKey={googleApiKey}
                    value={formState.location}
                    onChange={(event) =>
                      handleLocationInputChange(event.target.value)
                    }
                    onPlaceSelected={handleLocationSelect}
                    options={{
                      types: ["establishment"],
                      fields: ["formatted_address", "geometry", "name"],
                    }}
                    placeholder="Court name or address"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                ) : (
                  <input
                    type="text"
                    value={formState.location}
                    onChange={(event) =>
                      handleLocationInputChange(event.target.value)
                    }
                    placeholder="Court name or address"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                )}
              </Field>
              <Field label="Match format">
                <select
                  value={formState.matchFormat}
                  onChange={(event) =>
                    handleFormChange("matchFormat", event.target.value)
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="">Select format</option>
                  {availableMatchFormats.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              {isOpenMatch && (
                <Field label="Level">
                  <select
                    value={formState.level}
                    onChange={(event) =>
                      handleFormChange("level", event.target.value)
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="">Select level</option>
                    {availableSkillLevels.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.desc
                          ? `${option.label} – ${option.desc}`
                          : option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {isOpenMatch && (
                <Field label="Notes / Description">
                  <textarea
                    value={formState.notes}
                    onChange={(event) =>
                      handleFormChange("notes", event.target.value)
                    }
                    rows={4}
                    placeholder="Add context, scoring, or reminders"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </Field>
              )}

              {formError && (
                <p className="text-sm font-semibold text-red-600">{formError}</p>
              )}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  disabled={updateMatchMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    updateMatchMutation.isPending || !hasChanges || !formState.date || !formState.time
                  }
                  className="inline-flex justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {updateMatchMutation.isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 text-sm text-gray-700">
                <DetailRow icon={Calendar}>
                  {match.start_date_time
                    ? new Date(match.start_date_time).toLocaleString()
                    : "Date to be announced"}
                </DetailRow>
                {match.location_text && (
                  <DetailRow icon={MapPin}>{match.location_text}</DetailRow>
                )}
                {match.match_format && (
                  <DetailRow icon={ClipboardList}>{match.match_format}</DetailRow>
                )}
                {isOpenMatch && match.skill_level && (
                  <DetailRow icon={Users}>
                    Skill level: {match.skill_level}
                  </DetailRow>
                )}
                {match.notes && (
                  <DetailRow icon={FileText}>{match.notes}</DetailRow>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="mb-6 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Users className="h-5 w-5 text-gray-500" /> Participants
            </h2>
            <span className="text-sm font-medium text-gray-500">
              {participants.length} player{participants.length === 1 ? "" : "s"}
            </span>
          </header>
          {participants.length ? (
            <ul className="divide-y divide-gray-100">
              {participants.map((participant) => {
                const name =
                  participant.profile?.full_name ||
                  participant.profile?.name ||
                  `Player ${participant.player_id}`;
                const isHostParticipant = idsMatch(
                  participant.player_id,
                  match.host_id,
                );
                return (
                  <li
                    key={participant.id || participant.player_id}
                    className="flex items-center justify-between py-3 text-sm text-gray-700"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900">{name}</span>
                      {isHostParticipant && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                          Host
                        </span>
                      )}
                    </div>
                    {canEdit && !isHostParticipant ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveParticipant(participant.player_id)}
                        disabled={removingId === participant.player_id || removeParticipantMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X className="h-4 w-4" />
                        {removingId === participant.player_id
                          ? "Removing…"
                          : "Remove"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">{isHostParticipant ? "Organizer" : ""}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No participants yet.</p>
          )}
        </section>

        {isHost && (
          <section className="mb-10 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
              {isOpenMatch ? (
                <>
                  <Share2 className="h-5 w-5 text-gray-500" /> Share this match
                </>
              ) : (
                <>
                  <Users className="h-5 w-5 text-gray-500" /> Invite players
                </>
              )}
            </h2>
            {isOpenMatch ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Generate a public link to share with potential players.
                </p>
                {shareLink && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                      <LinkIcon className="h-4 w-4 text-gray-400" />
                      <span className="truncate">{shareLink}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
                    >
                      {shareCopied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleGenerateShareLink}
                  disabled={shareLinkMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Share2 className="h-4 w-4" />
                  {shareLinkMutation.isPending ? "Generating…" : "Generate share link"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Use the invite flow to add players directly.
                </p>
                <Link
                  to={`/matches/${match.id}/invite`}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Users className="h-4 w-4 text-white" />
                  Open invite manager
                </Link>
              </div>
            )}
          </section>
        )}
      </Page>
    </>
  );
}

function Page({ children }) {
  return <main className="mx-auto max-w-3xl p-4 sm:p-6">{children}</main>;
}

function Alert({ children }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-700">
      {children}
    </div>
  );
}

function Badge({ children, intent = "neutral" }) {
  const styles =
    intent === "warning"
      ? "bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-200"
      : "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-700 border-slate-300";
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1.5 text-xs font-black ${styles}`}
    >
      {children}
    </span>
  );
}

function Field({ label, required = false, children }) {
  return (
    <label className="flex w-full flex-col gap-1 text-sm font-semibold text-gray-700">
      <span>
        {label}
        {required ? (
          <span className="ml-1 font-normal text-red-500">*</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function DetailRow({ icon, children }) {
  const Icon = icon;
  return (
    <p className="flex items-start gap-2 text-sm font-medium text-gray-700">
      <Icon className="mt-0.5 h-4 w-4 text-gray-400" />
      <span>{children}</span>
    </p>
  );
}
