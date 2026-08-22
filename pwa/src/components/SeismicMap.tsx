import { useEffect, useRef, useState, useMemo } from "react";
import Map, { Source, Layer, Marker, Popup, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { getMagnitudeColor, getMarkerRadius, getShakeClass, getTimeAgo } from "../types";
import type { SeismicEvent } from "../types";
import { useRiskAnalysis } from "../hooks/useRiskAnalysis";
import type { FeatureCollection } from "geojson";

interface SeismicMapProps {
  events: SeismicEvent[];
  selectedEvent: SeismicEvent | null;
  newEventId: string | null;
  alertEventId?: string | null;
}

export function SeismicMap({ events, selectedEvent, newEventId, alertEventId }: SeismicMapProps) {
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFlash, setShowFlash] = useState(false);
  const { report } = useRiskAnalysis();
  const [popupInfo, setPopupInfo] = useState<SeismicEvent | null>(null);

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || "";

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
    if (newEventId && containerRef.current) {
      const event = events.find((e) => e.id === newEventId);
      if (event) {
        const shakeClass = getShakeClass(event.magnitude);
        containerRef.current.classList.add(shakeClass);
        setTimeout(() => {
          containerRef.current?.classList.remove(shakeClass);
        }, 3000);
      }
    }
  }, [newEventId, events]);

  // Fly to selected event from sidebar
  useEffect(() => {
    if (selectedEvent && mapRef.current) {
      mapRef.current.flyTo({
        center: [selectedEvent.lon, selectedEvent.lat],
        zoom: 7,
        duration: 1500,
      });
      // Wait for flyTo to finish before opening popup
      const timer = setTimeout(() => {
        setPopupInfo(selectedEvent);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [selectedEvent]);

  // Convert predictive bounds to GeoJSON polygons
  const riskFeatures = useMemo<FeatureCollection>(() => {
    if (!report?.assessments) return { type: "FeatureCollection", features: [] };
    
    return {
      type: "FeatureCollection",
      features: report.assessments
        .filter((a) => a.bounds) // Ensure bounds exist
        .map((assessment) => {
          const { minLat, maxLat, minLon, maxLon } = assessment.bounds!;
          
          let color = "#fbbf24"; // moderate (yellow)
          let fillOpacity = 0.1;

          if (assessment.riskLevel === "critical") {
            color = "#ef4444"; // red
            fillOpacity = 0.2;
          } else if (assessment.riskLevel === "high") {
            color = "#f97316"; // orange
            fillOpacity = 0.2;
          } else if (assessment.riskLevel === "low") {
            color = "#22c55e"; // green
            fillOpacity = 0.05; // very faint for low risk
          }

          return {
            type: "Feature",
            properties: {
              regionId: assessment.regionId,
              regionName: assessment.regionName,
              riskLevel: assessment.riskLevel,
              riskScore: assessment.riskScore,
              summary: assessment.summary,
              color,
              fillOpacity,
            },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [minLon, minLat],
                  [maxLon, minLat],
                  [maxLon, maxLat],
                  [minLon, maxLat],
                  [minLon, minLat],
                ],
              ],
            },
          };
        }),
    };
  }, [report]);

  return (
    <div ref={containerRef} style={{ height: "100%", width: "100%", position: "relative" }}>
      {showFlash && <div className="screen-flash" />}
      {!MAPBOX_TOKEN && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 1000, background: "rgba(255,0,0,0.8)", color: "white", padding: "10px", borderRadius: "5px" }}>
          ⚠️ No VITE_MAPBOX_TOKEN found. Map may not load.
        </div>
      )}
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: -66.9,
          latitude: 10.5,
          zoom: 3,
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        projection="globe"
        fog={{
          range: [0.8, 8],
          color: "#1e1e1e",
          "high-color": "#0d0d0d",
          "space-color": "#000000",
          "star-intensity": 0.5,
        }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Risk Grid Layer */}
        <Source id="risk-grid" type="geojson" data={riskFeatures}>
          <Layer
            id="risk-fills"
            type="fill"
            paint={{
              "fill-color": ["get", "color"],
              "fill-opacity": ["get", "fillOpacity"],
            }}
          />
          <Layer
            id="risk-lines"
            type="line"
            paint={{
              "line-color": ["get", "color"],
              "line-width": ["match", ["get", "riskLevel"], "critical", 2, 1],
              "line-opacity": 0.8,
            }}
          />
        </Source>

        {events.map((event) => {
          const color = getMagnitudeColor(event.magnitude);
          const radius = getMarkerRadius(event.magnitude);
          const isNew = event.id === newEventId;
          const isAlert = event.id === alertEventId;
          const pxSize = (isAlert ? radius * 1.5 : radius) * 2;

          return (
            <Marker
              key={event.id}
              longitude={event.lon}
              latitude={event.lat}
              anchor="center"
              onClick={(e: any) => {
                e.originalEvent.stopPropagation();
                setPopupInfo(event);
              }}
            >
              <div
                className={`quake-marker ${isNew ? getShakeClass(event.magnitude) : ""} ${isAlert ? "marker-alert-scratch" : ""}`}
                style={{
                  width: `${pxSize}px`,
                  height: `${pxSize}px`,
                  backgroundColor: isAlert ? "#ff0000" : color,
                  opacity: isNew || isAlert ? 0.9 : 0.65,
                  borderRadius: "50%",
                  border: `${isNew || isAlert ? 3 : 2}px solid ${isNew || isAlert ? "#fff" : color}`,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  boxSizing: "border-box",
                }}
              />
            </Marker>
          );
        })}

        {/* Earthquake Popup */}
        {popupInfo && (
          <Popup
            longitude={popupInfo.lon}
            latitude={popupInfo.lat}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
            className="quake-popup-mapbox"
            maxWidth="300px"
          >
            <div className="quake-popup__content">
              <div className="quake-popup__title">
                M{popupInfo.magnitude.toFixed(1)} — {popupInfo.location}
              </div>
              <div className="quake-popup__row">📏 Depth: {popupInfo.depth.toFixed(1)} km</div>
              <div className="quake-popup__row">
                🕐 {new Date(popupInfo.timestamp).toLocaleString("es-VE", { timeZone: "America/Caracas" })} ({getTimeAgo(popupInfo.timestamp)})
              </div>
              <div className="quake-popup__row">📡 {popupInfo.source.toUpperCase()}</div>
              {popupInfo.tsunami && (
                <div className="quake-popup__row" style={{ color: "#3b82f6", fontWeight: 600 }}>
                  🌊 Tsunami warning
                </div>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

