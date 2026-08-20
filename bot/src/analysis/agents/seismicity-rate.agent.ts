/**
 * SeismicityRateAgent
 * Monitors background seismicity rates and detects anomalous changes.
 *
 * Compares the current 30-day seismicity rate against the 1-year
 * historical baseline using a Poisson rate ratio test.
 *
 * Unusual INCREASES (swarms) or DECREASES (seismic quiescence)
 * can both be precursory signals, though neither is reliable alone.
 */

import type { IAgent, AgentContext, AgentResult } from "../engine";
import type { RegionCatalog } from "./data-collector.agent";
import { logger } from "../../utils/logger";

export interface RateResult {
  regionId: string;
  regionName: string;
  currentRate: number;     // events per day (last 30 days)
  historicalRate: number;  // events per day (baseline)
  rateRatio: number;       // current / historical
  anomalyType: "normal" | "swarm" | "quiescence";
  significance: number;    // z-score
  message: string;
}

// Poisson Z-test for rate comparison
function poissonZScore(observed: number, expected: number, timeRatio: number): number {
  // expected rate adjusted for the observation window
  const lambda = expected * timeRatio;
  if (lambda <= 0) return 0;
  return (observed - lambda) / Math.sqrt(lambda);
}

export class SeismicityRateAgent implements IAgent {
  readonly name = "seismicity-rate";
  readonly capabilities = ["rate-monitoring", "anomaly-detection"];

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

      const results: RateResult[] = [];

      for (const catalog of collectorData.catalogs) {
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        // Use a consistent magnitude threshold for rate comparison
        const mc = 2.5; // Standard completeness for LATAM

        const recentEvents = catalog.events.filter(
          (e) => now - e.time < thirtyDaysMs && e.magnitude >= mc
        );
        const historicalEvents = catalog.events.filter(
          (e) => now - e.time >= thirtyDaysMs && e.magnitude >= mc
        );

        // Calculate rates (events per day)
        const recentDays = 30;
        const currentRate = recentEvents.length / recentDays;

        // Historical period may vary — calculate actual span
        if (historicalEvents.length < 10) {
          logger.debug("RATE", `${catalog.region.name}: Insufficient historical data`);
          continue;
        }

        const historicalSpanMs = historicalEvents.length > 0
          ? historicalEvents[0].time - historicalEvents[historicalEvents.length - 1].time
          : thirtyDaysMs;
        const historicalDays = Math.max(1, historicalSpanMs / (24 * 60 * 60 * 1000));
        const historicalRate = historicalEvents.length / historicalDays;

        // Rate ratio
        const rateRatio = historicalRate > 0 ? currentRate / historicalRate : 1;

        // Statistical significance (Poisson Z-test)
        const zScore = poissonZScore(recentEvents.length, historicalRate, recentDays);

        let anomalyType: RateResult["anomalyType"] = "normal";
        let message = "";

        if (zScore > 2.5) {
          anomalyType = "swarm";
          message = `🔴 Seismicity rate is ${rateRatio.toFixed(1)}x above baseline (z=${zScore.toFixed(1)}). Possible seismic swarm detected.`;
        } else if (zScore < -2.0) {
          anomalyType = "quiescence";
          message = `🟠 Unusual seismic quiescence detected. Rate is ${(rateRatio * 100).toFixed(0)}% of baseline (z=${zScore.toFixed(1)}). Some studies associate this with stress accumulation.`;
        } else if (zScore > 1.5) {
          message = `🟡 Seismicity rate slightly elevated (${rateRatio.toFixed(1)}x baseline).`;
        } else {
          message = `🟢 Seismicity rate within normal range.`;
        }

        results.push({
          regionId: catalog.region.id,
          regionName: catalog.region.name,
          currentRate: Math.round(currentRate * 100) / 100,
          historicalRate: Math.round(historicalRate * 100) / 100,
          rateRatio: Math.round(rateRatio * 100) / 100,
          anomalyType,
          significance: Math.round(zScore * 100) / 100,
          message,
        });

        logger.info("RATE", `${catalog.region.name}: ${currentRate.toFixed(2)}/day vs ${historicalRate.toFixed(2)}/day (ratio=${rateRatio.toFixed(2)}, z=${zScore.toFixed(1)}) → ${anomalyType}`);
      }

      return {
        agentName: this.name,
        success: true,
        data: { results },
        confidence: 0.8,
        durationMs: Date.now() - startTime,
        metadata: {
          regionsAnalyzed: results.length,
          swarms: results.filter((r) => r.anomalyType === "swarm").length,
          quiescence: results.filter((r) => r.anomalyType === "quiescence").length,
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
