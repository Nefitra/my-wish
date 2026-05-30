import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type SearchType = "restaurant" | "hotel" | "shop";
type BudgetType = "Any" | "Cheap" | "Medium" | "Premium" | "Luxury";

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    amenity?: string;
    tourism?: string;
    shop?: string;
    cuisine?: string;
  };
};

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getBudgetScore(type: string, budget: BudgetType) {
  if (budget === "Any") return 0;

  const cheapTypes = ["fast_food", "cafe", "convenience", "supermarket"];
  const premiumTypes = ["restaurant", "hotel", "guest_house"];
  const luxuryTypes = ["hotel", "restaurant"];

  if (budget === "Cheap") {
    if (cheapTypes.includes(type)) return 20;
    if (premiumTypes.includes(type)) return -5;
  }

  if (budget === "Medium") {
    if (["restaurant", "cafe", "supermarket"].includes(type)) return 12;
  }

  if (budget === "Premium") {
    if (premiumTypes.includes(type)) return 18;
    if (cheapTypes.includes(type)) return -8;
  }

  if (budget === "Luxury") {
    if (luxuryTypes.includes(type)) return 22;
    if (cheapTypes.includes(type)) return -15;
  }

  return 0;
}

function getBaseWishyScore(
  distance: number,
  hasName: boolean,
  type: string,
  budget: BudgetType
) {
  let score = 40;

  if (distance <= 500) score += 35;
  else if (distance <= 1000) score += 28;
  else if (distance <= 2000) score += 20;
  else if (distance <= 5000) score += 12;
  else score += 5;

  if (hasName) score += 15;

  if (
    ["restaurant", "cafe", "fast_food", "hotel", "hostel", "guest_house"].includes(
      type
    )
  ) {
    score += 10;
  }

  score += getBudgetScore(type, budget);

  return score;
}

function applyRatingScore(baseScore: number, likes: number, dislikes: number) {
  const ratingBoost = likes * 3 - dislikes * 5;
  return Math.max(1, Math.min(baseScore + ratingBoost, 99));
}

export async function POST(request: Request) {
  try {
    const { latitude, longitude, type, budget } = await request.json();

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    const searchType: SearchType = type || "restaurant";
    const selectedBudget: BudgetType = budget || "Any";

    let overpassQuery = "";

    if (searchType === "hotel") {
      overpassQuery = `
        [out:json][timeout:25];
        (
          node["tourism"~"hotel|hostel|guest_house|apartment"](around:8000,${latitude},${longitude});
          way["tourism"~"hotel|hostel|guest_house|apartment"](around:8000,${latitude},${longitude});
          relation["tourism"~"hotel|hostel|guest_house|apartment"](around:8000,${latitude},${longitude});
        );
        out center 20;
      `;
    }

    if (searchType === "shop") {
      overpassQuery = `
        [out:json][timeout:25];
        (
          node["shop"](around:5000,${latitude},${longitude});
          way["shop"](around:5000,${latitude},${longitude});
          relation["shop"](around:5000,${latitude},${longitude});
        );
        out center 20;
      `;
    }

    if (searchType === "restaurant") {
      overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:8000,${latitude},${longitude});
          way["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:8000,${latitude},${longitude});
          relation["amenity"~"restaurant|cafe|fast_food|bar|pub"](around:8000,${latitude},${longitude});
        );
        out center 20;
      `;
    }

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "MyWishApp/1.0",
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (!response.ok) {
      return NextResponse.json({
        type: searchType,
        budget: selectedBudget,
        places: [],
      });
    }

    const data = await response.json();

    const rawPlaces = (data.elements || [])
      .map((item: OverpassElement) => {
        const lat = item.lat || item.center?.lat;
        const lon = item.lon || item.center?.lon;

        if (!lat || !lon) return null;

        const placeType =
          item.tags?.tourism || item.tags?.shop || item.tags?.amenity || searchType;

        const distance = distanceMeters(latitude, longitude, lat, lon);
        const hasName = Boolean(item.tags?.name);
        const placeId = `${item.id}-${lat}-${lon}`;

        return {
          id: item.id,
          placeId,
          name: item.tags?.name || "Unnamed place",
          type: placeType,
          cuisine: item.tags?.cuisine || null,
          latitude: lat,
          longitude: lon,
          distanceMeters: distance,
          baseScore: getBaseWishyScore(distance, hasName, placeType, selectedBudget),
          budget: selectedBudget,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
        };
      })
      .filter(Boolean) as any[];

    const placeIds = rawPlaces.map((place) => place.placeId);

    const { data: ratings } = await supabase
      .from("place_ratings")
      .select("place_id, rating")
      .in("place_id", placeIds);

    const ratingMap = new Map<string, { likes: number; dislikes: number }>();

    (ratings || []).forEach((item) => {
      const current = ratingMap.get(item.place_id) || { likes: 0, dislikes: 0 };

      if (item.rating === 1) current.likes += 1;
      if (item.rating === -1) current.dislikes += 1;

      ratingMap.set(item.place_id, current);
    });

    const places = rawPlaces
      .map((place) => {
        const rating = ratingMap.get(place.placeId) || {
          likes: 0,
          dislikes: 0,
        };

        return {
          ...place,
          likes: rating.likes,
          dislikes: rating.dislikes,
          wishyScore: applyRatingScore(
            place.baseScore,
            rating.likes,
            rating.dislikes
          ),
        };
      })
      .sort((a, b) => b.wishyScore - a.wishyScore)
      .slice(0, 10);

    return NextResponse.json({
      type: searchType,
      budget: selectedBudget,
      places,
    });
  } catch (error) {
    console.error("Nearby API error:", error);

    return NextResponse.json({
      error: "Nearby search failed",
      places: [],
    });
  }
}