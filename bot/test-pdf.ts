import { PDFReportAgent } from "./src/analysis/agents/pdf-report.agent";
import type { RiskAssessmentReport } from "./src/analysis/agents/risk-assessor.agent";
import * as path from "path";
import * as fs from "fs";

const mockReport: RiskAssessmentReport = {
  generatedAt: Date.now(),
  disclaimer: "Reporte generado por IA para pruebas",
  assessments: [
    {
      regionId: "oriente",
      regionName: "Oriente",
      bounds: { minLat: 8, maxLat: 12, minLon: -65, maxLon: -61 },
      riskScore: 85,
      riskLevel: "high",
      summary: "Alta tensión en el sistema de fallas oriental. Posibilidad de réplicas tras el evento principal.",
      updatedAt: Date.now(),
      indicators: {
        bValue: {
          regionId: "oriente",
          regionName: "Oriente",
          currentBValue: 0.72,
          historicalBValue: 1.0,
          deviation: 2.1,
          trend: "anomalous",
          sampleSize: 120,
          completeness: 2.5,
          message: "Valor b bajo, posible aumento de tensión"
        },
        rate: {
          regionId: "oriente",
          regionName: "Oriente",
          currentRate: 15.5,
          historicalRate: 5.0,
          rateRatio: 3.1,
          anomalyType: "swarm",
          significance: 3.2,
          message: "Tasa de sismicidad elevada"
        },
        activeForecasts: [
          {
            mainshockId: "evt_123",
            mainshockMag: 5.2,
            mainshockPlace: "Cariaco",
            mainshockTime: Date.now() - 43200000, // 12 hours ago
            regionId: "oriente",
            regionName: "Oriente",
            daysSinceMainshock: 0.5,
            forecast24h: {
              expected: 8,
              probM3: 0.85,
              probM4: 0.45,
              probM5: 0.12
            },
            forecast7d: {
              expected: 20,
              probM3: 0.95,
              probM4: 0.60,
              probM5: 0.25
            },
            message: "Réplicas activas en la zona"
          }
        ]
      }
    },
    {
      regionId: "occidente",
      regionName: "Occidente",
      bounds: { minLat: 7, maxLat: 11, minLon: -73, maxLon: -69 },
      riskScore: 40,
      riskLevel: "moderate",
      summary: "Actividad base normal. El valor b se mantiene estable dentro del rango histórico.",
      updatedAt: Date.now(),
      indicators: {
        bValue: {
          regionId: "occidente",
          regionName: "Occidente",
          currentBValue: 0.95,
          historicalBValue: 1.0,
          deviation: 0.5,
          trend: "normal",
          sampleSize: 50,
          completeness: 2.0,
          message: "Valor b estable"
        },
        rate: {
          regionId: "occidente",
          regionName: "Occidente",
          currentRate: 3.5,
          historicalRate: 3.0,
          rateRatio: 1.1,
          anomalyType: "normal",
          significance: 0.4,
          message: "Actividad base normal"
        },
        activeForecasts: []
      }
    }
  ]
};

async function testPdf() {
  const agent = new PDFReportAgent();
  const context = {
    workflowId: "test",
    workflowRunId: "test-run-123",
    startTime: Date.now(),
    message: "Generando PDF de prueba",
    metadata: {},
    previousResults: { "risk-assessment": { success: true, data: mockReport, agentName: 'test', durationMs: 0 } },
    state: {}
  };
  
  console.log("Generating PDF...");
  const result = await agent.execute(context);
  console.log("PDF Result:", result);
  
  const resultData = result.data as { pdfPath?: string } | undefined;
  if (resultData?.pdfPath) {
    const finalDest = "/Users/64bits/.gemini/antigravity-ide/brain/f46785bd-242c-4935-b46c-10264f56b464/boletin_sismico_prueba.pdf";
    fs.copyFileSync(resultData.pdfPath, finalDest);
    console.log(`Saved copy to: ${finalDest}`);
  }
}

testPdf().catch(console.error);
