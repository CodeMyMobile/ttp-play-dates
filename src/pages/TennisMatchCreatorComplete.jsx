import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Globe,
  Lock,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Users,
  Trophy,
  Zap,
  Check,
  Share2,
  Copy,
  Download,
  Plus,
  Search,
  X,
  MessageSquare,
  Mail,
  Home,
  Clock,
  Sun,
  Edit,
} from "lucide-react";

const INITIAL_MATCH_DATA = {
  type: "open",
  date: "2025-09-16",
  startTime: "22:00",
  duration: "2",
  location: "Oceanside Tennis Center",
  totalPlayers: 4,
  skillLevel: "4.0",
  format: "Doubles",
  notes: "",
  invitedPlayers: [],
};

const QUICK_DATES = [
  { value: "today", label: "Today", date: "2025-09-13" },
  { value: "tomorrow", label: "Tomorrow", date: "2025-09-14" },
  { value: "sunday", label: "Sunday", date: "2025-09-15" },
  { value: "monday", label: "Monday", date: "2025-09-16" },
];

const TIME_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
];

const DURATIONS = [
  { value: "1", label: "1h" },
  { value: "1.5", label: "1.5h" },
  { value: "2", label: "2h" },
  { value: "2.5", label: "2.5h" },
  { value: "3", label: "3h" },
];

const SKILL_LEVELS = [
  { value: "2.5", label: "2.5", desc: "Beginner" },
  { value: "3.0", label: "3.0", desc: "Developing" },
  { value: "3.5", label: "3.5", desc: "Intermediate" },
  { value: "4.0", label: "4.0", desc: "Advanced" },
  { value: "4.5", label: "4.5+", desc: "Expert" },
];

const AVAILABLE_PLAYERS = [
  {
    id: 1,
    name: "Sarah Wilson",
    email: "sarah@example.com",
    avatar: "S",
    ntrp: "4.0",
    lastPlayed: "2 days ago",
  },
  {
    id: 2,
    name: "Mike Johnson",
    email: "mike@example.com",
    avatar: "M",
    ntrp: "3.5",
    lastPlayed: "1 week ago",
  },
  {
    id: 3,
    name: "Alex Chen",
    email: "alex@example.com",
    avatar: "A",
    ntrp: "4.5",
    lastPlayed: "3 days ago",
  },
  {
    id: 4,
    name: "Emma Davis",
    email: "emma@example.com",
    avatar: "E",
    ntrp: "3.0",
    lastPlayed: "5 days ago",
  },
  {
    id: 5,
    name: "John Smith",
    email: "john@example.com",
    avatar: "J",
    ntrp: "4.0",
    lastPlayed: "Yesterday",
  },
  {
    id: 6,
    name: "Lisa Brown",
    email: "lisa@example.com",
    avatar: "L",
    ntrp: "3.5",
    lastPlayed: "4 days ago",
  },
  {
    id: 7,
    name: "Tom Wilson",
    email: "tom@example.com",
    avatar: "T",
    ntrp: "4.0",
    lastPlayed: "1 day ago",
  },
];

const formatTime = (time24) => {
  const [hours, minutes] = time24.split(":");
  const hourNumber = Number.parseInt(hours, 10);
  const hour12 = hourNumber % 12 || 12;
  const ampm = hourNumber >= 12 ? "PM" : "AM";
  return `${hour12}:${minutes} ${ampm}`;
};

const formatDate = (dateStr) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const escapeCalendarText = (value = "") =>
  value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

