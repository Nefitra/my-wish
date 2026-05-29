import { NextResponse } from "next/server";

type SearchType = "restaurant" | "hotel" | "shop";

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: {
    name?: string;
    amenity?: string;
    tourism?: string;
    shop?: string;
    cuisine?: string;
  };
};

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
          node["tourism"~"hotel|hostel|guest_house|apartment"](around:5000,${latitude},${longitude});
          way["tourism"~"hotel|hostel|guest_house|apartment"](around:5000,${latitude},${longitude});
          relation["tourism"~"hotel|hostel|guest_house|apartment"](around:5000,${latitude},${longitude});
        );
        out center 20;
      `;
    }

    if (searchType === "shop") {
      overpassQuery = `
        [out:json][timeout:25];
        (
          node["shop"](around:3000,${latitude},${longitude});
          way["shop"](around:3000,${latitude},${longitude});
          relation["shop"](around:3000,${latitude},${longitude});
        );
        out center 20;
      `;
    }

    if (searchType === "restaurant") {
      overpassQuery = `
        [out:json][timeout:25];
        (
          node["amenity"~"restaurant|cafe|fast_food"](around:3000,${latitude},${longitude});
          way["amenity"~"restaurant|cafe|fast_food"](around:3000,${latitude},${longitude});
          relation["amenity"~"restaurant|cafe|fast_food"](around:3000,${latitude},${longitude});
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

    const data = await response.json();

    const places = (data.elements || [])
      .map((item: OverpassElement) => {
        const lat = item.lat || item.center?.lat;
        const lon = item.lon || item.center?.lon;

        return {
          id: item.id,
          name: item.tags?.name || "Unnamed place",
          type:
            item.tags?.tourism ||
            item.tags?.shop ||
            item.tags?.amenity ||
            searchType,
          cuisine: item.tags?.cuisine || null,
          latitude: lat,
          longitude: lon,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
        };
      })
      .filter(
        (place: { latitude?: number; longitude?: number }) =>
          place.latitude && place.longitude
      )
      .slice(0, 10);

    return NextResponse.json({
      type: searchType,
      places,
    });
  } catch (error) {
    console.error("Nearby API error:", error);

    return NextResponse.json(
      { error: "Nearby search failed" },
      { status: 500 }
    );
  }
}