import { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  Smartphone,
  Share2,
  ClipboardPaste,
  UploadCloud,
  Info,
  Mail,
  Phone,
  Copy as CopyIcon,
  Check,
} from "lucide-react";
import InviteTabs from "./InviteTabs.jsx";
import ContactsPreview from "./ContactsPreview.jsx";
import {
  canUseContactPicker,
  canUseWebShare,
  dedupe,
  isValidEmail,
  isValidPhone,
  mailtoLink,
  parseFile,
  parsePasted,
  pickFromDevice,
  shareInvite,
  smsLink,
  normalizePhone,
  sendServerInvite,
} from "./useContactInvites";

const EMAIL_SUBJECT = "Join my tennis match";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildInviteMessage(match, url) {
  const lines = ["Join my tennis match!"];
  const when = match?.start_date_time || match?.dateTime;
  const where = match?.location_text || match?.location;
  const level = match?.skill_level || match?.skill_level_min || match?.level;

  if (when) lines.push(`When: ${formatDate(when)}`);
  if (where) lines.push(`Where: ${where}`);
  if (level) lines.push(`Level: ${level}`);
  lines.push(`Join: ${url}`);
  return lines.join("\n");
}

function describeTab(tab) {
  switch (tab) {
    case "device":
      return {
        title: "Pick from your device",
        icon: <Smartphone className="h-4 w-4" />,
      };
    case "share":
      return {
        title: "Share a link",
        icon: <Share2 className="h-4 w-4" />,
      };
    case "paste":
      return {
        title: "Paste contacts",
        icon: <ClipboardPaste className="h-4 w-4" />,
      };
    case "upload":
      return {
        title: "Upload CSV or VCF",
        icon: <UploadCloud className="h-4 w-4" />,
      };
    default:
      return { title: "", icon: null };
  }
}

