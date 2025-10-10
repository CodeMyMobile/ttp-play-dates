import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Calendar,
  ChevronLeft,
  Clock,
  Loader2,
  MapPin,
  Search,
  Zap,
} from "lucide-react";
import { listLiveballs } from "../services/group-lessons";

const normalizeCollection = (payload, fallbackKey) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (fallbackKey && Array.isArray(payload[fallbackKey])) return payload[fallbackKey];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
};

const formatDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const LiveballSearchPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [dayFilter, setDayFilter] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["liveballs", { search: searchTerm, day: dayFilter }],
    queryFn: () => listLiveballs({ search: searchTerm, day: dayFilter }),
  });

  const sessions = useMemo(
    () => normalizeCollection(data, "liveballs"),
    [data],
  );

  const filters = [
    { label: "Any day", value: "" },
    { label: "Today", value: "today" },
    { label: "Tomorrow", value: "tomorrow" },
    { label: "This week", value: "week" },
    { label: "Weekend", value: "weekend" },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="bg-gradient-to-br from-emerald-500 via-green-500 to-lime-500 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 bg-white/15 text-white px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide">
              <Zap className="w-3.5 h-3.5" />
              Liveball Sessions
            </span>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight">
              Find high-energy liveball runs and jump right in
            </h1>
            <p className="text-white/80 text-base sm:text-lg max-w-3xl">
              Dial in your cardio, reaction time, and point play with curated liveball
              sessions for every level.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 sm:p-6 grid gap-4 sm:grid-cols-[2fr,1fr]">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-white/70">Search liveball sessions</span>
              <div className="flex items-center gap-3 bg-white text-slate-900 rounded-xl px-3 py-2.5 shadow-lg">
                <Search className="w-5 h-5 text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Try intermediate, doubles, or 4.0"
                  className="flex-1 bg-transparent focus:outline-none text-base font-semibold"
                />
              </div>
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-white/70">Filter by day</span>
              <div className="flex gap-2 flex-wrap">
                {filters.map((filter) => (
                  <button
                    key={filter.value || "all"}
                    onClick={() => setDayFilter(filter.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                      dayFilter === filter.value
                        ? "bg-white text-emerald-600 shadow-lg"
                        : "bg-white/20 text-white/80 hover:bg-white/30"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-emerald-500 font-semibold">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading liveball sessions…
          </div>
        ) : isError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-5 font-semibold">
            {error?.response?.data?.message ||
              error?.message ||
              "We couldn't load liveball sessions right now."}
          </div>
        ) : sessions.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => {
              const id =
                session?.id ||
                session?.liveball_id ||
                session?.liveballId ||
                session?.slug ||
                session?.name;
              const coach =
                session?.coach?.name ||
                session?.coach_name ||
                session?.coachName ||
                session?.pro ||
                null;
              const location =
                session?.location?.name ||
                session?.location_name ||
                session?.location ||
                session?.facility ||
                session?.address ||
                null;
              const startsAt =
                session?.start_time ||
                session?.startTime ||
                session?.start_at ||
                session?.scheduled_for ||
                session?.scheduledFor ||
                null;
              const duration =
                session?.duration ||
                session?.duration_minutes ||
                session?.durationMinutes ||
                null;
              return (
                <article
                  key={id}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all border border-emerald-100 p-6 flex flex-col gap-4"
                >
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full">
                      <Activity className="w-3.5 h-3.5" />
                      Liveball
                    </div>
                    <h2 className="text-lg font-black text-slate-900 leading-tight">
                      {session?.title || session?.name || "Liveball session"}
                    </h2>
                  </div>
                  {coach && (
                    <p className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      {coach}
                    </p>
                  )}
                  <div className="space-y-2 text-sm font-semibold text-slate-600">
                    {location && (
                      <p className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-400" />
                        {location}
                      </p>
                    )}
                    {startsAt && (
                      <p className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        {formatDate(startsAt)}
                      </p>
                    )}
                    {duration && (
                      <p className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        {`${duration} min`}
                      </p>
                    )}
                  </div>
                  {session?.description && (
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {session.description.length > 160
                        ? `${session.description.slice(0, 157)}…`
                        : session.description}
                    </p>
                  )}
                  <div className="mt-auto">
                    <button className="w-full bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold py-2.5 rounded-xl hover:shadow-lg transition-all">
                      Reserve a spot
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="bg-emerald-50 border border-dashed border-emerald-200 text-emerald-600 rounded-2xl px-6 py-16 text-center font-semibold">
            We didn't find any liveball runs that match your filters.
          </div>
        )}
      </main>
    </div>
  );
};

export default LiveballSearchPage;
