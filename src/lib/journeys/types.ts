export const transportModes = [
  "walking",
  "local_transit",
  "airport_transfer",
  "flight",
  "train",
  "coach",
] as const;

export type TransportMode = (typeof transportModes)[number];
export type SearchMode = Extract<TransportMode, "flight" | "train" | "coach">;
export type OptimiseFor = "price" | "time" | "value" | "scenic";

export type LocationInput = {
  name: string;
  coordinates?: { latitude: number; longitude: number };
};

export type SearchRequest = {
  origin: LocationInput;
  destination: LocationInput;
  departureDate: string;
  returnDate?: string;
  travellers: number;
  currency: string;
  modes?: SearchMode[];
  optimiseFor?: OptimiseFor;
};

export type JourneyLeg = {
  mode: TransportMode;
  origin: string;
  destination: string;
  departureAt?: string;
  arrivalAt?: string;
  durationMinutes: number;
  priceMinor: number;
  currency: string;
  operator?: string;
  serviceNumber?: string;
  bookingUrl?: string;
  isSelfTransfer?: boolean;
  isEstimatedPrice?: boolean;
  details?: Record<string, unknown>;
};

export type Journey = {
  id: string;
  type: "flight" | "train" | "coach" | "mixed";
  legs: JourneyLeg[];
  totalPriceMinor: number;
  currency: string;
  totalDurationMinutes: number;
  totalWaitMinutes: number;
  transferCount: number;
  walkingMinutes: number;
  bookingType: "single_booking" | "multiple_bookings" | "unknown";
  scores: {
    value: number;
    convenience: number;
    scenic: number;
  };
  warnings: string[];
};

export type TransportProvider = {
  name: string;
  mode: SearchMode;
  search(request: SearchRequest): Promise<JourneyLeg[][]>;
};
