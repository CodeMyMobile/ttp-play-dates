import React from 'react';

const CreateMatchFlow = ({ onFlowComplete }) => (
  <div className="p-4">
    <h2 className="text-2xl font-bold mb-4">Create Match Flow Placeholder</h2>
    <button onClick={onFlowComplete} className="bg-green-500 text-white px-4 py-2 rounded">Done</button>
  </div>
);

export default CreateMatchFlow;
