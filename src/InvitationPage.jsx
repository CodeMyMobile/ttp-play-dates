import { useEffect, useState } from 'react';
import {
  acceptInvite,
  rejectInvite,
  getInviteByToken,
} from './services/invites';
import {
  Calendar,
  MapPin,
  Users,
  ClipboardList,
  Gauge,
  Check,
  X,
} from 'lucide-react';

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

const InvitationPage = ({ token }) => {
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');

  useEffect(() => {
    getInviteByToken(token)
      .then((data) => setInvite(data.invite || data))
      .catch(() => setError('Failed to load invite'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    try {
      await acceptInvite(token);
      setAction('accepted');
    } catch {
      setError('Failed to accept invite');
    }
  };

  const handleReject = async () => {
    try {
      await rejectInvite(token);
      setAction('rejected');
    } catch {
      setError('Failed to reject invite');
    }
  };

  if (loading) return <div className="p-4">Loading invitation...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (!invite) return <div className="p-4">Invitation not found.</div>;

  const { match = {}, inviter = {}, invitee = {} } = invite;
  const skill = formatSkillLevel(match.skill_level_min, match.skill_level_max);

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <div className="bg-green-500 text-white p-4 rounded-xl text-center">
        <p className="font-bold">You're Invited!</p>
        {inviter.full_name && (
          <p className="text-sm">
            {inviter.full_name} has invited {invitee.full_name || 'you'} to join this
            match
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4 space-y-2">
        {match.start_date_time && (
          <p className="text-gray-700 flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(match.start_date_time).toLocaleString()}
          </p>
        )}
        {match.location_text && (
          <p className="text-gray-700 flex items-center gap-1">
            <MapPin className="w-4 h-4" /> {match.location_text}
          </p>
        )}
        {match.match_format && (
          <p className="text-gray-700 flex items-center gap-1">
            <ClipboardList className="w-4 h-4" /> {match.match_format}
          </p>
        )}
        {skill && (
          <p className="text-gray-700 flex items-center gap-1">
            <Gauge className="w-4 h-4" /> Skill level: {skill}
          </p>
        )}
        {match.player_limit && (
          <p className="text-gray-700 flex items-center gap-1">
            <Users className="w-4 h-4" /> Player limit: {match.player_limit}
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        {action === 'accepted' ? (
          <p className="text-green-600 flex items-center gap-1">
            <Check className="w-4 h-4" /> Invitation accepted
          </p>
        ) : action === 'rejected' ? (
          <p className="text-red-600 flex items-center gap-1">
            <X className="w-4 h-4" /> Invitation declined
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50"
            >
              Decline
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl"
            >
              Accept Invitation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitationPage;
