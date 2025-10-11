const collapseRepeatedScheme = (scheme, value) => {
  if (!scheme || !value) return value?.trim() || "";
  const pattern = new RegExp(`^${scheme}\\s+`, "i");
  let trimmed = value.trim();
  while (pattern.test(trimmed)) {
    trimmed = trimmed.replace(pattern, "").trim();
  }
  return trimmed;
};

export const normalizeAuthToken = (token, { defaultScheme = "Bearer" } = {}) => {
  if (token === null || token === undefined) return null;
  const raw = String(token).trim();
  if (!raw) return null;

  const match = raw.match(/^([A-Za-z]+)\s+(.+)$/);
  if (match) {
    const [, scheme, rest] = match;
    const credentials = collapseRepeatedScheme(scheme, rest);
    return credentials ? `${scheme} ${credentials}` : null;
  }

  if (!defaultScheme) {
    return raw;
  }

  return `${defaultScheme} ${raw}`;
};

export const getStoredAuthToken = (options) => {
  try {
    const stored = localStorage.getItem("authToken");
    return normalizeAuthToken(stored, options);
  } catch {
    return null;
  }
};
