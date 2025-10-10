const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const buildMatchUpdatePayload = ({
  startDateTime,
  startDateTimeLocal,
  startDateTimeOffsetMinutes,
  startDateTimeTimezone,
  locationText,
  matchFormat,
  previousMatchFormat,
  notes,
  isOpenMatch,
  skillLevel,
  previousSkillLevel,
  latitude,
  longitude,
  previousLatitude,
  previousLongitude,
}) => {
  const payload = {
    start_date_time: startDateTime,
    location_text: locationText,
  };

  if (typeof startDateTimeLocal === "string" && startDateTimeLocal.trim()) {
    payload.start_date_time_local = startDateTimeLocal;
  }

  if (Number.isFinite(startDateTimeOffsetMinutes)) {
    payload.start_date_time_offset_minutes = startDateTimeOffsetMinutes;
  }

  if (
    typeof startDateTimeTimezone === "string" &&
    startDateTimeTimezone.trim()
  ) {
    payload.start_date_time_timezone = startDateTimeTimezone;
  }

  if (isFiniteNumber(latitude)) {
    payload.latitude = latitude;
  } else if (latitude === null && isFiniteNumber(previousLatitude)) {
    payload.latitude = null;
  }

  if (isFiniteNumber(longitude)) {
    payload.longitude = longitude;
  } else if (longitude === null && isFiniteNumber(previousLongitude)) {
    payload.longitude = null;
  }

  const trimmedFormat =
    typeof matchFormat === "string" ? matchFormat.trim() : "";
  const trimmedPreviousFormat =
    typeof previousMatchFormat === "string" ? previousMatchFormat.trim() : "";
  if (trimmedFormat) {
    payload.match_format = trimmedFormat;
  } else if (trimmedPreviousFormat) {
    payload.match_format = null;
  }

  if (isOpenMatch) {
    const trimmedSkill =
      typeof skillLevel === "string" ? skillLevel.trim() : "";
    const trimmedPreviousSkill =
      typeof previousSkillLevel === "string"
        ? previousSkillLevel.trim()
        : "";
    if (trimmedSkill) {
      payload.skill_level_min = trimmedSkill;
    } else if (trimmedPreviousSkill) {
      payload.skill_level_min = null;
    }
    if (typeof notes === "string") {
      payload.notes = notes;
    }
  }

  return payload;
};

export { buildMatchUpdatePayload };
