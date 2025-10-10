import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  Loader2,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { listGroupLessons, searchCoaches } from "../services/group-lessons";

const normalizeCollection = (payload, fallbackKey) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (fallbackKey && Array.isArray(payload[fallbackKey])) {
    return payload[fallbackKey];
  }
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
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const renderLessonMeta = (lesson) => {
  const coach =
    lesson?.coach?.name ||
    lesson?.coach_name ||
    lesson?.coachName ||
    lesson?.instructor ||
    lesson?.pro ||
    null;
  const location =
    lesson?.location?.name ||
    lesson?.location_name ||
    lesson?.locationName ||
    lesson?.facility ||
    lesson?.court ||
    lesson?.address ||
    null;
  const date =
    lesson?.start_time ||
    lesson?.startTime ||
    lesson?.start_at ||
    lesson?.startAt ||
    lesson?.scheduled_for ||
    lesson?.scheduledFor ||
    null;
  return { coach, location, date: formatDate(date) };
};

const lessonTitle = (lesson) =>
  lesson?.title ||
  lesson?.name ||
  lesson?.program ||
  lesson?.description ||
  "Group lesson";

const coachName = (coach) =>
  coach?.name || coach?.full_name || coach?.fullName || coach?.title || "Coach";

const coachLocation = (coach) =>
  coach?.club ||
  coach?.home_court ||
  coach?.homeCourt ||
  coach?.location ||
  coach?.city ||
  coach?.state ||
  null;

