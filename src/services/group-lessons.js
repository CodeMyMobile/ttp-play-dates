import api, { unwrap } from "./api";

const toNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const qs = (params) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      if (!value.length) return;
      search.set(key, value.join(","));
      return;
    }
    search.set(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : "";
};

const aliasParams = (params) => {
  const result = { ...params };
  const add = (key, value) => {
    if (value === undefined || value === null || value === "") return;
    if (!(key in result)) {
      result[key] = value;
    }
  };

  if (params.page !== undefined) {
    add("page_number", params.page);
    add("pageNumber", params.page);
  }
  if (params.perPage !== undefined) {
    add("per_page", params.perPage);
    add("limit", params.perPage);
  }
  if (params.search) {
    add("q", params.search);
    add("keyword", params.search);
  }
  if (params.keyword) {
    add("search", params.keyword);
  }
  if (params.coachId) {
    add("coach_id", params.coachId);
    add("instructor_id", params.coachId);
    add("pro_id", params.coachId);
    add("coach", params.coachId);
  }
  if (params.level) {
    add("skill_level", params.level);
    add("skillLevel", params.level);
    add("levels", params.level);
    add("level_filter", params.level);
  }
  if (params.latitude !== undefined) {
    add("lat", params.latitude);
  }
  if (params.longitude !== undefined) {
    add("lng", params.longitude);
    add("lon", params.longitude);
  }
  if (params.radius !== undefined) {
    add("distance", params.radius);
    add("miles", params.radius);
  }
  if (params.day) {
    add("day_of_week", params.day);
    add("weekday", params.day);
    add("dayOfWeek", params.day);
  }
  if (params.type) {
    add("event_type", params.type);
    add("eventType", params.type);
    add("category", params.type);
    add("categories", params.type);
    add("lesson_type", params.type);
    add("lessonType", params.type);
    add("session_type", params.type);
    add("sessionType", params.type);
    add("program_type", params.type);
    add("programType", params.type);
    add("kind", params.type);
    add("event_kind", params.type);
    add("focus", params.type);
    add("format", params.type);
  }

  return result;
};

const buildTypeFilters = (primary, fallback = []) => {
  const filters = { type: primary };
  const ensure = (key, value) => {
    if (value === undefined || value === null || value === "") return;
    if (!(key in filters)) {
      filters[key] = value;
    }
  };
  const list = Array.isArray(fallback) ? fallback : [fallback];
  list.forEach((value) => {
    ensure("lesson_type", value);
    ensure("lessonType", value);
    ensure("category", value);
    ensure("categories", value);
    ensure("program_type", value);
    ensure("programType", value);
    ensure("session_type", value);
    ensure("sessionType", value);
    ensure("kind", value);
    ensure("focus", value);
    ensure("format", value);
  });
  return filters;
};

const buildLocationParams = (location = {}) => {
  const latitude =
    toNumber(location.latitude ?? location.lat ?? location.latitdue) ??
    (typeof location.latLng?.lat === "function"
      ? toNumber(location.latLng.lat())
      : toNumber(location.latLng?.lat));
  const longitude =
    toNumber(location.longitude ?? location.lng ?? location.long ?? location.lon) ??
    (typeof location.latLng?.lng === "function"
      ? toNumber(location.latLng.lng())
      : toNumber(location.latLng?.lng));

  const params = {};
  if (latitude !== undefined) params.latitude = latitude;
  if (longitude !== undefined) params.longitude = longitude;
  const radius = toNumber(location.radius);
  if (radius !== undefined) params.radius = radius;
  return params;
};

const buildGroupLessonParams = ({
  search = "",
  coachId,
  page = 1,
  perPage = 12,
  level,
  location,
  radius,
} = {}) => {
  const params = { page, perPage };
  if (search) params.search = search;
  if (coachId) params.coachId = coachId;
  if (level) params.level = level;
  Object.assign(params, buildLocationParams(location));
  const normalizedRadius = toNumber(radius);
  if (normalizedRadius !== undefined) params.radius = normalizedRadius;
  return params;
};

const buildLiveballParams = ({
  search = "",
  page = 1,
  perPage = 12,
  day,
  level,
  location,
  radius,
} = {}) => {
  const params = { page, perPage };
  if (search) params.search = search;
  if (day) params.day = day;
  if (level) params.level = level;
  Object.assign(params, buildLocationParams(location));
  const normalizedRadius = toNumber(radius);
  if (normalizedRadius !== undefined) params.radius = normalizedRadius;
  return params;
};

const endpointCache = new Map();

