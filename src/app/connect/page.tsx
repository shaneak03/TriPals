"use client";

import React, { useState } from 'react';

const INTEREST_TAGS = [
  "Museums", "Nightlife", "Nature", "Foodie", "Hiking", "Photography", "Historical Sites"
];

export default function ConnectPage() {
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [matchFound, setMatchFound] = useState(false);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) => 
      prev.includes(interest) 
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleFindMatches = () => {
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      setMatchFound(true);
    }, 2000);
  };

  return (
    <div className="max-w-2xl mx-auto p-8 font-sans mt-10">
      <h1 className="text-3xl font-bold mb-2">Find Travel Pals</h1>
      <p className="text-gray-500 mb-8">Connect with travelers who share your vibe.</p>
      
      {!matchFound ? (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">What are your trip goals?</h2>
          
          <div className="flex flex-wrap gap-3 mb-8">
            {INTEREST_TAGS.map((interest) => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-4 py-2 rounded-full border font-medium transition-colors ${
                  selectedInterests.includes(interest)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>

          <button 
            onClick={handleFindMatches}
            disabled={selectedInterests.length === 0 || isSearching}
            className="w-full bg-black text-white font-bold py-3 rounded-lg disabled:opacity-30 transition-opacity"
          >
            {isSearching ? 'Calculating Compatibility...' : 'Find Matches'}
          </button>
        </div>
      ) : (
        <div className="bg-green-50 p-8 rounded-xl border border-green-200 text-center animate-pulse duration-1000">
          <div className="text-5xl mb-4">👋</div>
          <h2 className="text-2xl font-bold text-green-900 mb-2">Match Found!</h2>
          <p className="text-green-800 mb-6">
            We found another traveler with a 92% compatibility score in {selectedInterests.join(", ")}!
          </p>
          <button 
            onClick={() => setMatchFound(false)}
            className="bg-green-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-800"
          >
            Say Hello & Start Planning
          </button>
        </div>
      )}
    </div>
  );
}