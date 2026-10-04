import React from 'react';
import RecommendationsList from '@/components/RecommendationsList';

async function getTripData(tripId: string) {
  // Fallback mock data so your UI works before the database tables are built
  if (tripId === '12345') {
    return {
      id: tripId,
      title: "Weekend Archipelago Getaway",
      days: [
        { dayNumber: 1, title: "Arrival", description: "Flight landing in the morning. Pick up rental car and head to the coast." },
        { dayNumber: 2, title: "Island Hopping", description: "Take the ferry out to the southern islands. Seafood dinner at 19:00." },
        { dayNumber: 3, title: "Departure", description: "Return rental car and head to the airport for the afternoon flight." }
      ]
    };
  }
  return null;
}

// 1. Change the type of params to be a Promise
export default async function SharedTripPage({ params }: { params: Promise<{ tripId: string }> }) {
  // 2. Await the params before accessing tripId
  const resolvedParams = await params;
  const tripData = await getTripData(resolvedParams.tripId);

  if (!tripData) {
    return <div className="p-8 text-center text-red-500 font-bold">Trip not found.</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{tripData.title}</h1>
        <p className="text-gray-500">Trip ID Reference: {tripData.id}</p>
        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mt-2">
          View Only
        </span>
      </header>

      <div className="space-y-6 border-l-2 border-gray-200 ml-3 pl-6 mb-12">
        {tripData.days.map((day) => (
          <div key={day.dayNumber} className="relative">
            <div className="absolute -left-[31px] bg-white border-2 border-blue-500 w-4 h-4 rounded-full"></div>
            <h3 className="font-semibold text-lg">Day {day.dayNumber}: {day.title}</h3>
            <p className="text-gray-600 mt-1">{day.description}</p>
          </div>
        ))}
      </div>

      <RecommendationsList />
    </div>
  );
}