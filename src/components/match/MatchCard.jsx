import React from 'react';

const MatchCard = ({ match }) => (
  <div className="border rounded p-4 bg-white">
    <h3 className="font-bold">{match.location}</h3>
    <p>{new Date(match.dateTime).toLocaleString()}</p>
    <p>{match.format}</p>
  </div>
);

export default MatchCard;