const TennisMatchCreatorComplete = ({ onExit }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchData, setMatchData] = useState(() => ({
    ...INITIAL_MATCH_DATA,
    invitedPlayers: [],
  }));

  const getInvitedPlayers = () => matchData.invitedPlayers || [];
  const getInvitedCount = () => getInvitedPlayers().length;
  const getTotalPlayers = () => matchData.totalPlayers || 4;

  const canInviteMore = () => {
    if (matchData.type === "private") {
      return getInvitedCount() < 12;
    }
    const spotsRemaining = Math.max(0, getTotalPlayers() - getInvitedCount() - 1);
    return spotsRemaining > 0;
  };

  const nextStep = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const goBackToHome = () => {
    setCurrentStep(1);
    setMatchData({
      ...INITIAL_MATCH_DATA,
      invitedPlayers: [],
    });
    setSearchQuery("");
    if (onExit) {
      onExit();
    } else {
      navigate("/");
    }
  };

  const viewMatchDetails = () => {
    setCurrentStep(5);
  };

  const getFilteredPlayers = () => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return AVAILABLE_PLAYERS.filter((player) => {
      const nameMatch = player.name.toLowerCase().includes(query);
      const emailMatch = player.email.toLowerCase().includes(query);
      const notInvited = !getInvitedPlayers().find((invited) => invited.id === player.id);
      return (nameMatch || emailMatch) && notInvited;
    });
  };

  const addPlayer = (player) => {
    if (!canInviteMore()) return;
    setMatchData((prev) => ({
      ...prev,
      invitedPlayers: [...getInvitedPlayers(), player],
    }));
    setSearchQuery("");
  };

  const removePlayer = (playerId) => {
    setMatchData((prev) => ({
      ...prev,
      invitedPlayers: getInvitedPlayers().filter((player) => player.id !== playerId),
    }));
  };

  const generatePrivateLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/match/private/abc123def456`;
  };

  const shareViaMethod = (method) => {
    const link = generatePrivateLink();
    const message = `You're invited to join my ${matchData.format} match on ${formatDate(matchData.date)} at ${formatTime(matchData.startTime)} at ${matchData.location}. Join here:`;

    if (method === "sms") {
      if (typeof window === "undefined") return;
      window.open(`sms:?body=${encodeURIComponent(`${message} ${link}`)}`);
    } else if (method === "email") {
      if (typeof window === "undefined") return;
      window.location.href = `mailto:?subject=Tennis Match Invitation&body=${encodeURIComponent(`${message}\n\n${link}`)}`;
    } else if (method === "copy") {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(link).catch(() => {});
      }
    }
  };

  const addToCalendar = (type) => {
    const startDateTime = `${matchData.date}T${matchData.startTime}:00`;
    const start = new Date(startDateTime);
    if (Number.isNaN(start.getTime())) return;

    const durationHours = Number.parseFloat(matchData.duration || "0");
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

    const title = `Tennis Match - ${matchData.format}`;
    let details = `${matchData.format} match at ${matchData.location}.`;

    if (matchData.type === "open" && matchData.skillLevel) {
      details += ` Skill level: NTRP ${matchData.skillLevel}.`;
    }

    if (matchData.notes) {
      details += ` ${matchData.notes}`;
    }

    if (type === "google") {
      if (typeof window === "undefined") return;
      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start
        .toISOString()
        .replace(/[-:]/g, "")
        .split(".")[0]}Z/${end
        .toISOString()
        .replace(/[-:]/g, "")
        .split(".")[0]}Z&details=${encodeURIComponent(details)}&location=${encodeURIComponent(matchData.location)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (typeof window === "undefined") return;

    const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0];
    const dtStart = start.toISOString().replace(/[-:]/g, "").split(".")[0];
    const dtEnd = end.toISOString().replace(/[-:]/g, "").split(".")[0];

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TTP Play Dates//Match Creator//EN",
      "BEGIN:VEVENT",
      `UID:${timestamp}@ttp-play-dates`,
      `DTSTAMP:${timestamp}Z`,
      `DTSTART:${dtStart}Z`,
      `DTEND:${dtEnd}Z`,
      `SUMMARY:${escapeCalendarText(title)}`,
      `DESCRIPTION:${escapeCalendarText(details)}`,
      `LOCATION:${escapeCalendarText(matchData.location)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    const blob = new Blob([icsContent], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tennis-match.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const shareMatch = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: "Tennis Match",
          text: `Join my ${matchData.format} match on ${formatDate(matchData.date)} at ${formatTime(matchData.startTime)}`,
          url: generatePrivateLink(),
        })
        .catch(() => {});
    } else {
      copyLink();
    }
  };

  const copyLink = () => {
    const link = generatePrivateLink();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
  };

  const ProgressBar = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3].map((step) => (
        <Fragment key={step}>
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
              step < currentStep
                ? "bg-green-500 text-white"
                : step === currentStep
                ? "bg-green-500 text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {step < currentStep ? <Check size={20} /> : step}
          </div>
          {step < 3 && (
            <div
              className={`w-16 h-1 mx-2 ${step < currentStep ? "bg-green-500" : "bg-gray-200"}`}
            />
          )}
        </Fragment>
      ))}
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto bg-white min-h-screen">
      {currentStep === 1 && (
        <div className="p-6 space-y-8">
          <ProgressBar />
          <h1 className="text-2xl font-bold text-gray-900">Create a Match</h1>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
              Match Type
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setMatchData((prev) => ({
                    ...prev,
                    type: "open",
                    invitedPlayers: [],
                  }))
                }
                className={`p-6 rounded-2xl border-2 transition-all ${
                  matchData.type === "open"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      matchData.type === "open" ? "bg-green-500" : "bg-gray-400"
                    }`}
                  >
                    <Globe size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Open Match</div>
                    <div className="text-sm text-gray-500">Anyone can join</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setMatchData((prev) => ({
                    ...prev,
                    type: "private",
                    invitedPlayers: [],
                  }))
                }
                className={`p-6 rounded-2xl border-2 transition-all ${
                  matchData.type === "private"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      matchData.type === "private" ? "bg-green-500" : "bg-gray-400"
                    }`}
                  >
                    <Lock size={20} className="text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Private Match</div>
                    <div className="text-sm text-gray-500">Invite only</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
              Date &amp; Time
            </h3>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-2">QUICK PICKS</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {QUICK_DATES.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() =>
                      setMatchData((prev) => ({
                        ...prev,
                        date: day.date,
                      }))
                    }
                    className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors text-sm flex-shrink-0 ${
                      matchData.date === day.date
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">DATE</label>
                <input
                  type="date"
                  value={matchData.date}
                  onChange={(event) =>
                    setMatchData((prev) => ({
                      ...prev,
                      date: event.target.value,
                    }))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">TIME</label>
                <select
                  value={matchData.startTime}
                  onChange={(event) =>
                    setMatchData((prev) => ({
                      ...prev,
                      startTime: event.target.value,
                    }))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                >
                  {TIME_SLOTS.map((time) => (
                    <option key={time} value={time}>
                      {formatTime(time)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">DURATION</label>
                <select
                  value={matchData.duration}
                  onChange={(event) =>
                    setMatchData((prev) => ({
                      ...prev,
                      duration: event.target.value,
                    }))
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                >
                  {DURATIONS.map((duration) => (
                    <option key={duration.value} value={duration.value}>
                      {duration.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Calendar size={20} className="text-gray-500" />
                <div>
                  <div className="font-medium text-gray-900">{formatDate(matchData.date)}</div>
                  <div className="text-sm text-gray-500">
                    {formatTime(matchData.startTime)} for {matchData.duration} hours
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Location</h3>
            <div className="relative">
              <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={matchData.location}
                onChange={(event) =>
                  setMatchData((prev) => ({
                    ...prev,
                    location: event.target.value,
                  }))
                }
                placeholder="e.g., Oceanside Tennis Center"
                className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">Players will see the exact address after joining</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-6">Number of Players</h3>
            <div className="flex items-center justify-center gap-8">
              <button
                type="button"
                onClick={() =>
                  setMatchData((prev) => ({
                    ...prev,
                    totalPlayers: Math.max(2, prev.totalPlayers - 1),
                  }))
                }
                disabled={matchData.totalPlayers <= 2}
                className="w-14 h-14 rounded-full border-2 border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-xl font-semibold text-gray-600 transition-colors"
              >
                −
              </button>
              <div className="text-center">
                <div className="text-6xl font-bold text-green-500 mb-2">{matchData.totalPlayers}</div>
                <div className="text-sm font-medium text-gray-700">Total Players</div>
                <div className="text-sm text-gray-500">You + {matchData.totalPlayers - 1} others</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setMatchData((prev) => ({
                    ...prev,
                    totalPlayers: Math.min(8, prev.totalPlayers + 1),
                  }))
                }
                disabled={matchData.totalPlayers >= 8}
                className="w-14 h-14 rounded-full border-2 border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-xl font-semibold text-gray-600 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={goBackToHome}
              className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="flex-1 px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              Next <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {currentStep === 2 && matchData.type === "open" && (
        <div className="p-6 space-y-8">
          <ProgressBar />
          <h1 className="text-2xl font-bold text-gray-900">Match Settings</h1>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                NTRP Skill Level
              </h3>
              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-medium">REQUIRED</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {SKILL_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() =>
                    setMatchData((prev) => ({
                      ...prev,
                      skillLevel: level.value,
                    }))
                  }
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    matchData.skillLevel === level.value
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-xl font-bold text-gray-900 mb-1">{level.label}</div>
                  <div className="text-xs text-gray-600">{level.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500">Helps players find appropriate skill matches</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Match Format</h3>
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Trophy size={20} className="text-gray-500" />
                <select
                  value={matchData.format}
                  onChange={(event) =>
                    setMatchData((prev) => ({
                      ...prev,
                      format: event.target.value,
                    }))
                  }
                  className="flex-1 bg-transparent text-lg font-medium text-gray-900 focus:outline-none"
                >
                  <option value="Singles">Singles</option>
                  <option value="Doubles">Doubles</option>
                  <option value="Mixed Doubles">Mixed Doubles</option>
                  <option value="Round Robin">Round Robin</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Additional Notes</h3>
            <textarea
              value={matchData.notes}
              onChange={(event) =>
                setMatchData((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              placeholder="Any special instructions, what to bring, parking info..."
              rows={4}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={prevStep}
              className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="flex-1 px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              Next <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}
      {currentStep === 2 && matchData.type === "private" && (
        <div className="p-6 space-y-6">
          <ProgressBar />
          <h1 className="text-2xl font-bold text-gray-900">Invite Players</h1>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Invited Players</h3>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-900">{getInvitedCount() + 1} invited</div>
                <div className="text-xs text-gray-500">{getTotalPlayers() - 1} needed for match</div>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">Y</div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">You (Host)</div>
                  <div className="text-sm text-green-600">Organizer</div>
                </div>
              </div>

              {getInvitedPlayers().map((player) => (
                <div key={player.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    {player.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{player.name}</div>
                    <div className="text-sm text-gray-600">NTRP {player.ntrp} • {player.lastPlayed}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePlayer(player.id)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded-full"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}

              {getInvitedCount() >= getTotalPlayers() - 1 && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <div className="text-center">
                    <div className="text-sm font-bold text-green-700 mb-1">
                      ✅ You have enough players for your {matchData.format} match!
                    </div>
                    <div className="text-xs text-green-600">
                      💡 Tip: Invite 2-3 more people as backups in case someone can't make it
                    </div>
                  </div>
                </div>
              )}

              {getInvitedCount() < getTotalPlayers() - 1 && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <div className="text-center">
                    <div className="text-sm font-bold text-orange-700 mb-1">
                      Need {getTotalPlayers() - getInvitedCount() - 1} more players for your match
                    </div>
                    <div className="text-xs text-orange-600">Invite extra people to ensure a full match!</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {canInviteMore() && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Add More Players</h3>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-medium">
                  {12 - getInvitedCount()} spots left
                </span>
              </div>
              <p className="text-xs text-blue-600 mb-4">
                🎯 Smart strategy: Invite more than {getTotalPlayers() - 1} players to guarantee a full match!
              </p>

              <div className="relative mb-4">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {searchQuery && (
                <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                  {getFilteredPlayers().length > 0 ? (
                    getFilteredPlayers().map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => addPlayer(player)}
                        className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {player.avatar}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-gray-900">{player.name}</div>
                          <div className="text-sm text-gray-600">NTRP {player.ntrp} • Played {player.lastPlayed}</div>
                        </div>
                        <Plus size={20} className="text-green-500" />
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-500">No players found matching "{searchQuery}"</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">Share Invitation Link</h3>
            <p className="text-xs text-gray-500 mb-4">
              📤 Share this link - first {getTotalPlayers() - 1} to confirm get spots, others join waitlist
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <Lock size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Private Match Link</span>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="text-sm text-gray-600 break-all">{generatePrivateLink()}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => shareViaMethod("copy")}
                className="flex flex-col items-center gap-2 p-4 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Copy size={20} className="text-gray-600" />
                <span className="text-sm font-medium">Copy Link</span>
              </button>

              <button
                type="button"
                onClick={() => shareViaMethod("sms")}
                className="flex flex-col items-center gap-2 p-4 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <MessageSquare size={20} className="text-gray-600" />
                <span className="text-sm font-medium">Text/SMS</span>
              </button>

              <button
                type="button"
                onClick={() => shareViaMethod("email")}
                className="flex flex-col items-center gap-2 p-4 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Mail size={20} className="text-gray-600" />
                <span className="text-sm font-medium">Email</span>
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Match Format</h3>
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Trophy size={20} className="text-gray-500" />
                <select
                  value={matchData.format}
                  onChange={(event) =>
                    setMatchData((prev) => ({
                      ...prev,
                      format: event.target.value,
                    }))
                  }
                  className="flex-1 bg-transparent text-lg font-medium text-gray-900 focus:outline-none"
                >
                  <option value="Singles">Singles</option>
                  <option value="Doubles">Doubles</option>
                  <option value="Mixed Doubles">Mixed Doubles</option>
                  <option value="Round Robin">Round Robin</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">Additional Notes</h3>
            <textarea
              value={matchData.notes}
              onChange={(event) =>
                setMatchData((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              placeholder="Any special instructions, what to bring, parking info..."
              rows={3}
              className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={prevStep}
              className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              Next <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}
      {currentStep === 3 && (
        <div className="p-6 space-y-8">
          <ProgressBar />
          <h1 className="text-2xl font-bold text-gray-900">Review &amp; Publish</h1>

          <div className="bg-gray-50 rounded-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">MATCH SUMMARY</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-gray-500" />
                <span className="text-gray-700">{formatDate(matchData.date)}, {formatTime(matchData.startTime)}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin size={16} className="text-gray-500" />
                <span className="text-gray-700">{matchData.location}</span>
              </div>
              <div className="flex items-center gap-3">
                <Users size={16} className="text-gray-500" />
                <span className="text-gray-700">
                  {matchData.type === "private"
                    ? `${getInvitedCount() + 1} players invited • ${getTotalPlayers()} needed for match`
                    : `${getTotalPlayers()} players total`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Trophy size={16} className="text-gray-500" />
                <span className="text-gray-700">
                  {matchData.format}
                  {matchData.type === "open" && matchData.skillLevel && ` • NTRP ${matchData.skillLevel} - Advanced`}
                </span>
              </div>
              {matchData.type === "private" && (
                <div className="flex items-center gap-3">
                  <Lock size={16} className="text-gray-500" />
                  <span className="text-gray-700">Private Match - Invite Only</span>
                </div>
              )}
            </div>
          </div>

          {matchData.type === "private" && (
            <div className="bg-blue-50 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">INVITED PLAYERS</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    Y
                  </div>
                  <span className="text-gray-700 font-medium">You (Host)</span>
                </div>
                {getInvitedPlayers().map((player) => (
                  <div key={player.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {player.avatar}
                    </div>
                    <span className="text-gray-700">{player.name}</span>
                  </div>
                ))}
                {getInvitedCount() > getTotalPlayers() - 1 && (
                  <div className="bg-green-100 rounded-lg p-3 mt-3">
                    <div className="text-sm font-medium text-green-700">
                      🎯 Smart planning: You've invited {getInvitedCount()} players for {getTotalPlayers() - 1} spots!
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      First {getTotalPlayers() - 1} to confirm get spots, others join waitlist
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            className={`rounded-xl p-6 text-center ${matchData.type === "private" ? "bg-blue-50" : "bg-green-50"}`}
          >
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                matchData.type === "private" ? "bg-blue-500" : "bg-green-500"
              }`}
            >
              {matchData.type === "private" ? <Lock size={32} className="text-white" /> : <Zap size={32} className="text-white" />}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {matchData.type === "private" ? "Ready to Create!" : "Ready to Publish!"}
            </h3>
            <p className="text-gray-600">
              {matchData.type === "private"
                ? "Your private match will be created and invitations sent"
                : "Your match will be visible to all players in the area"}
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={prevStep}
              className="flex-1 px-6 py-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              type="button"
              onClick={nextStep}
              className={`flex-1 px-6 py-4 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                matchData.type === "private"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {matchData.type === "private" ? "Create Match" : "Publish"} <Check size={20} />
            </button>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="p-6 space-y-8">
          <div className="text-center mb-8">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse ${
                matchData.type === "private" ? "bg-blue-500" : "bg-green-500"
              }`}
            >
              <Check size={40} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {matchData.type === "private" ? "Private Match Created!" : "Match Published!"}
            </h1>
            <p className="text-gray-600">
              {matchData.type === "private"
                ? "Invitations have been sent to your selected players"
                : "Your match is now live and visible to all players"}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{matchData.format} Match</h3>
                <p className="text-gray-600">
                  {formatDate(matchData.date)} • {formatTime(matchData.startTime)}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  matchData.type === "private" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                }`}
              >
                {matchData.type === "private" ? "PRIVATE" : "LIVE"}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={14} />
                <span>{matchData.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={14} />
                <span>
                  {matchData.type === "private"
                    ? `${getInvitedCount() + 1} players invited • ${getTotalPlayers()} needed`
                    : `1/${getTotalPlayers()} players • ${getTotalPlayers() - 1} spots open`}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
                {matchData.type === "private" ? "Share Private Link" : "Share Match"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={shareMatch}
                  className="flex items-center justify-center gap-2 p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  <Share2 size={16} />
                  <span className="text-sm font-medium">Share Link</span>
                </button>
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex items-center justify-center gap-2 p-3 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <Copy size={16} />
                  <span className="text-sm font-medium">Copy Link</span>
                </button>
              </div>

              {matchData.type === "private" && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => shareViaMethod("sms")}
                    className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <MessageSquare size={16} />
                    <span className="text-sm font-medium">Send SMS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => shareViaMethod("email")}
                    className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <Mail size={16} />
                    <span className="text-sm font-medium">Send Email</span>
                  </button>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Add to Calendar</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => addToCalendar("google")}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Calendar size={16} />
                  <span className="text-sm font-medium">Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => addToCalendar("apple")}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Plus size={16} />
                  <span className="text-sm font-medium">Apple</span>
                </button>
                <button
                  type="button"
                  onClick={() => addToCalendar("outlook")}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Calendar size={16} />
                  <span className="text-sm font-medium">Outlook</span>
                </button>
                <button
                  type="button"
                  onClick={() => addToCalendar("download")}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Download size={16} />
                  <span className="text-sm font-medium">Download</span>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={viewMatchDetails}
              className={`w-full px-6 py-4 text-white rounded-xl font-semibold transition-colors ${
                matchData.type === "private" ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              View Match Details
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={goBackToHome}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                <Home size={16} />
                Back to Home
              </button>
              <button
                type="button"
                onClick={goBackToHome}
                className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 5 && (
        <div className="bg-white min-h-screen">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Match Details</h1>
              <button type="button" onClick={shareMatch} className="p-2 hover:bg-gray-100 rounded-lg">
                <Share2 size={20} className="text-gray-600" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{matchData.format} Match</h2>
                  <p className="text-gray-600">{formatDate(matchData.date)}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    matchData.type === "private" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                  }`}
                >
                  {matchData.type === "private" ? "PRIVATE" : "OPEN"}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Clock size={16} className="text-gray-500" />
                  <span className="text-gray-700">
                    {formatTime(matchData.startTime)} • {matchData.duration} hours
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={16} className="text-gray-500" />
                  <span className="text-gray-700">{matchData.location}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Users size={16} className="text-gray-500" />
                  <span className="text-gray-700">
                    {matchData.type === "private"
                      ? `${getInvitedCount() + 1} players invited • ${getTotalPlayers()} needed`
                      : `${getTotalPlayers()} players total`}
                  </span>
                </div>
                {matchData.type === "open" && matchData.skillLevel && (
                  <div className="flex items-center gap-3">
                    <Trophy size={16} className="text-gray-500" />
                    <span className="text-gray-700">NTRP {matchData.skillLevel} - Advanced</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun size={20} className="text-yellow-500" />
                    <span className="font-medium text-gray-700">72°F</span>
                    <span className="text-sm text-gray-600">Sunny</span>
                  </div>
                  <span className="text-xs text-gray-500">Perfect weather for tennis!</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Hosted by</p>
                <p className="font-medium text-gray-700">You</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Players ({getInvitedCount() + 1}/{getTotalPlayers()})
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="font-bold text-white text-sm">Y</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">You</p>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Host</span>
                    </div>
                  </div>
                  <Check size={16} className="text-green-500" />
                </div>

                {getInvitedPlayers().map((player) => (
                  <div key={player.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="font-medium text-white text-sm">{player.avatar}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{player.name}</p>
                        <p className="text-sm text-gray-600">NTRP {player.ntrp}</p>
                      </div>
                    </div>
                    <span className="text-sm text-yellow-600 font-medium">Pending</span>
                  </div>
                ))}

                {Array.from({ length: Math.max(0, getTotalPlayers() - getInvitedCount() - 1) }).map((_, index) => (
                  <div key={`empty-${index}`} className="flex items-center space-x-3">
                    <div className="w-10 h-10 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center">
                      <Plus size={16} className="text-gray-400" />
                    </div>
                    <p className="text-gray-500">Waiting for player...</p>
                  </div>
                ))}
              </div>
            </div>

            {matchData.notes && (
              <div className="bg-blue-50 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes from Host</h3>
                <p className="text-gray-600">{matchData.notes}</p>
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Host Controls</h3>

              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                  <Edit size={16} className="text-gray-600" />
                  <span className="text-sm font-medium">Edit Match</span>
                </button>

                <button className="flex items-center justify-center gap-2 p-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-colors">
                  <X size={16} />
                  <span className="text-sm font-medium">Cancel Match</span>
                </button>
              </div>

              <button
                type="button"
                onClick={shareMatch}
                className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                <Share2 size={16} />
                <span className="text-sm font-medium">Share Match</span>
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Quick Actions</h3>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => addToCalendar("google")}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Calendar size={16} className="text-gray-600" />
                  <span className="text-sm font-medium">Add to Calendar</span>
                </button>

                <button
                  type="button"
                  onClick={copyLink}
                  className="flex items-center justify-center gap-2 p-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Copy size={16} className="text-gray-600" />
                  <span className="text-sm font-medium">Copy Link</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                type="button"
                onClick={goBackToHome}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                <Home size={16} />
                Back to Home
              </button>
              <button
                type="button"
                onClick={goBackToHome}
                className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TennisMatchCreatorComplete;
