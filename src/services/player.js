import { resolveApiBaseUrl } from "./config.js";

const API_URL = resolveApiBaseUrl();

const toParams = (params) => {
  return Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
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
  if (!player) {
    throw new Error("Missing player token");
  }
  if (!id) {
    throw new Error("Missing player id");
  }

  const params = toParams({
    id,
    date_of_birth,
    usta_rating,
    uta_rating,
    full_name: fullName,
    phone: mobile,
    about_me,
    profile_picture,
  });

  const response = await fetch(`${API_URL}/player/personal_details/${id}`, {
    method: "PATCH",
    headers: {
      "Content-type": "application/json;charset=UTF-8",
      Authorization: `token ${player}`,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || response.statusText || "Failed to update profile";
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};
