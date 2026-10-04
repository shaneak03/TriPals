import type { JourneyLeg, SearchRequest, TransportProvider } from "./types";

// Temporary adapters. Replace each search method with a real provider call later.
const localAccess = (request: SearchRequest, departureHub: string, arrivalHub: string): JourneyLeg[] => [
  {
    mode: "local_transit",
    origin: `${request.origin.name} city centre`,
    destination: departureHub,
    durationMinutes: 45,
    priceMinor: 1500,
    currency: request.currency,
    operator: "Local transit",
    isEstimatedPrice: true,
  },
  {
    mode: "airport_transfer",
    origin: arrivalHub,
    destination: `${request.destination.name} city centre`,
    durationMinutes: 50,
    priceMinor: 1300,
    currency: request.currency,
    operator: "Airport transfer",
    isEstimatedPrice: true,
  },
];

export const demoFlightProvider: TransportProvider = {
  name: "Demo flight provider",
  mode: "flight",
  async search(request) {
    return [[
      ...localAccess(request, "London Heathrow", "Milan Linate"),
    ].flatMap((leg, index) => index === 0
      ? [leg, {
          mode: "flight",
          origin: "London Heathrow",
          destination: "Milan Linate",
          durationMinutes: 120,
          priceMinor: 4500,
          currency: request.currency,
          operator: "Demo Airways",
          serviceNumber: "TP101",
          isEstimatedPrice: true,
          details: { provider: "demo-flight" },
        }]
      : [leg])];
  },
};

export const demoTrainProvider: TransportProvider = {
  name: "Demo rail provider",
  mode: "train",
  async search(request) {
    return [[
      {
        mode: "train",
        origin: `${request.origin.name} city centre`,
        destination: `${request.destination.name} city centre`,
        durationMinutes: 510,
        priceMinor: 9800,
        currency: request.currency,
        operator: "Demo Rail",
        isEstimatedPrice: true,
        details: { provider: "demo-rail" },
      },
    ]];
  },
};

export const demoCoachProvider: TransportProvider = {
  name: "Demo coach provider",
  mode: "coach",
  async search(request) {
    return [[
      {
        mode: "coach",
        origin: `${request.origin.name} city centre`,
        destination: `${request.destination.name} city centre`,
        durationMinutes: 720,
        priceMinor: 4200,
        currency: request.currency,
        operator: "Demo Coach",
        isEstimatedPrice: true,
        details: { provider: "demo-coach" },
      },
    ]];
  },
};
