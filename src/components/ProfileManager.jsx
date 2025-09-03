import { useState, useEffect } from 'react';
import { getPersonalDetails, updatePersonalDetails } from '../services/auth';

const emptyDetails = {
  full_name: '',
  phone: '',
  profile_picture: '',
  date_of_birth: '',
  usta_rating: 0,
  uta_rating: 0,
};

const ProfileManager = ({ isOpen, onClose }) => {
  const [details, setDetails] = useState(emptyDetails);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchDetails();
    }
  }, [isOpen]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const data = await getPersonalDetails();
      setDetails({
        full_name: data.full_name || '',
        phone: data.phone || '',
        profile_picture: data.profile_picture || '',
        date_of_birth: data.date_of_birth ? data.date_of_birth.split('T')[0] : '',
        usta_rating: data.usta_rating || 0,
        uta_rating: data.uta_rating || 0,
      });
    } catch (err) {
      console.error(err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await updatePersonalDetails(details);
      onClose();
    } catch (err) {
      console.error(err);
      setError('Update failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Player Profile</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ×
          </button>
        </div>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-3">
            <input
              className="w-full border p-2"
              type="text"
              placeholder="Full Name"
              value={details.full_name}
              onChange={(e) => setDetails({ ...details, full_name: e.target.value })}
            />
            <input
              className="w-full border p-2"
              type="text"
              placeholder="Phone"
              value={details.phone}
              onChange={(e) => setDetails({ ...details, phone: e.target.value })}
            />
            <input
              className="w-full border p-2"
              type="text"
              placeholder="Profile Picture URL"
              value={details.profile_picture}
              onChange={(e) => setDetails({ ...details, profile_picture: e.target.value })}
            />
            <input
              className="w-full border p-2"
              type="date"
              value={details.date_of_birth}
              onChange={(e) => setDetails({ ...details, date_of_birth: e.target.value })}
            />
            <input
              className="w-full border p-2"
              type="number"
              placeholder="USTA Rating"
              value={details.usta_rating}
              onChange={(e) => setDetails({ ...details, usta_rating: e.target.value })}
            />
            <input
              className="w-full border p-2"
              type="number"
              placeholder="UTA Rating"
              value={details.uta_rating}
              onChange={(e) => setDetails({ ...details, uta_rating: e.target.value })}
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded border"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-green-600 text-white"
              >
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfileManager;
