/**
 * RiskAssessorAgent
 * Aggregates outputs from BValueAnalyzer, SeismicityRate, and ETAS agents
 * into a unified risk score per region.
 *
 * Risk levels:
 *   LOW     (0-25)   — Normal seismic activity
 *   MODERATE (25-50) — Some indicators elevated
 *   HIGH    (50-75)  — Multiple indicators anomalous
 *   CRITICAL (75-100) — Strong convergence of anomalous signals
 *
 * DISCLAIMER: This is a statistical aggregation, NOT an earthquake prediction.
 */

import type { IAgent, AgentContext, AgentResult } from "../engine";
import type { BValueResult } from "./b-value.agent";
import type { RateResult } from "./seismicity-rate.agent";
import type { AftershockForecast } from "./etas.agent";
import { logger } from "../../utils/logger";

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface RegionRiskAssessment {
  regionId: string;
  regionName: string;
  riskScore: number;        // 0-100
  riskLevel: RiskLevel;
  indicators: {
    bValue: BValueResult | null;
    rate: RateResult | null;
    activeForecasts: AftershockForecast[];
  };
  summary: string;
  updatedAt: number;
}

export interface RiskAssessmentReport {
  assessments: RegionRiskAssessment[];
  generatedAt: number;
  disclaimer: string;
}

const DISCLAIMER =
  "⚠️ AVISO: Este análisis se genera mediante modelos estadísticos y datos sísmicos en tiempo real " +
  "provenientes de fuentes oficiales públicas (USGS, EMSC). " +
  "Los terremotos NO se pueden predecir con exactitud. Esta información es puramente referencial. " +
  "Consulte siempre a las autoridades locales de protección civil para alertas oficiales.";

function calculateRiskScore(
  bValue: BValueResult | null,
  rate: RateResult | null,
  forecasts: AftershockForecast[],
): number {
  let score = 0;

  // B-value contribution (max 35 points)
  if (bValue) {
    if (bValue.trend === "anomalous") score += 35;
    else if (bValue.trend === "elevated") score += 15;
  }

  // Seismicity rate contribution (max 30 points)
  if (rate) {
    if (rate.anomalyType === "swarm") score += 25;
    else if (rate.anomalyType === "quiescence") score += 30; // Quiescence can be more concerning
    else if (rate.rateRatio > 1.5) score += 10;
  }

  // ETAS aftershock contribution (max 35 points)
  if (forecasts.length > 0) {
    const maxP4 = Math.max(...forecasts.map((f) => f.forecast24h.probM4));
    const maxP5 = Math.max(...forecasts.map((f) => f.forecast24h.probM5));

    if (maxP5 > 0.1) score += 35;
    else if (maxP4 > 0.3) score += 25;
    else if (maxP4 > 0.1) score += 15;
    else score += 5; // Active sequence but low probability
  }

  return Math.min(100, score);
}

function riskLevel(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

function generateSummary(assessment: RegionRiskAssessment): string {
  const parts: string[] = [];

  const levelEmoji: Record<RiskLevel, string> = {
    low: "🟢",
    moderate: "🟡",
    high: "🟠",
    critical: "🔴",
  };

  parts.push(`${levelEmoji[assessment.riskLevel]} **${assessment.regionName}** — Risk: ${assessment.riskLevel.toUpperCase()} (${assessment.riskScore}/100)`);

  if (assessment.indicators.bValue) {
    parts.push(`  📊 B-value: ${assessment.indicators.bValue.message}`);
  }

  if (assessment.indicators.rate) {
    parts.push(`  📈 Seismicity: ${assessment.indicators.rate.message}`);
  }

  if (assessment.indicators.activeForecasts.length > 0) {
    for (const forecast of assessment.indicators.activeForecasts.slice(0, 2)) {
      parts.push(`  🌊 ${forecast.message}`);
    }
  }

  return parts.join("\n");
}

export class RiskAssessorAgent implements IAgent {
  readonly name = "risk-assessor";
  readonly capabilities = ["risk-aggregation", "report-generation"];

  canHandle(_context: AgentContext): boolean {
    return true; // Always runs — aggregates whatever is available
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // Extract results from previous agents (any may have failed)
      const bValueData = context.previousResults["b-value-analysis"]?.data as
        { results: BValueResult[] } | undefined;
      const rateData = context.previousResults["seismicity-rate"]?.data as
        { results: RateResult[] } | undefined;
      const etasData = context.previousResults["etas-forecast"]?.data as
        { forecasts: AftershockForecast[] } | undefined;

      // Collect all unique region IDs
      const regionIds = new Set<string>();
      const regionNames = new Map<string, string>();

      for (const r of bValueData?.results ?? []) {
        regionIds.add(r.regionId);
        regionNames.set(r.regionId, r.regionName);
      }
      for (const r of rateData?.results ?? []) {
        regionIds.add(r.regionId);
        regionNames.set(r.regionId, r.regionName);
      }
      for (const f of etasData?.forecasts ?? []) {
        regionIds.add(f.regionId);
        regionNames.set(f.regionId, f.regionName);
      }

      const assessments: RegionRiskAssessment[] = [];

      for (const regionId of regionIds) {
        const bValue = bValueData?.results.find((r) => r.regionId === regionId) ?? null;
        const rate = rateData?.results.find((r) => r.regionId === regionId) ?? null;
        const forecasts = etasData?.forecasts.filter((f) => f.regionId === regionId) ?? [];

        const score = calculateRiskScore(bValue, rate, forecasts);
        const level = riskLevel(score);

        const assessment: RegionRiskAssessment = {
          regionId,
          regionName: regionNames.get(regionId) ?? regionId,
          riskScore: score,
          riskLevel: level,
          indicators: { bValue, rate, activeForecasts: forecasts },
          summary: "", // Will be generated below
          updatedAt: Date.now(),
        };

        assessment.summary = generateSummary(assessment);
        assessments.push(assessment);

        logger.info("RISK", `${assessment.regionName}: score=${score} level=${level}`);
      }

      // Sort by risk score (highest first)
      assessments.sort((a, b) => b.riskScore - a.riskScore);

      const report: RiskAssessmentReport = {
        assessments,
        generatedAt: Date.now(),
        disclaimer: DISCLAIMER,
      };

      return {
        agentName: this.name,
        success: true,
        data: report,
        confidence: 0.75,
        durationMs: Date.now() - startTime,
        metadata: {
          regionsAssessed: assessments.length,
          criticalRegions: assessments.filter((a) => a.riskLevel === "critical").length,
          highRiskRegions: assessments.filter((a) => a.riskLevel === "high").length,
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
