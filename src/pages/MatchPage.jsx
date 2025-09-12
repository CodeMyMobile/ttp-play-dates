// src/pages/MatchPage.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getMatch, removeParticipant } from "../services/matches";
import { Calendar, MapPin, Users, ClipboardList, FileText, X } from "lucide-react";
import Header from "../components/Header.jsx";

export default function MatchPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [removeError, setRemoveError] = useState("");

  const [currentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await getMatch(id);
        if (!alive) return;
        setData(resp);
      } catch {
        setErr("Not found or access denied.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const handleRemoveParticipant = async (playerId) => {
    if (!data) return;
    if (!window.confirm("Remove this participant from the match?")) return;
    try {
      await removeParticipant(data.match.id, playerId);
      setData({
        ...data,
        participants: data.participants.filter((p) => p.player_id !== playerId),
      });
    } catch {
      setRemoveError("Failed to remove participant");
      setTimeout(() => setRemoveError(""), 3000);
    }
  };

  if (err)
    return (
      <>
        <Header />
        <Page>
          <Alert>{err}</Alert>
        </Page>
      </>
    );
  if (!data)
    return (
      <>
        <Header />
        <Page>
          <p>Loading…</p>
        </Page>
      </>
    );

  const { match, participants = [] } = data;
  const isHost = currentUser?.id === match.host_id;

  return (
    <>
      <Header />
      <Page>
      <h1 className="text-xl font-bold mb-2">Match Details</h1>
      {data?.match?.status === "cancelled" && (
        <div className="mb-4">
          <span className="inline-block px-3 py-1.5 bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200 rounded-full text-xs font-black">
            CANCELLED
          </span>
        </div>
      )}
      <div className="space-y-1 mb-6">
        <p className="flex items-center gap-1 text-gray-700">
          <Calendar className="w-4 h-4" />
          {new Date(match.start_date_time).toLocaleString()}
        </p>
        {match.location_text && (
          <p className="flex items-center gap-1 text-gray-700">
            <MapPin className="w-4 h-4" /> {match.location_text}
          </p>
        )}
        {match.match_format && (
          <p className="flex items-center gap-1 text-gray-700">
            <ClipboardList className="w-4 h-4" /> {match.match_format}
          </p>
        )}
        {match.notes && (
          <p className="flex items-center gap-1 text-gray-700">
            <FileText className="w-4 h-4" /> {match.notes}
          </p>
        )}
      </div>
      <div>
        <h2 className="text-lg font-bold mb-2 flex items-center gap-1">
          <Users className="w-4 h-4" /> Participants
        </h2>
        {removeError && <p className="text-red-600 mb-2">{removeError}</p>}
        {participants.length ? (
          <ul className="space-y-1">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-gray-700"
              >
                <span>
                  {p.profile?.full_name || `Player ${p.player_id}`}
                  {p.player_id === match.host_id && (
                    <span className="ml-1 text-blue-700 text-xs">Host</span>
                  )}
                </span>
                {isHost && p.player_id !== match.host_id && (
                  <button
                    onClick={() => handleRemoveParticipant(p.player_id)}
                    className="text-red-600 hover:text-red-800"
                    aria-label="Remove participant"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No participants yet.</p>
        )}
      </div>
      </Page>
    </>
  );
}

function Page({ children }) {
  return <main className="max-w-3xl mx-auto p-4">{children}</main>;
}
function Alert({ children }) {
  return <div className="p-3 rounded bg-gray-100 border">{children}</div>;
}
