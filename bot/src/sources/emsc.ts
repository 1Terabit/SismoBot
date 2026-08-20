import WebSocket from "ws";
import { SeismicEvent, SeismicProvider, SeismicEventHandler } from "./types";
import { logger } from "../utils/logger";

/**
 * EMSC (European-Mediterranean Seismological Centre) provider.
 * Uses the SeismicPortal WebSocket for zero-latency real-time push events.
 */

interface EMSCWebSocketMessage {
  action: string;
  data: {
    type: string;
    geometry: {
      type: string;
      coordinates: [number, number, number]; // [lon, lat, depth]
    };
    properties: {
      unid: string;
      mag: number;
      flynn_region: string;
      time: string;
      auth: string;
    };
    id: string;
  };
}

const EMSC_WS_URL = "wss://www.seismicportal.eu/standing_order/websocket";

export class EMSCProvider implements SeismicProvider {
  readonly name = "emsc" as const;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private handler: SeismicEventHandler | null = null;

  start(onNewEvent: SeismicEventHandler): void {
    this.handler = onNewEvent;
    this.connect();
  }

  private connect(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
    }

    logger.info("EMSC", `Connecting to WebSocket: ${EMSC_WS_URL}`);
    this.ws = new WebSocket(EMSC_WS_URL);

    this.ws.on("open", () => {
      logger.info("EMSC", "WebSocket connected. Real-time push active.");
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      try {
        const message = JSON.parse(data.toString()) as EMSCWebSocketMessage;
        
        // We only care about create or update actions
        if (message.action !== "create" && message.action !== "update") {
          return;
        }

        const feature = message.data;
        if (!feature || !feature.geometry || !feature.properties) return;

        const [lon, lat, depth] = feature.geometry.coordinates;

        const event = this.normalize(message);
        
        // Emit event to the main handler
        if (this.handler) {
          this.handler([event]);
        }
      } catch (err) {
        logger.error("EMSC", "Error parsing WebSocket message", err);
      }
    });

    this.ws.on("close", () => {
      logger.warn("EMSC", "WebSocket closed. Reconnecting in 5s...");
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      logger.error("EMSC", "WebSocket error", err);
      this.ws?.close();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }

  private normalize(msg: EMSCWebSocketMessage): SeismicEvent {
    const props = msg.data.properties;
    const [lon, lat, depth] = msg.data.geometry.coordinates;

    return {
      id: props.unid ?? `emsc-${props.time}`,
      magnitude: props.mag,
      lat,
      lon,
      depth: Math.abs(depth), // Depth sometimes comes as negative in GeoJSON
      location: props.flynn_region ?? "Unknown location",
      timestamp: new Date(props.time).getTime(),
      source: "emsc",
    };
  }
}