const GroupLessonsPage = () => {
  const navigate = useNavigate();
  const [lessonSearch, setLessonSearch] = useState("");
  const [coachSearch, setCoachSearch] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState(null);

  const {
    data: lessonsResponse,
    isLoading: lessonsLoading,
    isError: lessonsHasError,
    error: lessonsErrorData,
  } = useQuery({
    queryKey: [
      "group-lessons",
      { search: lessonSearch, coachId: selectedCoachId },
    ],
    queryFn: () =>
      listGroupLessons({ search: lessonSearch, coachId: selectedCoachId }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const lessons = useMemo(
    () => normalizeCollection(lessonsResponse, "groupLessons"),
    [lessonsResponse],
  );

  const lessonsErrorMessage =
    lessonsErrorData?.response?.data?.message ||
    lessonsErrorData?.data?.message ||
    lessonsErrorData?.message ||
    "We couldn't load group lessons right now.";

  const {
    data: coachesResponse,
    isLoading: coachesLoading,
  } = useQuery({
    queryKey: ["coaches", { search: coachSearch }],
    queryFn: () => searchCoaches({ search: coachSearch }),
    enabled: coachSearch.trim().length > 0,
  });

  const coaches = useMemo(
    () => normalizeCollection(coachesResponse, "coaches"),
    [coachesResponse],
  );

  const handleCoachSelect = (coach) => {
    setSelectedCoachId(coach?.id || coach?.coach_id || coach?.coachId || null);
    setCoachSearch("");
  };

  const selectedCoach = useMemo(() => {
    if (!selectedCoachId) return null;
    return (
      lessons?.find((lesson) => {
        const coachId =
          lesson?.coach?.id ||
          lesson?.coach_id ||
          lesson?.coachId ||
          lesson?.instructor_id ||
          lesson?.instructorId ||
          null;
        return coachId === selectedCoachId;
      }) ||
      coaches?.find((coach) => {
        const id = coach?.id || coach?.coach_id || coach?.coachId || null;
        return id === selectedCoachId;
      }) || null
    );
  }, [selectedCoachId, lessons, coaches]);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white">
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
              <Users className="w-3.5 h-3.5" />
              Group Lessons
            </span>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight">
              Level up with curated group lessons near you
            </h1>
            <p className="text-white/80 text-base sm:text-lg max-w-3xl">
              Discover flexible programming designed to sharpen your game. Search by
              coach, skill level, or focus area and grab your spot in minutes.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 sm:p-6 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-white/70">
                Search group lessons
              </span>
              <div className="flex items-center gap-3 bg-white text-slate-900 rounded-xl px-3 py-2.5 shadow-lg">
                <Search className="w-5 h-5 text-slate-500" />
                <input
                  value={lessonSearch}
                  onChange={(event) => setLessonSearch(event.target.value)}
                  placeholder="Try cardio, beginner, or doubles"
                  className="flex-1 bg-transparent focus:outline-none text-base font-semibold"
                />
              </div>
            </label>
            <label className="flex flex-col gap-2 relative">
              <span className="text-sm font-semibold text-white/70">
                Search by coach name
              </span>
              <div className="flex items-center gap-3 bg-white text-slate-900 rounded-xl px-3 py-2.5 shadow-lg">
                <Search className="w-5 h-5 text-slate-500" />
                <input
                  value={coachSearch}
                  onChange={(event) => setCoachSearch(event.target.value)}
                  placeholder="Search for a coach"
                  className="flex-1 bg-transparent focus:outline-none text-base font-semibold"
                />
              </div>
              {coachSearch && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white text-slate-900 rounded-xl shadow-xl max-h-60 overflow-y-auto z-10">
                  {coachesLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm font-semibold text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching coaches…
                    </div>
                  ) : coaches.length ? (
                    coaches.map((coach) => {
                      const id = coach?.id || coach?.coach_id || coach?.coachId || null;
                      return (
                        <button
                          key={id || coach?.email || coach?.name}
                          onClick={() => handleCoachSelect(coach)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-100 transition-colors"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {coachName(coach)}
                          </p>
                          {coachLocation(coach) && (
                            <p className="text-xs font-medium text-slate-500">
                              {coachLocation(coach)}
                            </p>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-sm font-semibold text-slate-500">
                      No coaches matched "{coachSearch}".
                    </div>
                  )}
                </div>
              )}
            </label>
          </div>
          {selectedCoach && (
            <div className="bg-white/10 backdrop-blur rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white/70">Filtering by coach</p>
                <p className="text-lg font-bold">
                  {coachName(selectedCoach?.coach || selectedCoach)}
                </p>
              </div>
              <button
                onClick={() => setSelectedCoachId(null)}
                className="text-sm font-semibold bg-white text-slate-900 px-4 py-2 rounded-xl shadow-lg hover:shadow-xl transition"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {lessonsLoading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-slate-500 font-semibold">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading group lessons…
          </div>
        ) : lessonsHasError ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-6 py-5 font-semibold">
            {lessonsErrorMessage}
          </div>
        ) : lessons.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson) => {
              const id =
                lesson?.id ||
                lesson?.lesson_id ||
                lesson?.lessonId ||
                lesson?.uuid ||
                lesson?.slug ||
                lesson?.name;
              const meta = renderLessonMeta(lesson);
              return (
                <article
                  key={id}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all border border-slate-100 p-6 flex flex-col gap-4"
                >
                  <div className="space-y-1">
                    <h2 className="text-lg font-black text-slate-900 leading-tight">
                      {lessonTitle(lesson)}
                    </h2>
                    {meta.coach && (
                      <p className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-400" />
                        {meta.coach}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 text-sm font-semibold text-slate-600">
                    {meta.location && (
                      <p className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {meta.location}
                      </p>
                    )}
                    {meta.date && (
                      <p className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {meta.date}
                      </p>
                    )}
                    {lesson?.level && (
                      <p className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                          {lesson.level}
                        </span>
                      </p>
                    )}
                  </div>
                  {lesson?.description && (
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {lesson.description.length > 160
                        ? `${lesson.description.slice(0, 157)}…`
                        : lesson.description}
                    </p>
                  )}
                  <div className="mt-auto">
                    <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-2.5 rounded-xl hover:shadow-lg transition-all">
                      View details
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="bg-slate-100 border border-dashed border-slate-300 text-slate-600 rounded-2xl px-6 py-16 text-center font-semibold">
            We didn't find any group lessons that match your filters.
          </div>
        )}
      </main>
    </div>
  );
};

export default GroupLessonsPage;
