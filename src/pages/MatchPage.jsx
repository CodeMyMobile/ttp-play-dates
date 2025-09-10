// src/pages/MatchPage.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getMatch } from "../services/matches";

export default function MatchPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const match = await getMatch(id);
        if (!alive) return;
        setData(match);
      } catch {
        setErr("Not found or access denied.");
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (err) return <Page><Alert>{err}</Alert></Page>;
  if (!data) return <Page><p>Loading…</p></Page>;

  return (
    <Page>
      <h1 className="text-xl font-bold mb-2">{data.match_format} match</h1>
      <div className="space-y-1">
        <p><b>Starts:</b> {new Date(data.start_date_time).toLocaleString()}</p>
        {data.location_text && <p><b>Location:</b> {data.location_text}</p>}
        {data.notes && <p><b>Notes:</b> {data.notes}</p>}
      </div>
      {/* Render participants, notes, actions, etc. */}
    </Page>
  );
}

function Page({ children }) {
  return <main className="max-w-3xl mx-auto p-4">{children}</main>;
}
function Alert({ children }) {
  return <div className="p-3 rounded bg-gray-100 border">{children}</div>;
}
