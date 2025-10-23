import { useState } from "react";
import { Users } from "lucide-react";
import InviteModal from "./InviteModal.jsx";

const asyncNoop = async () => "";

export default function InviteButton({
  match,
  getInviteUrl = asyncNoop,
  disabled = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOpen = async () => {
    if (disabled) return;
    setError("");
    setLoading(true);
    try {
      const url = await getInviteUrl();
      if (typeof url === "string" && url.trim()) {
        setInviteUrl(url.trim());
      }
    } catch (err) {
      const message =
        err?.message || "We couldn't load an invite link. Try again later.";
      setError(message);
    } finally {
      setLoading(false);
      setIsOpen(true);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setInviteUrl("");
    setError("");
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled || loading}
        className={`inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <Users className="h-4 w-4 text-white" />
        {loading ? "Preparing…" : "Invite players"}
      </button>
      {error && !isOpen && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
      {isOpen && (
        <InviteModal
          match={match}
          inviteUrl={inviteUrl}
          onClose={handleClose}
          onRefreshInviteUrl={getInviteUrl}
        />
      )}
    </>
  );
}
