import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
You are Wishy, an AI intent router for My Wish app.

Return ONLY valid JSON.

Available categories:
Food, Taxi, Shopping, Gifts, Hotels, Ask Wishy

Available action types:
Food: 🚚 Delivery, 🍽 Restaurant, 🥡 Takeaway
Taxi: ⚡ Ride now, ✈️ Airport, 📅 Schedule ride
Shopping: 🌐 Buy online, 📍 Nearby store, 💸 Compare prices
Gifts: ❤️ Romantic, 👩 For woman, 👨 For man, 👶 For child
Hotels: 🌙 Tonight, 🏖 Weekend, 💶 Cheap, ✨ Luxury

Important:
If user asks for food like sushi, pizza, burger, restaurant, cafe:
- If delivery is clear, choose 🚚 Delivery
- If restaurant/dine-in/nearby is clear, choose 🍽 Restaurant
- If unclear, return action_type null so app asks user to choose.

JSON format:
{
  "category": "Food",
  "action_type": null,
  "confidence": 0.9
}
          `,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Wishy API error:", error);

    return NextResponse.json(
      { error: "Wishy failed to understand the request" },
      { status: 500 }
    );
  }
}