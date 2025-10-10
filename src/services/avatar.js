import { resolveApiBaseUrl } from "./config.js";

const API_URL = resolveApiBaseUrl();

export async function getPlayerAWSUrl(accessToken, imageType) {
  if (!accessToken) {
    throw new Error("Missing access token for avatar upload");
  }
  const res = await fetch(`${API_URL}/player/avatars?file_type=${imageType}`, {
    method: "GET",
    headers: {
      Authorization: `token ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to get upload URL (${res.status})`);
  }
  return res.json();
}

export async function putToSignedUrl(uploadURL, file, imageType) {
  const res = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": `image/${imageType}` },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}) ${text}`);
  }
}
