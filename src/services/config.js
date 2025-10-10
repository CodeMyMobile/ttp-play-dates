const DEFAULT_API_HOST = "https://api.thetennisplan.com";
const DEFAULT_API_PATH = "/api";
const DEFAULT_API_BASE = `${DEFAULT_API_HOST}${DEFAULT_API_PATH}`;
const LEGACY_HOSTNAMES = new Set(["ttp-api.codemymobile.com"]);

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

const normalizeFromLegacyHost = (urlString) => {
  const parsed = parseUrl(urlString);
  if (!parsed) return urlString || DEFAULT_API_BASE;

  if (!LEGACY_HOSTNAMES.has(parsed.hostname)) {
    return stripTrailingSlash(parsed.href);
  }

  const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : DEFAULT_API_PATH;
  const normalizedPath = path === "/" ? DEFAULT_API_PATH : ensureLeadingSlash(path);
  return `${DEFAULT_API_HOST}${stripTrailingSlash(normalizedPath)}`;
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
