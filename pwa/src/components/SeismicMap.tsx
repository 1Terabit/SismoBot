import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Rectangle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { getMagnitudeColor, getMarkerRadius, getShakeClass, getTimeAgo } from "../types";
import type { SeismicEvent } from "../types";
import { useRiskAnalysis } from "../hooks/useRiskAnalysis";
import { REGION_BOUNDS } from "../utils/regions";
interface SeismicMapProps {
  events: SeismicEvent[];
  selectedEvent: SeismicEvent | null;
  newEventId: string | null;
  alertEventId?: string | null;
}

function FlyToEvent({ event }: { event: SeismicEvent | null }) {
  const map = useMap();

  useEffect(() => {
    if (event) {
      map.flyTo([event.lat, event.lon], 7, { duration: 1.5 });
    }
  }, [event, map]);

  return null;
}

export function SeismicMap({ events, selectedEvent, newEventId, alertEventId }: SeismicMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<Record<string, any>>({});
  const [showFlash, setShowFlash] = useState(false);
  const { report } = useRiskAnalysis();

  // Screen flash for M6+ new events
  useEffect(() => {
    if (newEventId) {
      const event = events.find((e) => e.id === newEventId);
      if (event && event.magnitude >= 6.0) {
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 2000);
      }
    }
  }, [newEventId, events]);

  // Apply shake to map container for new events
  useEffect(() => {
    if (newEventId && mapRef.current) {
      const event = events.find((e) => e.id === newEventId);
      if (event) {
        const shakeClass = getShakeClass(event.magnitude);
        mapRef.current.classList.add(shakeClass);
        setTimeout(() => {
          mapRef.current?.classList.remove(shakeClass);
        }, 3000);
      }
    }
  }, [newEventId, events]);

  // Open popup when an event is selected from sidebar (after flyTo finishes)
  useEffect(() => {
    if (selectedEvent && markerRefs.current[selectedEvent.id]) {
      // Wait for the 1.5s flyTo animation to finish before opening popup
      const timer = setTimeout(() => {
        const marker = markerRefs.current[selectedEvent.id];
        if (marker && marker.openPopup) {
          marker.openPopup();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [selectedEvent]);

  return (
    <div ref={mapRef} style={{ height: "100%", width: "100%", position: "relative" }}>
      {showFlash && <div className="screen-flash" />}
      <MapContainer
        center={[10.5, -66.9]}
        zoom={3}
        minZoom={2}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%", backgroundColor: "#111" }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          noWrap={true}
        />

        <FlyToEvent event={selectedEvent} />

        {/* Risk Overlays */}
        {report?.assessments.map((assessment) => {
          if (assessment.riskLevel === "low" || assessment.regionName === "all") return null;
          
          const regionKey = Object.keys(REGION_BOUNDS).find((key) => {
             // We need to match the English or Spanish name loosely. 
             // Simplest way is to map the regionName to our keys.
             const nameLower = assessment.regionName.toLowerCase();
             return nameLower.includes(key.toLowerCase()) || 
                    (key === "caribe" && nameLower.includes("carib")) ||
                    (key === "centroamerica" && nameLower.includes("central")) ||
                    (key === "sudamerica" && nameLower.includes("south")) ||
                    (key === "norteamerica" && nameLower.includes("north"));
          }) || assessment.regionName.toLowerCase();

          const bounds = REGION_BOUNDS[regionKey];
          if (!bounds) return null;

          const colorMap = {
            moderate: "#fbbf24", // yellow-400
            high: "#f97316", // orange-500
            critical: "#ef4444", // red-500
          };

          const color = colorMap[assessment.riskLevel as keyof typeof colorMap] || "#fbbf24";
          const isCritical = assessment.riskLevel === "critical";

          return (
            <Rectangle
              key={`risk-${regionKey}`}
              bounds={[
                [bounds.minLat, bounds.minLon],
                [bounds.maxLat, bounds.maxLon],
              ]}
              pathOptions={{
                color,
                weight: isCritical ? 2 : 1,
                fillColor: color,
                fillOpacity: isCritical ? 0.2 : 0.1,
                className: isCritical ? "pulse-critical" : "",
              }}
            >
              <Popup className="quake-popup">
                <div className="quake-popup__title" style={{ color }}>
                  ⚠️ Zona de Riesgo: {assessment.riskLevel.toUpperCase()}
                </div>
                <div className="quake-popup__row" style={{ fontWeight: "bold" }}>
                  {assessment.regionName}
                </div>
                <div className="quake-popup__row">
                  Score de Anomalía: {assessment.riskScore}/100
                </div>
                <hr style={{ borderColor: "#333", margin: "8px 0" }} />
                {assessment.factors.map((factor, idx) => (
                  <div key={idx} className="quake-popup__row" style={{ fontSize: "0.85em", color: "#ccc" }}>
                    • {factor}
                  </div>
                ))}
              </Popup>
            </Rectangle>
          );
        })}

        {events.map((event) => {
          const color = getMagnitudeColor(event.magnitude);
          const radius = getMarkerRadius(event.magnitude);
          const isNew = event.id === newEventId;
          const isAlert = event.id === alertEventId;

          return (
            <CircleMarker
              ref={(m) => {
                if (m) {
                  markerRefs.current[event.id] = m;
                } else {
                  delete markerRefs.current[event.id];
                }
              }}
              key={event.id}
              center={[event.lat, event.lon]}
              radius={isAlert ? radius * 1.5 : radius}
              pathOptions={{
                color: isNew || isAlert ? "#fff" : color,
                fillColor: isAlert ? "#ff0000" : color,
                fillOpacity: isNew || isAlert ? 0.9 : 0.65,
                weight: isNew || isAlert ? 3 : 2,
              }}
              className={`quake-marker ${isNew ? getShakeClass(event.magnitude) : ""} ${isAlert ? "marker-alert-scratch" : ""}`}
            >
              <Popup className="quake-popup">
                <div className="quake-popup__title">
                  M{event.magnitude.toFixed(1)} — {event.location}
                </div>
                <div className="quake-popup__row">📏 Depth: {event.depth.toFixed(1)} km</div>
                <div className="quake-popup__row">
                  🕐 {new Date(event.timestamp).toLocaleString("es-VE", { timeZone: "America/Caracas" })} ({getTimeAgo(event.timestamp)})
                </div>
                <div className="quake-popup__row">📡 {event.source.toUpperCase()}</div>
                {event.tsunami && (
                  <div className="quake-popup__row" style={{ color: "#3b82f6", fontWeight: 600 }}>
                    🌊 Tsunami warning
                  </div>
                )}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
