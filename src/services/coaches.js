import api, { unwrap } from "./api";

const buildQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : "";
};

export const listCoaches = (params) =>
  unwrap(api(`/coaches${buildQueryString(params)}`, { authSchemePreference: "token" }));

export default listCoaches;
