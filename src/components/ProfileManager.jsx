import { useState, useEffect } from 'react';
import {
  login,
  signup,
  getPersonalDetails,
  updatePersonalDetails,
  logout,
} from '../services/auth';

const emptyDetails = {
  full_name: '',
  phone: '',
  profile_picture: '',
  date_of_birth: '',
  usta_rating: 0,
  uta_rating: 0,
};

const ProfileManager = () => {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '' });
  const [details, setDetails] = useState(emptyDetails);
  const [error, setError] = useState('');

  useEffect(() => {
    if (localStorage.getItem('authToken')) {
      fetchDetails();
    }
  }, []);

  const fetchDetails = async () => {
    try {
      const data = await getPersonalDetails();
      setUser(data);
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
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await signup(form.email, form.password);
      }
      await fetchDetails();
    } catch (err) {
      console.error(err);
      setError('Authentication failed');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await updatePersonalDetails(details);
      await fetchDetails();
    } catch (err) {
      console.error(err);
      setError('Update failed');
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setMode('login');
    setForm({ email: '', password: '' });
    setDetails(emptyDetails);
  };

  if (!user) {
    return (
      <div className="p-4 max-w-md mx-auto">
        <h2 className="text-xl font-bold mb-4">
          {mode === 'login' ? 'Player Login' : 'Player Signup'}
        </h2>
        <form onSubmit={handleAuth} className="space-y-4">
          <input
            className="w-full border p-2"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            className="w-full border p-2"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded"
          >
            {mode === 'login' ? 'Login' : 'Signup'}
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          {mode === 'login' ? (
            <>
              Need an account?{' '}
              <button
                className="text-blue-600"
                onClick={() => setMode('signup')}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                className="text-blue-600"
                onClick={() => setMode('login')}
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Player Profile</h2>
        <button onClick={handleLogout} className="text-sm text-blue-600">
          Logout
        </button>
      </div>
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
        <button
          type="submit"
          className="w-full bg-green-600 text-white p-2 rounded"
        >
          Save
        </button>
      </form>
    </div>
  );
};

export default ProfileManager;
