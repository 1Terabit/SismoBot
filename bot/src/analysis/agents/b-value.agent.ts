/**
 * BValueAnalyzerAgent
 * Implements Gutenberg-Richter b-value analysis with anomaly detection.
 *
 * The b-value is the slope of the frequency-magnitude distribution:
 *   log₁₀(N) = a - b·M
 *
 * A DROP in b-value may indicate increasing tectonic stress in a region.
 * We use the Maximum Likelihood Estimation (MLE) method:
 *   b = log₁₀(e) / (M_mean - M_min)
 *
 * where M_mean is the average magnitude above the completeness threshold M_c.
 */

import type { IAgent, AgentContext, AgentResult } from "../engine";
import type { RegionCatalog, CatalogEvent } from "./data-collector.agent";
import { logger } from "../../utils/logger";

export interface BValueResult {
  regionId: string;
  regionName: string;
  currentBValue: number;
  historicalBValue: number;
  deviation: number;     // how many σ from historical mean
  trend: "normal" | "elevated" | "anomalous";
  sampleSize: number;
  completeness: number;  // Mc
  message: string;
}

// Estimate the completeness magnitude (Mc) using the Maximum Curvature method
function estimateCompleteness(magnitudes: number[]): number {
  if (magnitudes.length === 0) return 2.0;

  // Round magnitudes to 0.1 bins
  const bins = new Map<number, number>();
  for (const m of magnitudes) {
    const bin = Math.round(m * 10) / 10;
    bins.set(bin, (bins.get(bin) ?? 0) + 1);
  }

  // Mc = magnitude bin with the most events + 0.2 correction
  let maxCount = 0;
  let mc = 2.0;
  for (const [mag, count] of bins) {
    if (count > maxCount) {
      maxCount = count;
      mc = mag;
    }
  }

  return mc + 0.2; // Standard correction for MaxC method
}

// Calculate b-value using Maximum Likelihood Estimation (Aki, 1965)
function calculateBValue(magnitudes: number[], mc: number): number | null {
  const filtered = magnitudes.filter((m) => m >= mc);
  if (filtered.length < 30) return null; // Not enough data

  const meanMag = filtered.reduce((sum, m) => sum + m, 0) / filtered.length;
  const bValue = Math.LOG10E / (meanMag - (mc - 0.05)); // Δ bin = 0.1

  return Math.max(0.3, Math.min(3.0, bValue)); // Clamp to reasonable range
}

// Calculate standard deviation of b-value (Shi & Bolt, 1982)
function bValueStdDev(magnitudes: number[], mc: number, bValue: number): number {
  const filtered = magnitudes.filter((m) => m >= mc);
  if (filtered.length < 30) return Infinity;

  const n = filtered.length;
  const meanMag = filtered.reduce((sum, m) => sum + m, 0) / n;
  const variance = filtered.reduce((sum, m) => sum + Math.pow(m - meanMag, 2), 0) / (n * (n - 1));

  return 2.3 * bValue * bValue * Math.sqrt(variance);
}

export class BValueAnalyzerAgent implements IAgent {
  readonly name = "b-value-analyzer";
  readonly capabilities = ["gutenberg-richter", "anomaly-detection"];

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
          error: "No catalog data available from DataCollectorAgent",
        };
      }

      const results: BValueResult[] = [];

      for (const catalog of collectorData.catalogs) {
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        // Split into recent (30d) and historical (older)
        const recentEvents = catalog.events.filter((e) => now - e.time < thirtyDaysMs);
        const historicalEvents = catalog.events.filter((e) => now - e.time >= thirtyDaysMs);

        const recentMags = recentEvents.map((e) => e.magnitude);
        const historicalMags = historicalEvents.map((e) => e.magnitude);

        // Estimate completeness from the larger dataset
        const allMags = catalog.events.map((e) => e.magnitude);
        const mc = estimateCompleteness(allMags);

        const currentB = calculateBValue(recentMags, mc);
        const historicalB = calculateBValue(historicalMags, mc);

        if (currentB === null || historicalB === null) {
          logger.debug("BVALUE", `${catalog.region.name}: Insufficient data (recent=${recentMags.length}, historical=${historicalMags.length})`);
          continue;
        }

        // Calculate statistical significance
        const sigma = bValueStdDev(historicalMags, mc, historicalB);
        const deviation = sigma > 0 ? (historicalB - currentB) / sigma : 0;

        let trend: BValueResult["trend"] = "normal";
        let message = "";

        if (deviation > 2.0) {
          trend = "anomalous";
          message = `⚠️ B-value drop of ${(historicalB - currentB).toFixed(2)} detected (${deviation.toFixed(1)}σ). This MAY indicate increasing tectonic stress. Not a prediction.`;
        } else if (deviation > 1.0) {
          trend = "elevated";
          message = `🟡 B-value slightly below baseline (${deviation.toFixed(1)}σ). Monitoring closely.`;
        } else {
          message = `🟢 B-value within normal range.`;
        }

        results.push({
          regionId: catalog.region.id,
          regionName: catalog.region.name,
          currentBValue: Math.round(currentB * 100) / 100,
          historicalBValue: Math.round(historicalB * 100) / 100,
          deviation: Math.round(deviation * 100) / 100,
          trend,
          sampleSize: recentMags.filter((m) => m >= mc).length,
          completeness: mc,
          message,
        });

        logger.info("BVALUE", `${catalog.region.name}: b=${currentB.toFixed(2)} (hist=${historicalB.toFixed(2)}, dev=${deviation.toFixed(1)}σ) → ${trend}`);
      }

      return {
        agentName: this.name,
        success: true,
        data: { results },
        confidence: 0.85,
        durationMs: Date.now() - startTime,
        metadata: {
          regionsAnalyzed: results.length,
          anomalies: results.filter((r) => r.trend === "anomalous").length,
          elevated: results.filter((r) => r.trend === "elevated").length,
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
