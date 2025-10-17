const PROFILE_IMAGE_KEYS = [
  "profile_picture",
  "profilePicture",
  "profile_picture_url",
  "profilePictureUrl",
  "profile_photo",
  "profilePhoto",
  "profile_image",
  "profileImage",
  "profile_image_url",
  "profileImageUrl",
  "photo_url",
  "photoUrl",
  "image_url",
  "imageUrl",
  "avatar_url",
  "avatarUrl",
  "avatar",
  "host_avatar",
  "hostAvatar",
  "picture",
  "photo",
];

const toNonEmptyString = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "";
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return "";
};

export const getProfileImageFromSource = (source) => {
  if (!source || typeof source !== "object") return "";
  for (const key of PROFILE_IMAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const candidate = toNonEmptyString(source[key]);
    if (candidate) {
      return candidate;
    }
  }
  return "";
};

export const getAvatarUrlFromPlayer = (player) => {
  if (!player || typeof player !== "object") return "";
  const sources = [player.profile, player.player, player.user, player];
  for (const source of sources) {
    const url = getProfileImageFromSource(source);
    if (url) return url;
  }
  return "";
};

export const getAvatarInitials = (name, fallback) => {
  const source = (name || fallback || "").trim();
  if (!source) return "MP";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};