export default function InviteModal({
  match,
  inviteUrl = "",
  onClose,
  onRefreshInviteUrl,
}) {
  const supportsContactPicker = canUseContactPicker();
  const supportsShare = canUseWebShare();
  const [activeTab, setActiveTab] = useState(
    supportsContactPicker ? "device" : "share",
  );
  const [contacts, setContacts] = useState([]);
  const [contactErrors, setContactErrors] = useState({});
  const [status, setStatus] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [linkError, setLinkError] = useState("");
  const [loadingLink, setLoadingLink] = useState(false);
  const [sending, setSending] = useState(false);
  const [localInviteUrl, setLocalInviteUrl] = useState(inviteUrl);
  const [pastedText, setPastedText] = useState("");

  useEffect(() => {
    setLocalInviteUrl(inviteUrl);
  }, [inviteUrl]);

  useEffect(() => {
    return () => {
      setContacts([]);
      setPastedText("");
    };
  }, []);

  const tabs = useMemo(() => {
    const list = [
      supportsContactPicker
        ? { id: "device", label: "Device" }
        : null,
      { id: "share", label: "Share" },
      { id: "paste", label: "Paste" },
      { id: "upload", label: "Upload" },
    ].filter(Boolean);
    return list;
  }, [supportsContactPicker]);

  const inviteMessage = useMemo(() => {
    const url = localInviteUrl || inviteUrl;
    if (!url) return "Join my tennis match!";
    return buildInviteMessage(match, url);
  }, [inviteUrl, localInviteUrl, match]);

  const ensureInviteUrl = useCallback(async () => {
    if (localInviteUrl) return localInviteUrl;
    if (!onRefreshInviteUrl) return "";
    setLoadingLink(true);
    setLinkError("");
    try {
      const next = await onRefreshInviteUrl();
      if (typeof next === "string" && next.trim()) {
        setLocalInviteUrl(next.trim());
        return next.trim();
      }
      setLinkError("We couldn't load an invite link. Copy the link manually.");
      return "";
    } catch (error) {
      setLinkError(
        error?.message || "We couldn't load an invite link right now.",
      );
      return "";
    } finally {
      setLoadingLink(false);
    }
  }, [localInviteUrl, onRefreshInviteUrl]);

  const mergeContacts = useCallback((incoming) => {
    if (!incoming?.length) return;
    setContacts((prev) => dedupe([...prev, ...incoming]));
  }, []);

  const handlePick = useCallback(async () => {
    const picked = await pickFromDevice();
    mergeContacts(picked);
    setStatus(
      picked.length
        ? `Added ${picked.length} contact${picked.length === 1 ? "" : "s"}.`
        : "No contacts selected.",
    );
  }, [mergeContacts]);

  const handlePaste = useCallback(() => {
    const parsed = parsePasted(pastedText);
    mergeContacts(parsed);
    setPastedText("");
    setStatus(
      parsed.length
        ? `Added ${parsed.length} contact${parsed.length === 1 ? "" : "s"}.`
        : "No valid contacts found.",
    );
  }, [mergeContacts, pastedText]);

  const handleFile = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const parsed = await parseFile(file);
      mergeContacts(parsed);
      event.target.value = "";
      setStatus(
        parsed.length
          ? `Added ${parsed.length} contact${parsed.length === 1 ? "" : "s"}.`
          : "We couldn't read any contacts from that file.",
      );
    },
    [mergeContacts],
  );

  const updateContact = useCallback((id, updates) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === id
          ? { ...contact, ...updates }
          : contact,
      ),
    );
    setContactErrors((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      const entry = { ...next[id] };
      Object.keys(updates).forEach((key) => {
        delete entry[key];
      });
      if (Object.keys(entry).length === 0) {
        delete next[id];
      } else {
        next[id] = entry;
      }
      return next;
    });
  }, []);

  const removeContact = useCallback((id) => {
    setContacts((prev) => prev.filter((contact) => contact.id !== id));
  }, []);

  const validateContacts = useCallback((list) => {
    const errors = {};
    list.forEach((contact) => {
      if (contact.channel === "sms") {
        const normalized = contact.phone
          ? normalizePhone(contact.phone)
          : "";
        if (!isValidPhone(normalized)) {
          errors[contact.id] = {
            ...(errors[contact.id] || {}),
            phone: "Enter a valid phone number",
          };
        }
      } else if (contact.channel === "email") {
        if (!isValidEmail(contact.email)) {
          errors[contact.id] = {
            ...(errors[contact.id] || {}),
            email: "Enter a valid email",
          };
        }
      }
    });
    setContactErrors(errors);
    return Object.keys(errors).length === 0;
  }, []);

  const openIntentLinks = useCallback((list, message, url) => {
    list.forEach((contact, index) => {
      const body = message;
      if (contact.channel === "sms" && contact.phone) {
        const intent = smsLink(contact.phone, body);
        setTimeout(() => {
          window.open(intent, "_blank", "noopener,noreferrer");
        }, index * 100);
      }
      if (contact.channel === "email" && contact.email) {
        const intent = mailtoLink(contact.email, EMAIL_SUBJECT, body);
        setTimeout(() => {
          window.open(intent, "_blank", "noopener,noreferrer");
        }, index * 100);
      }
      void sendServerInvite(contact, { inviteUrl: url, body });
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (!contacts.length) {
      setStatus("Add at least one contact before sending.");
      return;
    }
    if (!validateContacts(contacts)) {
      setStatus("Fix the highlighted contact details first.");
      return;
    }
    const sanitizedContacts = contacts.map((contact) => {
      if (contact.channel === "sms") {
        const normalized = contact.phone ? normalizePhone(contact.phone) : "";
        return { ...contact, phone: normalized };
      }
      if (contact.channel === "email" && contact.email) {
        return { ...contact, email: contact.email.trim().toLowerCase() };
      }
      return contact;
    });
    setContacts(sanitizedContacts);
    setSending(true);
    const url = await ensureInviteUrl();
    const link = url || localInviteUrl || inviteUrl;
    const message = buildInviteMessage(match, link);
    if (!link) {
      setStatus("We need an invite link before we can share.");
      setSending(false);
      return;
    }
    openIntentLinks(sanitizedContacts, message, link);
    setStatus(
      "We opened your messaging apps in new tabs. Complete the invites there.",
    );
    setSending(false);
  }, [contacts, ensureInviteUrl, inviteUrl, localInviteUrl, match, openIntentLinks, validateContacts]);

  const handleShare = useCallback(async () => {
    const url = await ensureInviteUrl();
    const link = url || localInviteUrl || inviteUrl;
    if (!link) {
      setStatus("We need an invite link before we can share.");
      return;
    }
    const message = buildInviteMessage(match, link);
    if (supportsShare) {
      try {
        await shareInvite(link, message);
        setStatus("Shared! Choose an app from your device's share sheet.");
        return;
      } catch (error) {
        console.warn("Share failed", error);
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopyFeedback("Invite copied to clipboard.");
    } catch (error) {
      console.warn("Copy failed", error);
      setCopyFeedback("Copy failed. Use the buttons below instead.");
    }
  }, [ensureInviteUrl, inviteUrl, localInviteUrl, match, supportsShare]);

  const handleCopyLink = useCallback(async () => {
    const link = localInviteUrl || inviteUrl;
    if (!link) {
      setStatus("Generate an invite link first.");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopyFeedback("Link copied to clipboard.");
    } catch (error) {
      console.warn("Copy failed", error);
      setCopyFeedback("Copy failed. Copy it manually instead.");
    }
  }, [inviteUrl, localInviteUrl]);

  const shareQuickActions = useMemo(() => {
    const link = localInviteUrl || inviteUrl;
    if (!link) return [];
    const message = buildInviteMessage(match, link);
    const phoneIntent = smsLink("", message);
    const emailIntent = mailtoLink("", EMAIL_SUBJECT, message);
    return [
      {
        label: "Text message",
        href: phoneIntent,
        icon: <Phone className="h-4 w-4" />,
      },
      {
        label: "Email",
        href: emailIntent,
        icon: <Mail className="h-4 w-4" />,
      },
    ];
  }, [inviteUrl, localInviteUrl, match]);

  const { title, icon } = describeTab(activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 sm:px-6">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-gray-200 bg-white p-2 text-gray-500 transition hover:bg-gray-50"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <header className="border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-cyan-50 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            Invite players
          </p>
          <h2 className="mt-1 text-2xl font-black text-gray-900">Share your match</h2>
          <p className="mt-2 text-sm text-gray-600">
            Send a modern invite without sharing your full address book. Pick from your contacts, share a link, or paste details.
          </p>
        </header>
        <InviteTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="px-6"
        />
        <section className="px-6 py-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-700">
            {icon}
            <span>{title}</span>
          </div>
          {linkError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {linkError}
            </div>
          )}
          {status && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              <Check className="h-4 w-4" />
              <span>{status}</span>
            </div>
          )}
          {activeTab === "device" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                <p>
                  We only access the contacts you pick. Nothing is stored after you close this window.
                </p>
              </div>
              {supportsContactPicker ? (
                <button
                  type="button"
                  onClick={handlePick}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Smartphone className="h-4 w-4 text-white" />
                  Pick contacts
                </button>
              ) : (
                <p className="text-sm text-gray-500">
                  Contact picker isn’t supported on this browser. Try the paste or share tab instead.
                </p>
              )}
              <ContactsPreview
                contacts={contacts}
                errors={contactErrors}
                onEdit={updateContact}
                onRemove={removeContact}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !contacts.length}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Share2 className="h-4 w-4" />
                {sending ? "Opening invites…" : "Send invites"}
              </button>
            </div>
          )}
          {activeTab === "share" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Use your device share sheet or copy the invite message. This keeps the existing “Copy invite link” flow intact.
              </p>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <pre className="whitespace-pre-wrap break-words text-sm text-gray-800">{inviteMessage}</pre>
              </div>
              <div className="flex flex-wrap gap-3">
                {supportsShare && (
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <Share2 className="h-4 w-4 text-white" />
                    Share from device
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <CopyIcon className="h-4 w-4" />
                  Copy invite link
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <ClipboardPaste className="h-4 w-4" />
                  Copy invite message
                </button>
              </div>
              {copyFeedback && (
                <p className="text-xs font-semibold text-gray-500">{copyFeedback}</p>
              )}
              {shareQuickActions.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Quick actions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {shareQuickActions.map((action) => (
                      <a
                        key={action.label}
                        href={action.href}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        {action.icon}
                        {action.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === "paste" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Paste phone numbers or email addresses (one per line). We’ll validate, de-duplicate, and let you edit before sending.
              </p>
              <textarea
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                rows={6}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                placeholder={"e.g.\n+15551234567\nfriend@example.com"}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={!pastedText.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ClipboardPaste className="h-4 w-4 text-white" />
                  Parse contacts
                </button>
                <span className="text-xs text-gray-500">
                  We’ll clear the textarea after parsing.
                </span>
              </div>
              <ContactsPreview
                contacts={contacts}
                errors={contactErrors}
                onEdit={updateContact}
                onRemove={removeContact}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !contacts.length}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Share2 className="h-4 w-4" />
                {sending ? "Opening invites…" : "Send invites"}
              </button>
            </div>
          )}
          {activeTab === "upload" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Upload a CSV (name, phone, email) or VCF contact file. We’ll only keep contacts for this session.
              </p>
              <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-600 transition hover:border-emerald-300 hover:bg-emerald-50/40">
                <UploadCloud className="h-8 w-8 text-emerald-500" />
                <span className="font-semibold">Choose a file</span>
                <span className="text-xs text-gray-500">CSV or VCF up to 1MB</span>
                <input
                  type="file"
                  accept=".csv,.vcf,text/csv,text/vcard"
                  onChange={handleFile}
                  className="hidden"
                />
              </label>
              <ContactsPreview
                contacts={contacts}
                errors={contactErrors}
                onEdit={updateContact}
                onRemove={removeContact}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !contacts.length}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Share2 className="h-4 w-4" />
                {sending ? "Opening invites…" : "Send invites"}
              </button>
            </div>
          )}
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 text-xs text-gray-500">
          <p>
            Works best over HTTPS. Some features depend on your browser and device capabilities.
          </p>
          {loadingLink && <span className="font-semibold text-emerald-600">Fetching link…</span>}
        </footer>
      </div>
    </div>
  );
}
