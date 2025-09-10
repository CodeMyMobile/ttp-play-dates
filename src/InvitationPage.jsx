// src/InvitationPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getInvitePreview,
  beginInviteVerification,
  verifyInviteCode,
} from "./services/invites";

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
      const resp = await beginInviteVerification(token);
      setResendAt(resp?.resendAt || null);
      setPhase("otp");
    } catch {
      setError("Couldn’t send code. Please try again.");
    }
  };

  const verify = async () => {
    setError("");
    try {
      const data = await verifyInviteCode(token, code);
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
  if (loading) return <Page><p>Loading…</p></Page>;
  if (!preview) return <Page><Alert>Invite not found.</Alert></Page>;
  if (preview.status === "expired") return <Page><Alert>This invite has expired.</Alert></Page>;
  if (preview.status === "revoked") return <Page><Alert>This invite was revoked.</Alert></Page>;
  if (preview.status === "full") return <Page><Alert>This match is full.</Alert></Page>;

  return (
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
        <>
          <Primary onClick={begin}>Join match</Primary>
          {error && <ErrorText>{error}</ErrorText>}
        </>
      )}

      {phase === "otp" && (
        <div className="grid gap-3">
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
          </div>
          {error && <ErrorText>{error}</ErrorText>}
        </div>
      )}
    </Page>
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
