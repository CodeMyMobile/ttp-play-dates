import { useEffect, useState } from 'react';
import { listInvites, acceptInvite, rejectInvite } from '../services/invites';
import { Check, X } from 'lucide-react';

const InvitesList = () => {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInvites = async () => {
      try {
        setLoading(true);
        const data = await listInvites();
        setInvites(data.invites || data || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load invites');
      } finally {
        setLoading(false);
      }
    };

    fetchInvites();
  }, []);

  const handleAccept = async (token) => {
    try {
      await acceptInvite(token);
      setInvites((prev) => prev.filter((inv) => inv.token !== token));
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (token) => {
    try {
      await rejectInvite(token);
      setInvites((prev) => prev.filter((inv) => inv.token !== token));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-4">Loading invites...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Invitations</h2>
      {invites.length === 0 ? (
        <p className="text-gray-500">No invites found.</p>
      ) : (
        <ul className="space-y-4">
          {invites.map((invite) => (
            <li
              key={invite.token}
              className="bg-white p-4 rounded-xl shadow flex items-center justify-between"
            >
              <div className="flex-1 mr-4">
                <p className="font-bold text-gray-800">
                  {invite.match?.title || 'Match Invite'}
                </p>
                {invite.match?.start_date_time && (
                  <p className="text-sm text-gray-500">
                    {new Date(invite.match.start_date_time).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReject(invite.token)}
                  className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleAccept(invite.token)}
                  className="p-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InvitesList;
