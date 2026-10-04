import { LocationInput, TransportMode } from "../journeys/types";
import { PlacesProvider, RoutingProvider, Place, RouteResult } from "./types";

// Haversine formula to calculate distance between two coordinates
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

export class MockPlacesProvider implements PlacesProvider {
  async searchPlaces(destination: LocationInput, interests: string[]): Promise<Place[]> {
    if (!destination.coordinates) throw new Error("Coordinates required");
    const { latitude, longitude } = destination.coordinates;
    const places: Place[] = [];
    
    // Dynamically generate places clustered around the requested coordinates
    interests.forEach((interest, index) => {
      // Generate 3 places per interest
      for (let i = 0; i < 3; i++) {
        // Add a random offset (roughly 0 to 5km away from city center)
        const latOffset = (Math.random() - 0.5) * 0.05;
        const lngOffset = (Math.random() - 0.5) * 0.05;
        
        places.push({
          id: `place_${interest}_${i}_${Date.now()}`,
          name: `${interest} Spot ${i + 1} (${destination.name})`,
          location: {
            name: `${interest} Spot`,
            coordinates: { latitude: latitude + latOffset, longitude: longitude + lngOffset }
          },
          category: interest,
          durationMinutes: interest.includes("Food") ? 90 : 120, // Default durations
          priceMinor: Math.floor(Math.random() * 2500), // Random price up to 25.00
        });
      }
    });
    
    return places;
  }
}

export class MockRoutingProvider implements RoutingProvider {
  async getRoute(origin: LocationInput, destination: LocationInput, mode: TransportMode): Promise<RouteResult> {
    if (!origin.coordinates || !destination.coordinates) throw new Error("Coordinates required");
    
    const distanceKm = getDistanceFromLatLonInKm(
      origin.coordinates.latitude, origin.coordinates.longitude,
      destination.coordinates.latitude, destination.coordinates.longitude
    );
    
    // Walking: ~5km/h, Transit: ~20km/h
    const speedKmh = mode === "walking" ? 5 : 20;
    const durationMinutes = Math.ceil((distanceKm / speedKmh) * 60);
    const priceMinor = mode === "walking" ? 0 : Math.ceil(distanceKm * 50); // 0.50 per km for transit
    
    return {
      mode,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      durationMinutes: Math.max(1, durationMinutes),
      priceMinor
    };
  }
}