import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const Header = ({ onNavigate, onShowSignIn }) => {
  const { currentUser, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Tennis Match App</h1>
        <div className="flex gap-4">
          <button onClick={() => onNavigate('browse')}>Browse</button>
          <button onClick={() => onNavigate('create')}>Create</button>
          {currentUser ? (
            <button onClick={logout}>Logout</button>
          ) : (
            <button onClick={onShowSignIn}>Sign In</button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
