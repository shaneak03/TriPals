import { LocationInput, TransportMode } from "../journeys/types";

export type Pace = "Relaxed" | "Balanced" | "Packed";

export type ItineraryRequest = {
  destination: LocationInput;
  startDate: string;
  endDate: string;
  interests: string[];
  pace: Pace;
  dailyBudget: number; 
  currency: string;
};

export type Place = {
  id: string;
  name: string;
  location: LocationInput;
  category: string;
  durationMinutes: number;
  priceMinor: number; 
};

export type RouteResult = {
  mode: TransportMode;
  distanceKm: number;
  durationMinutes: number;
  priceMinor: number;
  polyline?: string; // For Stella's map to draw the route
};

export type ItineraryActivity = {
  type: "activity";
  place: Place;
  startTime: string;
  endTime: string;
};

export type ItineraryTransit = {
  type: "transit";
  route: RouteResult;
  fromId: string;
  toId: string;
};

export type ItineraryDay = {
  dayNumber: number;
  date: string;
  items: (ItineraryActivity | ItineraryTransit)[];
  dailyCostMinor: number;
};

export type TripItinerary = {
  destination: LocationInput;
  days: ItineraryDay[];
  totalCostMinor: number;
  budgetStatus: "Comfortable" | "Near Limit" | "Over Budget";
  budgetPercentage: number;
};  