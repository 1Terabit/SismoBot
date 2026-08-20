/**
 * ETASForecasterAgent (Simplified)
 * Implements a simplified ETAS (Epidemic-Type Aftershock Sequence) model.
 *
 * After a significant earthquake (M ≥ 4.0), calculates the probability
 * of aftershocks using the modified Omori law:
 *
 *   λ(t) = K · 10^(α·(M-Mc)) / (t + c)^p
 *
 * Parameters:
 *   K  = productivity (typically 0.01-0.1)
 *   α  = magnitude scaling (typically ~1.0)
 *   c  = time offset (typically 0.01-0.1 days)
 *   p  = decay exponent (typically 1.0-1.3)
 *   Mc = completeness magnitude
 *
 * This is a simplified implementation for educational/awareness purposes.
 * For research-grade forecasting, use the USGS OAF system.
 */

import type { IAgent, AgentContext, AgentResult } from "../engine";
import type { RegionCatalog, CatalogEvent } from "./data-collector.agent";
import { logger } from "../../utils/logger";

export interface AftershockForecast {
  mainshockId: string;
  mainshockMag: number;
  mainshockPlace: string;
  mainshockTime: number;
  regionId: string;
  regionName: string;
  daysSinceMainshock: number;
  // Forecasted aftershock counts for different time windows
  forecast24h: {
    expected: number;   // expected number of aftershocks ≥ Mc
    probM3: number;     // probability of at least one M ≥ 3.0
    probM4: number;     // probability of at least one M ≥ 4.0
    probM5: number;     // probability of at least one M ≥ 5.0
  };
  forecast7d: {
    expected: number;
    probM3: number;
    probM4: number;
    probM5: number;
  };
  message: string;
}

// ETAS parameters (generic values from Reasenberg & Jones, 1989)
const ETAS_PARAMS = {
  K: 0.05,      // Productivity
  alpha: 1.0,   // Magnitude scaling
  c: 0.05,      // Time offset (days)
  p: 1.1,       // Decay exponent
  b: 1.0,       // Gutenberg-Richter b-value (default)
};

// Omori-Utsu rate: expected aftershocks per day at time t (days) after mainshock
function omoriRate(mainshockMag: number, mc: number, t: number): number {
  const { K, alpha, c, p } = ETAS_PARAMS;
  return K * Math.pow(10, alpha * (mainshockMag - mc)) / Math.pow(t + c, p);
}

// Integrate the Omori rate from t1 to t2 (in days) to get expected count
function expectedAftershocks(mainshockMag: number, mc: number, t1: number, t2: number): number {
  // Numerical integration (trapezoidal, 100 steps)
  const steps = 100;
  const dt = (t2 - t1) / steps;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    const t = t1 + i * dt;
    const weight = i === 0 || i === steps ? 0.5 : 1.0;
    sum += weight * omoriRate(mainshockMag, mc, t);
  }
  return sum * dt;
}

// Probability of at least one aftershock ≥ targetMag (using G-R relation)
function probAtLeast(expectedAboveMc: number, targetMag: number, mc: number, bValue: number): number {
  // N(≥M) = N(≥Mc) · 10^(-b·(M - Mc))
  const expectedAboveTarget = expectedAboveMc * Math.pow(10, -bValue * (targetMag - mc));
  // P(≥1) = 1 - e^(-λ) (Poisson)
  return 1 - Math.exp(-expectedAboveTarget);
}

export class ETASForecasterAgent implements IAgent {
  readonly name = "etas-forecaster";
  readonly capabilities = ["aftershock-forecast", "etas-model"];

