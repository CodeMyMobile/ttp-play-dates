import api, { unwrap } from "./api";

const toNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const buildLocationParams = (location = {}) => {
  const params = {};
  const latitudeCandidates = [
    location.latitude,
    location.lat,
    location.latitdue, // tolerate historical typo just in case
    location?.latLng &&
      (typeof location.latLng.lat === "function"
        ? location.latLng.lat()
        : location.latLng.lat),
  ];
  const longitudeCandidates = [
    location.longitude,
    location.lng,
    location.long,
    location.lon,
    location?.latLng &&
      (typeof location.latLng.lng === "function"
        ? location.latLng.lng()
        : location.latLng.lng),
  ];

  const latitude = latitudeCandidates
    .map((candidate) => toNumber(candidate))
    .find((candidate) => candidate !== undefined);
  const longitude = longitudeCandidates
    .map((candidate) => toNumber(candidate))
    .find((candidate) => candidate !== undefined);
  const radius = toNumber(location.radius);

  if (latitude !== undefined) params.latitude = latitude;
  if (longitude !== undefined) params.longitude = longitude;
  if (radius !== undefined) params.radius = radius;

  return params;
};

const applyAliases = (params = {}, aliasMap = {}) => {
  const result = new Map();

  const addValue = (key, value) => {
    if (key === undefined || key === null) return;
    if (value === undefined || value === null || value === "") return;

    if (Array.isArray(value)) {
      value.forEach((entry) => addValue(key, entry));
      return;
    }

    const normalizedKey = String(key);
    const existing = result.get(normalizedKey) || [];
    if (!existing.includes(value)) {
      existing.push(value);
      result.set(normalizedKey, existing);
    }
  };

  Object.entries(params).forEach(([key, value]) => {
    addValue(key, value);
    const aliases = aliasMap[key];
    if (aliases) {
      aliases.forEach((alias) => addValue(alias, value));
    }
  });

  return result;
};

const buildQueryString = (paramsMap) => {
  if (!paramsMap || paramsMap.size === 0) return "";
  const search = new URLSearchParams();
  paramsMap.forEach((values, key) => {
    values.forEach((value) => {
      if (value === undefined || value === null) return;
      search.append(key, String(value));
    });
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

const fetchIndex = async (path, params, aliasMap, { emptyOn404 = false } = {}) => {
  const query = buildQueryString(applyAliases(params, aliasMap));
  try {
    return await unwrap(api(`${path}${query}`));
  } catch (error) {
    const status = error?.status ?? error?.response?.status;
    if (emptyOn404 && status === 404) {
      return { data: [] };
    }
    throw error;
  }
};

const GROUP_LESSON_ALIAS_MAP = {
  page: ["page_number", "pageNumber"],
  per_page: ["perPage", "limit"],
  search: ["q", "keyword"],
  coach_id: ["coachId", "coach", "instructor_id", "instructorId", "pro_id"],
  level: ["levels", "level_filter"],
  skill_level: ["skillLevel"],
  latitude: ["lat"],
  longitude: ["lng", "lon"],
  radius: ["distance", "miles"],
};

const LIVEBALL_ALIAS_MAP = {
  page: ["page_number", "pageNumber"],
  per_page: ["perPage", "limit"],
  search: ["q", "keyword"],
  level: ["levels", "level_filter"],
  skill_level: ["skillLevel"],
  day_of_week: ["weekday", "dayOfWeek", "day"],
  latitude: ["lat"],
  longitude: ["lng", "lon"],
  radius: ["distance", "miles"],
};

const COACH_ALIAS_MAP = {
  page: ["page_number", "pageNumber"],
  per_page: ["perPage", "limit"],
  search: ["q", "keyword"],
};

const buildGroupLessonParams = ({
  search = "",
  coachId,
  level,
  page = 1,
  perPage = 12,
  location,
  radius,
} = {}) => {
  const params = {
    page: toNumber(page) ?? 1,
    per_page: toNumber(perPage) ?? 12,
  };

  const query = search.trim();
  if (query) params.search = query;
  if (coachId) params.coach_id = coachId;
  if (level) {
    params.level = level;
    params.skill_level = level;
  }

  Object.assign(params, buildLocationParams(location));
  const explicitRadius = toNumber(radius);
  if (explicitRadius !== undefined) params.radius = explicitRadius;

  return params;
};

const buildLiveballParams = ({
  search = "",
  level,
  day,
  page = 1,
  perPage = 12,
  location,
  radius,
} = {}) => {
  const params = {
    page: toNumber(page) ?? 1,
    per_page: toNumber(perPage) ?? 12,
  };

  const query = search.trim();
  if (query) params.search = query;
  if (level) {
    params.level = level;
    params.skill_level = level;
  }
  if (day) {
    params.day_of_week = day;
  }

  Object.assign(params, buildLocationParams(location));
  const explicitRadius = toNumber(radius);
  if (explicitRadius !== undefined) params.radius = explicitRadius;

  return params;
};

const buildCoachParams = ({ search = "", page = 1, perPage = 12 } = {}) => {
  const params = {
    page: toNumber(page) ?? 1,
    per_page: toNumber(perPage) ?? 12,
  };
  const query = search.trim();
  if (query) params.search = query;
  return params;
};

export const listGroupLessons = (options = {}) =>
  fetchIndex(
    "/group_lessons",
    buildGroupLessonParams(options),
    GROUP_LESSON_ALIAS_MAP,
    { emptyOn404: true },
  );

export const listLiveballs = (options = {}) =>
  fetchIndex(
    "/liveball_runs",
    buildLiveballParams(options),
    LIVEBALL_ALIAS_MAP,
    { emptyOn404: true },
  );

export const searchCoaches = (options = {}) =>
  fetchIndex("/coaches", buildCoachParams(options), COACH_ALIAS_MAP, {
    emptyOn404: true,
  });
