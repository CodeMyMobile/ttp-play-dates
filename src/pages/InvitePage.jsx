import React, { useState } from 'react';
import { useToast } from '../hooks/useToast.jsx';
import { searchPlayers, sendInvites } from '../services/matchService';

const InvitePage = ({ matchData, onInviteComplete }) => {
  const { displayToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [players, setPlayers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState(new Set());

  const handleSearch = async () => {
    try {
      const data = await searchPlayers(searchTerm);
      setPlayers(data.players || []);
    } catch {
      displayToast('Search failed', 'error');
    }
  };

  const toggleSelect = (id) => {
    setSelectedPlayers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleSendInvites = async () => {
    try {
      await sendInvites(matchData.id, Array.from(selectedPlayers));
      displayToast('Invites sent successfully!');
      onInviteComplete();
    } catch {
      displayToast('Failed to send invites', 'error');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Invite Players</h2>
      <div className="mb-4">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border p-2 mr-2"
          placeholder="Search players..."
        />
        <button onClick={handleSearch} className="bg-blue-500 text-white px-4 py-2 rounded">Search</button>
      </div>
      <ul className="mb-4">
        {players.map((player) => (
          <li key={player.id}>
            <label>
              <input
                type="checkbox"
                checked={selectedPlayers.has(player.id)}
                onChange={() => toggleSelect(player.id)}
              />
              {player.name}
            </label>
          </li>
        ))}
      </ul>
      <button onClick={handleSendInvites} className="bg-green-500 text-white px-4 py-2 rounded">Send Invites</button>
    </div>
  );
};

export default InvitePage;
