import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Matches } from "../lib/api.js";

export default function MatchPage() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Matches.get(id)
      .then(setMatch)
      .catch(() => setError("Not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4">{error}</div>;
  if (!match) return <div className="p-4">Not found</div>;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">{match.title}</h1>
      {match.startsAt && <p>{new Date(match.startsAt).toLocaleString()}</p>}
      {match.host && <p>Hosted by {match.host}</p>}
      {match.accepted && (
        <button className="px-4 py-2 bg-blue-600 text-white rounded">Message host</button>
      )}
    </div>
  );
}
