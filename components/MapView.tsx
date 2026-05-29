"use client";

import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

type Place = {
  id: number;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  mapsUrl: string;
};

type MapViewProps = {
  userLat: number;
  userLng: number;
  places: Place[];
};

const userIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function MapView({ userLat, userLng, places }: MapViewProps) {
  return (
    <div className="h-[360px] w-full overflow-hidden rounded-2xl border border-[#2B3350]">
      <MapContainer
        center={[userLat, userLng]}
        zoom={14}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[userLat, userLng]} icon={userIcon}>
          <Popup>You are here 📍</Popup>
        </Marker>

        {places.map((place) => (
          <Marker
            key={`${place.id}-${place.latitude}-${place.longitude}`}
            position={[place.latitude, place.longitude]}
            icon={userIcon}
          >
            <Popup>
              <strong>{place.name}</strong>
              <br />
              {place.type}
              <br />
              <a href={place.mapsUrl} target="_blank">
                Open in Maps
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}