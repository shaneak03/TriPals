import React from 'react';

const mockRecommendations = [
  { id: 1, name: "Haga District Walk", category: "Sightseeing", matchScore: 94, icon: "🏘️" },
  { id: 2, name: "Liseberg Amusement Park", category: "Entertainment", matchScore: 88, icon: "🎢" },
  { id: 3, name: "Universeum Science Centre", category: "Museum", matchScore: 82, icon: "🧬" }
];

export default function RecommendationsList() {
  return (
    <div className="p-6 bg-gray-50 rounded-xl mt-8">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Top Matches For You</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mockRecommendations.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center text-center">
            <div className="text-4xl mb-3">{item.icon}</div>
            <h3 className="font-semibold text-lg text-gray-900">{item.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{item.category}</p>
            <div className="mt-auto bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">
              {item.matchScore}% Match
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}