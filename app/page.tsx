"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { intents } from "@/data/intents";

type Card = {
  emoji: string;
  title: string;
  subtitle: string;
  options: string[];
};

type Service = {
  id: number;
  category: string;
  action_type: string;
  name: string;
  emoji: string;
  description: string;
  url: string;
  priority: number;
  active: boolean;
};

type WishyResult = {
  category: string;
  action_type: string | null;
  confidence: number;
};

type NearbyPlace = {
  id: number;
  name: string;
  type: string;
  cuisine: string | null;
  latitude: number;
  longitude: number;
  mapsUrl: string;
};

type RecentWish = {
  id: number;
  wish_text: string;
  category: string | null;
};

export default function Home() {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [recentWishes, setRecentWishes] = useState<RecentWish[]>([]);
  const [wishText, setWishText] = useState("");
  const [loading, setLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [locationReady, setLocationReady] = useState(false);

  const cards: Card[] = [
    { emoji: "🍔", title: "Food", subtitle: "Delivery or restaurant", options: ["🚚 Delivery", "🍽 Restaurant", "🥡 Takeaway"] },
    { emoji: "🚕", title: "Taxi", subtitle: "Ride anywhere", options: ["⚡ Ride now", "✈️ Airport", "📅 Schedule ride"] },
    { emoji: "🛍", title: "Shopping", subtitle: "Buy online or nearby", options: ["🌐 Buy online", "📍 Nearby store", "💸 Compare prices"] },
    { emoji: "🎁", title: "Gifts", subtitle: "Find perfect ideas", options: ["❤️ Romantic", "👩 For woman", "👨 For man", "👶 For child"] },
    { emoji: "🏨", title: "Hotels", subtitle: "Stay tonight", options: ["🌙 Tonight", "🏖 Weekend", "💶 Cheap", "✨ Luxury"] },
    { emoji: "💬", title: "Ask Wishy", subtitle: "AI instant help", options: ["Ask anything"] },
  ];

  const getSessionId = () => {
    const existing = localStorage.getItem("wishy_session_id");
    if (existing) return existing;

    const sessionId = crypto.randomUUID();
    localStorage.setItem("wishy_session_id", sessionId);
    return sessionId;
  };

  const trackEvent = async (
    eventType: string,
    category?: string,
    actionType?: string,
    serviceName?: string,
    wish?: string
  ) => {
    try {
      await supabase.from("analytics_events").insert({
        event_type: eventType,
        category: category || null,
        action_type: actionType || null,
        service_name: serviceName || null,
        wish_text: wish || null,
      });
    } catch (error) {
      console.error("Analytics error:", error);
    }
  };

  const saveWish = async (wish: string, category?: string) => {
    try {
      const sessionId = getSessionId();

      await supabase.from("user_wishes").insert({
        session_id: sessionId,
        wish_text: wish,
        category: category || null,
      });

      await loadRecentWishes();
    } catch (error) {
      console.error("Wish save error:", error);
    }
  };

  const loadRecentWishes = async () => {
    try {
      const sessionId = getSessionId();

      const { data, error } = await supabase
        .from("user_wishes")
        .select("id, wish_text, category")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        console.error("Recent wishes error:", error);
        return;
      }

      setRecentWishes(data || []);
    } catch (error) {
      console.error("Recent wishes load error:", error);
    }
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported on this device");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const sessionId = getSessionId();

        localStorage.setItem("wishy_lat", latitude.toString());
        localStorage.setItem("wishy_lng", longitude.toString());

        await supabase.from("user_locations").insert({
          session_id: sessionId,
          latitude,
          longitude,
        });

        await trackEvent("location_connected", undefined, undefined, undefined, `${latitude},${longitude}`);

        setLocationReady(true);
        alert("Location connected 📍");
      },
      (error) => {
        console.error("Location error:", error);
        alert("Location permission denied");
      }
    );
  };

  useEffect(() => {
    const savedLat = localStorage.getItem("wishy_lat");
    const savedLng = localStorage.getItem("wishy_lng");

    if (savedLat && savedLng) setLocationReady(true);

    loadRecentWishes();
  }, []);

  useEffect(() => {
    async function loadNearbyPlaces() {
      const shouldSearchNearby =
        locationReady &&
        selectedCard &&
        selectedOption &&
        ((selectedCard.title === "Food" && selectedOption === "🍽 Restaurant") ||
          selectedCard.title === "Hotels" ||
          (selectedCard.title === "Shopping" && selectedOption === "📍 Nearby store"));

      if (!shouldSearchNearby) {
        setNearbyPlaces([]);
        return;
      }

      const latitude = localStorage.getItem("wishy_lat");
      const longitude = localStorage.getItem("wishy_lng");

      if (!latitude || !longitude) return;

      let nearbyType = "restaurant";
      if (selectedCard.title === "Hotels") nearbyType = "hotel";
      if (selectedCard.title === "Shopping") nearbyType = "shop";

      setNearbyLoading(true);

      try {
        const response = await fetch("/api/nearby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: Number(latitude),
            longitude: Number(longitude),
            type: nearbyType,
          }),
        });

        const data = await response.json();
        setNearbyPlaces(data.places || []);
      } catch (error) {
        console.error("Nearby places error:", error);
        setNearbyPlaces([]);
      } finally {
        setNearbyLoading(false);
      }
    }

    loadNearbyPlaces();
  }, [selectedCard, selectedOption, locationReady]);

  useEffect(() => {
    async function loadServices() {
      if (!selectedCard || !selectedOption || selectedCard.title === "Ask Wishy") return;

      setLoading(true);

      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("category", selectedCard.title)
        .eq("action_type", selectedOption)
        .eq("active", true)
        .order("priority", { ascending: true });

      if (error) {
        console.error("Supabase error:", error);
        setServices([]);
      } else {
        const unique = Array.from(
          new Map((data || []).map((item) => [item.name, item])).values()
        );

        setServices(unique as Service[]);
      }

      setLoading(false);
    }

    loadServices();
  }, [selectedCard, selectedOption]);

  const openCard = (category: string, actionType: string | null = null) => {
    const matchedCard = cards.find((card) => card.title === category);

    if (!matchedCard) {
      const askWishy = cards.find((card) => card.title === "Ask Wishy");
      setSelectedCard(askWishy || null);
      setSelectedOption("Ask anything");
      trackEvent("category_opened", "Ask Wishy", "Ask anything");
      return;
    }

    trackEvent("category_opened", category, actionType || undefined);

    setSelectedCard(matchedCard);
    setSelectedOption(actionType);
    setServices([]);
    setNearbyPlaces([]);
  };

  const detectIntent = async () => {
    const text = wishText.toLowerCase().trim();

    if (!text) return;

    await trackEvent("wish_submitted", undefined, undefined, undefined, text);

    const foundIntent = intents.find((intent) =>
      intent.keywords.some((keyword) => text.includes(keyword))
    );

    if (foundIntent) {
      await saveWish(text, foundIntent.category);

      const deliveryWords = ["delivery", "deliver", "order", "доставка", "заказать"];
      const restaurantWords = ["restaurant", "nearby", "dine", "dine-in", "eat out", "ресторан", "покушать", "рядом"];
      const takeawayWords = ["takeaway", "take away", "pickup", "pick up", "самовывоз"];
      const airportWords = ["airport", "аэропорт"];
      const nearbyStoreWords = ["nearby store", "shop nearby", "магазин рядом", "рядом магазин"];

      if (foundIntent.category === "Food") {
        if (deliveryWords.some((word) => text.includes(word))) return openCard("Food", "🚚 Delivery");
        if (restaurantWords.some((word) => text.includes(word))) return openCard("Food", "🍽 Restaurant");
        if (takeawayWords.some((word) => text.includes(word))) return openCard("Food", "🥡 Takeaway");
        return openCard("Food", null);
      }

      if (foundIntent.category === "Taxi") {
        if (airportWords.some((word) => text.includes(word))) return openCard("Taxi", "✈️ Airport");
        return openCard("Taxi", null);
      }

      if (foundIntent.category === "Shopping") {
        if (nearbyStoreWords.some((word) => text.includes(word))) return openCard("Shopping", "📍 Nearby store");
        return openCard("Shopping", null);
      }

      return openCard(foundIntent.category, null);
    }

    try {
      setAiLoading(true);

      const response = await fetch("/api/wishy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: wishText }),
      });

      const data: WishyResult = await response.json();

      if (data?.category) {
        await saveWish(text, data.category);
        openCard(data.category, data.action_type);
      } else {
        await saveWish(text, "Ask Wishy");
        openCard("Ask Wishy", "Ask anything");
      }
    } catch (error) {
      console.error("Wishy AI error:", error);
      await saveWish(text, "Ask Wishy");
      openCard("Ask Wishy", "Ask anything");
    } finally {
      setAiLoading(false);
    }
  };

  const resetFlow = () => {
    setSelectedCard(null);
    setSelectedOption(null);
    setServices([]);
    setNearbyPlaces([]);
  };

  const getNearbyTitle = () => {
    if (selectedCard?.title === "Hotels") return "📍 Hotels near you";
    if (selectedCard?.title === "Shopping") return "📍 Stores near you";
    return "📍 Restaurants near you";
  };

  const runRecentWish = (wish: string) => {
    setWishText(wish);
    setTimeout(() => detectIntent(), 50);
  };

  return (
    <main className="min-h-screen bg-[#0B0F1A] text-white px-5 py-6 max-w-md mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">My Wish ✨</h1>
        <p className="text-gray-400 mt-2">What do you wish right now?</p>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={wishText}
          onChange={(event) => setWishText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") detectIntent();
          }}
          placeholder="Tell Wishy what you want..."
          className="w-full bg-[#151A2D] border border-[#22293D] rounded-2xl px-5 py-4 outline-none text-white placeholder-gray-500 focus:border-violet-500 transition"
        />

        <button
          onClick={detectIntent}
          disabled={aiLoading}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 transition rounded-2xl px-5 font-semibold"
        >
          {aiLoading ? "..." : "Go"}
        </button>
      </div>

      {aiLoading && <p className="text-gray-400 text-sm mb-4">Wishy is thinking...</p>}

      <div className="mb-6">
        <button
          onClick={requestLocation}
          className={`w-full rounded-2xl py-4 font-semibold transition ${
            locationReady
              ? "bg-green-600 hover:bg-green-500"
              : "bg-[#151A2D] border border-[#22293D] hover:border-violet-500"
          }`}
        >
          {locationReady ? "📍 Location Connected" : "📍 Use My Location"}
        </button>
      </div>

      {recentWishes.length > 0 && (
        <div className="mb-8">
          <p className="text-gray-400 text-sm mb-3">Recent Wishes</p>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {recentWishes.map((wish) => (
              <button
                key={wish.id}
                onClick={() => runRecentWish(wish.wish_text)}
                className="shrink-0 bg-[#151A2D] border border-[#22293D] rounded-full px-4 py-2 text-sm hover:border-violet-500 transition"
              >
                {wish.wish_text}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => (
          <button
            key={card.title}
            onClick={() => {
              trackEvent("category_opened", card.title);
              setSelectedCard(card);
              setSelectedOption(null);
              setServices([]);
              setNearbyPlaces([]);
            }}
            className="text-left bg-[#151A2D] border border-[#22293D] rounded-3xl p-5 cursor-pointer transition hover:scale-[1.03] hover:border-violet-500"
          >
            <div className="text-4xl mb-4">{card.emoji}</div>
            <h2 className="text-xl font-semibold">{card.title}</h2>
            <p className="text-gray-400 text-sm mt-2">{card.subtitle}</p>
          </button>
        ))}
      </div>

      {selectedCard && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
          <div className="w-full max-w-md bg-[#151A2D] rounded-t-3xl p-6 border-t border-[#2B3350] max-h-[85vh] overflow-y-auto">
            <div className="w-14 h-1 bg-gray-600 rounded-full mx-auto mb-6" />

            {!selectedOption && (
              <>
                <h2 className="text-2xl font-bold mb-2">
                  {selectedCard.emoji} {selectedCard.title}
                </h2>

                <p className="text-gray-400 mb-5">Choose what you want to do:</p>

                <div className="space-y-3">
                  {selectedCard.options.map((option, index) => (
                    <button
                      key={option}
                      onClick={() => {
                        setSelectedOption(option);
                        trackEvent("action_selected", selectedCard.title, option);
                      }}
                      className={`w-full transition rounded-2xl py-4 font-semibold ${
                        index === 0
                          ? "bg-violet-600 hover:bg-violet-500"
                          : "bg-[#1E263D] hover:bg-[#2A3555]"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}

            {selectedOption && selectedCard.title !== "Ask Wishy" && (
              <>
                <button
                  onClick={() => {
                    setSelectedOption(null);
                    setServices([]);
                    setNearbyPlaces([]);
                  }}
                  className="text-gray-400 hover:text-white mb-4"
                >
                  ← Back
                </button>

                <h2 className="text-2xl font-bold mb-2">
                  {selectedCard.emoji} {selectedOption}
                </h2>

                <p className="text-gray-400 mb-5">Best options for you:</p>

                {locationReady &&
                  ((selectedCard.title === "Food" && selectedOption === "🍽 Restaurant") ||
                    selectedCard.title === "Hotels" ||
                    (selectedCard.title === "Shopping" && selectedOption === "📍 Nearby store")) && (
                    <>
                      {nearbyLoading && <p className="text-gray-400">Wishy is searching nearby places...</p>}

                      {!nearbyLoading && nearbyPlaces.length > 0 && (
                        <div className="mb-6 space-y-3">
                          <p className="text-green-400 font-semibold">{getNearbyTitle()}</p>

                          {nearbyPlaces.map((place) => (
                            <div
                              key={`${place.id}-${place.latitude}-${place.longitude}`}
                              className="bg-[#0B0F1A] border border-[#2B3350] rounded-2xl p-4"
                            >
                              <h3 className="font-bold text-lg">{place.name}</h3>

                              <p className="text-gray-400 text-sm mt-1">
                                {place.cuisine ? `${place.type} · ${place.cuisine}` : place.type}
                              </p>

                              <a
                                href={place.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() =>
                                  trackEvent("nearby_place_opened", selectedCard.title, selectedOption, place.name)
                                }
                                className="block mt-4 text-center bg-green-600 hover:bg-green-500 transition rounded-xl py-3 font-semibold"
                              >
                                Open in Maps
                              </a>
                            </div>
                          ))}
                        </div>
                      )}

                      {!nearbyLoading && nearbyPlaces.length === 0 && (
                        <p className="text-gray-400 mb-4">No nearby places found. Showing general services.</p>
                      )}
                    </>
                  )}

                {loading && <p className="text-gray-400">Wishy is searching...</p>}

                {!loading && services.length === 0 && (
                  <p className="text-gray-400">No services found yet. Add them in Supabase.</p>
                )}

                <div className="space-y-3">
                  {services.map((service) => (
                    <div key={service.id} className="bg-[#0B0F1A] border border-[#2B3350] rounded-2xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-3xl">{service.emoji}</div>

                        <div className="flex-1">
                          <h3 className="font-bold text-lg">{service.name}</h3>
                          <p className="text-gray-400 text-sm mt-1">{service.description}</p>

                          <a
                            href={service.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              trackEvent("service_opened", service.category, service.action_type, service.name)
                            }
                            className="block mt-4 text-center bg-violet-600 hover:bg-violet-500 transition rounded-xl py-3 font-semibold"
                          >
                            Open Service
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {selectedCard.title === "Ask Wishy" && selectedOption && (
              <>
                <h2 className="text-2xl font-bold mb-3">💬 Ask Wishy</h2>

                <input
                  type="text"
                  value={wishText}
                  onChange={(event) => setWishText(event.target.value)}
                  placeholder="Ask Wishy anything..."
                  className="w-full bg-[#0B0F1A] border border-[#2B3350] rounded-2xl px-5 py-4 outline-none text-white placeholder-gray-500 focus:border-violet-500 transition"
                />

                <p className="text-gray-500 text-sm mt-4">
                  AI connection is active as fallback intent router.
                </p>
              </>
            )}

            <button onClick={resetFlow} className="mt-6 w-full text-gray-400 hover:text-white transition">
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}