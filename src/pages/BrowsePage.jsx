import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getMatches } from '../services/matchService';
import { useToast } from '../hooks/useToast.jsx';
import MatchCard from '../components/match/MatchCard';

const BrowsePage = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { displayToast } = useToast();
  const [matches, setMatches] = useState([]);
  const activeFilter = 'my';
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      try {
        const data = await getMatches(activeFilter);
        setMatches(data.matches || []);
      } catch {
        displayToast('Failed to fetch matches', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchMatches();
    } else {
      setMatches([]);
    }
  }, [activeFilter, currentUser, displayToast]);

  const handleCreateClick = () => {
    if (!currentUser) {
      displayToast('Please sign in to create a match', 'error');
    } else {
      onNavigate('create');
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between mb-4">
        <h2 className="text-2xl font-bold">Browse Matches</h2>
        <button onClick={handleCreateClick} className="bg-blue-500 text-white px-4 py-2 rounded">Create Match</button>
      </div>
      {loading ? (
        <p>Loading matches...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches.map(match => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
};

export default BrowsePage;
