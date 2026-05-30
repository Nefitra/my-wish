import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { place_id, rating } = await request.json();

    if (!place_id || !rating) {
      return NextResponse.json(
        { error: "place_id and rating are required" },
        { status: 400 }
      );
    }

    if (![1, -1].includes(rating)) {
      return NextResponse.json(
        { error: "rating must be 1 or -1" },
        { status: 400 }
      );
    }

    await supabase.from("place_ratings").insert({
      place_id: String(place_id),
      rating,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Rate place error:", error);

    return NextResponse.json(
      { error: "Rating failed" },
      { status: 500 }
    );
  }
}