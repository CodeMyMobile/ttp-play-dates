const baseEnvUrl = process.env.VITE_API_URL || "https://api.thetennisplan.com";
const baseURL = baseEnvUrl.endsWith("/") ? baseEnvUrl.slice(0, -1) : baseEnvUrl;
const endpoint = `${baseURL}/group_lessons`;

const params = new URLSearchParams();

if (process.env.GROUP_LESSON_SEARCH) {
  params.set("search", process.env.GROUP_LESSON_SEARCH);
}

if (process.env.GROUP_LESSON_LEVEL) {
  params.set("level", process.env.GROUP_LESSON_LEVEL);
}

if (process.env.GROUP_LESSON_PAGE) {
  params.set("page", process.env.GROUP_LESSON_PAGE);
}

if (process.env.GROUP_LESSON_PER_PAGE) {
  params.set("per_page", process.env.GROUP_LESSON_PER_PAGE);
}

const query = params.toString();
const url = query ? `${endpoint}?${query}` : endpoint;

const main = async () => {
  process.stdout.write(`Fetching group lessons from ${url}\n`);

  const headers = {
    Accept: "application/json",
  };

  const token = process.env.API_TOKEN || process.env.TTP_API_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  let payload;

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    throw new Error(`Expected JSON response, received: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const error = payload?.error || response.statusText;
    throw new Error(`API request failed (${response.status}): ${error}`);
  }

  const lessons = Array.isArray(payload) ? payload : payload?.data || [];

  if (!Array.isArray(lessons)) {
    console.log("Received payload:", JSON.stringify(payload, null, 2));
    throw new Error("Unexpected payload shape for group lessons");
  }

  if (lessons.length === 0) {
    console.log("No group lessons returned.");
    return;
  }

  console.log(`Received ${lessons.length} group lesson(s). Showing up to first 10 entries:`);
  lessons.slice(0, 10).forEach((lesson, index) => {
    const id = lesson.id ?? "unknown";
    const title = lesson.title || lesson.name || lesson.program_name || "Untitled";
    const location = lesson.location || lesson.city || lesson.venue || lesson.address || "Location unknown";
    console.log(`\n#${index + 1} - ID: ${id}`);
    console.log(`  Title: ${title}`);
    console.log(`  Location: ${location}`);
    if (lesson.start_time || lesson.startTime) {
      console.log(`  Start: ${lesson.start_time || lesson.startTime}`);
    }
    if (lesson.end_time || lesson.endTime) {
      console.log(`  End: ${lesson.end_time || lesson.endTime}`);
    }
  });
};

main().catch((error) => {
  console.error("Failed to fetch group lessons:");
  if (error?.cause?.code) {
    console.error(
      `Network error (${error.cause.code}): ${error.cause.message || "Unable to reach API"}`,
    );
  }
  console.error(error);
  process.exitCode = 1;
});
