import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  MapPin,
  Users,
  Check,
  Copy,
  User,
  X,
  Send,
  Phone,
} from "lucide-react";
import {
  getMatch,
  getShareLink,
  searchPlayers,
  removeParticipant,
  updateMatch,
  sendInvites,
} from "../services/matches";
import { ARCHIVE_FILTER_VALUE, isMatchArchivedError } from "../utils/archive";
import { idsMatch, uniqueActiveParticipants } from "../utils/participants";

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
  const [hostId, setHostId] = useState(null);
  const [isArchived, setIsArchived] = useState(false);
  const [matchStatus, setMatchStatus] = useState(null);

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
    setMatchStatus(null);
    setIsArchived(false);
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
        const status = data.match?.status ?? null;
        setMatchStatus(status);
        const archived = status === "archived";
        setIsArchived(archived);
        if (archived) {
          setParticipants([]);
          setParticipantsError("This match has been archived. Invites are read-only.");
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
          setIsArchived(true);
          setMatchStatus("archived");
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

  const canRemove = (pid) => {
    const host = hostId ?? currentUser?.id;
    if (!host || !currentUser?.id || isArchived) return false;
    return idsMatch(currentUser.id, host) && !idsMatch(pid, host);
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

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Share Link</h3>
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
                {copiedLink ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
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

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Players</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {players.map((player) => {
                const name = player.full_name;
                const pid = Number(player.user_id);
                const selected = selectedPlayers.has(pid);
                return (
                  <button
                    key={player.user_id}
                    onClick={() => {
                      if (!Number.isFinite(pid) || pid <= 0) return;
                      setSelectedPlayers((prev) => {
                        const newMap = new Map(prev);
                        if (newMap.has(pid)) newMap.delete(pid);
                        else newMap.set(pid, { ...player, user_id: pid });
                        return newMap;
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
                        .map((n) => n[0])
                        .join("")
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
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.perPage)}
                  className="px-3 py-1.5 rounded-lg border-2 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {selectedPlayers.size > 0 && (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                  Selected ({totalSelectedInvitees})
                </h3>
                <button
                  onClick={() => setSelectedPlayers(new Map())}
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
                  if (matchStatus !== "upcoming") {
                    await updateMatch(matchId, { status: "upcoming" });
                    setMatchStatus("upcoming");
                  }
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