  canHandle(context: AgentContext): boolean {
    return !!context.previousResults["collect-data"]?.success;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const collectorData = context.previousResults["collect-data"]?.data as {
        catalogs: RegionCatalog[];
      };

      if (!collectorData?.catalogs) {
        return {
          agentName: this.name,
          success: false,
          data: null,
          durationMs: Date.now() - startTime,
          error: "No catalog data available",
        };
      }

      const forecasts: AftershockForecast[] = [];
      const now = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      for (const catalog of collectorData.catalogs) {
        // Find significant mainshocks (M ≥ 4.0) in the last 7 days
        const recentMainshocks = catalog.events
          .filter((e) => e.magnitude >= 4.0 && now - e.time < sevenDaysMs)
          .sort((a, b) => b.magnitude - a.magnitude)
          .slice(0, 5); // Top 5 by magnitude

        const mc = 2.0; // Completeness magnitude for aftershock analysis

        for (const mainshock of recentMainshocks) {
          const daysSince = (now - mainshock.time) / (24 * 60 * 60 * 1000);

          // 24-hour forecast: from now to now+24h
          const expected24h = expectedAftershocks(mainshock.magnitude, mc, daysSince, daysSince + 1);
          const probM3_24h = probAtLeast(expected24h, 3.0, mc, ETAS_PARAMS.b);
          const probM4_24h = probAtLeast(expected24h, 4.0, mc, ETAS_PARAMS.b);
          const probM5_24h = probAtLeast(expected24h, 5.0, mc, ETAS_PARAMS.b);

          // 7-day forecast: from now to now+7d
          const expected7d = expectedAftershocks(mainshock.magnitude, mc, daysSince, daysSince + 7);
          const probM3_7d = probAtLeast(expected7d, 3.0, mc, ETAS_PARAMS.b);
          const probM4_7d = probAtLeast(expected7d, 4.0, mc, ETAS_PARAMS.b);
          const probM5_7d = probAtLeast(expected7d, 5.0, mc, ETAS_PARAMS.b);

          let message = "";
          if (probM4_24h > 0.3) {
            message = `🔴 High aftershock probability near ${mainshock.place}. ${(probM4_24h * 100).toFixed(0)}% chance of M4+ in the next 24h.`;
          } else if (probM3_24h > 0.5) {
            message = `🟡 Moderate aftershock activity expected near ${mainshock.place}. ${(probM3_24h * 100).toFixed(0)}% chance of M3+ in 24h.`;
          } else {
            message = `🟢 Aftershock sequence from M${mainshock.magnitude} near ${mainshock.place} is decaying normally.`;
          }

          forecasts.push({
            mainshockId: mainshock.id,
            mainshockMag: mainshock.magnitude,
            mainshockPlace: mainshock.place,
            mainshockTime: mainshock.time,
            regionId: catalog.region.id,
            regionName: catalog.region.name,
            daysSinceMainshock: Math.round(daysSince * 10) / 10,
            forecast24h: {
              expected: Math.round(expected24h * 10) / 10,
              probM3: Math.round(probM3_24h * 1000) / 1000,
              probM4: Math.round(probM4_24h * 1000) / 1000,
              probM5: Math.round(probM5_24h * 1000) / 1000,
            },
            forecast7d: {
              expected: Math.round(expected7d * 10) / 10,
              probM3: Math.round(probM3_7d * 1000) / 1000,
              probM4: Math.round(probM4_7d * 1000) / 1000,
              probM5: Math.round(probM5_7d * 1000) / 1000,
            },
            message,
          });

          logger.info("ETAS", `${mainshock.place}: M${mainshock.magnitude} (${daysSince.toFixed(1)}d ago) → P(M4+ 24h)=${(probM4_24h * 100).toFixed(1)}%`);
        }
      }

      return {
        agentName: this.name,
        success: true,
        data: { forecasts },
        confidence: 0.7, // Lower confidence — simplified model
        durationMs: Date.now() - startTime,
        metadata: {
          mainshocksAnalyzed: forecasts.length,
          highRiskForecasts: forecasts.filter((f) => f.forecast24h.probM4 > 0.3).length,
        },
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      return {
        agentName: this.name,
        success: false,
        data: null,
        durationMs: Date.now() - startTime,
        error: errMsg,
      };
    }
  }
}
