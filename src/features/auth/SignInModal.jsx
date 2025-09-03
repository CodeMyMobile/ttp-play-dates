import React from 'react';

const SignInModal = ({ onClose }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div className="bg-white p-4 rounded">
      <p>Sign In Modal Placeholder</p>
      <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Close</button>
    </div>
  </div>
);

export default SignInModal;
