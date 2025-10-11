const API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://ttp-api.codemymobile.com/api";

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
  id = undefined,
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

  const headers = {
    "Content-type": "application/json;charset=UTF-8",
    Authorization: `token ${player}`,
  };

  const send = async ({ url, method, body }) => {
    const response = await fetch(url, {
      method,
      headers,
      body,
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

  const body = JSON.stringify(params);

  if (params.id) {
    try {
      return await send({
        url: `${API_URL}/player/personal_details/${params.id}`,
        method: "PATCH",
        body,
      });
    } catch (error) {
      if (error?.status !== 404) {
        throw error;
      }
    }
  }

  const { id: _ignored, ...createParams } = params;
  return send({
    url: `${API_URL}/player/personal_details`,
    method: "POST",
    body: JSON.stringify(createParams),
  });
};
