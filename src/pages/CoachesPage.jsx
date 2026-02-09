import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listCoaches } from "../services/coaches";

const extractCoaches = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.coaches)) return payload.coaches;
  if (payload.results && Array.isArray(payload.results.data)) {
    return payload.results.data;
  }
  return [];
};

const pickCoachValue = (coach, keys) => {
  if (!coach || typeof coach !== "object") return "";
  for (const key of keys) {
    const value = coach[key];
    if (value && typeof value === "object") {
      if (Array.isArray(value)) {
        if (value.length) return value.join(", ");
      } else if ("name" in value && value.name) {
        return value.name;
      }
    }
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return "";
};

const CoachesPage = () => {
  const {
    data,
    error,
    isError,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["coaches"],
    queryFn: () => listCoaches(),
    staleTime: 1000 * 60,
  });

  const coaches = useMemo(() => extractCoaches(data), [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-emerald-700">Coach Directory</h1>
            <p className="text-sm text-emerald-900/70">
              Explore coaches available through Matchplay and reach out to book your next training session.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-700"
            disabled={isFetching}
          >
            {isFetching ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {isLoading ? (
          <div className="rounded-xl border border-emerald-200 bg-white/60 p-6 text-center text-emerald-700">
            Loading coaches...
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
            <p className="font-semibold">We couldn't load the coach list.</p>
            <p className="text-sm opacity-80">
              {error?.message || "Please try again in a moment."}
            </p>
          </div>
        ) : coaches.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-white/60 p-6 text-center text-emerald-700">
            No coaches found. Try refreshing to fetch the latest list.
          </div>
        ) : (
          <ul className="grid gap-4">
            {coaches.map((coach, index) => {
              const name = pickCoachValue(coach, [
                "full_name",
                "name",
                "coach_name",
                "title",
                "first_name",
                "last_name",
              ]);
              const specialization = pickCoachValue(coach, [
                "specialization",
                "speciality",
                "expertise",
                "focus",
                "tagline",
                "bio",
              ]);
              const location = pickCoachValue(coach, [
                "location",
                "city",
                "region",
                "address",
              ]);
              const contact = pickCoachValue(coach, [
                "phone",
                "email",
                "contact",
              ]);
              return (
                <li
                  key={coach.id || coach.uuid || coach.slug || index}
                  className="rounded-xl border border-emerald-200 bg-white/70 p-5 shadow-sm backdrop-blur"
                >
                  <h2 className="text-xl font-bold text-emerald-800">
                    {name || "Matchplay Coach"}
                  </h2>
                  {specialization && (
                    <p className="mt-1 text-sm font-medium text-emerald-700/80">
                      {specialization}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-emerald-900/70">
                    {location && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
                        {location}
                      </span>
                    )}
                    {contact && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                        {contact}
                      </span>
                    )}
                  </div>
                  <details className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-emerald-900/80">
                    <summary className="cursor-pointer font-semibold text-emerald-700">
                      View raw coach data
                    </summary>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs">
                      {JSON.stringify(coach, null, 2)}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CoachesPage;
