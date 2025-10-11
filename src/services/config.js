const stripTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const ensureLeadingSlash = (value = "") => {
  if (!value) return "";
  return `/${value.replace(/^\/+/, "")}`;
};

const parseUrl = (value) => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
};

const combineOriginAndPath = (parsedUrl, fallbackPath = "") => {
  if (!parsedUrl) return fallbackPath;
  const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;
  const hasPath = parsedUrl.pathname && parsedUrl.pathname !== "/";
  const path = hasPath ? parsedUrl.pathname : fallbackPath;
  const normalizedPath = path ? ensureLeadingSlash(path) : "";
  return stripTrailingSlash(`${origin}${normalizedPath}`);
};

const DEFAULT_API_HOST = "https://api.thetennisplan.com";
const DEFAULT_API_BASE = stripTrailingSlash(DEFAULT_API_HOST);
const LEGACY_HOST_DEFAULT_PATHS = new Map([
  ["ttp-api.codemymobile.com", "/api"],
]);

const normalizeFromLegacyHost = (urlString) => {
  const parsed = parseUrl(urlString);
  if (!parsed) return urlString || DEFAULT_API_BASE;

  const defaultPath = LEGACY_HOST_DEFAULT_PATHS.get(parsed.hostname);
  if (!defaultPath) {
    return combineOriginAndPath(parsed);
  }

  const hasPath = parsed.pathname && parsed.pathname !== "/";
  const path = hasPath ? parsed.pathname : defaultPath;

  return stripTrailingSlash(
    `${DEFAULT_API_HOST}${ensureLeadingSlash(path)}`,
  );
};

export const resolveApiBaseUrl = (overrides = {}) => {
  const env =
    (typeof import.meta !== "undefined" && import.meta.env) || {};

  const candidate =
    overrides.VITE_API_BASE_URL ||
    env.VITE_API_BASE_URL ||
    overrides.VITE_API_URL ||
    env.VITE_API_URL ||
    DEFAULT_API_BASE;

  const normalizedCandidate = stripTrailingSlash(String(candidate || "").trim());
  if (!normalizedCandidate) {
    return DEFAULT_API_BASE;
  }

  const legacyNormalized = normalizeFromLegacyHost(normalizedCandidate);
  return legacyNormalized || DEFAULT_API_BASE;
};

export default resolveApiBaseUrl;
