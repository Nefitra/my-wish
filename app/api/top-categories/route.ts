import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("analytics_events")
      .select("category")
      .not("category", "is", null);

    if (error || !data) {
      return NextResponse.json({ categories: [] });
    }

    const map = new Map<string, number>();

    data.forEach((item) => {
      map.set(item.category, (map.get(item.category) || 0) + 1);
    });

    const categories = Array.from(map.entries())
      .map(([category, count]) => ({
        category,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Top categories error:", error);
    return NextResponse.json({ categories: [] });
  }
}