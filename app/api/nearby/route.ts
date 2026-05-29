import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { latitude, longitude, query } = await request.json();

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Latitude and longitude are required" },
        { status: 400 }
      );
    }

    const searchQuery = query || "restaurant";

    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"~"restaurant|cafe|fast_food"](around:3000,${latitude},${longitude});
        way["amenity"~"restaurant|cafe|fast_food"](around:3000,${latitude},${longitude});
        relation["amenity"~"restaurant|cafe|fast_food"](around:3000,${latitude},${longitude});
      );
      out center 20;
    `;

    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    const data = await response.json();

    const places = (data.elements || [])
      .map((item: any) => {
        const lat = item.lat || item.center?.lat;
        const lon = item.lon || item.center?.lon;

        return {
          id: item.id,
          name: item.tags?.name || "Unnamed place",
          type: item.tags?.amenity || "place",
          cuisine: item.tags?.cuisine || null,
          latitude: lat,
          longitude: lon,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
        };
      })
      .filter((place: any) => place.latitude && place.longitude)
      .slice(0, 10);

    return NextResponse.json({
      query: searchQuery,
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