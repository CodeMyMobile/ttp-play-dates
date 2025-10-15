import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Users,
  Clock,
  MapPin,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  UserPlus,
} from "lucide-react";

const formatTimeUntil = (milliseconds) => {
  if (!Number.isFinite(milliseconds)) return "";
  if (milliseconds <= 0) return "Starting soon";

  const minutes = Math.round(milliseconds / (1000 * 60));
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    if (remainingMinutes === 0) {
      return `${hours} hour${hours === 1 ? "" : "s"}`;
    }
    return `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(hours / 24);
  const leftoverHours = hours % 24;
  if (leftoverHours === 0) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return `${days}d ${leftoverHours}h`;
};

const formatRelativePast = (timestamp) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  const diffMs = Date.now() - timestamp;
  if (diffMs <= 0) return "Just now";

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
};

const HostMatchAlerts = ({ alerts = [], onInvite, formatDateTime }) => {
  const [expandedMatchId, setExpandedMatchId] = useState(null);

  const sortedAlerts = useMemo(() => {
    if (!Array.isArray(alerts)) return [];
    return [...alerts].sort((a, b) => {
      const left = Number.isFinite(a?.timeUntilMs) ? a.timeUntilMs : Infinity;
      const right = Number.isFinite(b?.timeUntilMs) ? b.timeUntilMs : Infinity;
      if (left === right) return (a?.matchId || 0) - (b?.matchId || 0);
      return left - right;
    });
  }, [alerts]);

  if (sortedAlerts.length === 0) {
    return null;
  }

  return (
    <section className="bg-gradient-to-r from-amber-50 via-white to-orange-50 border border-amber-200 rounded-3xl shadow-sm p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-amber-100 p-2 text-amber-600">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-black text-amber-900 flex items-center gap-2">
            Upcoming matches need attention
          </h3>
          <p className="text-sm font-semibold text-amber-700">
            You still have open spots in matches starting soon. Review the details and invite a few trusted players.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {sortedAlerts.map((alert) => {
          const isExpanded = expandedMatchId === alert.matchId;
          const recommendations = Array.isArray(alert.recommendations)
            ? alert.recommendations
            : [];
          return (
            <div
              key={alert.matchId}
              className="rounded-2xl border border-amber-100 bg-white/80 backdrop-blur px-4 py-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-amber-700">
                    <Users className="w-4 h-4" />
                    Need {alert.openSpots}
                    {alert.openSpots === 1 ? " more player" : " more players"}
                    {Number.isFinite(alert.playerLimit) && (
                      <span className="text-amber-500">
                        (capacity {alert.playerLimit})
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-gray-700">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span className="text-gray-900 font-bold">
                      {formatTimeUntil(alert.timeUntilMs)}
                    </span>
                    {typeof formatDateTime === "function" && (
                      <span className="text-gray-500">• {formatDateTime(alert.dateTime)}</span>
                    )}
                  </div>
                  {alert.location && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span>{alert.location}</span>
                    </div>
                  )}
                  {(alert.format || alert.skillLevel) && (
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
                      {alert.format && (
                        <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          {alert.format}
                        </span>
                      )}
                      {alert.skillLevel && (
                        <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                          NTRP {alert.skillLevel}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={() => setExpandedMatchId(isExpanded ? null : alert.matchId)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-black text-amber-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
                  >
                    <Lightbulb className="w-4 h-4" />
                    {isExpanded ? "Hide suggestions" : "View suggestions"}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => (typeof onInvite === "function" ? onInvite(alert.matchId) : null)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-black text-white shadow hover:shadow-md transition"
                  >
                    <UserPlus className="w-4 h-4" /> Manage invites
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 border-t border-amber-100 pt-4 space-y-3">
                  {recommendations.length > 0 ? (
                    <ul className="space-y-3">
                      {recommendations.map((player) => (
                        <li
                          key={player.key}
                          className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-sm font-black text-gray-900">
                              {player.name}
                            </p>
                            <div className="text-xs font-semibold text-gray-600 space-x-2">
                              <span>{player.matchCount} match{player.matchCount === 1 ? "" : "es"} together</span>
                              {Number.isFinite(player.lastSeen) && player.lastSeen > 0 && (
                                <span className="text-gray-400">• {formatRelativePast(player.lastSeen)}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs font-semibold text-gray-600 space-y-1 text-left sm:text-right">
                            {player.email && <p>{player.email}</p>}
                            {player.phoneDisplay && <p>{player.phoneDisplay}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-xl border border-dashed border-amber-200 bg-white/60 px-4 py-3 text-sm font-semibold text-amber-700">
                      We don't have enough history to suggest specific players yet. Try inviting partners you've played with recently.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default HostMatchAlerts;
