import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("trending_places")
      .select("*")
      .order("score", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ places: [] });
    }

    return NextResponse.json({
      places: data || [],
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      places: [],
    });
  }
}