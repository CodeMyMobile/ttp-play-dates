import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Invites } from "../lib/api.js";

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [phase, setPhase] = useState("loading");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    Invites.getPreview(token)
      .then(setPreview)
      .catch(() => setError("Invite not found"))
      .finally(() => setPhase("preview"));
  }, [token]);

  useEffect(() => {
    if (!resendAt) return;
    const timer = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((new Date(resendAt) - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  if (phase === "loading") return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!preview) return <div className="p-4">Invite not found.</div>;

  const begin = async () => {
    try {
      const payload = preview.requires === "generic" ? { identifier } : undefined;
      const { resendAt: next } = await Invites.begin(token, payload);
      setResendAt(next);
      setPhase("otp");
    } catch {
      setError("Failed to send code");
    }
  };

  const verify = async () => {
    try {
      const { redirect } = await Invites.verify(token, code);
      setPhase("done");
      navigate(redirect);
    } catch {
      setError("Invalid code");
    }
  };

  const resend = () => begin();

  if (preview.status !== "pending") {
    return <div className="p-4">Invite {preview.status}</div>;
  }

  if (phase === "preview") {
    const info = preview.matchPreview || {};
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-semibold">{info.title}</h1>
        {info.startsAt && <p>{new Date(info.startsAt).toLocaleString()}</p>}
        {info.host && <p>Hosted by {info.host}</p>}
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={() => setPhase("identify")}>Continue</button>
      </div>
    );
  }

  if (phase === "identify") {
    return (
      <div className="p-4 space-y-4">
        {preview.requires === "generic" ? (
          <input
            className="border p-2 w-full"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter phone or email"
          />
        ) : (
          <p>We'll send a code to {preview.maskedIdentifier}</p>
        )}
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={begin}>Send Code</button>
      </div>
    );
  }

  if (phase === "otp") {
    return (
      <div className="p-4 space-y-4">
        <input
          className="border p-2 w-full"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter code"
        />
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={verify}>Verify</button>
        <button
          className="px-4 py-2 border rounded"
          onClick={resend}
          disabled={remaining > 0}
        >
          {remaining > 0 ? `Resend in ${remaining}s` : "Resend code"}
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return <div className="p-4">Done! Redirecting...</div>;
  }

  return null;
}
