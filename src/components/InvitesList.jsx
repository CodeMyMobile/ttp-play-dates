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
  Archive,
  AlertCircle,
  Link as LinkIcon,
  MessageCircle,
  Phone,
  Copy,
} from 'lucide-react';

const InvitesList = ({ onInviteResponse }) => {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedToken, setCopiedToken] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    let alive = true;
    const fetchInvites = async () => {
      try {
        setLoading(true);
        setError('');
        const filterParam = activeTab === 'archived' ? 'archieve' : undefined;
        const data = await listInvites({ filter: filterParam });
        if (!alive) return;
        setInvites(data.invites || data || []);
      } catch (err) {
        console.error(err);
        if (!alive) return;
        if (err?.status === 410 || err?.response?.status === 410) {
          setError('Archived invites are unavailable.');
        } else {
          setError('Failed to load invites');
        }
        setInvites([]);
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchInvites();
    return () => {
      alive = false;
    };
  }, [activeTab]);

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
      const errorCode = err?.data?.error || err?.response?.data?.error;
      if (err?.status === 410 || err?.response?.status === 410 || errorCode === 'match_archived') {
        setError('This invite has been archived and can no longer be accepted.');
      }
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
      const errorCode = err?.data?.error || err?.response?.data?.error;
      if (err?.status === 410 || err?.response?.status === 410 || errorCode === 'match_archived') {
        setError('This invite has been archived and can no longer be updated.');
      }
    }
  };

  const handleCopy = async (url, token) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(''), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
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

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Invitations</h2>
      <div className="flex gap-2 mb-4">
        {[
          { id: 'active', label: 'Active' },
          { id: 'archived', label: 'Archived' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              activeTab === tab.id
                ? 'bg-emerald-500 text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="mb-4 text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
      {loading ? (
        <p className="text-gray-500">Loading invites...</p>
      ) : invites.length === 0 ? (
        <p className="text-gray-500">
          {activeTab === 'archived' ? 'No archived invites found.' : 'No invites found.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {invites.map((invite) => {
            const isArchived = invite.match?.status === 'archived';
            const skill = formatSkillLevel(
              invite.match?.skill_level_min,
              invite.match?.skill_level_max,
            );
            const inviteUrl = `${window.location.origin}${import.meta.env.BASE_URL}#/invites/${invite.token}`;
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(inviteUrl)}`;
            const smsUrl = `sms:?&body=${encodeURIComponent(inviteUrl)}`;
            return (
              <li key={invite.token} className="bg-white p-4 rounded-xl shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-1 mr-4">
                    <p className="font-bold text-gray-800">Match Invite</p>
                    {isArchived && (
                      <p className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                        <Archive className="w-3.5 h-3.5" /> Archived match — actions disabled
                      </p>
                    )}
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
                    href={inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    title="Open invite link"
                  >
                    <LinkIcon className="w-4 h-4" />
                  </a>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    title="Share via WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                  <a
                    href={smsUrl}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    title="Share via SMS"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleCopy(inviteUrl, invite.token)}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                    title="Copy invite link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
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
                        disabled={isArchived}
                        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleAccept(invite.token)}
                        disabled={isArchived}
                        className="p-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 break-all">{inviteUrl}</p>
                {copiedToken === invite.token && (
                  <p className="text-xs text-green-600">Link copied!</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default InvitesList;
