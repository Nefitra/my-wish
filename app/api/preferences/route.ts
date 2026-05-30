import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { session_id, preference_key, preference_value } =
      await request.json();

    if (!session_id || !preference_key || !preference_value) {
      return NextResponse.json(
        { error: "session_id, preference_key and preference_value are required" },
        { status: 400 }
      );
    }

    await supabase.from("user_preferences").insert({
      session_id,
      preference_key,
      preference_value,
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Preferences API error:", error);

    return NextResponse.json(
      { error: "Preference save failed" },
      { status: 500 }
    );
  }
}