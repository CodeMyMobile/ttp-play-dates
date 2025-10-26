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

  const rounded = Math.round(numeric * 10) / 10;
  return rounded;
};

const formatRatingValue = (value, { asString = false } = {}) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (!Number.isFinite(value)) {
    return undefined;
  }

  if (!asString) {
    return value;
  }

  return value.toFixed(1);
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

  const buildParams = ({ ratingsAsString = false } = {}) =>
    Object.entries({
      id,
      date_of_birth,
      usta_rating: ratingsAsString
        ? formatRatingValue(normalizedUstaRating, { asString: true })
        : normalizedUstaRating,
      uta_rating: ratingsAsString
        ? formatRatingValue(normalizedUtaRating, { asString: true })
        : normalizedUtaRating,
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

  const params = buildParams();

  const method = id ? "PATCH" : "POST";

  const send = (body) =>
    unwrap(
      api(`/player/personal_details`, {
        method,
        authToken: authHeader,
        authSchemePreference: "token",
        json: body,
      }),
    );

  try {
    return await send(params);
  } catch (error) {
    const status = Number(error?.status ?? error?.response?.status);
    const hasNumericRatings = [normalizedUstaRating, normalizedUtaRating].some(
      (value) => typeof value === "number" && Number.isFinite(value),
    );

    if (status !== 422 || !hasNumericRatings) {
      throw error;
    }

    const fallbackParams = buildParams({ ratingsAsString: true });
    return send(fallbackParams);
  }
};
