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
      setInvite((prev) => ({ ...prev, status: 'accepted', accepted: true }));
      setAction('accepted');
    } catch {
      setError('Failed to accept invite');
    }
  };

  const handleReject = async () => {
    try {
      await rejectInvite(token);
      setInvite((prev) => ({ ...prev, status: 'rejected', rejected: true }));
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
  const isAccepted = invite.status === 'accepted' || invite.accepted || action === 'accepted';

  const confirmedPlayers = [
    inviter.full_name ? { name: inviter.full_name, role: 'Host' } : null,
  ].filter(Boolean);
  if (isAccepted && invitee.full_name) {
    confirmedPlayers.push({ name: invitee.full_name, role: 'You' });
  }
  const spotsLeft = match.player_limit
    ? Math.max(match.player_limit - confirmedPlayers.length, 0)
    : null;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      {isAccepted ? (
        <div className="bg-green-600 text-white p-4 rounded-xl text-center">
          <p className="font-bold">Match Details</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden">
          <div className="bg-green-600 text-white text-center p-3">
            <p className="font-semibold">Match Invitation</p>
          </div>
          <div className="bg-yellow-50 p-3 text-sm text-center text-gray-700">
            {inviter.full_name ? (
              <span>
                {inviter.full_name} has invited {invitee.full_name || 'you'} to join
                this match
              </span>
            ) : (
              <span>You're invited to join this match</span>
            )}
          </div>
        </div>
      )}

      {/* Date and location */}
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
      </div>

      {/* Match information */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-2">Match Information</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {match.match_format && (
            <p className="flex items-center gap-1">
              <ClipboardList className="w-4 h-4" /> {match.match_format}
            </p>
          )}
          {match.player_limit && (
            <p className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {match.player_limit} Players
            </p>
          )}
          {skill && (
            <p className="flex items-center gap-1">
              <Gauge className="w-4 h-4" /> Skill {skill}
            </p>
          )}
          {spotsLeft !== null && (
            <p className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {spotsLeft} Spots Left
            </p>
          )}
        </div>
      </div>

      {/* Host */}
      {inviter.full_name && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-2">Host</h2>
          <div className="flex items-center justify-between">
            <span>{inviter.full_name}</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
              Host
            </span>
          </div>
        </div>
      )}

      {/* Confirmed players */}
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-2">Confirmed Players</h2>
        <div className="space-y-2">
          {confirmedPlayers.map((p) => (
            <div key={p.name} className="flex items-center justify-between">
              <span>{p.name}</span>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                {p.role}
              </span>
            </div>
          ))}
          {spotsLeft > 0 && (
            <p className="text-sm text-gray-500">{spotsLeft} open spot(s)</p>
          )}
        </div>
      </div>

      {/* Accept / decline */}
      <div className="bg-white rounded-xl shadow p-4">
        {action === 'accepted' || isAccepted ? (
          <p className="text-green-600 flex items-center gap-1">
            <Check className="w-4 h-4" /> Invitation accepted
          </p>
        ) : action === 'rejected' || invite.status === 'rejected' ? (
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

      {/* Location */}
      {match.location_text && (
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold mb-2">Location</h2>
          <p className="text-sm text-gray-700 flex items-center gap-1">
            <MapPin className="w-4 h-4" /> {match.location_text}
          </p>
        </div>
      )}
    </div>
  );
};

export default InvitationPage;
