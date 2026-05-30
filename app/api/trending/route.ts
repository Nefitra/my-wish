import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { place_id, place_name, category, action } = await request.json();

    if (!place_id || !place_name || !category || !action) {
      return NextResponse.json(
        { error: "place_id, place_name, category and action are required" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("trending_places")
      .select("*")
      .eq("place_id", place_id)
      .maybeSingle();

    const likeAdd = action === "like" ? 1 : 0;
    const saveAdd = action === "save" ? 1 : 0;
    const openAdd = action === "open" ? 1 : 0;

    if (existing) {
      const likes = (existing.likes || 0) + likeAdd;
      const saves = (existing.saves || 0) + saveAdd;
      const score = (existing.score || 0) + likeAdd * 3 + saveAdd * 5 + openAdd;

      await supabase
        .from("trending_places")
        .update({
          likes,
          saves,
          score,
          updated_at: new Date().toISOString(),
        })
        .eq("place_id", place_id);
    } else {
      await supabase.from("trending_places").insert({
        place_id,
        place_name,
        category,
        likes: likeAdd,
        saves: saveAdd,
        score: likeAdd * 3 + saveAdd * 5 + openAdd,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Trending API error:", error);

    return NextResponse.json(
      { error: "Trending update failed" },
      { status: 500 }
    );
  }
}