import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Users, Calendar, Settings, AlertTriangle, Bell, Copy, Share2, Trash2 } from 'lucide-react';
import { getPlayDate, updatePlayDate, notifyPlayDateChange } from '../services/matches';

const NOTIFY_TRIGGER_FIELDS = [
  'date',
  'time',
  'duration',
  'location',
  'format',
  'skillLevel',
  'maxPlayers'
];

const formatOptions = [
  { value: 'singles', label: 'Singles', players: 2 },
  { value: 'doubles', label: 'Doubles', players: 4 },
  { value: 'mixed-doubles', label: 'Mixed Doubles', players: 4 },
  { value: 'round-robin', label: 'Round Robin', players: 6 },
  { value: 'custom', label: 'Custom', players: 'custom' }
];

function classNames(...xs) { return xs.filter(Boolean).join(' '); }

export default function EditMatchModal({ playDateId, isOpen, onClose, onSaved }) {
  const [tab, setTab] = useState('details');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notifyEligible, setNotifyEligible] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [players, setPlayers] = useState([]);
  const originalDataRef = useRef(null);

  const [form, setForm] = useState({
    date: '',
    time: '',
    duration: '2',
    location: '',
    notes: '',
    maxPlayers: 4,
    currentPlayers: 0,
    format: 'doubles',
    skillLevel: '3.5',
    isPublic: true,
    allowWaitlist: true
  });

  const modalRef = useRef(null);

  // API data mapping functions
  const mapIn = useCallback((api) => ({
    date: api.date ?? '',
    time: api.time ?? '',
    duration: String(api.durationHours ?? '2'),
    location: api.location ?? '',
    notes: api.notes ?? '',
    maxPlayers: api.maxPlayers ?? 4,
    currentPlayers: api.currentPlayers ?? 0,
    format: api.format ?? 'doubles',
    skillLevel: api.skillLevel ?? 'any',
    isPublic: api.isPublic ?? true,
    allowWaitlist: api.allowWaitlist ?? true
  }), []);

  const mapOutChanged = useCallback((current, original) => {
    const patch = {};
    Object.keys(current).forEach(key => {
      if (current[key] !== original[key]) {
        if (key === 'duration') {
          patch.durationHours = parseFloat(current.duration);
        } else {
          patch[key] = current[key];
        }
      }
    });
    return patch;
  }, []);

  const detectDetailChanges = useCallback((current, original) => 
    NOTIFY_TRIGGER_FIELDS.filter(f => current[f] !== original[f]), []);

  // Load play date data when modal opens
  useEffect(() => {
    if (!isOpen || !playDateId) return;
    
    let ignore = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPlayDate(playDateId);
        const normalized = mapIn(data);
        
        if (!ignore) {
          originalDataRef.current = normalized;
          setForm(normalized);
          setPlayers(data.players || []);
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load play date');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    
    return () => { ignore = true; };
  }, [isOpen, playDateId, mapIn]);

  // Track notification eligibility
  useEffect(() => {
    if (!originalDataRef.current) return;
    const changedDetails = detectDetailChanges(form, originalDataRef.current);
    setNotifyEligible(changedDetails.length > 0);
  }, [form, detectDetailChanges]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusable = modalRef.current.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      focusable && focusable.focus();
    }
  }, [isOpen, loading]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFormatChange = (value) => {
    const selected = formatOptions.find(f => f.value === value);
    setForm(prev => ({
      ...prev,
      format: value,
      maxPlayers: selected?.players === 'custom' ? prev.maxPlayers : selected?.players || 4
    }));
  };

  const handleRemovePlayer = (playerId) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
    setForm(prev => ({ ...prev, currentPlayers: Math.max(prev.currentPlayers - 1, 0) }));
  };

  const handleSave = async () => {
    if (!originalDataRef.current) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const changes = mapOutChanged(form, originalDataRef.current);
      const changedDetailFields = detectDetailChanges(form, originalDataRef.current);
      
      if (Object.keys(changes).length === 0) {
        onClose?.();
        return;
      }

      // Update play date
      await updatePlayDate(playDateId, changes);

      // Send notification if detail fields changed
      if (changedDetailFields.length > 0) {
        try {
          await notifyPlayDateChange(playDateId, {
            type: 'details_changed',
            fields: changedDetailFields
          });
        } catch (notifyErr) {
          // Non-critical error - don't fail the whole operation
          console.warn('Failed to send notification:', notifyErr);
        }
      }

      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/playdates/${playDateId}`;
    navigator.clipboard.writeText(url).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    });
  };

  const handleShare = () => {
    const url = `${window.location.origin}/playdates/${playDateId}`;
    if (navigator.share) {
      navigator.share({ url, title: 'Tennis Play Date' });
    } else {
      handleCopyLink();
    }
  };

  const handleCancel = () => {
    if (!originalDataRef.current) {
      onClose?.();
      return;
    }
    
    const hasChanges = Object.keys(mapOutChanged(form, originalDataRef.current)).length > 0;
    if (hasChanges) {
      setShowCancelConfirm(true);
    } else {
      onClose?.();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div 
        ref={modalRef}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 id="edit-modal-title" className="text-2xl font-black text-gray-900">
              Edit Play Date
            </h2>
            {notifyEligible && (
              <p className="text-sm text-amber-600 font-semibold mt-1 flex items-center gap-1">
                <Bell className="w-4 h-4" />
                Changes will notify confirmed players
              </p>
            )}
          </div>
          <button
            onClick={handleCancel}
            className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading play date...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 font-semibold">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setTab('details')}
                className={classNames(
                  'flex-1 px-6 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2',
                  tab === 'details'
                    ? 'border-b-2 border-green-600 text-green-600 bg-green-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <Settings className="w-4 h-4" />
                Details
              </button>
              <button
                onClick={() => setTab('players')}
                className={classNames(
                  'flex-1 px-6 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2',
                  tab === 'players'
                    ? 'border-b-2 border-green-600 text-green-600 bg-green-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <Users className="w-4 h-4" />
                Players ({players.length})
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {tab === 'details' ? (
                <div className="space-y-6">
                  {/* Date and Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Date
                      </label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => handleChange('date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Time
                      </label>
                      <input
                        type="time"
                        value={form.time}
                        onChange={(e) => handleChange('time', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Duration and Format */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Duration (hours)
                      </label>
                      <select
                        value={form.duration}
                        onChange={(e) => handleChange('duration', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="1">1 hour</option>
                        <option value="1.5">1.5 hours</option>
                        <option value="2">2 hours</option>
                        <option value="2.5">2.5 hours</option>
                        <option value="3">3 hours</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Format
                      </label>
                      <select
                        value={form.format}
                        onChange={(e) => handleFormatChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        {formatOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => handleChange('location', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter court location..."
                    />
                  </div>

                  {/* Skill Level and Max Players */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Skill Level
                      </label>
                      <select
                        value={form.skillLevel}
                        onChange={(e) => handleChange('skillLevel', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="any">Any Level</option>
                        <option value="2.5">2.5 - Beginner</option>
                        <option value="3.0">3.0 - Beginner+</option>
                        <option value="3.5">3.5 - Intermediate-</option>
                        <option value="4.0">4.0 - Intermediate</option>
                        <option value="4.5">4.5 - Intermediate+</option>
                        <option value="5.0">5.0 - Advanced</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Max Players
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="12"
                        value={form.maxPlayers}
                        onChange={(e) => handleChange('maxPlayers', parseInt(e.target.value) || 2)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => handleChange('notes', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Additional information for players..."
                    />
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={form.isPublic}
                        onChange={(e) => handleChange('isPublic', e.target.checked)}
                        className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Public play date (visible to all players)
                      </span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={form.allowWaitlist}
                        onChange={(e) => handleChange('allowWaitlist', e.target.checked)}
                        className="w-4 h-4 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Allow waitlist when full
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Share Actions */}
                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                    >
                      <Copy className="w-4 h-4" />
                      Copy Link
                    </button>
                    <button
                      onClick={handleShare}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                  </div>

                  {/* Players List */}
                  {players.length > 0 ? (
                    <div className="space-y-2">
                      {players.map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                              {player.initials || player.name?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {player.name || `Player ${player.id}`}
                                {player.isHost && (
                                  <span className="ml-2 text-xs font-bold text-blue-600">(Host)</span>
                                )}
                              </div>
                              {player.ntrp && (
                                <div className="text-sm text-gray-500">NTRP: {player.ntrp}</div>
                              )}
                            </div>
                          </div>
                          {!player.isHost && (
                            <button
                              onClick={() => handleRemovePlayer(player.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              aria-label={`Remove ${player.name || `Player ${player.id}`}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No players have joined yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !originalDataRef.current}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Cancel Confirmation Overlay */}
      {showCancelConfirm && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Discard Changes?</h3>
            <p className="text-gray-600 mb-4">You have unsaved changes. Are you sure you want to close without saving?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Keep Editing
              </button>
              <button
                onClick={() => {
                  setShowCancelConfirm(false);
                  onClose?.();
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}