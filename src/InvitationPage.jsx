// src/InvitationPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getInvitePreview,
  beginInviteVerification,
  verifyInviteCode,
} from "./services/invites";
import Header from "./components/Header.jsx";

export default function InvitationPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [phase, setPhase] = useState("preview"); // 'preview'|'otp'
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showPicker, setShowPicker] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [identifier, setIdentifier] = useState("");
  const [lastChannel, setLastChannel] = useState(null);

  // 1s ticker for resend countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const canResend = useMemo(() => {
    if (!resendAt) return true;
    return now >= new Date(resendAt).getTime();
  }, [resendAt, now]);

  // Load minimal invite preview
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getInvitePreview(token);
        if (!alive) return;
        setPreview(data);
        setPhase("preview");
        // Initialize channel preference from available channels
        const channels = data?.availableChannels || [];
        const defaultChannel = channels.includes("sms")
          ? "sms"
          : channels[0] || null;
        setSelectedChannel(defaultChannel);
        setLastChannel(null);
        setShowPicker(false);
        setIdentifier("");
      } catch {
        setPreview(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const begin = async () => {
    setError("");
    try {
      const payload = {};
      if (selectedChannel) payload.channel = selectedChannel;
      if (identifier) payload.identifier = identifier.trim();
      const resp = await beginInviteVerification(token, payload);
      if (resp?.channel) setLastChannel(resp.channel);
      setResendAt(resp?.resendAt || null);
      setPhase("otp");
      setShowPicker(false);
    } catch (e) {
      const msg = mapBeginError(e?.message);
      setError(msg);
    }
  };

  const verify = async () => {
    setError("");
    try {
      const data = await verifyInviteCode(token, code);

      // If verification returns tokens/profile, start a session
      const {
        access_token,
        refresh_token,
        profile,
        user_id,
        user_type,
      } = data || {};

      if (access_token) {
        try {
          localStorage.setItem("authToken", access_token);
        } catch (storageError) {
          if (import.meta.env.DEV) {
            console.warn("Unable to persist auth token", storageError);
          }
        }
      }
      if (refresh_token) {
        try {
          localStorage.setItem("refreshToken", refresh_token);
        } catch (storageError) {
          if (import.meta.env.DEV) {
            console.warn("Unable to persist refresh token", storageError);
          }
        }
      }

      // Persist a lightweight user object for app state restore
      if (user_id || profile) {
        const name = (profile?.full_name || "").trim() || "Player";
        const user = {
          id: user_id,
          type: user_type,
          name,
          email: profile?.email || "",
          phone: profile?.phone || "",
          avatar: name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase(),
          skillLevel: profile?.usta_rating || "",
        };
        try {
          localStorage.setItem("user", JSON.stringify(user));
        } catch (storageError) {
          if (import.meta.env.DEV) {
            console.warn("Unable to persist user profile", storageError);
          }
        }
      }

      setPhase("done");
      navigate(data.redirect || `/matches/${data.matchId}`, { replace: true });
    } catch {
      setError("Invalid or expired code. Try again.");
    }
  };

  const resend = async () => {
    if (!canResend) return;
    await begin();
  };

  // Render states
  if (loading)
    return (
      <>
        <Header />
        <Page><p>Loading…</p></Page>
      </>
    );
  if (!preview)
    return (
      <>
        <Header />
        <Page><Alert>Invite not found.</Alert></Page>
      </>
    );
  if (preview.status === "expired")
    return (
      <>
        <Header />
        <Page><Alert>This invite has expired.</Alert></Page>
      </>
    );
  if (preview.status === "revoked")
    return (
      <>
        <Header />
        <Page><Alert>This invite was revoked.</Alert></Page>
      </>
    );
  if (preview.status === "full")
    return (
      <>
        <Header />
        <Page><Alert>This match is full.</Alert></Page>
      </>
    );

  return (
    <>
      <Header />
      <Page>
      <h1 className="text-xl font-bold mb-3">Private match invite</h1>

      {preview.match && (
        <div className="mb-4 space-y-1">
          <div className="font-semibold">{preview.match.match_format} match</div>
          <div>
            {new Date(preview.match.start_date_time).toLocaleString()}
          </div>
          <div>Host: {preview.inviter?.full_name}</div>
          {preview.match.location_text && (
            <div>Location: {preview.match.location_text}</div>
          )}
        </div>
      )}

      {phase === "preview" && (
        <div className="grid gap-3">
          <Primary
            onClick={() => {
              const channels = preview?.availableChannels || [];
              if (channels.length > 1 || preview?.identifierRequired) {
                setShowPicker((v) => !v);
              } else {
                // If there's only one channel and no identifier required, send immediately
                setShowPicker(false);
                setSelectedChannel(channels[0] || selectedChannel);
                begin();
              }
            }}
          >
            Join match
          </Primary>

          {showPicker && (
            <div className="p-3 border rounded bg-gray-50 grid gap-3">
              <div className="font-medium">Choose where to receive your code</div>
              <div className="grid gap-2">
                {(preview?.availableChannels || []).map((ch) => (
                  <label key={ch} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="channel"
                      value={ch}
                      checked={selectedChannel === ch}
                      onChange={() => setSelectedChannel(ch)}
                    />
                    <span className="capitalize">{ch}</span>
                    {preview?.maskedIdentifier && (
                      <span className="text-gray-500 text-sm">
                        to {preview.maskedIdentifier}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {preview?.identifierRequired && (
                <label className="grid gap-1">
                  <span className="text-sm text-gray-700">
                    Enter your {prettyRequirement(preview?.requires)}
                  </span>
                  <input
                    className="w-full p-2 border rounded"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={placeholderFor(preview?.requires)}
                  />
                </label>
              )}

              <div className="flex gap-2">
                <button
                  onClick={begin}
                  className="px-3 py-2 rounded bg-black text-white"
                >
                  Send code
                </button>
                <button
                  onClick={() => setShowPicker(false)}
                  className="px-3 py-2 border rounded"
                >
                  Cancel
                </button>
              </div>

              {error && <ErrorText>{error}</ErrorText>}
            </div>
          )}

          {!showPicker && error && <ErrorText>{error}</ErrorText>}
        </div>
      )}

      {phase === "otp" && (
        <div className="grid gap-3">
          <div className="text-sm text-gray-600">
            Code sent via {lastChannel || selectedChannel} {preview?.maskedIdentifier ? `to ${preview.maskedIdentifier}` : ""}
          </div>
          <label className="grid gap-1">
            <span>Enter 6-digit code</span>
            <input
              className="w-full p-2 border rounded tracking-widest"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-3">
            <Primary onClick={verify}>Verify and join</Primary>
            <button
              onClick={resend}
              disabled={!canResend}
              className="px-3 py-2 border rounded disabled:opacity-50"
              aria-disabled={!canResend}
            >
              {canResend
                ? "Resend code"
                : `Resend in ${Math.max(
                    0,
                    Math.ceil((new Date(resendAt).getTime() - now) / 1000)
                  )}s`}
            </button>
            <button
              onClick={() => {
                setPhase("preview");
                setShowPicker(true);
                setError("");
              }}
              className="px-3 py-2 border rounded"
            >
              Change channel
            </button>
          </div>
          {error && <ErrorText>{error}</ErrorText>}
        </div>
      )}
      </Page>
    </>
  );
}

/** Lightweight primitives (keeps your Tailwind setup) */
function Page({ children }) {
  return (
    <main className="max-w-xl mx-auto p-4">
      {children}
    </main>
  );
}
function Primary({ onClick, children }) {
  return (
    <button onClick={onClick} className="px-4 py-2 rounded bg-black text-white">
      {children}
    </button>
  );
}
function ErrorText({ children }) {
  return <p className="text-red-600">{children}</p>;
}
function Alert({ children }) {
  return <div className="p-3 rounded bg-gray-100 border">{children}</div>;
}

// Helpers
function mapBeginError(code) {
  switch (code) {
    case "invalid_channel":
      return "Please choose a valid delivery channel.";
    case "identifier_required":
    case "identifier_missing":
      return "Please enter the required phone or email.";
    case "expired":
      return "This invite has expired.";
    case "invalid_status":
      return "This invite cannot be used right now.";
    case "not_found":
      return "Invite not found.";
    case "bad_request":
      return "Couldn’t send code. Check details and try again.";
    default:
      return "Couldn’t send code. Please try again.";
  }
}

function prettyRequirement(req) {
  if (req === "phone") return "phone";
  if (req === "email") return "email";
  return "identifier";
}

function placeholderFor(req) {
  if (req === "phone") return "+1 555 555 5555";
  if (req === "email") return "you@example.com";
  return "Enter identifier";
}
