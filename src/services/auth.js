import api, { unwrap } from "./api";

export const login = async (email, password) => {
  const data = await unwrap(
    api(`/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  );
  if (data?.access_token) {
    localStorage.setItem("authToken", data.access_token);
  }
  if (data?.refresh_token) {
    localStorage.setItem("refreshToken", data.refresh_token);
  }
  return data;
};

export const signup = async ({ email, password, name, phone, user_type = 2 }) => {
  const payload = {
    email,
    password,
    user_type,
    // Common backend field names; adjust if your API differs
    full_name: name,
    phone,
  };
  const data = await unwrap(
    api(`/auth/signup`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
  if (data?.access_token) {
    localStorage.setItem("authToken", data.access_token);
  }
  if (data?.refresh_token) {
    localStorage.setItem("refreshToken", data.refresh_token);
  }
  return data;
};

export const getPersonalDetails = async () =>
  unwrap(api(`/player/personal_details`));

export const updatePersonalDetails = async (details) =>
  unwrap(
    api(`/player/personal_details`, {
      method: "POST",
      body: JSON.stringify(details),
    })
  );

export const logout = () => {
  localStorage.removeItem("authToken");
};
