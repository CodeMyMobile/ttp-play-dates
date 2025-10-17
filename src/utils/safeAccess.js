export const safeOwnPropertyDescriptor = (object, key) => {
  if (!object || (typeof object !== "object" && typeof object !== "function")) {
    return undefined;
  }
  try {
    if (!Object.prototype.hasOwnProperty.call(object, key)) {
      return undefined;
    }
  } catch {
    return undefined;
  }
  try {
    return Object.getOwnPropertyDescriptor(object, key) || undefined;
  } catch {
    return undefined;
  }
};

export const safeOwnPropertyValue = (object, key) => {
  if (key === null || key === undefined) return undefined;
  const descriptor = safeOwnPropertyDescriptor(object, key);
  if (!descriptor) return undefined;
  if (typeof descriptor.get === "function" || typeof descriptor.set === "function") {
    return undefined;
  }
  return descriptor.value;
};

export const safeOwnedPlainObject = (object, key) => {
  const value = safeOwnPropertyValue(object, key);
  return value && typeof value === "object" ? value : null;
};

export const safeValueAtPath = (object, path) => {
  if (!object || typeof object !== "object") return undefined;
  if (path === null || path === undefined) return undefined;

  const segments = Array.isArray(path)
    ? path
    : typeof path === "string"
    ? path.split(".").filter(Boolean)
    : [path];

  let current = object;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    const key = typeof segment === "string" || typeof segment === "number"
      ? segment
      : String(segment);
    const value = safeOwnPropertyValue(current, key);
    if (value === undefined) {
      return undefined;
    }
    current = value;
  }
  return current;
};

export const safeBoolean = (value) => value === true;

export const safeStringValue = (value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : null;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return null;
};

export const safeIterableKeys = (object) => {
  if (!object || typeof object !== "object") return [];
  try {
    return Object.keys(object);
  } catch {
    return [];
  }
};

export const safeArrayFrom = (value) => (Array.isArray(value) ? value : []);
