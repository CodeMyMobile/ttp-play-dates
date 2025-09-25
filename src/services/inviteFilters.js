export const filterActiveInvites = (invites) => {
  if (!Array.isArray(invites)) return [];
  const now = Date.now();
  return invites.filter((invite) => {
    const referenceDate = invite?.expires_at || invite?.match?.start_date_time;
    if (!referenceDate) return true;
    const parsed = new Date(referenceDate);
    if (Number.isNaN(parsed.getTime())) return true;
    return parsed.getTime() >= now;
  });
};
