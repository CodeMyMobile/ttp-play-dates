import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Users,
  UserCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

const LESSONS = [
  {
    id: "private-60",
    title: "60-Minute Private Tune-Up",
    coach: "Coach Priya Desai",
    type: "private",
    description:
      "One-on-one session focused on your serve mechanics and baseline consistency.",
    price: "$120",
    location: "Penmar Recreation Center",
    nextSession: "Saturday, Jan 27 · 9:00 AM",
    duration: "60 minutes",
  },
  {
    id: "group-40",
    title: "Adult Doubles Strategy Clinic",
    coach: "Coach Mateo Alvarez",
    type: "group",
    description:
      "High-energy clinic for 3.0-3.5 players covering positioning and team communication.",
    price: "$45",
    location: "Mar Vista Park",
    nextSession: "Tuesday, Jan 30 · 7:00 PM",
    duration: "90 minutes",
    openSpots: 3,
  },
];

const typeLabel = {
  private: "Private lesson",
  group: "Group lesson",
};

const FindCoach = () => {
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [confirmationNotice, setConfirmationNotice] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);

  const isPrivateLesson = selectedLesson?.type === "private";

  const nextSteps = useMemo(() => {
    if (!selectedLesson) return [];

    if (isPrivateLesson) {
      return [
        `Coach ${selectedLesson.coach} will review your request. Private lessons require a coach to confirm before they're finalized.`,
        "You'll only be charged once the coach confirms your lesson.",
        "We'll send an email and text as soon as the coach responds.",
      ];
    }

    const openSpotCopy = selectedLesson.openSpots
      ? `There are currently ${selectedLesson.openSpots} open spots.`
      : "We'll let you know if any spots open up.";

    return [
      "Your spot is instantly confirmed as long as there are open spots.",
      openSpotCopy,
      "We'll send a reminder 24 hours before the clinic.",
    ];
  }, [isPrivateLesson, selectedLesson]);

  const statusSummary = isPrivateLesson
    ? {
        title: "Pending coach confirmation",
        body:
          "We'll notify you once your coach confirms the lesson. Payment will process after they approve it.",
        accent: "border-amber-200 bg-amber-50 text-amber-800",
      }
    : {
        title: "You're confirmed!",
        body:
          "Group lessons lock in immediately when spots are available. You're all set for this session.",
        accent: "border-emerald-200 bg-emerald-50 text-emerald-800",
      };

  const handleStartOver = () => {
    setSelectedLesson(null);
    setIsConfirmed(false);
    setConfirmationNotice("");
  };

  const handleConfirmLesson = () => {
    if (!selectedLesson) return;

    setIsConfirmed(true);
    setConfirmationNotice(
      isPrivateLesson
        ? `You're in! We'll let you know as soon as ${selectedLesson.coach} confirms. You'll only be charged after they approve the lesson.`
        : "You're booked! Your spot in this group lesson is confirmed and your payment has been processed.",
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100/50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Find a Coach</h1>
            <p className="mt-1 text-sm font-semibold text-gray-500">
              Browse curated coaches and book the session that fits your goals.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Matchplay
          </Link>
        </div>

        {!selectedLesson ? (
          <div className="grid gap-4">
            {LESSONS.map((lesson) => {
              const isGroupLesson = lesson.type === "group";
              return (
                <article
                  key={lesson.id}
                  className="rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-100/40"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                          {isGroupLesson ? <Users className="h-3.5 w-3.5" /> : <UserCircle className="h-3.5 w-3.5" />}
                          {typeLabel[lesson.type]}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          <Clock className="h-3.5 w-3.5" />
                          {lesson.duration}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-gray-900">{lesson.title}</h2>
                        <p className="mt-1 text-sm font-semibold text-gray-600">with {lesson.coach}</p>
                      </div>
                      <p className="text-sm font-medium text-gray-600">{lesson.description}</p>
                      <div className="grid gap-3 text-sm font-semibold text-gray-600 sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-emerald-500" />
                          {lesson.nextSession}
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-emerald-500" />
                          {lesson.location}
                        </div>
                      </div>
                      {isGroupLesson && typeof lesson.openSpots === "number" && (
                        <p className="text-xs font-semibold text-emerald-600">
                          {lesson.openSpots} open spots remaining
                        </p>
                      )}
                    </div>
                    <div className="flex w-full flex-col items-end gap-4 sm:w-auto">
                      <p className="text-2xl font-black text-gray-900">{lesson.price}</p>
                      <button
                        type="button"
                        onClick={() => setSelectedLesson(lesson)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg sm:w-auto"
                      >
                        Book now
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6">
            <button
              type="button"
              onClick={handleStartOver}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to all lessons
            </button>

            {confirmationNotice && (
              <div
                className={`rounded-2xl border p-4 text-sm font-semibold shadow ${
                  isPrivateLesson
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
                role="status"
              >
                {confirmationNotice}
              </div>
            )}

            <section className="space-y-4 rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-100/40">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-gray-900">{selectedLesson.title}</h2>
                  <p className="text-sm font-semibold text-gray-500">with {selectedLesson.coach}</p>
                  <p className="text-sm font-medium text-gray-600">{selectedLesson.description}</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                    {isPrivateLesson ? <UserCircle className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                    {typeLabel[selectedLesson.type]}
                  </span>
                  <p className="text-2xl font-black text-gray-900">{selectedLesson.price}</p>
                </div>
              </div>
              <div className="grid gap-4 text-sm font-semibold text-gray-600 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-500" />
                  {selectedLesson.nextSession}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  {selectedLesson.duration}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-500" />
                  {selectedLesson.location}
                </div>
              </div>
              <div
                className={`rounded-2xl border p-4 text-sm font-semibold ${statusSummary.accent}`}
              >
                <p className="font-black">{statusSummary.title}</p>
                <p className="mt-1 text-sm font-medium">{statusSummary.body}</p>
              </div>
            </section>

            <section className="rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-100/40">
              <h3 className="text-lg font-black text-gray-900">What happens next</h3>
              <ul className="mt-4 space-y-3 text-sm font-semibold text-gray-600">
                {nextSteps.map((step) => (
                  <li key={step} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <span>{step}</span>
                  </li>
                ))}
                {isPrivateLesson ? (
                  <li className="flex items-start gap-3 text-sm font-semibold text-gray-600">
                    <CreditCard className="mt-0.5 h-4 w-4 text-emerald-500" />
                    Payment runs automatically once your coach confirms the lesson.
                  </li>
                ) : (
                  <li className="flex items-start gap-3 text-sm font-semibold text-gray-600">
                    <CreditCard className="mt-0.5 h-4 w-4 text-emerald-500" />
                    Payment has already been processed to hold your spot.
                  </li>
                )}
              </ul>
            </section>

            <section className="rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-xl shadow-emerald-100/40">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-gray-900">
                    Confirm this {isPrivateLesson ? "private lesson" : "group lesson"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-600">
                    {isPrivateLesson
                      ? "We'll reserve the time and notify your coach to approve it."
                      : "Your spot will be locked in immediately when you confirm."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleConfirmLesson}
                  disabled={isConfirmed}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isConfirmed ? "Lesson confirmed" : "Confirm lesson"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default FindCoach;
