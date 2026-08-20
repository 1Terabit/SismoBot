/**
 * Seismic Risk Analysis Workflow
 * Orchestrates the full analysis pipeline using HelpyBot's DAG engine.
 *
 * DAG structure:
 *   collect-data ──┬── b-value-analysis ──┐
 *                  ├── seismicity-rate ────┼── risk-assessment
 *                  └── etas-forecast ──────┘
 */

import {
  WorkflowBuilder,
  WorkflowEngine,
  AgentRegistry,
  ResilienceService,
  EventBus,
} from "./engine";
import { DataCollectorAgent } from "./agents/data-collector.agent";
import { BValueAnalyzerAgent } from "./agents/b-value.agent";
import { SeismicityRateAgent } from "./agents/seismicity-rate.agent";
import { ETASForecasterAgent } from "./agents/etas.agent";
import { RiskAssessorAgent, type RiskAssessmentReport } from "./agents/risk-assessor.agent";
import { PDFReportAgent } from "./agents/pdf-report.agent";
import { logger } from "../utils/logger";

const seismicWorkflow = new WorkflowBuilder("seismic-risk-analysis")
  .step("collect-data", "data-collector")
  .step("b-value-analysis", "b-value-analyzer", { dependsOn: ["collect-data"] })
  .step("seismicity-rate", "seismicity-rate", { dependsOn: ["collect-data"] })
  .step("etas-forecast", "etas-forecaster", { dependsOn: ["collect-data"] })
  .step("risk-assessment", "risk-assessor", {
    dependsOn: ["b-value-analysis", "seismicity-rate", "etas-forecast"],
  })
  .step("pdf-report", "pdf-report", { dependsOn: ["risk-assessment"] })
  .build();

// Singleton instances
let engine: WorkflowEngine | null = null;
let lastReport: RiskAssessmentReport | null = null;
let lastPdfPath: string | null = null;

function createEngine(): WorkflowEngine {
  const registry = new AgentRegistry();
  const resilience = new ResilienceService();
  const eventBus = new EventBus();

  // Register all agents
  registry.register(new DataCollectorAgent());
  registry.register(new BValueAnalyzerAgent());
  registry.register(new SeismicityRateAgent());
  registry.register(new ETASForecasterAgent());
  registry.register(new RiskAssessorAgent());
  registry.register(new PDFReportAgent());

  // Log events for debugging
  eventBus.subscribe((event) => {
    if (event.type.startsWith("agent.")) {
      const payload = event.payload as Record<string, unknown>;
      logger.debug("EVENT", `${event.type}: ${payload.agentName ?? "unknown"}`);
    } else {
      logger.debug("EVENT", `${event.type}`);
    }
  });

  return new WorkflowEngine(registry, resilience, eventBus);
}

/**
 * Run the full seismic risk analysis workflow.
 * Returns the risk assessment report.
 */
export async function runSeismicAnalysis(): Promise<RiskAssessmentReport | null> {
  if (!engine) {
    engine = createEngine();
  }

  const runId = crypto.randomUUID();
  logger.info("ANALYSIS", "═══════════════════════════════════════════");
  logger.info("ANALYSIS", "Starting Seismic Risk Analysis workflow...");
  logger.info("ANALYSIS", `Run ID: ${runId}`);
  logger.info("ANALYSIS", "═══════════════════════════════════════════");

  try {
    const context = await engine.executeWorkflow(seismicWorkflow, runId, "scheduled-analysis");

    const report = context.previousResults["risk-assessment"]?.data as RiskAssessmentReport | undefined;

    if (report) {
      lastReport = report;

      // Extract PDF path if available
      const pdfData = context.previousResults["pdf-report"]?.data as { pdfPath: string } | undefined;
      if (pdfData?.pdfPath) {
        lastPdfPath = pdfData.pdfPath;
      }

      // Log summary
      logger.info("ANALYSIS", "─── Risk Assessment Summary ───");
      for (const assessment of report.assessments) {
        const emoji = { low: "🟢", moderate: "🟡", high: "🟠", critical: "🔴" }[assessment.riskLevel];
        logger.info("ANALYSIS", `${emoji} ${assessment.regionName}: ${assessment.riskLevel.toUpperCase()} (${assessment.riskScore}/100)`);
      }
      logger.info("ANALYSIS", "───────────────────────────────");

      return report;
    } else {
      logger.warn("ANALYSIS", "Workflow completed but no risk report was generated");
      return null;
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    logger.error("ANALYSIS", `Workflow failed: ${errMsg}`);
    return null;
  }
}

/**
 * Get the most recent risk assessment report (cached).
 */
export function getLastReport(): RiskAssessmentReport | null {
  return lastReport;
}

/**
 * Get the path to the most recent PDF report.
 */
export function getLastPdfPath(): string | null {
  return lastPdfPath;
}

/**
 * Start the periodic analysis scheduler.
 * Runs every 6 hours by default.
 */
export function startAnalysisScheduler(intervalMs = 6 * 60 * 60 * 1000): NodeJS.Timeout {
  logger.info("ANALYSIS", `Scheduler started: running every ${intervalMs / (60 * 60 * 1000)}h`);

  // Run immediately on start (delayed 30s to let the bot initialize first)
  setTimeout(() => {
    runSeismicAnalysis().catch((e) => {
      logger.error("ANALYSIS", `Scheduled run failed: ${e}`);
    });
  }, 30_000);

  // Then run periodically
  return setInterval(() => {
    runSeismicAnalysis().catch((e) => {
      logger.error("ANALYSIS", `Scheduled run failed: ${e}`);
    });
  }, intervalMs);
}
