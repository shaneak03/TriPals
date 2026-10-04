"use client";

import React, { useState } from 'react';
import Link from 'next/link';

// --- TYPES & MOCK DATA ---

type Traveler = {
  id: number;
  name: string;
  age: number;
  country: string;
  destination: string;
  travelDates: string;
  goals: string[];
  styles: string[];
  budget: string;
  bio: string;
  emoji: string;
  likesUser: boolean; // Triggers mutual match
};

const GOALS = ["Museums", "Nightlife", "Nature", "Foodie", "Hiking", "Photography", "Historical Sites", "Live Music"];
const STYLES = ["Adventure", "Relaxation", "Social", "Budget", "Luxury", "Spontaneous", "Planner"];
const BUDGETS = ["Backpacker (€20-40/day)", "Moderate (€50-100/day)", "Comfort (€100-200/day)"];

const MOCK_TRAVELERS: Traveler[] = [
  { id: 1, name: "Alex", age: 22, country: "Germany", destination: "Gothenburg", travelDates: "Oct 18–22", goals: ["Nature", "Hiking", "Photography"], styles: ["Adventure", "Spontaneous"], budget: "Moderate (€50-100/day)", bio: "Avid long-distance runner looking for a buddy to hit the morning trails before exploring the city.", emoji: "🏃", likesUser: true },
  { id: 2, name: "Sarah", age: 24, country: "Singapore", destination: "Gothenburg", travelDates: "Oct 15–25", goals: ["Foodie", "Nature", "Museums"], styles: ["Planner", "Social"], budget: "Moderate (€50-100/day)", bio: "Biomedical engineering grad doing a Scandinavian tour. I love baking blueberry pies and finding the best local cafes.", emoji: "🥧", likesUser: false },
  { id: 3, name: "Emma", age: 23, country: "UK", destination: "Gothenburg", travelDates: "Oct 20–24", goals: ["Nightlife", "Live Music", "Foodie"], styles: ["Social", "Spontaneous"], budget: "Moderate (€50-100/day)", bio: "Here for the indie music scene! Looking for someone to grab drinks and check out local gigs.", emoji: "🎸", likesUser: true },
  { id: 4, name: "Daniel", age: 26, country: "Spain", destination: "Stockholm", travelDates: "Oct 18–26", goals: ["Historical Sites", "Museums", "Photography"], styles: ["Planner", "Relaxation"], budget: "Comfort (€100-200/day)", bio: "History buff and amateur photographer. I like taking my time at museums and enjoying a good glass of wine.", emoji: "📸", likesUser: false },
  { id: 5, name: "Sofia", age: 21, country: "Italy", destination: "Gothenburg", travelDates: "Oct 19–21", goals: ["Foodie", "Nightlife"], styles: ["Social", "Budget"], budget: "Backpacker (€20-40/day)", bio: "Exchange student looking to explore the city on a budget. Let's find the best cheap eats!", emoji: "🍕", likesUser: false },
  { id: 6, name: "Lucas", age: 25, country: "Brazil", destination: "Gothenburg", travelDates: "Oct 10–20", goals: ["Nature", "Hiking"], styles: ["Adventure"], budget: "Backpacker (€20-40/day)", bio: "Just me and my backpack. Looking for tough hiking trails and good views.", emoji: "🥾", likesUser: true },
  { id: 7, name: "Maya", age: 24, country: "USA", destination: "Gothenburg", travelDates: "Oct 17–23", goals: ["Museums", "Historical Sites"], styles: ["Planner", "Comfort"], budget: "Comfort (€100-200/day)", bio: "I have a color-coded spreadsheet for this trip. Seeking a fellow planner to hit all the top landmarks.", emoji: "📋", likesUser: false },
  { id: 8, name: "Noah", age: 27, country: "Canada", destination: "Copenhagen", travelDates: "Oct 18–22", goals: ["Nightlife", "Foodie", "Live Music"], styles: ["Spontaneous", "Social"], budget: "Moderate (€50-100/day)", bio: "Happy to just walk around and see where the day takes us. Coffee addict.", emoji: "☕", likesUser: false },
  { id: 9, name: "Olivia", age: 22, country: "Australia", destination: "Gothenburg", travelDates: "Oct 18–25", goals: ["Photography", "Nature"], styles: ["Relaxation", "Adventure"], budget: "Moderate (€50-100/day)", bio: "Chasing the best autumn lighting. Always down for a scenic ferry ride.", emoji: "🍂", likesUser: true },
  { id: 10, name: "Ethan", age: 25, country: "France", destination: "Gothenburg", travelDates: "Oct 19–23", goals: ["Foodie", "Historical Sites"], styles: ["Luxury", "Planner"], budget: "Comfort (€100-200/day)", bio: "I travel for the food. Already booked two Michelin star restaurants, looking for company.", emoji: "🍷", likesUser: false },
  { id: 11, name: "Lina", age: 23, country: "Sweden", destination: "Gothenburg", travelDates: "Local", goals: ["Nightlife", "Live Music"], styles: ["Social", "Spontaneous"], budget: "Moderate (€50-100/day)", bio: "Local looking to show travelers the hidden gems of the city that tourists usually miss.", emoji: "🇸🇪", likesUser: true },
  { id: 12, name: "Zheng", age: 26, country: "China", destination: "Gothenburg", travelDates: "Oct 15–30", goals: ["Museums", "Photography"], styles: ["Planner", "Adventure"], budget: "Moderate (€50-100/day)", bio: "Hardware engineer attending a tech expo, but hoping to do some rapid prototyping and sightseeing on the weekend.", emoji: "⚙️", likesUser: false },
  { id: 13, name: "Anna", age: 24, country: "Poland", destination: "Gothenburg", travelDates: "Oct 18–21", goals: ["Nature", "Hiking", "Historical Sites"], styles: ["Budget", "Adventure"], budget: "Backpacker (€20-40/day)", bio: "History and nature lover. Looking for walking tours and park picnics.", emoji: "🌳", likesUser: false },
  { id: 14, name: "Leo", age: 22, country: "Netherlands", destination: "Gothenburg", travelDates: "Oct 16–20", goals: ["Nightlife", "Social"], styles: ["Spontaneous", "Social"], budget: "Moderate (€50-100/day)", bio: "Hostel hopper. Let's get a group together for a pub crawl!", emoji: "🍻", likesUser: true },
  { id: 15, name: "Chloe", age: 25, country: "Ireland", destination: "Gothenburg", travelDates: "Oct 18–24", goals: ["Foodie", "Nature", "Photography"], styles: ["Relaxation", "Comfort"], budget: "Comfort (€100-200/day)", bio: "Seeking a relaxing getaway. Spas, good food, and gentle walks by the water.", emoji: "✨", likesUser: false }
];

