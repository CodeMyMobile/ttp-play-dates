import api, { unwrap } from "./api";

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

export const listGroupLessons = ({
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
  if (location?.latitude) params.latitude = location.latitude;
  if (location?.longitude) params.longitude = location.longitude;
  if (radius) params.radius = radius;
  return unwrap(api(`/group-lessons${qs(params)}`));
};

export const searchCoaches = ({ search = "", page = 1, perPage = 12 } = {}) => {
  const params = { page, perPage };
  if (search) params.search = search;
  return unwrap(api(`/coaches${qs(params)}`));
};

export const listLiveballs = ({
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
  if (location?.latitude) params.latitude = location.latitude;
  if (location?.longitude) params.longitude = location.longitude;
  if (radius) params.radius = radius;
  return unwrap(api(`/liveballs${qs(params)}`));
};
