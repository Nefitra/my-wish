import { NextResponse } from "next/server";

type SearchType = "restaurant" | "hotel" | "shop";

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

function getWishyScore(distance: number, hasName: boolean, type: string) {
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

  return Math.min(score, 99);
}

export async function POST(request: Request) {
  try {
    const { latitude, longitude, type } = await request.json();

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    const searchType: SearchType = type || "restaurant";

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
      return NextResponse.json({ type: searchType, places: [] });
    }

    const data = await response.json();

    const places = (data.elements || [])
      .map((item: OverpassElement) => {
        const lat = item.lat || item.center?.lat;
        const lon = item.lon || item.center?.lon;

        if (!lat || !lon) return null;

        const placeType =
          item.tags?.tourism || item.tags?.shop || item.tags?.amenity || searchType;

        const distance = distanceMeters(latitude, longitude, lat, lon);
        const hasName = Boolean(item.tags?.name);

        return {
          id: item.id,
          name: item.tags?.name || "Unnamed place",
          type: placeType,
          cuisine: item.tags?.cuisine || null,
          latitude: lat,
          longitude: lon,
          distanceMeters: distance,
          wishyScore: getWishyScore(distance, hasName, placeType),
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.wishyScore - a.wishyScore)
      .slice(0, 10);

    return NextResponse.json({
      type: searchType,
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