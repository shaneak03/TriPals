import { ItineraryRequest, TripItinerary, Place, ItineraryDay, ItineraryActivity, ItineraryTransit } from "./types";
// Note: We will eventually import getRoute from your team's src/lib/routing-api.ts
// import { getRoute } from "../routing-api"; 

// Temporary Haversine fallback until the Python API is fully wired
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function addMinutesToTime(timeStr: string, minsToAdd: number) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes + minsToAdd, 0, 0);
  return date.toTimeString().substring(0, 5);
}

export async function generateItinerary(
  request: ItineraryRequest,
  availablePlaces: Place[] // Fetched via your locations.ts
): Promise<TripItinerary> {
  
  const diffTime = Math.abs(new Date(request.endDate).getTime() - new Date(request.startDate).getTime());
  const numDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const activitiesPerDay = request.pace === "Packed" ? 5 : request.pace === "Relaxed" ? 2 : 3;
  
  const days: ItineraryDay[] = [];
  let totalTripCostMinor = 0;
  const totalBudgetMinor = request.dailyBudget * 100 * numDays;

  const unvisitedPlaces = [...availablePlaces];

  for (let d = 0; d < numDays; d++) {
    const dailyItems: (ItineraryActivity | ItineraryTransit)[] = [];
    let dailyCost = 0;
    let currentTime = "10:00"; 
    
    if (unvisitedPlaces.length === 0) break;
    let currentPlace = unvisitedPlaces.shift()!;
    
    for (let a = 0; a < activitiesPerDay; a++) {
      // 1. Add Activity
      const activityEndTime = addMinutesToTime(currentTime, currentPlace.durationMinutes);
      dailyItems.push({ type: "activity", place: currentPlace, startTime: currentTime, endTime: activityEndTime });
      dailyCost += currentPlace.priceMinor;
      currentTime = activityEndTime;

      // 2. Find closest next place (Nearest Neighbor clustering)
      if (a < activitiesPerDay - 1 && unvisitedPlaces.length > 0) {
        let closestIndex = 0;
        let shortestDist = Infinity;

        for (let i = 0; i < unvisitedPlaces.length; i++) {
          const dist = getDistanceFromLatLonInKm(
            currentPlace.location.coordinates!.latitude, currentPlace.location.coordinates!.longitude,
            unvisitedPlaces[i].location.coordinates!.latitude, unvisitedPlaces[i].location.coordinates!.longitude
          );
          if (dist < shortestDist) {
            shortestDist = dist;
            closestIndex = i;
          }
        }

        const nextPlace = unvisitedPlaces.splice(closestIndex, 1)[0];
        const walkMinutes = Math.max(1, Math.ceil((shortestDist / 5) * 60)); // 5km/h walking speed
        
        // 3. Add Transit
        dailyItems.push({
          type: "transit",
          route: { mode: "walking", distanceKm: shortestDist, durationMinutes: walkMinutes, priceMinor: 0 },
          fromId: currentPlace.id,
          toId: nextPlace.id
        });
        
        currentTime = addMinutesToTime(currentTime, walkMinutes);
        currentPlace = nextPlace;
      }
    }

    days.push({
      dayNumber: d + 1,
      date: new Date(new Date(request.startDate).getTime() + d * 86400000).toISOString().split('T')[0],
      items: dailyItems,
      dailyCostMinor: dailyCost
    });
    totalTripCostMinor += dailyCost;
  }

  const budgetPercentage = (totalTripCostMinor / totalBudgetMinor) * 100;
  
  return {
    destination: request.destination,
    days,
    totalCostMinor: totalTripCostMinor,
    budgetStatus: budgetPercentage > 100 ? "Over Budget" : budgetPercentage > 85 ? "Near Limit" : "Comfortable",
    budgetPercentage: Math.round(budgetPercentage)
  };
}