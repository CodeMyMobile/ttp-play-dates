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

const parseDateAndTime = (dateString, timeString) => {
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

  return localDate;
};

const formatLocalDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatLocalTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const resolveTimezoneName = () => {
  try {
    const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
    return typeof timeZone === "string" && timeZone ? timeZone : null;
  } catch {
    return null;
  }
};

const combineDateAndTimeToIso = (dateString, timeString) => {
  const localDate = parseDateAndTime(dateString, timeString);
  if (!localDate) {
    return null;
  }

  return toIsoStringWithOffset(localDate);
};

const buildDateTimeInfoFromDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const isoString = toIsoStringWithOffset(date);
  if (!isoString) {
    return null;
  }

  const seconds = pad(date.getSeconds());
  const localDateTime = `${formatLocalDate(date)}T${formatLocalTime(date)}:${seconds}`;
  const timezoneOffsetMinutes = Number.isFinite(date.getTimezoneOffset())
    ? -date.getTimezoneOffset()
    : null;
  const timezoneName = resolveTimezoneName();

  return {
    isoString,
    localDateTime,
    timezoneOffsetMinutes,
    timezoneName,
  };
};

const buildDateTimePayload = (dateString, timeString) => {
  const localDate = parseDateAndTime(dateString, timeString);
  if (!localDate) {
    return null;
  }

  return buildDateTimeInfoFromDate(localDate);
};

export {
  buildDateTimeInfoFromDate,
  buildDateTimePayload,
  combineDateAndTimeToIso,
  toIsoStringWithOffset,
};
