/**
 * PDFReportAgent
 * Generates an official, military-style PDF report from the RiskAssessmentReport.
 * Uses pdfmake for server-side PDF generation.
 */

import type { IAgent, AgentContext, AgentResult } from "../engine";
import type { RiskAssessmentReport, RegionRiskAssessment, RiskLevel } from "./risk-assessor.agent";
import { logger } from "../../utils/logger";
import PdfPrinter = require("pdfmake");
import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// We use standard PDF fonts (Helvetica) to avoid shipping TTF files
const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

// @ts-expect-error pdfmake typings don't expose it as a constructable class correctly
const printer = new PdfPrinter(fonts);

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "critical": return "#991b1b"; // dark red
    case "high": return "#ea580c";     // orange
    case "moderate": return "#ca8a04"; // yellow/amber
    case "low": return "#166534";      // dark green
    default: return "#475569";         // slate
  }
}

function getRiskText(level: RiskLevel): string {
  switch (level) {
    case "critical": return "CRÍTICO (ALERTA ROJA)";
    case "high": return "ALTO (ALERTA NARANJA)";
    case "moderate": return "MODERADO (ALERTA AMARILLA)";
    case "low": return "BAJO (NORMAL)";
    default: return "DESCONOCIDO";
  }
}

function buildReportDocument(report: RiskAssessmentReport): TDocumentDefinitions {
  const dateStr = new Date(report.generatedAt).toISOString();
  const dateParts = dateStr.split("T");

  const content: Content[] = [
    // Official Header
    {
      text: "SISMOBOT - DEPARTAMENTO DE ANÁLISIS TECTÓNICO",
      style: "officialHeader",
    },
    {
      text: "BOLETÍN DE INTELIGENCIA SÍSMICA",
      style: "title",
    },
    {
      columns: [
        { text: `FECHA EMISIÓN: ${dateParts[0]}`, style: "metaData" },
        { text: `HORA (ZULU): ${dateParts[1].substring(0, 8)}Z`, style: "metaData", alignment: "right" },
      ],
      margin: [0, 0, 0, 20],
    },
    {
      text: "CLASIFICACIÓN: PÚBLICA / NO CLASIFICADA",
      style: "classification",
      margin: [0, 0, 0, 30],
    },
  ];

  // Global Risk Summary
  const critical = report.assessments.filter((a) => a.riskLevel === "critical").length;
  const high = report.assessments.filter((a) => a.riskLevel === "high").length;
  
  content.push({
    text: "RESUMEN EJECUTIVO",
    style: "sectionHeader",
  });
  
  content.push({
    text: `Análisis procesado para ${report.assessments.length} regiones estratégicas. Se han detectado ${critical} zona(s) en nivel CRÍTICO y ${high} zona(s) en nivel ALTO.`,
    margin: [0, 0, 0, 20],
  });

  // Table per region
  for (const assessment of report.assessments) {
    const tableBody: TableCell[][] = [];

    // Table Header
    tableBody.push([
      { text: "INDICADOR", style: "tableHeader" },
      { text: "VALOR OBSERVADO", style: "tableHeader" },
      { text: "ESTADO / INTERPRETACIÓN", style: "tableHeader" },
    ]);

    // B-Value Row
    if (assessment.indicators.bValue) {
      const b = assessment.indicators.bValue;
      tableBody.push([
        { text: "Valor b (Gutenberg-Richter)" },
        { text: `Actual: ${b.currentBValue}\nBase: ${b.historicalBValue}\nΔ: -${b.deviation}σ` },
        { text: b.message },
      ]);
    }

    // Seismicity Rate Row
    if (assessment.indicators.rate) {
      const r = assessment.indicators.rate;
      tableBody.push([
        { text: "Tasa de Sismicidad (30 días)" },
        { text: `Ratio: ${r.rateRatio}x\nZ-Score: ${r.significance}` },
        { text: r.message },
      ]);
    }

    // ETAS Row(s)
    if (assessment.indicators.activeForecasts.length > 0) {
      for (const etas of assessment.indicators.activeForecasts) {
        tableBody.push([
          { text: `Modelo ETAS\n(Evento: M${etas.mainshockMag} ${etas.mainshockPlace})` },
          { text: `Prob. M4+ (24h): ${(etas.forecast24h.probM4 * 100).toFixed(1)}%\nProb. M5+ (24h): ${(etas.forecast24h.probM5 * 100).toFixed(1)}%` },
          { text: etas.message },
        ]);
      }
    } else {
      tableBody.push([
        { text: "Modelo ETAS (Réplicas)" },
        { text: "Sin eventos mayores recientes" },
        { text: "Secuencia estable." },
      ]);
    }

    content.push({
      text: `ZONA: ${assessment.regionName.toUpperCase()}`,
      style: "regionTitle",
    });

    content.push({
      text: `NIVEL DE RIESGO: ${getRiskText(assessment.riskLevel)}`,
      color: getRiskColor(assessment.riskLevel),
      bold: true,
      margin: [0, 0, 0, 10],
    });

    content.push({
      table: {
        headerRows: 1,
        widths: ["25%", "25%", "50%"],
        body: tableBody,
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 25],
    });
  }

  // Footer Disclaimer
  content.push({
    text: "--- FIN DEL COMUNICADO ---",
    alignment: "center",
    margin: [0, 30, 0, 10],
    bold: true,
  });

  content.push({
    text: report.disclaimer,
    style: "disclaimer",
  });

  return {
    content,
    defaultStyle: {
      font: "Helvetica",
      fontSize: 10,
      color: "#1f2937",
    },
    styles: {
      officialHeader: {
        fontSize: 12,
        bold: true,
        alignment: "center",
        color: "#4b5563",
        margin: [0, 0, 0, 5],
      },
      title: {
        fontSize: 18,
        bold: true,
        alignment: "center",
        color: "#111827",
        margin: [0, 0, 0, 20],
      },
      classification: {
        fontSize: 12,
        bold: true,
        alignment: "center",
        color: "#ef4444",
        background: "#fef2f2",
      },
      metaData: {
        fontSize: 9,
        bold: true,
        color: "#6b7280",
      },
      sectionHeader: {
        fontSize: 14,
        bold: true,
        color: "#111827",
        margin: [0, 15, 0, 10],
        decoration: "underline",
      },
      regionTitle: {
        fontSize: 12,
        bold: true,
        background: "#e5e7eb",
        margin: [0, 0, 0, 5],
      },
      tableHeader: {
        bold: true,
        fontSize: 10,
        color: "#374151",
        fillColor: "#f3f4f6",
      },
      disclaimer: {
        fontSize: 8,
        italics: true,
        color: "#9ca3af",
        alignment: "justify",
      },
    },
    pageMargins: [40, 60, 40, 60],
  };
}

export class PDFReportAgent implements IAgent {
  readonly name = "pdf-report";
  readonly capabilities = ["report-generation", "pdf"];

  canHandle(context: AgentContext): boolean {
    return !!context.previousResults["risk-assessment"]?.success;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const report = context.previousResults["risk-assessment"]?.data as RiskAssessmentReport | undefined;

      if (!report) {
        throw new Error("No risk assessment report available to generate PDF.");
      }

      const docDefinition = buildReportDocument(report);
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      
      const fileName = `sismobot_boletin_${Date.now()}.pdf`;
      const outputPath = path.join(os.tmpdir(), fileName);
      
      logger.info("PDF", `Generating military-style PDF report: ${outputPath}`);

      await new Promise<void>((resolve, reject) => {
        const stream = fs.createWriteStream(outputPath);
        pdfDoc.pipe(stream);
        pdfDoc.end();
        stream.on("finish", resolve);
        stream.on("error", reject);
      });

      return {
        agentName: this.name,
        success: true,
        data: { 
          pdfPath: outputPath, 
          fileName,
          generatedAt: Date.now() 
        },
        confidence: 1.0,
        durationMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      logger.error("PDF", `Failed to generate PDF: ${errMsg}`);
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