const shouldRetry = (candidate, error) => {
  if (!error) return false;
  const status = error.status ?? error?.response?.status;
  if (!status) return false;
  if (Array.isArray(candidate?.retryOn) && candidate.retryOn.includes(status)) {
    return true;
  }
  return status === 404 || status === 405;
};

const buildCandidateParams = (candidate, baseParams) => {
  if (typeof candidate.mapParams === "function") {
    const mapped = candidate.mapParams({ ...baseParams });
    return aliasParams(mapped);
  }
  const extras =
    typeof candidate.params === "function"
      ? candidate.params({ ...baseParams })
      : candidate.params || {};
  return aliasParams({ ...baseParams, ...extras });
};

const fetchWithFallback = async (cacheKey, candidates, baseParams) => {
  const cached = endpointCache.get(cacheKey);
  if (cached) {
    const params = buildCandidateParams(cached, baseParams);
    return unwrap(api(`${cached.path}${qs(params)}`));
  }

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const params = buildCandidateParams(candidate, baseParams);
      const data = await unwrap(api(`${candidate.path}${qs(params)}`));
      endpointCache.set(cacheKey, candidate);
      return data;
    } catch (error) {
      lastError = error;
      if (shouldRetry(candidate, error)) {
        continue;
      }
      throw error;
    }
  }

  if (lastError) throw lastError;
  throw new Error(`No matching endpoint for ${cacheKey}`);
};

const GROUP_LESSON_ENDPOINTS = [
  { path: "/group_lessons" },
  { path: "/group-lessons" },
  { path: "/groupLessons" },
  { path: "/group_lessons/list" },
  { path: "/group-lessons/list" },
  { path: "/groupLessons/list" },
  { path: "/events/group-lessons" },
  { path: "/events/group_lessons" },
  { path: "/events/groupLessons" },
  { path: "/events/group" },
  { path: "/lessons/group-lessons" },
  { path: "/lessons/group_lessons" },
  { path: "/lessons/group" },
  { path: "/sessions/group-lessons" },
  { path: "/sessions/group_lessons" },
  { path: "/sessions/group" },
  { path: "/programs/group-lessons" },
  { path: "/programs/group_lessons" },
  { path: "/programs/group" },
  {
    path: "/events",
    mapParams: (params) => ({
      ...params,
      include: params.include || "group_lessons",
      listing: params.listing || "group",
      ...buildTypeFilters("group_lesson", ["group", "group-lesson"]),
    }),
    retryOn: [400, 422],
  },
  {
    path: "/lessons",
    mapParams: (params) => ({
      ...params,
      ...buildTypeFilters("group", ["group_lesson", "group-lesson"]),
    }),
    retryOn: [400, 422],
  },
  {
    path: "/lessons",
    mapParams: (params) => ({
      ...params,
      ...buildTypeFilters("group_lesson", ["group", "group-lesson"]),
    }),
    retryOn: [400, 422],
  },
];

const LIVEBALL_ENDPOINTS = [
  { path: "/liveball_runs" },
  { path: "/liveballs" },
  { path: "/liveball-runs" },
  { path: "/liveballRuns" },
  { path: "/liveball_runs/list" },
  { path: "/liveball-runs/list" },
  { path: "/liveballs/list" },
  { path: "/events/liveball" },
  { path: "/events/liveball-runs" },
  { path: "/events/liveball_runs" },
  { path: "/events/live-ball" },
  { path: "/lessons/liveball" },
  { path: "/lessons/live-ball" },
  { path: "/programs/liveball" },
  { path: "/programs/live-ball" },
  { path: "/sessions/liveball" },
  { path: "/sessions/live-ball" },
  {
    path: "/events",
    mapParams: (params) => ({
      ...params,
      include: params.include || "liveball",
      listing: params.listing || "liveball",
      ...buildTypeFilters("liveball", ["live_ball", "live-ball"]),
    }),
    retryOn: [400, 422],
  },
  {
    path: "/lessons",
    mapParams: (params) => ({
      ...params,
      ...buildTypeFilters("liveball", ["live_ball", "live-ball"]),
    }),
    retryOn: [400, 422],
  },
];

export const listGroupLessons = (options = {}) => {
  const baseParams = buildGroupLessonParams(options);
  return fetchWithFallback("group-lessons", GROUP_LESSON_ENDPOINTS, baseParams);
};

export const searchCoaches = ({ search = "", page = 1, perPage = 12 } = {}) => {
  const params = aliasParams({ page, perPage, ...(search ? { search } : {}) });
  return unwrap(api(`/coaches${qs(params)}`));
};

export const listLiveballs = (options = {}) => {
  const baseParams = buildLiveballParams(options);
  return fetchWithFallback("liveballs", LIVEBALL_ENDPOINTS, baseParams);
};
