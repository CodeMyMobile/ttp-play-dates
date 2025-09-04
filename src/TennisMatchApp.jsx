import React, { useState, useEffect, useRef, useCallback } from "react";
import apiClient from "./services/api";
import {
  listMatches,
  createMatch,
  updateMatch,
  cancelMatch,
  joinMatch,
  leaveMatch,
  searchPlayers,
  sendInvites,
} from "./services/matches";
import ProfileManager from "./components/ProfileManager";
import InvitesList from "./components/InvitesList";
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  ChevronRight,
  Plus,
  X,
  Check,
  Search,
  Share2,
  Menu,
  Bell,
  Star,
  TrendingUp,
  Award,
  Filter,
  Settings,
  LogOut,
  User,
  ChevronLeft,
  MoreVertical,
  Send,
  Copy,
  Mail,
  MessageCircle,
  AlertCircle,
  ArrowRight,
  Zap,
  Trophy,
  Activity,
  Sparkles,
  Target,
} from "lucide-react";
import Autocomplete from "react-google-autocomplete";

const TennisMatchApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState("browse");
  const [activeFilter, setActiveFilter] = useState("my");
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [showToast, setShowToast] = useState(null);
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState(new Map());
  const [inviteMatchId, setInviteMatchId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMatchMenu, setShowMatchMenu] = useState(null);
  const [signInStep, setSignInStep] = useState("initial");
  const [password, setPassword] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    skillLevel: "",
  });
  const [verificationCode, setVerificationCode] = useState("");

  const [matchData, setMatchData] = useState({
    type: "open",
    playerCount: 4,
    skillLevel: null,
    format: "Doubles",
    dateTime: "",
    location: "",
    latitude: null,
    longitude: null,
    mapUrl: "",
    notes: "",
  });

  const [matches, setMatches] = useState([]);
  const [matchCounts, setMatchCounts] = useState({
    my: 0,
    open: 0,
    today: 0,
    tomorrow: 0,
    weekend: 0,
  });
  const [editMatch, setEditMatch] = useState(null);

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(15, 0, 0, 0);
    setMatchData((prev) => ({
      ...prev,
      dateTime: tomorrow.toISOString().slice(0, 16),
    }));
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  const displayToast = (message, type = "success") => {
    setShowToast({ message, type });
    setTimeout(() => setShowToast(null), 3000);
  };

  const formatDateTime = (dateTime) => {
    const date = new Date(dateTime);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatPhoneNumber = (value) => {
    const phone = value.replace(/\D/g, "");
    const match = phone.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (!match) return value;
    return !match[2]
      ? match[1]
      : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ""}`;
  };

  const buildMapsUrl = (lat, lng, address) => {
    if (lat && lng) {
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    if (address) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        address
      )}`;
    }
    return "";
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("refreshToken");
    setCurrentUser(null);
    displayToast("Logged out", "success");
  };

  const fetchMatches = useCallback(async () => {
    try {
      const data = await listMatches(activeFilter);
      const rawMatches = data.matches || [];
      setMatchCounts(data.counts || {});
      const transformed = rawMatches.map((m) => ({
        id: m.id,
        type: m.host_id === currentUser?.id ? "hosted" : "available",
        status: m.match_type === "private" ? "closed" : m.status || "open",
        dateTime: m.start_date_time,
        location: m.location_text,
        latitude: m.latitude,
        longitude: m.longitude,
        mapUrl: buildMapsUrl(m.latitude, m.longitude, m.location_text),
        format: m.match_format,
        skillLevel: m.skill_level_min,
        notes: m.notes,
        players: m.players || [],
        spotsAvailable: m.player_limit,
      }));
      setMatches(transformed);
    } catch (err) {
      displayToast(
        err.response?.data?.message || "Failed to load matches",
        "error"
      );
    }
  }, [activeFilter, currentUser]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Removed static sample players; will fetch real player list in InviteScreen

  const Header = () => (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-50 backdrop-blur-lg bg-white/95">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {currentScreen === "browse" ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">🎾</span>
              </div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Matchplay
              </h1>
            </div>
            {currentUser ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentScreen("invites")}
                  className="relative p-2.5 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                </button>
                <button
                  onClick={() => setShowProfileManager(true)}
                  className="flex items-center gap-2 hover:bg-gray-50 px-3 py-2 rounded-xl transition-all"
                >
                  <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                    {currentUser.avatar}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold text-gray-800">
                      {currentUser.name.split(" ")[0]}
                    </span>
                    {currentUser.skillLevel && (
                      <span className="text-xs font-semibold text-gray-500">
                        NTRP {currentUser.skillLevel}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 hover:bg-gray-50 px-3 py-2 rounded-xl transition-all"
                >
                  <LogOut className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-bold text-gray-800">Log Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSignInModal(true)}
                className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:shadow-xl hover:scale-105 transition-all shadow-lg"
              >
                Sign In
              </button>
            )}
          </div>
        ) : currentScreen === "invites" ? (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentScreen("browse")}
              className="flex items-center gap-2 hover:bg-gray-50 px-3 py-2 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700 font-bold">Back</span>
            </button>
            <h1 className="text-xl font-black text-gray-800">Invites</h1>
            {currentUser && (
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                {currentUser.avatar}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (showPreview) {
                  setShowPreview(false);
                } else {
                  setCurrentScreen("browse");
                }
              }}
              className="flex items-center gap-2 hover:bg-gray-50 px-3 py-2 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700 font-bold">Back</span>
            </button>
            {currentUser && (
              <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                {currentUser.avatar}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const BrowseScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30">
      {/* Hero Section with Action Button */}
      <div className="bg-gradient-to-br from-white via-green-50/20 to-emerald-50/30 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-green-600" />
            <span className="text-sm font-bold text-green-600 uppercase tracking-wide">
              Active Now
            </span>
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-3">
            {currentUser
              ? `Welcome back, ${currentUser.name.split(" ")[0]}!`
              : "Find Your Next Match"}
          </h2>
          <p className="text-lg font-medium text-gray-600 mb-8">
            {currentUser
              ? "You have 2 upcoming matches this week"
              : "Join 500+ players in North County"}
          </p>

          {/* Prominent Action Button */}
          <button
            onClick={() => {
              if (!currentUser) {
                setShowSignInModal(true);
              } else {
                setCurrentScreen("create");
                setCreateStep(1);
              }
            }}
            className="group relative inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white rounded-2xl font-black text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
            <Sparkles className="w-6 h-6 relative" />
            <span className="relative">Create New Match</span>
            <ArrowRight className="w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white sticky top-[65px] z-40 border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-2 py-4 overflow-x-auto scrollbar-hide">
            {[ 
              {
                id: "my",
                label: "My Matches",
                count: matchCounts.my || 0,
                color: "violet",
                icon: "⭐",
              },
              {
                id: "open",
                label: "Open Matches",
                count: matchCounts.open || 0,
                color: "green",
                icon: "🔥",
              },
              {
                id: "today",
                label: "Today",
                count: matchCounts.today || 0,
                color: "blue",
                icon: "📅",
              },
              {
                id: "tomorrow",
                label: "Tomorrow",
                count: matchCounts.tomorrow || 0,
                color: "amber",
                icon: "⏰",
              },
              {
                id: "weekend",
                label: "Weekend",
                count: matchCounts.weekend || 0,
                color: "purple",
                icon: "🎉",
              },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  activeFilter === filter.id
                    ? "text-white shadow-lg scale-105"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                style={
                  activeFilter === filter.id
                    ? {
                        background:
                          filter.color === "violet"
                            ? "linear-gradient(135deg, rgb(139 92 246), rgb(124 58 237))"
                            : filter.color === "green"
                            ? "linear-gradient(135deg, rgb(34 197 94), rgb(16 185 129))"
                            : filter.color === "blue"
                            ? "linear-gradient(135deg, rgb(59 130 246), rgb(37 99 235))"
                            : filter.color === "amber"
                            ? "linear-gradient(135deg, rgb(245 158 11), rgb(217 119 6))"
                            : "linear-gradient(135deg, rgb(168 85 247), rgb(147 51 234))",
                      }
                    : {}
                }
              >
                <span className="text-base">{filter.icon}</span>
                {filter.label}
                {filter.count > 0 && (
                  <span
                    className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
                      activeFilter === filter.id
                        ? "bg-white/25 text-white"
                        : "bg-white text-gray-600"
                    }`}
                  >
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Match Cards */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Actions Bar */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <h3 className="text-xl font-black mb-1">
                Looking for a quick game?
              </h3>
              <p className="text-blue-100 font-medium">
                3 players near you are ready to play now
              </p>
            </div>
            <button className="px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:shadow-lg hover:scale-105 transition-all">
              Find Players
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </div>
    </div>
  );

  const MatchCard = ({ match }) => {
    const isHosted = match.type === "hosted";
    const isJoined = match.type === "joined";

    const getNTRPDisplay = (skillLevel) => {
      if (!skillLevel || skillLevel === "Any Level") return null;
      const ntrp = skillLevel.split(" - ")[0];
      return ntrp;
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-2xl transition-all p-6 border border-gray-100 group hover:scale-[1.02]">
        <div className="flex justify-between items-start mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {match.status === "open" && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200 rounded-full text-xs font-black flex items-center gap-1.5">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                OPEN
              </span>
            )}
            {match.status === "closed" && (
              <span className="px-3 py-1.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-full text-xs font-black">
                PRIVATE
              </span>
            )}
            {isHosted && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 border border-violet-200 rounded-full text-xs font-black">
                HOSTING
              </span>
            )}
            {isJoined && (
              <span className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 rounded-full text-xs font-black">
                PLAYING
              </span>
            )}
          </div>
          {(isHosted || isJoined) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMatchMenu(showMatchMenu === match.id ? null : match.id);
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-4 h-4 text-gray-400" />
                {showMatchMenu === match.id && (
                  <MatchMenu
                    type={isHosted ? "host" : "player"}
                    matchId={match.id}
                    onClose={() => setShowMatchMenu(null)}
                  />
                )}
            </button>
          )}
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">
                {formatDateTime(match.dateTime)}
              </p>
              <p className="text-xs font-semibold text-gray-500">
                Duration: 2 hours
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-pink-100 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">
                <a
                  href={match.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {match.location}
                </a>
              </p>
              <p className="text-xs font-semibold text-gray-500">
                2.3 miles away
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-bold text-gray-700">
              {match.format}
            </span>
          </div>
          {getNTRPDisplay(match.skillLevel) && (
            <>
              <span className="text-gray-300">•</span>
              <span className="text-sm font-black text-gray-900 bg-gradient-to-r from-amber-50 to-orange-50 px-2.5 py-1 rounded-lg">
                NTRP {getNTRPDisplay(match.skillLevel)}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {match.players.map((player, idx) => (
                <div
                  key={idx}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black border-2 border-white shadow-md ${
                    player.confirmed
                      ? player.name === "You"
                        ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                        : "bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700"
                      : "bg-white border-2 border-dashed border-gray-300 text-gray-400"
                  }`}
                >
                  {player.avatar}
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-600 font-bold">
              {match.spotsAvailable === 0
                ? "FULL"
                : `${match.spotsAvailable} SPOT${
                    match.spotsAvailable === 1 ? "" : "S"
                  } LEFT`}
            </span>
          </div>

            {match.type === "available" && (
              <button
                onClick={async () => {
                  if (!currentUser) {
                    setShowSignInModal(true);
                  } else {
                    try {
                      await joinMatch(match.id);
                      displayToast("Successfully joined the match! 🎾");
                      fetchMatches();
                    } catch (err) {
                      displayToast(
                        err.response?.data?.message || "Failed to join match",
                        "error"
                      );
                    }
                  }
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-black hover:shadow-xl hover:scale-110 transition-all flex items-center gap-1.5 shadow-lg"
              >
                <Zap className="w-4 h-4" />
                JOIN
              </button>
            )}
          {isHosted && (
            <button
              onClick={() => {
                setEditMatch({
                  id: match.id,
                  dateTime: new Date(match.dateTime).toISOString().slice(0, 16),
                  location: match.location,
                  latitude: match.latitude,
                  longitude: match.longitude,

                  notes: match.notes || "",
                });
                setShowEditModal(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-black hover:shadow-xl hover:scale-110 transition-all shadow-lg"
            >
              MANAGE
            </button>
          )}
          {isJoined && (
            <button
              onClick={() => displayToast("Loading match details...")}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-black hover:bg-gray-200 transition-all"
            >
              DETAILS
            </button>
          )}
        </div>
      </div>
    );
  };

  const MatchMenu = ({ type, matchId, onClose }) => {
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (!e.target.closest(".match-menu")) {
          onClose();
        }
      };
      setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 0);
      return () => document.removeEventListener("click", handleClickOutside);
    }, [onClose]);

    return (
      <div className="match-menu absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
        {type === "host" ? (
          <>
            <button
              onClick={() => {
                const matchToEdit = matches.find((m) => m.id === matchId);
                if (matchToEdit) {
                  setEditMatch({
                    id: matchToEdit.id,
                    dateTime: new Date(matchToEdit.dateTime)
                      .toISOString()
                      .slice(0, 16),
                    location: matchToEdit.location,
                    notes: matchToEdit.notes || "",
                  });
                  setShowEditModal(true);
                }
                onClose();
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Settings className="w-4 h-4 text-gray-500" /> Edit Match
            </button>
            <button
              onClick={() => {
                displayToast("Sending reminders...");
                onClose();
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Bell className="w-4 h-4 text-gray-500" /> Send Reminder
            </button>
            <button
              onClick={() => {
                setInviteMatchId(matchId);
                setSelectedPlayers(new Map());
                setCurrentScreen("invite");
                onClose();
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4 text-gray-500" /> Invite More
            </button>
            <div className="border-t border-gray-100" />
            <button
              onClick={async () => {
                try {
                  await cancelMatch(matchId);
                  displayToast("Match cancelled");
                  onClose();
                  fetchMatches();
                } catch (err) {
                  displayToast(
                    err.response?.data?.message || "Failed to cancel match",
                    "error"
                  );
                }
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
            >
              <X className="w-4 h-4" /> Cancel Match
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                displayToast("Loading match details...");
                onClose();
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <Calendar className="w-4 h-4 text-gray-500" /> View Details
            </button>
            <button
              onClick={() => {
                displayToast("Opening chat...");
                onClose();
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-gray-500" /> Contact Host
            </button>
            <div className="border-t border-gray-100" />
            <button
              onClick={async () => {
                try {
                  await leaveMatch(matchId);
                  displayToast("Left match");
                  onClose();
                  fetchMatches();
                } catch (err) {
                  displayToast(
                    err.response?.data?.message || "Failed to leave match",
                    "error"
                  );
                }
              }}
              className="w-full px-4 py-3 text-left text-sm font-bold text-orange-600 hover:bg-orange-50 flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Leave Match
            </button>
          </>
        )}
      </div>
    );
  };

  const CreateMatchScreen = () => {
    const ProgressBar = () => (
      <div className="flex justify-between items-center mb-10 relative">
        <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 rounded-full" />
        <div
          className="absolute top-4 left-0 h-1 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full transition-all duration-500"
          style={{
            width: `${
              ((createStep - 1) / ((matchData.type === "closed" ? 2 : 3) - 1)) *
              100
            }%`,
          }}
        />
        {[1, 2, matchData.type === "closed" ? null : 3]
          .filter(Boolean)
          .map((step) => (
            <div
              key={step}
              className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                step < createStep
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-xl scale-110"
                  : step === createStep
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-xl ring-4 ring-green-100 scale-110"
                  : "bg-white border-2 border-gray-200 text-gray-400"
              }`}
            >
              {step < createStep ? <Check className="w-6 h-6" /> : step}
            </div>
          ))}
      </div>
    );

    const handlePublish = async () => {
      try {
        const payload = {
          type: matchData.type === "closed" ? "private" : "open",
          dateTime: new Date(matchData.dateTime).toISOString(),
          location: matchData.location,
          latitude: matchData.latitude,
          longitude: matchData.longitude,
          playerCount: matchData.playerCount,
          skillLevel: matchData.skillLevel,
          format: matchData.format,
          notes: matchData.notes,
        };
        await createMatch(payload);
        displayToast("Match published successfully! 🎾");
        setCurrentScreen("browse");
        setCreateStep(1);
        setShowPreview(false);
        fetchMatches();
      } catch (err) {
        displayToast(
          err.response?.data?.message || "Failed to publish match",
          "error"
        );
      }
    };

    // Preview Screen for Closed Matches
    if (showPreview && matchData.type === "closed") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 pb-20">
          <div className="max-w-2xl mx-auto p-6">
            <h2 className="text-3xl font-black text-gray-900 mb-8">
              Review Match Details
            </h2>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
              <div className="mb-4">
                <span className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 rounded-full text-xs font-black">
                  PRIVATE MATCH • INVITE ONLY
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-6 h-6 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                      WHEN
                    </h3>
                    <p className="font-black text-gray-900 text-lg">
                      {formatDateTime(matchData.dateTime)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-6 h-6 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                      WHERE
                    </h3>
                    <p className="font-black text-gray-900 text-lg">
                      <a
                        href={matchData.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {matchData.location}
                      </a>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="w-6 h-6 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                      DETAILS
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-gray-900 text-lg">
                        {matchData.playerCount} players
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="font-black text-gray-900 text-lg">
                        {matchData.format}
                      </span>
                    </div>
                  </div>
                </div>

                {matchData.skillLevel &&
                  matchData.skillLevel !== "Any Level" && (
                    <div className="flex items-start gap-3">
                      <Trophy className="w-6 h-6 text-gray-400 mt-0.5" />
                      <div>
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-1">
                          SKILL LEVEL
                        </h3>
                        <span className="inline-block px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 rounded-lg text-sm font-black">
                          NTRP {matchData.skillLevel}
                        </span>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 text-center mb-6 border border-blue-100">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">
                Ready to Invite Players
              </h3>
              <p className="text-base font-semibold text-gray-600">
                You'll need to invite {matchData.playerCount - 1}{" "}
                {matchData.playerCount - 1 === 1 ? "player" : "players"} to join
                this match
              </p>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
              <div className="max-w-2xl mx-auto flex gap-3">
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setCreateStep(2);
                  }}
                  className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setCurrentScreen("invite");
                  }}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  CONTINUE <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (createStep === 1) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30 pb-20">
          <div className="max-w-2xl mx-auto p-6">
            <ProgressBar />

            <h2 className="text-3xl font-black text-gray-900 mb-10">
              Create a Match
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-4 uppercase tracking-wider">
                  Match Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    {
                      id: "open",
                      label: "Open Match",
                      desc: "Anyone can join",
                      icon: "🌍",
                      gradient: "from-green-50 to-emerald-50",
                      border: "border-green-300",
                    },
                    {
                      id: "closed",
                      label: "Private Match",
                      desc: "Invite only",
                      icon: "🔒",
                      gradient: "from-blue-50 to-indigo-50",
                      border: "border-blue-300",
                    },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() =>
                        setMatchData((prev) => ({ ...prev, type: type.id }))
                      }
                      className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 ${
                        matchData.type === type.id
                          ? `bg-gradient-to-br ${type.gradient} ${type.border} shadow-xl`
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div className="text-3xl mb-3">{type.icon}</div>
                      <div className="font-black text-gray-900 mb-1 text-lg">
                        {type.label}
                      </div>
                      <div className="text-xs font-semibold text-gray-600">
                        {type.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={matchData.dateTime}
                  onChange={(e) =>
                    setMatchData((prev) => ({
                      ...prev,
                      dateTime: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-4 w-5 h-5 text-gray-400" />
                  <Autocomplete
                    apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
                    type="search"
                    placeholder="e.g., Oceanside Tennis Center"
                    value={matchData.location}
                    onChange={(e) =>
                      setMatchData((prev) => ({
                        ...prev,
                        location: e.target.value,
                        latitude: null,
                        longitude: null,
                        mapUrl: buildMapsUrl(null, null, e.target.value),
                      }))
                    }
                    onPlaceSelected={(place) => {
                      const address = place.formatted_address || place.name || "";
                      const lat = place.geometry?.location?.lat();
                      const lng = place.geometry?.location?.lng();
                      setMatchData((prev) => ({
                        ...prev,
                        location: address,
                        latitude: lat,
                        longitude: lng,
                        mapUrl: buildMapsUrl(lat, lng, address),
                      }));
                    }}
                    options={{
                      types: ["geocode", "establishment"],
                      fields: [
                        "formatted_address",
                        "geometry",
                        "name",
                        "address_components",
                      ],
                    }}
                    className="w-full pl-11 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800 placeholder:font-semibold"
                  />
                </div>
                <p className="text-xs font-semibold text-gray-500 mt-2">
                  Players will see the exact address after joining
                </p>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-4 uppercase tracking-wider">
                  Number of Players
                </label>
                <div className="flex items-center justify-center gap-10 p-10 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl">
                  <button
                    onClick={() =>
                      setMatchData((prev) => ({
                        ...prev,
                        playerCount: Math.max(2, prev.playerCount - 1),
                      }))
                    }
                    className="w-14 h-14 rounded-full bg-white border-2 border-gray-300 hover:border-green-500 hover:shadow-lg transition-all flex items-center justify-center hover:scale-110"
                  >
                    <span className="text-2xl font-bold text-gray-600">−</span>
                  </button>
                  <div className="text-center">
                    <div className="text-6xl font-black bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                      {matchData.playerCount}
                    </div>
                    <div className="text-base font-bold text-gray-600 mt-2">
                      Total Players
                    </div>
                    <div className="text-sm font-semibold text-gray-500 mt-1">
                      You + {matchData.playerCount - 1}{" "}
                      {matchData.playerCount - 1 === 1 ? "other" : "others"}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setMatchData((prev) => ({
                        ...prev,
                        playerCount: Math.min(8, prev.playerCount + 1),
                      }))
                    }
                    className="w-14 h-14 rounded-full bg-white border-2 border-gray-300 hover:border-green-500 hover:shadow-lg transition-all flex items-center justify-center hover:scale-110"
                  >
                    <span className="text-2xl font-bold text-gray-600">+</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
              <div className="max-w-2xl mx-auto flex gap-3">
                <button
                  onClick={() => {
                    setCurrentScreen("browse");
                    setShowPreview(false);
                    setCreateStep(1);
                  }}
                  className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => {
                    if (!matchData.location || !matchData.dateTime) {
                      displayToast(
                        "Please fill in all required fields",
                        "error"
                      );
                      return;
                    }
                    setCreateStep(2);
                  }}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  NEXT <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (createStep === 2) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30 pb-20">
          <div className="max-w-2xl mx-auto p-6">
            <ProgressBar />

            <h2 className="text-3xl font-black text-gray-900 mb-10">
              Match Settings
            </h2>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                    NTRP Skill Level
                  </label>
                  {matchData.type === "open" ? (
                    <span className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-full font-black">
                      REQUIRED
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-full font-black">
                      OPTIONAL
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      value: "2.5 - Beginner",
                      label: "2.5",
                      desc: "Beginner",
                      color: "from-blue-400 to-blue-500",
                    },
                    {
                      value: "3.0 - Adv. Beginner",
                      label: "3.0",
                      desc: "Developing",
                      color: "from-green-400 to-green-500",
                    },
                    {
                      value: "3.5 - Intermediate",
                      label: "3.5",
                      desc: "Intermediate",
                      color: "from-yellow-400 to-amber-500",
                    },
                    {
                      value: "4.0 - Adv. Intermediate",
                      label: "4.0",
                      desc: "Advanced",
                      color: "from-orange-400 to-orange-500",
                    },
                    {
                      value: "4.5+ - Advanced",
                      label: "4.5+",
                      desc: "Expert",
                      color: "from-red-400 to-red-500",
                    },
                    matchData.type === "closed"
                      ? {
                          value: "Any Level",
                          label: "Any",
                          desc: "All Levels",
                          color: "from-gray-400 to-gray-500",
                        }
                      : null,
                  ]
                    .filter(Boolean)
                    .map((level) => (
                      <button
                        key={level.value}
                        onClick={() =>
                          setMatchData((prev) => ({
                            ...prev,
                            skillLevel: level.value,
                          }))
                        }
                        className={`p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                          matchData.skillLevel === level.value
                            ? "border-gray-900 shadow-xl"
                            : "border-gray-200 hover:border-gray-400 bg-white"
                        }`}
                      >
                        <div
                          className={`text-xl font-black mb-1 ${
                            matchData.skillLevel === level.value
                              ? `bg-gradient-to-r ${level.color} bg-clip-text text-transparent`
                              : "text-gray-700"
                          }`}
                        >
                          {level.label}
                        </div>
                        <div className="text-xs font-bold text-gray-600">
                          {level.desc}
                        </div>
                      </button>
                    ))}
                </div>
                {matchData.type === "open" && (
                  <p className="text-xs font-semibold text-gray-500 mt-3">
                    Helps players find appropriate skill matches
                  </p>
                )}
                {matchData.type === "closed" && (
                  <p className="text-xs font-semibold text-gray-500 mt-3">
                    Optional - helps balance skill levels
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">
                  Match Format
                </label>
                <div className="relative">
                  <Trophy className="absolute left-3 top-4 w-5 h-5 text-gray-400" />
                  <select
                    value={matchData.format}
                    onChange={(e) =>
                      setMatchData((prev) => ({
                        ...prev,
                        format: e.target.value,
                      }))
                    }
                    className="w-full pl-11 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors appearance-none bg-white font-bold text-gray-800"
                  >
                    <option>Doubles</option>
                    <option>Singles</option>
                    <option>Mixed Doubles</option>
                    <option>Dingles</option>
                    <option>Round Robin</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-3 uppercase tracking-wider">
                  Additional Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Any special instructions, what to bring, parking info..."
                  value={matchData.notes}
                  onChange={(e) =>
                    setMatchData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors resize-none font-semibold text-gray-800 placeholder:font-semibold"
                />
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
              <div className="max-w-2xl mx-auto flex gap-3">
                <button
                  onClick={() => setCreateStep(1)}
                  className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={() => {
                    if (matchData.type === "open" && !matchData.skillLevel) {
                      displayToast("Please select a skill level", "error");
                      return;
                    }
                    if (matchData.type === "closed") {
                      setShowPreview(true);
                    } else {
                      setCreateStep(3);
                    }
                  }}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  NEXT <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (createStep === 3) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-green-50/30 pb-20">
          <div className="max-w-2xl mx-auto p-6">
            <ProgressBar />

            <h2 className="text-3xl font-black text-gray-900 mb-10">
              Review & Publish
            </h2>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
              <h3 className="font-black text-gray-900 text-lg mb-5">
                MATCH SUMMARY
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-gray-700">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="font-bold text-base">
                    {formatDateTime(matchData.dateTime)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <span className="font-bold text-base">
                    <a
                      href={matchData.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {matchData.location}
                    </a>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <Users className="w-5 h-5 text-gray-400" />
                  <span className="font-bold text-base">
                    {matchData.playerCount} players total
                  </span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <Trophy className="w-5 h-5 text-gray-400" />
                  <span className="font-bold text-base">
                    {matchData.format} •{" "}
                    {matchData.skillLevel &&
                    matchData.skillLevel !== "Any Level"
                      ? `NTRP ${matchData.skillLevel}`
                      : "Any Level"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-10 text-center border border-green-200">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-xl">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3">
                Ready to Publish!
              </h3>
              <p className="text-lg font-semibold text-gray-600">
                Your match will be visible to all players in the area
              </p>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
              <div className="max-w-2xl mx-auto flex gap-3">
                <button
                  onClick={() => setCreateStep(2)}
                  className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors"
                >
                  BACK
                </button>
                <button
                  onClick={handlePublish}
                  className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  PUBLISH <Check className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null; // Add a null return for completeness
  };

  const InviteScreen = () => {
    const searchInputRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [players, setPlayers] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const perPage = 12;
    const [copiedLink, setCopiedLink] = useState(false);

    const copyLink = () => {
      navigator.clipboard.writeText("matchplay.app/m/abc123");
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    };

    useEffect(() => {
      setPage(1);
    }, [searchTerm]);

    useEffect(() => {
      if (searchTerm === "" || searchTerm.length >= 2) {
        searchPlayers({ search: searchTerm, page, perPage })
          .then((data) => {
            setPlayers(data.players || []);
            setPagination(data.pagination);
          })
          .catch((err) =>
            displayToast(
              err.response?.data?.message || "Failed to load players",
              "error"
            )
          );
      } else {
        setPlayers([]);
        setPagination(null);
      }
    }, [searchTerm, page]);

    // Keep search input focused after each render when typing
    useEffect(() => {
      searchInputRef.current?.focus();
    }, [searchTerm]);

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 pb-20">
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
            <h2 className="text-3xl font-black text-gray-900 mb-3">
              Invite Players
            </h2>
            <p className="text-lg font-semibold text-gray-600 mb-4">
              Need {matchData.playerCount - 1} more{" "}
              {matchData.playerCount - 1 === 1 ? "player" : "players"}
            </p>
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
            </div>
          </div>

          <div className="space-y-6">
            {/* Search players to invite */}
            <div>
              <input
                ref={searchInputRef}
                type="search"
                aria-label="Search players"
                autoComplete="off"
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 font-semibold text-gray-800"
              />
            </div>
            {/* Quick Share */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">
                Share Link
              </h3>
              <div className="flex gap-3 mb-4">
                <input
                  type="text"
                  value="matchplay.app/m/abc123"
                  readOnly
                  className="flex-1 px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600"
                />
                <button
                  onClick={copyLink}
                  className={`px-5 py-3 rounded-xl font-black transition-all ${
                    copiedLink
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white"
                      : "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-xl hover:scale-105 shadow-lg"
                  }`}
                >
                  {copiedLink ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => displayToast("Opening WhatsApp...")}
                  className="py-3 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-2 border-green-300 rounded-xl text-sm font-black hover:shadow-lg hover:scale-105 transition-all"
                >
                  WHATSAPP
                </button>
                <button
                  onClick={() => displayToast("Opening messages...")}
                  className="py-3 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-2 border-blue-300 rounded-xl text-sm font-black hover:shadow-lg hover:scale-105 transition-all"
                >
                  SMS
                </button>
                <button
                  onClick={() => displayToast("Opening email...")}
                  className="py-3 bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border-2 border-purple-300 rounded-xl text-sm font-black hover:shadow-lg hover:scale-105 transition-all"
                >
                  EMAIL
                </button>
              </div>
            </div>

            {/* Players list from backend */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                  Players
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {players.map((player) => {
                  const name = player.full_name;
                  return (
                    <button
                      key={player.user_id}
                      onClick={() => {
                        setSelectedPlayers((prev) => {
                          const newMap = new Map(prev);
                          if (newMap.has(player.user_id)) {
                            newMap.delete(player.user_id);
                          } else {
                            newMap.set(player.user_id, player);
                          }
                          return newMap;
                        });
                      }}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all hover:scale-105 ${
                        selectedPlayers.has(player.user_id)
                          ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 shadow-md"
                          : "border-gray-200 hover:border-gray-300 bg-white"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow-md ${
                          selectedPlayers.has(player.user_id)
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
                      <span className="text-sm text-gray-700 font-bold">
                        {name}
                      </span>
                      {selectedPlayers.has(player.user_id) && (
                        <Check className="w-4 h-4 text-green-600 ml-auto" />
                      )}
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

            {/* Selected players display */}
            {selectedPlayers.size > 0 && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                    Selected ({selectedPlayers.size})
                  </h3>
                  <button
                    onClick={() => setSelectedPlayers(new Map())}
                    className="text-sm text-gray-500 hover:text-gray-700 font-bold"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[...selectedPlayers.values()].map((player) => (
                    <span
                      key={player.user_id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-full text-sm font-bold text-gray-700"
                    >
                      {player.full_name}
                      <button
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
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
            <div className="max-w-2xl mx-auto flex gap-3">
              <button
                onClick={() => {
                  displayToast("Match saved!");
                  setCurrentScreen("browse");
                  setShowPreview(false);
                  setCreateStep(1);
                  setSelectedPlayers(new Map());
                  setInviteMatchId(null);
                }}
                className="flex-1 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors"
              >
                SAVE FOR LATER
              </button>
              <button
                onClick={async () => {
                  if (selectedPlayers.size === 0) {
                    displayToast("Please select at least one player", "error");
                    return;
                  }
                  if (!inviteMatchId) {
                    displayToast("No match selected for invites", "error");
                    return;
                  }
                  try {
                    await sendInvites(
                      inviteMatchId,
                      Array.from(selectedPlayers.keys())
                    );
                    displayToast(
                      `Invites sent to ${selectedPlayers.size} ${
                        selectedPlayers.size === 1 ? "player" : "players"
                      }! 🎾`
                    );
                    setCurrentScreen("browse");
                    setSelectedPlayers(new Map());
                    setShowPreview(false);
                    setCreateStep(1);
                    setInviteMatchId(null);
                  } catch (err) {
                    displayToast(
                      err.response?.data?.message || "Failed to send invites",
                      "error"
                    );
                  }
                }}
                className="flex-1 px-6 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Send className="w-5 h-5" />
                SEND INVITES
                {selectedPlayers.size > 0 && ` (${selectedPlayers.size})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SignInModal = () => {
    if (!showSignInModal) return null;

    const handleOAuthSignIn = (provider) => {
      // Simulate OAuth response
      if (provider === "google") {
        setFormData((prev) => ({
          ...prev,
          name: "John Smith",
          email: "john.smith@gmail.com",
        }));
      } else if (provider === "apple") {
        setFormData((prev) => ({
          ...prev,
          name: "John Smith",
          email: "j.smith@icloud.com",
        }));
      }
      setSignInStep("oauth-complete");
    };

      const handleVerification = () => {
        if (verificationCode.length === 6) {
          const newUser = {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            skillLevel: formData.skillLevel,
            avatar: formData.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase(),
            rating: 4.2,
          };
          localStorage.setItem("user", JSON.stringify(newUser));
          setCurrentUser(newUser);
          setShowSignInModal(false);
          setSignInStep("initial");
          setFormData({ name: "", email: "", phone: "", skillLevel: "" });
          setVerificationCode("");
          displayToast(
          `Welcome to Matchplay, ${formData.name.split(" ")[0]}! 🎾`,
          "success"
        );
      } else {
        displayToast("Please enter a valid 6-digit code", "error");
      }
    };

    // OAuth completion step
    if (signInStep === "oauth-complete") {
      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-slideUp">
            <button
              onClick={() => {
                setSignInStep("initial");
                setFormData({ name: "", email: "", phone: "", skillLevel: "" });
              }}
              className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSignInModal(false);
                setSignInStep("initial");
                setFormData({ name: "", email: "", phone: "", skillLevel: "" });
              }}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6 mt-4">
              <h2 className="text-3xl font-black text-gray-900 mb-2">
                Almost Done!
              </h2>
              <p className="text-gray-500 font-semibold">
                Just need a few more details
              </p>
            </div>

            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="text-sm text-green-700">
                  <p className="font-black mb-1">
                    Account connected successfully
                  </p>
                  <p className="font-semibold">Signed in as {formData.email}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                  Mobile Number
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone: formatPhoneNumber(e.target.value),
                    }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                  maxLength="14"
                  autoFocus
                />
                <p className="text-xs font-semibold text-gray-500 mt-2">
                  Required for match coordination and reminders
                </p>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                  NTRP Skill Level
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <select
                  value={formData.skillLevel}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      skillLevel: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors appearance-none bg-white font-bold text-gray-800"
                >
                  <option value="">Select your level</option>
                  <option value="2.5">2.5 - Beginner</option>
                  <option value="3.0">3.0 - Advanced Beginner</option>
                  <option value="3.5">3.5 - Intermediate</option>
                  <option value="4.0">4.0 - Advanced Intermediate</option>
                  <option value="4.5+">4.5+ - Advanced</option>
                </select>
                <p className="text-xs font-semibold text-gray-500 mt-2">
                  Helps us find appropriate matches for you
                </p>
              </div>

              <button
                onClick={() => {
                  if (formData.phone && formData.skillLevel) {
                    setSignInStep("verify");
                  } else {
                    displayToast("Please fill in all required fields", "error");
                  }
                }}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all shadow-lg"
              >
                COMPLETE SIGN UP
              </button>
            </div>

            <p className="text-xs text-center text-gray-500 mt-6 font-semibold">
              By continuing, you agree to our Terms of Service and Privacy
              Policy
            </p>
          </div>
        </div>
      );
    }

    // Email/password login step
  if (signInStep === "login") {
  const handleLogin = () => {
    apiClient
      .post("/auth/login", { email: formData.email, password })
      .then((res) => {
        // Support both payload shapes:
        // 1) { access_token, refresh_token, profile, user_id, user_type }
        // 2) { token, user: { ... } }
        const {
          access_token,
          refresh_token,
          profile,
          user_id,
          user_type,
          token,
          user: userFromApi,
        } = res.data || {};

        let user;

        if (access_token) {
          // Newer shape with profile & tokens
          localStorage.setItem("authToken", access_token);
          if (refresh_token) localStorage.setItem("refreshToken", refresh_token);

          const name = profile?.full_name || formData.email;
          user = {
            id: user_id,
            type: user_type,
            name,
            email: formData.email,
            avatar: name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase(),
            skillLevel: profile?.usta_rating || "",
          };
        } else {
          // Legacy/alternative shape with single token + user object
          if (token) localStorage.setItem("authToken", token);

          const fallbackName = (userFromApi?.name || formData.email || "").trim();
          user =
            userFromApi ||
            {
              name: fallbackName,
              email: formData.email,
              avatar: fallbackName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase(),
            };
        }

        // Persist user for session restore
        localStorage.setItem("user", JSON.stringify(user));

        setCurrentUser(user);
        setShowSignInModal(false);
        setSignInStep("initial");
        setFormData({ name: "", email: "", phone: "", skillLevel: "" });
        setPassword("");

        const safeFirst = (user.name || "").split(" ")[0] || "Player";
        displayToast(`Welcome back, ${safeFirst}! 🎾`, "success");
      })
      .catch((err) =>
        displayToast(err.response?.data?.message || err.message, "error")
      );
  };


      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-slideUp">
            <button
              onClick={() => setSignInStep("initial")}
              className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSignInModal(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <h2 className="text-3xl font-black text-gray-900 mb-2">Sign In</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
              </div>
              <button
                onClick={handleLogin}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all shadow-lg"
              >
                SIGN IN
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (signInStep === "form") {
      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-slideUp">
            <button
              onClick={() => {
                setSignInStep("initial");
                setFormData({ name: "", email: "", phone: "", skillLevel: "" });
              }}
              className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSignInModal(false);
                setSignInStep("initial");
                setFormData({ name: "", email: "", phone: "", skillLevel: "" });
              }}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6 mt-4">
              <h2 className="text-3xl font-black text-gray-900 mb-2">
                Create Your Account
              </h2>
              <p className="text-gray-500 font-semibold">
                Join the tennis community
              </p>
            </div>

            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-3 mb-5">
              <p className="text-xs text-blue-700 text-center font-bold">
                📱 Phone verification required • We use SMS to coordinate
                matches and prevent no-shows
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                  Full Name
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="John Smith"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                  Email Address
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                  Mobile Number
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      phone: formatPhoneNumber(e.target.value),
                    }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors font-bold text-gray-800"
                  maxLength="14"
                />
                <p className="text-xs font-semibold text-gray-500 mt-2">
                  We'll text you match reminders and updates
                </p>
              </div>

              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                  NTRP Skill Level
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <select
                  value={formData.skillLevel}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      skillLevel: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors appearance-none bg-white font-bold text-gray-800"
                >
                  <option value="">Select your level</option>
                  <option value="2.5">2.5 - Beginner</option>
                  <option value="3.0">3.0 - Advanced Beginner</option>
                  <option value="3.5">3.5 - Intermediate</option>
                  <option value="4.0">4.0 - Advanced Intermediate</option>
                  <option value="4.5+">4.5+ - Advanced</option>
                </select>
                <p className="text-xs font-semibold text-gray-500 mt-2">
                  Helps us find appropriate matches for you
                </p>
              </div>

              <button
                onClick={() => {
                  if (
                    formData.name &&
                    formData.email &&
                    formData.phone &&
                    formData.skillLevel
                  ) {
                    setSignInStep("verify");
                  } else {
                    displayToast("Please fill in all required fields", "error");
                  }
                }}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all shadow-lg"
              >
                CONTINUE
              </button>
            </div>

            <p className="text-xs text-center text-gray-500 mt-6 font-semibold">
              By continuing, you agree to our Terms of Service and Privacy
              Policy
            </p>
          </div>
        </div>
      );
    }

    if (signInStep === "verify") {
      return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-slideUp">
            <button
              onClick={() => {
                setSignInStep(
                  formData.name && formData.email ? "oauth-complete" : "form"
                );
                setVerificationCode("");
              }}
              className="absolute top-4 left-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSignInModal(false);
                setSignInStep("initial");
                setFormData({ name: "", email: "", phone: "", skillLevel: "" });
                setVerificationCode("");
              }}
              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6 mt-4">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">
                Verify Your Number
              </h2>
              <p className="text-gray-500 font-semibold mb-2">
                We sent a code to {formData.phone}
              </p>
              <p className="text-xs text-gray-400 font-semibold">
                This helps prevent no-shows and keeps matches reliable
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                  Verification Code
                </label>
                <input
                  type="text"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(
                      e.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl text-center text-2xl font-black tracking-widest focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                  maxLength="6"
                  autoFocus
                />
              </div>

              <button
                onClick={handleVerification}
                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl hover:scale-105 transition-all shadow-lg"
              >
                VERIFY & CONTINUE
              </button>

              <button
                onClick={() => displayToast("Verification code resent!")}
                className="w-full text-gray-500 text-sm hover:text-gray-700 transition-colors font-bold"
              >
                Didn't receive the code? Resend
              </button>
            </div>

            <p className="text-xs text-center text-gray-500 mt-6 font-semibold">
              For demo purposes, enter any 6-digit code
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-slideUp">
          <button
            onClick={() => {
              setShowSignInModal(false);
              setSignInStep("initial");
              setFormData({ name: "", email: "", phone: "", skillLevel: "" });
              setVerificationCode("");
            }}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <span className="text-white text-3xl">🎾</span>
            </div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">
              Welcome to Matchplay
            </h2>
            <p className="text-gray-500 font-semibold">
              Sign in to create and join matches
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                setSignInStep("form");
              }}
              className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Mail className="w-5 h-5" />
              SIGN UP WITH EMAIL
            </button>

            <button
              onClick={() => handleOAuthSignIn("google")}
              className="w-full py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              CONTINUE WITH GOOGLE
            </button>

            <button
              onClick={() => handleOAuthSignIn("apple")}
              className="w-full py-3.5 bg-black text-white rounded-xl font-black hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              CONTINUE WITH APPLE
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-500 font-bold">
                Already have an account?
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setSignInStep("login");
            }}
            className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-black hover:bg-gray-200 transition-colors"
          >
            SIGN IN WITH EXISTING ACCOUNT
          </button>

          <button
            onClick={() => {
              setShowSignInModal(false);
              setSignInStep("initial");
              setFormData({ name: "", email: "", phone: "", skillLevel: "" });
              setVerificationCode("");
            }}
            className="w-full text-gray-500 text-sm hover:text-gray-700 transition-colors mt-3 font-bold"
          >
            Continue as guest
          </button>
        </div>
      </div>
    );
  }; // FIX: Removed comma here

  const EditModal = () => {
    if (!showEditModal || !editMatch) return null;

    const handleSave = async () => {
      try {
        await updateMatch(editMatch.id, {
          start_date_time: new Date(editMatch.dateTime).toISOString(),
          location_text: editMatch.location,
          latitude: editMatch.latitude,
          longitude: editMatch.longitude,
          notes: editMatch.notes,
        });
        displayToast("Match updated successfully!");
        setShowEditModal(false);
        setEditMatch(null);
        fetchMatches();
      } catch (err) {
        displayToast(
          err.response?.data?.message || "Failed to update match",
          "error"
        );
      }
    };

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl max-w-lg w-full p-6 relative animate-slideUp">
          <button
            onClick={() => {
              setShowEditModal(false);
              setEditMatch(null);
            }}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Edit Match</h2>
          <p className="text-sm text-gray-500 mb-6 font-semibold">
            Changes will notify all confirmed players
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                Date & Time
              </label>
              <input
                type="datetime-local"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-bold text-gray-800"
                value={editMatch.dateTime}
                onChange={(e) =>
                  setEditMatch({ ...editMatch, dateTime: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-4 w-5 h-5 text-gray-400" />
                <Autocomplete
                  apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
                  type="search"
                  value={editMatch.location}
                  onChange={(e) =>
                    setEditMatch({
                      ...editMatch,
                      location: e.target.value,
                      latitude: null,
                      longitude: null,
                    })
                  }
                  onPlaceSelected={(place) => {
                    const address = place.formatted_address || place.name || "";
                    const lat = place.geometry?.location?.lat();
                    const lng = place.geometry?.location?.lng();
                    setEditMatch({
                      ...editMatch,
                      location: address,
                      latitude: lat,
                      longitude: lng,
                    });
                  }}
                  options={{
                    types: ["geocode", "establishment"],
                    fields: [
                      "formatted_address",
                      "geometry",
                      "name",
                      "address_components",
                    ],
                  }}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-bold text-gray-800"
                />
              </div>
              <input
                type="text"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-bold text-gray-800"
                value={editMatch.location}
                onChange={(e) =>
                  setEditMatch({ ...editMatch, location: e.target.value })
                }
              />

            </div>

            <div>
              <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-wider">
                Notes
              </label>
              <textarea
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 font-bold text-gray-800"
                rows={3}
                value={editMatch.notes}
                onChange={(e) =>
                  setEditMatch({ ...editMatch, notes: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => {
                setShowEditModal(false);
                setEditMatch(null);
              }}
              className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-black hover:bg-gray-50"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-black hover:shadow-xl shadow-lg"
            >
              SAVE CHANGES
            </button>
          </div>
        </div>
      </div>
    );
  }; // FIX: Removed comma here

  const Toast = () => {
    if (!showToast) return null;

    return (
      <div
        className={`fixed top-20 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl shadow-xl z-50 animate-slideDown flex items-center gap-2 ${
          showToast.type === "error"
            ? "bg-red-500 text-white"
            : "bg-gray-900 text-white"
        }`}
      >
        {showToast.type === "error" ? (
          <AlertCircle className="w-5 h-5" />
        ) : (
          <Check className="w-5 h-5" />
        )}
        <span className="font-black">{showToast.message}</span>
      </div>
    );
  }; // FIX: Removed comma here

  // Add the CSS animations
  const styles = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translate(-50%, -20px);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }
    
    .animate-slideUp {
      animation: slideUp 0.3s ease-out;
    }
    
    .animate-slideDown {
      animation: slideDown 0.3s ease-out;
    }
    
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    
    .bg-size-200 {
      background-size: 200% 100%;
    }
    
    .bg-pos-0 {
      background-position: 0% 50%;
    }
    
    .bg-pos-100 {
      background-position: 100% 50%;
    }
  `;

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{styles}</style>

      {Header()}

      {currentScreen === "browse" && BrowseScreen()}
      {currentScreen === "create" && CreateMatchScreen()}
      {currentScreen === "invite" && <InviteScreen />}
      {currentScreen === "invites" && <InvitesList />}

      {SignInModal()}
      {EditModal()}
      {Toast()}
      <ProfileManager
        isOpen={showProfileManager}
        onClose={() => setShowProfileManager(false)}
      />
    </div>
  );
};

export default TennisMatchApp;
