import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';

import Header from './components/common/Header';
import BrowsePage from './pages/BrowsePage';
import CreateMatchFlow from './features/create-match/CreateMatchFlow';
import InvitePage from './pages/InvitePage';
import SignInModal from './features/auth/SignInModal';

function App() {
  // Initialize auth context to ensure consumers update on auth changes
  useAuth();
  const [currentScreen, setCurrentScreen] = useState('browse');
  const [showSignInModal, setShowSignInModal] = useState(false);

  // Placeholder for match data when navigating to invite screen
  const [matchToInvite] = useState(null);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'create':
        return <CreateMatchFlow onFlowComplete={() => setCurrentScreen('browse')} />;
      case 'invite':
        return <InvitePage matchData={matchToInvite} onInviteComplete={() => setCurrentScreen('browse')} />;
      case 'browse':
      default:
        return <BrowsePage onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigate={setCurrentScreen} onShowSignIn={() => setShowSignInModal(true)} />
      {renderScreen()}
      {showSignInModal && <SignInModal onClose={() => setShowSignInModal(false)} />}
    </div>
  );
}

export default App;
