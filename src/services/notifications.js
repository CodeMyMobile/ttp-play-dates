import api, { unwrap } from "./api";

const buildQuery = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      search.set(key, value.join(","));
      return;
    }
    if (typeof value === "boolean") {
      search.set(key, value ? "1" : "0");
      return;
    }
    search.set(key, value);
  });
  const str = search.toString();
  return str ? `?${str}` : "";
};

const notificationsEndpoint = "/notifications/";

export const listNotifications = ({ page, perPage, unread, type, types } = {}) => {
  const query = buildQuery({
    page,
    perPage,
    unread,
    type,
    types,
  });
  return unwrap(api(`${notificationsEndpoint}${query}`));
};

export const markNotificationsRead = ({ ids } = {}) =>
  unwrap(
    api(`${notificationsEndpoint}read/`, {
      method: "POST",
      body: JSON.stringify({ ids: Array.isArray(ids) ? ids : ids ? [ids] : [] }),
    }),
  );

export default {
  listNotifications,
  markNotificationsRead,
};