// --- MAIN COMPONENT ---

export default function ConnectPage() {
  // 1. User Preferences State
  const [destination, setDestination] = useState("Gothenburg");
  const [userGoals, setUserGoals] = useState<string[]>([]);
  const [userStyles, setUserStyles] = useState<string[]>([]);
  const [userBudget, setUserBudget] = useState("");

  // 2. Session & Discovery State
  const [step, setStep] = useState<'form' | 'loading' | 'discovery' | 'end'>('form');
  const [sessionQueue, setSessionQueue] = useState<(Traveler & { score: number; reasons: string[] })[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // 3. Card View State: 'default' | 'profile' | 'sent' | 'matched'
  const [cardState, setCardState] = useState<'default' | 'profile' | 'sent' | 'matched'>('default');

  // --- HELPERS ---

  const toggleArray = (arr: string[], setArr: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setArr(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  };

  const calculateCompatibility = (traveler: Traveler) => {
    let score = 45; // Base score
    const reasons: string[] = [];

    // Destination Match (Heavy weight)
    if (destination && traveler.destination.toLowerCase() === destination.toLowerCase()) {
      score += 25;
      reasons.push("Same destination");
    }

    // Goals Match
    const sharedGoals = traveler.goals.filter(g => userGoals.includes(g));
    if (sharedGoals.length > 0) {
      score += sharedGoals.length * 8;
      reasons.push(`Shared goals: ${sharedGoals.join(", ")}`);
    }

    // Style Match
    const sharedStyles = traveler.styles.filter(s => userStyles.includes(s));
    if (sharedStyles.length > 0) {
      score += sharedStyles.length * 6;
      reasons.push(`Similar travel style`);
    }

    // Budget Match
    if (userBudget && traveler.budget === userBudget) {
      score += 10;
      reasons.push("Matching budget");
    }

    return {
      ...traveler,
      score: Math.min(score, 98), // Cap at 98% for realism
      reasons: reasons.length > 0 ? reasons : ["Looking to explore new places"]
    };
  };

  const startSession = () => {
    setStep('loading');

    setTimeout(() => {
      // 1. Score all travelers
      const scored = MOCK_TRAVELERS.map(calculateCompatibility);
      
      // 2. Bucket into compatibility tiers
      const tier1 = scored.filter(t => t.score >= 90);
      const tier2 = scored.filter(t => t.score >= 80 && t.score < 90);
      const tier3 = scored.filter(t => t.score >= 60 && t.score < 80);

      // 3. Shuffle within tiers to maintain relevance but add randomness
      const shuffle = (arr: any[]) => arr.sort(() => Math.random() - 0.5);
      
      const finalQueue = [...shuffle(tier1), ...shuffle(tier2), ...shuffle(tier3)];
      
      setSessionQueue(finalQueue);
      setCurrentIndex(0);
      setCardState('default');
      setStep('discovery');
    }, 2000);
  };

  const nextTraveler = () => {
    if (currentIndex + 1 >= sessionQueue.length) {
      setStep('end');
    } else {
      setCurrentIndex(prev => prev + 1);
      setCardState('default');
    }
  };

  const handleSayHello = () => {
    const current = sessionQueue[currentIndex];
    if (current.likesUser) {
      setCardState('matched');
    } else {
      setCardState('sent');
    }
  };

  // --- RENDERERS ---

  if (step === 'form') {
    return (
      <div className="max-w-2xl mx-auto p-8 font-sans mt-10">
        <h1 className="text-3xl font-bold mb-2">Find Travel Pals</h1>
        <p className="text-gray-500 mb-8">Set your preferences to find the best matches.</p>
        
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-8">
          <div>
            <h2 className="text-lg font-semibold mb-3">Where are you going?</h2>
            <input 
              type="text" 
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g. Gothenburg"
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Trip Goals</h2>
            <div className="flex flex-wrap gap-2">
              {GOALS.map(goal => (
                <button key={goal} onClick={() => toggleArray(userGoals, setUserGoals, goal)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${userGoals.includes(goal) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                  {goal}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Travel Style</h2>
            <div className="flex flex-wrap gap-2">
              {STYLES.map(style => (
                <button key={style} onClick={() => toggleArray(userStyles, setUserStyles, style)}
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${userStyles.includes(style) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Budget</h2>
            <select 
              value={userBudget} 
              onChange={(e) => setUserBudget(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Select a budget...</option>
              {BUDGETS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <button 
            onClick={startSession}
            disabled={userGoals.length === 0}
            className="w-full bg-black text-white font-bold py-3 rounded-lg disabled:opacity-30 transition-opacity"
          >
            Find Matches
          </button>
        </div>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="max-w-2xl mx-auto p-8 font-sans mt-20 text-center animate-pulse">
        <div className="text-5xl mb-6">🌍</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Finding your travel pals...</h2>
        <p className="text-gray-500">Calculating compatibility scores based on your preferences.</p>
      </div>
    );
  }

  if (step === 'end') {
    return (
      <div className="max-w-2xl mx-auto p-8 font-sans mt-20 text-center">
        <div className="text-5xl mb-6">🌍</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">That's everyone for now!</h2>
        <p className="text-gray-500 mb-8">You've explored all the travel pals matching your current preferences.</p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button onClick={startSession} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
            Start Over
          </button>
          <button onClick={() => setStep('form')} className="bg-white text-gray-800 border border-gray-300 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition">
            Adjust Preferences
          </button>
        </div>
      </div>
    );
  }

  // --- DISCOVERY STEP ---
  const current = sessionQueue[currentIndex];

  return (
    <div className="max-w-md mx-auto p-6 font-sans mt-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Travel Pals</h1>
        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
          {currentIndex + 1} of {sessionQueue.length}
        </span>
      </div>

      {cardState === 'matched' && (
        <div className="bg-green-50 p-8 rounded-xl border border-green-200 text-center mb-6 shadow-sm">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-green-900 mb-2">It's a Match!</h2>
          <p className="text-green-800 mb-8">You and {current.name} both want to explore together.</p>
          <div className="flex flex-col gap-3">
            <button className="w-full bg-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-800 transition">
              Start Chat
            </button>
            <button onClick={nextTraveler} className="w-full bg-white text-green-800 border border-green-300 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition">
              Keep Exploring
            </button>
          </div>
        </div>
      )}

      {cardState === 'sent' && (
        <div className="bg-blue-50 p-8 rounded-xl border border-blue-200 text-center mb-6 shadow-sm">
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-blue-900 mb-2">Interest Sent!</h2>
          <p className="text-blue-800 mb-8">{current.name} will be notified if they are also interested in you.</p>
          <button onClick={nextTraveler} className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
            Next Travel Pal →
          </button>
        </div>
      )}

      {(cardState === 'default' || cardState === 'profile') && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gray-50 p-8 text-center border-b border-gray-100 relative">
            <div className="absolute top-4 right-4 bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">
              {current.score}% Match
            </div>
            <div className="text-6xl mb-4 bg-white w-24 h-24 mx-auto rounded-full flex items-center justify-center shadow-sm border border-gray-200">
              {current.emoji}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Meet {current.name}, {current.age}</h2>
            <p className="text-gray-500 mt-1 font-medium flex items-center justify-center gap-2">
              <span>📍 {current.destination}</span>
              <span>•</span>
              <span>📅 {current.travelDates}</span>
            </p>
          </div>

          <div className="p-6">
            <p className="text-gray-700 italic mb-6">"{current.bio}"</p>
            
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
              <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">Why you match</h3>
              <ul className="space-y-1">
                {current.reasons.map((reason, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-green-500">✓</span> {reason}
                  </li>
                ))}
              </ul>
            </div>

            {cardState === 'profile' && (
              <div className="mb-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">Country</h3>
                  <p className="text-sm text-gray-600">{current.country}</p>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">Interests</h3>
                  <div className="flex flex-wrap gap-2">
                    {current.goals.map(g => <span key={g} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">{g}</span>)}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">Travel Style</h3>
                  <div className="flex flex-wrap gap-2">
                    {current.styles.map(s => <span key={s} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">{s}</span>)}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">Budget</h3>
                  <p className="text-sm text-gray-600">{current.budget}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {cardState === 'default' && (
                <button onClick={() => setCardState('profile')} className="w-full bg-gray-100 text-gray-800 px-4 py-3 rounded-lg font-semibold hover:bg-gray-200 transition">
                  View Profile
                </button>
              )}
              
              <div className="flex gap-3 mt-2">
                <button onClick={nextTraveler} className="flex-1 bg-white border-2 border-gray-200 text-gray-600 px-4 py-3 rounded-lg font-semibold hover:border-gray-300 hover:bg-gray-50 transition">
                  Pass
                </button>
                <button onClick={handleSayHello} className="flex-[2] bg-black text-white px-4 py-3 rounded-lg font-semibold hover:bg-gray-800 transition">
                  Say Hello 👋
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="text-center mt-8">
        <Link href="/" className="text-gray-500 hover:text-gray-900 text-sm font-medium underline underline-offset-4 transition">
          Back to Home
        </Link>
      </div>
    </div>
  );
}