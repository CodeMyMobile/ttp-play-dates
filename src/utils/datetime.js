const pad = (value) => String(value).padStart(2, "0");

const toIsoStringWithOffset = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  const offsetMinutes = date.getTimezoneOffset();
  const sign = offsetMinutes > 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absolute / 60));
  const offsetMins = pad(absolute % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
};

const combineDateAndTimeToIso = (dateString, timeString) => {
  if (!dateString || !timeString) return null;

  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const [hourStr, minuteStr] = timeString.split(":");

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (
    [year, month, day, hour, minute].some(
      (value) => !Number.isFinite(value),
    )
  ) {
    return null;
  }

  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(localDate.getTime())) {
    return null;
  }

  // Preserve the creator's local offset so the backend can render and send
  // notifications using the exact wall time the user selected. Serialising
  // to UTC ("Z") caused the API to interpret the match in the wrong local
  // day/hour, leading to SMS invites showing `1:00 AM` for a 6:00 PM match.
  return toIsoStringWithOffset(localDate);
};

export { combineDateAndTimeToIso, toIsoStringWithOffset };
