import { useEffect, useState } from 'react';
import { listInvites, acceptInvite, rejectInvite } from '../services/invites';
import {
  Check,
  X,
  Calendar,
  MapPin,
  Users,
  ClipboardList,
  User,
  FileText,
  Gauge,
  Link as LinkIcon,
} from 'lucide-react';

const InvitesList = ({ onInviteResponse }) => {
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
      setInvites((prev) =>
        prev.map((inv) =>
          inv.token === token
            ? { ...inv, accepted: true, rejected: false, status: 'accepted' }
            : inv,
        ),
      );
      onInviteResponse?.();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (token) => {
    try {
      await rejectInvite(token);
      setInvites((prev) =>
        prev.map((inv) =>
          inv.token === token
            ? { ...inv, rejected: true, accepted: false, status: 'rejected' }
            : inv,
        ),
      );
      onInviteResponse?.();
    } catch (err) {
      console.error(err);
    }
  };

  const formatSkillLevel = (min, max) => {
    const minNum = parseFloat(min);
    const maxNum = parseFloat(max);
    if (!Number.isNaN(minNum) && !Number.isNaN(maxNum)) {
      return `${minNum} - ${maxNum}`;
    }
    if (!Number.isNaN(minNum)) return `${minNum}+`;
    if (!Number.isNaN(maxNum)) return `Up to ${maxNum}`;
    return null;
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
          {invites.map((invite) => {
            const skill = formatSkillLevel(
              invite.match?.skill_level_min,
              invite.match?.skill_level_max,
            );
            return (
              <li key={invite.token} className="bg-white p-4 rounded-xl shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-1 mr-4">
                    <p className="font-bold text-gray-800">Match Invite</p>
                    {invite.inviter?.full_name && (
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <User className="w-4 h-4" /> {invite.inviter.full_name}
                      </p>
                    )}
                    {invite.match?.start_date_time && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(invite.match.start_date_time).toLocaleString()}
                      </p>
                    )}
                    {invite.match?.location_text && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> {invite.match.location_text}
                      </p>
                    )}
                    {invite.match?.match_format && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <ClipboardList className="w-4 h-4" /> {invite.match.match_format}
                      </p>
                    )}
                    {skill && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Gauge className="w-4 h-4" /> Skill level: {skill}
                      </p>
                    )}
                    {invite.match?.player_limit && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Users className="w-4 h-4" /> Player limit: {invite.match.player_limit}
                      </p>
                    )}
                    {invite.match?.notes && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <FileText className="w-4 h-4" /> {invite.match.notes}
                      </p>
                    )}
                    {invite.expires_at && (
                      <p className="text-xs text-gray-400">
                        Expires {new Date(invite.expires_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <a
                      href={`${import.meta.env.BASE_URL}invites/${invite.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      title="Open invite link"
                    >
                      <LinkIcon className="w-4 h-4" />
                    </a>
                    {invite.accepted ? (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <Check className="w-4 h-4" /> Accepted
                      </p>
                    ) : invite.rejected ? (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <X className="w-4 h-4" /> Rejected
                      </p>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default InvitesList;
