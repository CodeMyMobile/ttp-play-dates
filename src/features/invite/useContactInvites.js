// @ts-check

/**
 * @typedef {Object} Contact
 * @property {string} [id]
 * @property {string} [name]
 * @property {string} [phone]
 * @property {string} [email]
 * @property {'sms' | 'email'} [channel]
 */

const EMAIL_REGEX = /^(?:[a-zA-Z0-9_!#$%&'*+/=?`{|}~^.-]+)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

export function canUseContactPicker() {
  return (
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    typeof /** @type {any} */ (navigator).contacts?.select === "function"
  );
}

export function canUseWebShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

const US_COUNTRY_CODE = "+1";

export function normalizePhone(raw) {
  if (!raw) return "";
  let value = raw.trim();
  if (!value) return "";
  value = value.replace(/[^+\d]/g, "");
  if (!value) return "";
  if (value.startsWith("+")) {
    const digits = value.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }
  const digitsOnly = value.replace(/\D/g, "");
  if (!digitsOnly) return "";
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return `+${digitsOnly}`;
  }
  if (digitsOnly.length === 10) {
    return `${US_COUNTRY_CODE}${digitsOnly}`;
  }
  return `+${digitsOnly}`;
}

/**
 * @param {Contact[]} contacts
 * @returns {Contact[]}
 */
export function dedupe(contacts) {
  const seenPhones = new Map();
  const seenEmails = new Map();
  const result = [];

  contacts.forEach((contact) => {
    const phoneKey = contact.phone ? normalizePhone(contact.phone) : "";
    const emailKey = contact.email ? contact.email.trim().toLowerCase() : "";
    const hasPhone = Boolean(phoneKey);
    const hasEmail = Boolean(emailKey);

    if (hasPhone && seenPhones.has(phoneKey)) {
      return;
    }
    if (hasEmail && seenEmails.has(emailKey)) {
      return;
    }

    const normalized = {
      ...contact,
      phone: phoneKey || undefined,
      email: emailKey || undefined,
    };

    if (hasPhone) {
      seenPhones.set(phoneKey, normalized);
    }
    if (hasEmail) {
      seenEmails.set(emailKey, normalized);
    }

    result.push(normalized);
  });

  return result;
}

const buildId = (() => {
  let counter = 0;
  return () => {
    counter += 1;
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      try {
        return crypto.randomUUID();
      } catch (error) {
        // Ignore and fall back to counter based id
      }
    }
    return `contact-${Date.now()}-${counter}`;
  };
})();

/**
 * @returns {Promise<Contact[]>}
 */
export async function pickFromDevice() {
  if (!canUseContactPicker()) return [];
  try {
    const navigatorAny = /** @type {any} */ (navigator);
    const results = await navigatorAny.contacts.select(["name", "tel", "email"], {
      multiple: true,
    });
    if (!Array.isArray(results)) return [];

    return dedupe(
      results.map((entry) => {
        const name = Array.isArray(entry.name) ? entry.name[0] : entry.name;
        const tel = Array.isArray(entry.tel) ? entry.tel[0] : entry.tel;
        const email = Array.isArray(entry.email) ? entry.email[0] : entry.email;
        const normalizedPhone = normalizePhone(typeof tel === "string" ? tel : "");
        const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
        return {
          id: buildId(),
          name: typeof name === "string" ? name.trim() : undefined,
          phone: normalizedPhone || undefined,
          email: normalizedEmail || undefined,
          channel: normalizedPhone ? "sms" : "email",
        };
      }),
    );
  } catch (error) {
    console.warn("Contact picker failed", error);
    return [];
  }
}

/**
 * @param {string} text
 * @returns {Contact[]}
 */
