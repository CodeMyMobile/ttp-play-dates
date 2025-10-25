import api, { unwrap } from "./api";
import { normalizeAuthToken } from "./authToken";

export const normalizeRatingForApi = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return undefined;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return undefined;
  }

  const roundedToHalfStep = Math.round(numeric * 2) / 2;
  const isHalfStep = Math.abs(roundedToHalfStep - numeric) < 1e-9;
  if (!isHalfStep) {
    return undefined;
  }

  if (Number.isInteger(roundedToHalfStep)) {
    return roundedToHalfStep;
  }

  return Math.round(roundedToHalfStep * 10);
};

export const normalizeRatingFromApi = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return "";
  }

  if (numeric >= 10 && Number.isInteger(numeric)) {
    const scaled = numeric / 10;
    if (scaled >= 0 && scaled <= 10) {
      return scaled.toFixed(1);
    }
  }

  if (Number.isInteger(numeric)) {
    return numeric.toFixed(1);
  }

  const roundedToHalfStep = Math.round(numeric * 2) / 2;
  return roundedToHalfStep.toFixed(1);
};

export const updatePlayerPersonalDetails = async ({
  player = null,
  id = null,
  date_of_birth = null,
  usta_rating = null,
  uta_rating = null,
  fullName = null,
  mobile = null,
  about_me = null,
  profile_picture,
}) => {
  const authHeader = normalizeAuthToken(player, {
    defaultScheme: "token",
    preferScheme: "token",
  });
  if (!authHeader) {
    throw new Error("Missing player token");
  }

  const normalizedUstaRating = normalizeRatingForApi(usta_rating);
  const normalizedUtaRating = normalizeRatingForApi(uta_rating);

  const params = Object.entries({
    id,
    date_of_birth,
    usta_rating: normalizedUstaRating,
    uta_rating: normalizedUtaRating,
    full_name: fullName,
    phone: mobile,
    about_me,
    profile_picture,
  }).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

  const method = id ? "PATCH" : "POST";

  return unwrap(
    api(`/player/personal_details`, {
      method,
      authToken: authHeader,
      authSchemePreference: "token",
      json: params,
    }),
  );
};
