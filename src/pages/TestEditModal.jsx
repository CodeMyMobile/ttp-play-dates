import React, { useState } from 'react';
import EditMatchModal from '../components/edit-match-modal';
import Header from '../components/Header';

export default function TestEditModal() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playDateId, setPlayDateId] = useState('123');

  const handleClose = () => {
    setIsModalOpen(false);
  };

  const handleSaved = () => {
    console.log('Play date saved successfully');
    // In real app, refresh data or show toast
  };

  return (
    <>
      <Header />
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Edit Match Modal Test</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Play Date ID:
            </label>
            <input
              type="text"
              value={playDateId}
              onChange={(e) => setPlayDateId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              placeholder="Enter play date ID"
            />
          </div>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Open Edit Modal
          </button>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Test Notes:</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            <li>Modal fetches data from GET /playdates/:id</li>
            <li>Changes are sent via PATCH /playdates/:id</li>
            <li>Notification sent to POST /playdates/:id/notify for detail changes</li>
            <li>Detail fields: date, time, duration, location, format, skillLevel, maxPlayers</li>
            <li>ESC key closes modal</li>
            <li>Focus management for accessibility</li>
            <li>Confirmation dialog for unsaved changes</li>
          </ul>
        </div>
      </div>

      <EditMatchModal
        playDateId={playDateId}
        isOpen={isModalOpen}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    </>
  );
}