export function parsePasted(text) {
  if (!text) return [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const contacts = lines
    .map((line) => {
      if (EMAIL_REGEX.test(line)) {
        return {
          id: buildId(),
          email: line.toLowerCase(),
          channel: "email",
        };
      }
      const phone = normalizePhone(line);
      if (phone) {
        return {
          id: buildId(),
          phone,
          channel: "sms",
        };
      }
      return null;
    })
    .filter(Boolean);

  return dedupe(/** @type {Contact[]} */ (contacts));
}

/**
 * @param {string} text
 * @returns {Contact[]}
 */
function parseCsv(text) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!rows.length) return [];

  const [firstRow, ...rest] = rows;
  const header = firstRow.split(/,|;|\t/).map((value) => value.trim().toLowerCase());
  const hasHeader = header.some((value) => ["name", "phone", "tel", "email"].includes(value));
  const dataRows = hasHeader ? rest : rows;
  const effectiveHeader = hasHeader
    ? header
    : ["name", "phone", "email"].slice(0, rows[0].split(/,|;|\t/).length);

  return dedupe(
    /** @type {Contact[]} */ (
      dataRows
        .map((row) => {
          const cells = row.split(/,|;|\t/).map((cell) => cell.trim());
          const contact = { id: buildId() };
          cells.forEach((cell, index) => {
            const key = effectiveHeader[index];
            if (!key) return;
            if (!cell) return;
            if (key.includes("name")) contact.name = cell;
            if (key.includes("phone") || key.includes("tel")) {
              const normalized = normalizePhone(cell);
              if (normalized) contact.phone = normalized;
            }
            if (key.includes("mail")) contact.email = cell.toLowerCase();
          });
          if (!contact.phone && !contact.email) return null;
          contact.channel = contact.phone ? "sms" : "email";
          return contact;
        })
        .filter(Boolean)
    ),
  );
}

/**
 * @param {string} text
 * @returns {Contact[]}
 */
function parseVcf(text) {
  const cards = text.split(/END:VCARD/i);
  const contacts = [];
  cards.forEach((card) => {
    if (!/BEGIN:VCARD/i.test(card)) return;
    const lines = card.split(/\r?\n/);
    const contact = { id: buildId() };
    lines.forEach((line) => {
      const [rawKey, rawValue] = line.split(":");
      if (!rawValue) return;
      const key = rawKey.toUpperCase();
      const value = rawValue.trim();
      if (key.startsWith("FN")) contact.name = value;
      if (key.startsWith("TEL")) {
        const normalized = normalizePhone(value);
        if (normalized && !contact.phone) contact.phone = normalized;
      }
      if (key.startsWith("EMAIL") && !contact.email) {
        contact.email = value.toLowerCase();
      }
    });
    if (!contact.phone && !contact.email) return;
    contact.channel = contact.phone ? "sms" : "email";
    contacts.push(contact);
  });
  return dedupe(contacts);
}

/**
 * @param {File} file
 * @returns {Promise<Contact[]>}
 */
export async function parseFile(file) {
  if (!file) return [];
  const text = await file.text();
  if (!text) return [];
  if (/BEGIN:VCARD/i.test(text)) {
    return parseVcf(text);
  }
  return parseCsv(text);
}

/**
 * @param {string} url
 * @param {string} text
 */
export async function shareInvite(url, text) {
  if (!canUseWebShare()) {
    throw new Error("Web Share API not available");
  }
  await navigator.share({ url, text, title: "Join my tennis match" });
}

/**
 * @param {string} phone
 * @param {string} body
 */
export function smsLink(phone, body) {
  const sanitized = phone.replace(/[^\d+]/g, "");
  const encodedBody = encodeURIComponent(body);
  const base = sanitized ? `sms:${sanitized}` : "sms:";
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}body=${encodedBody}`;
}

/**
 * @param {string} email
 * @param {string} subject
 * @param {string} body
 */
export function mailtoLink(email, subject, body) {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${encodeURIComponent(email)}?subject=${encodedSubject}&body=${encodedBody}`;
}

/**
 * @param {Contact} contact
 * @param {any} payload
 */
export async function sendServerInvite(contact, payload) {
  // TODO(optional): wire this to a backend invite endpoint.
  void contact;
  void payload;
}

/**
 * @param {string | undefined} value
 */
export function isValidEmail(value) {
  if (!value) return false;
  return EMAIL_REGEX.test(value.trim());
}

/**
 * @param {string | undefined} value
 */
export function isValidPhone(value) {
  const normalized = value ? normalizePhone(value) : "";
  return Boolean(normalized && /^\+[1-9]\d{6,14}$/.test(normalized));
}

export { EMAIL_REGEX };
