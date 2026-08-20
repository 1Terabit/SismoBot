/**
 * PDFReportAgent
 * Generates an official, military-style PDF report from the RiskAssessmentReport.
 * Uses pdfmake for server-side PDF generation.
 */

import type { IAgent, AgentContext, AgentResult } from "../engine";
import type { RiskAssessmentReport, RegionRiskAssessment, RiskLevel } from "./risk-assessor.agent";
import { logger } from "../../utils/logger";
import pdfmake = require("pdfmake");
import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

// We use standard PDF fonts (Helvetica) to avoid shipping TTF files
const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const i18n = {
  es: {
    dept: "SISMOBOT - DEPARTAMENTO DE ANÁLISIS TECTÓNICO",
    title: "BOLETÍN DE INTELIGENCIA SÍSMICA",
    date: "FECHA EMISIÓN",
    time: "HORA (ZULU)",
    classification: "CLASIFICACIÓN: PÚBLICA / NO CLASIFICADA",
    executiveSummary: "RESUMEN EJECUTIVO",
    summaryText: (total: number, critical: number, high: number) => `Análisis procesado para ${total} regiones estratégicas. Se han detectado ${critical} zona(s) en nivel CRÍTICO y ${high} zona(s) en nivel ALTO.`,
    indicator: "INDICADOR",
    observedValue: "VALOR OBSERVADO",
    statusInterpretation: "ESTADO / INTERPRETACIÓN",
    bValue: "Valor b (Gutenberg-Richter)",
    actual: "Actual",
    base: "Base",
    deviation: "Desviación",
    seismicityRate: "Tasa de Sismicidad (30 días)",
    significance: "Significancia",
    etasModel: "Modelo ETAS",
    etasEvent: "Evento",
    probM4: "Prob. M4+ (24h)",
    probM5: "Prob. M5+ (24h)",
    etasReplica: "Modelo ETAS (Réplica)",
    noMajorEvents: "Sin eventos mayores recientes",
    stableSequence: "Secuencia estable.",
    zone: "ZONA",
    riskLevel: "NIVEL DE RIESGO",
    endReport: "--- FIN DEL COMUNICADO ---",
    legendTitle: "ANEXO A: LEYENDA Y GLOSARIO TÉCNICO",
    legendBValueTitle: "Valor b (Gutenberg-Richter): ",
    legendBValueText: "Es un indicador de la tensión tectónica. Normalmente ronda el valor de 1.0. Si baja significativamente (Desviación negativa), significa que hay menos sismos pequeños y más energía acumulándose, indicando un posible aumento de la tensión y probabilidad de un sismo mayor.\n\n",
    legendRateTitle: "Tasa de Sismicidad: ",
    legendRateText: "Mide la cantidad de sismos recientes (30 días) frente al promedio histórico. Un 'Ratio' de 2.0x significa el doble de sismos. La 'Significancia' indica qué tan inusual es estadísticamente este cambio.\n\n",
    legendETASTitle: "Modelo ETAS (Réplicas): ",
    legendETASText: "Es un modelo epidémico que calcula la probabilidad de réplicas en las próximas 24 horas después de un evento sísmico importante (el evento 'Base'). 'Prob. M4+' significa la probabilidad de tener una réplica de magnitud 4 o superior.\n\n",
    legendRiskLevels: "Niveles de Riesgo:\n",
    legendLowText: "Actividad dentro de los parámetros normales de la región.\n",
    legendModerateText: "Se observan anomalías estadísticas aisladas; requiere monitoreo.\n",
    legendHighText: "Múltiples indicadores anómalos o una secuencia de réplicas muy activa.\n",
    legendCriticalText: "Convergencia de anomalías fuertes indicando muy alta tensión en la zona.\n",
    page: "Página",
    of: "de",
    riskCritical: "CRÍTICO (ALERTA ROJA)",
    riskHigh: "ALTO (ALERTA NARANJA)",
    riskModerate: "MODERADO (ALERTA AMARILLA)",
    riskLow: "BAJO (NORMAL)",
    disclaimer: "⚠️ AVISO: Este análisis se genera mediante modelos estadísticos y datos sísmicos en tiempo real provenientes de fuentes oficiales públicas (USGS, EMSC, FUNVISIS). Los terremotos NO se pueden predecir con exactitud. Esta información es puramente referencial. Consulte siempre a las autoridades locales de protección civil para alertas oficiales.",
    lowBadge: "[BAJO]: ",
    moderateBadge: "[MODERADO]: ",
    highBadge: "[ALTO]: ",
    criticalBadge: "[CRÍTICO]: "
  },
  en: {
    dept: "SISMOBOT - TECTONIC ANALYSIS DEPARTMENT",
    title: "SEISMIC INTELLIGENCE BULLETIN",
    date: "ISSUE DATE",
    time: "TIME (ZULU)",
    classification: "CLASSIFICATION: PUBLIC / UNCLASSIFIED",
    executiveSummary: "EXECUTIVE SUMMARY",
    summaryText: (total: number, critical: number, high: number) => `Analysis processed for ${total} strategic regions. Detected ${critical} zone(s) at CRITICAL level and ${high} zone(s) at HIGH level.`,
    indicator: "INDICATOR",
    observedValue: "OBSERVED VALUE",
    statusInterpretation: "STATUS / INTERPRETATION",
    bValue: "b-Value (Gutenberg-Richter)",
    actual: "Current",
    base: "Baseline",
    deviation: "Deviation",
    seismicityRate: "Seismicity Rate (30 days)",
    significance: "Significance",
    etasModel: "ETAS Model",
    etasEvent: "Event",
    probM4: "Prob. M4+ (24h)",
    probM5: "Prob. M5+ (24h)",
    etasReplica: "ETAS Model (Aftershocks)",
    noMajorEvents: "No recent major events",
    stableSequence: "Stable sequence.",
    zone: "ZONE",
    riskLevel: "RISK LEVEL",
    endReport: "--- END OF REPORT ---",
    legendTitle: "ANNEX A: LEGEND AND TECHNICAL GLOSSARY",
    legendBValueTitle: "b-Value (Gutenberg-Richter): ",
    legendBValueText: "An indicator of tectonic stress. Typically around 1.0. A significant drop (negative deviation) means fewer small earthquakes and more accumulating energy, indicating increased stress and higher probability of a larger event.\n\n",
    legendRateTitle: "Seismicity Rate: ",
    legendRateText: "Measures the amount of recent earthquakes (30 days) against the historical average. A 'Ratio' of 2.0x means double the typical amount. 'Significance' indicates how statistically unusual this change is.\n\n",
    legendETASTitle: "ETAS Model (Aftershocks): ",
    legendETASText: "An epidemic model calculating the probability of aftershocks within the next 24 hours following a major seismic event (the 'Baseline' event). 'Prob. M4+' refers to the probability of an aftershock of magnitude 4 or greater.\n\n",
    legendRiskLevels: "Risk Levels:\n",
    legendLowText: "Activity within normal parameters for the region.\n",
    legendModerateText: "Isolated statistical anomalies observed; requires monitoring.\n",
    legendHighText: "Multiple anomalous indicators or a highly active aftershock sequence.\n",
    legendCriticalText: "Convergence of strong anomalies indicating extremely high stress in the zone.\n",
    page: "Page",
    of: "of",
    riskCritical: "CRITICAL (RED ALERT)",
    riskHigh: "HIGH (ORANGE ALERT)",
    riskModerate: "MODERATE (YELLOW ALERT)",
    riskLow: "LOW (NORMAL)",
    disclaimer: "⚠️ DISCLAIMER: This analysis is generated using statistical models and real-time seismic data from public official sources (USGS, EMSC, FUNVISIS). Earthquakes CANNOT be predicted with certainty. This information is purely referential. Always consult local civil protection authorities for official alerts.",
    lowBadge: "[LOW]: ",
    moderateBadge: "[MODERATE]: ",
    highBadge: "[HIGH]: ",
    criticalBadge: "[CRITICAL]: "
  }
};

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "critical": return "#991b1b"; // dark red
    case "high": return "#ea580c";     // orange
    case "moderate": return "#ca8a04"; // yellow/amber
    case "low": return "#166534";      // dark green
    default: return "#475569";         // slate
  }
}

function getRiskText(level: RiskLevel, lang: "es" | "en"): string {
  const t = i18n[lang];
  switch (level) {
    case "critical": return t.riskCritical;
    case "high": return t.riskHigh;
    case "moderate": return t.riskModerate;
    case "low": return t.riskLow;
    default: return "UNKNOWN";
  }
}

function buildReportDocument(report: RiskAssessmentReport, lang: "es" | "en" = "es"): TDocumentDefinitions {
  const t = i18n[lang];
  const dateStr = new Date(report.generatedAt).toISOString();
  const dateParts = dateStr.split("T");

  const content: Content[] = [
    // Official Header
    {
      text: t.dept,
      style: "officialHeader",
    },
    {
      text: t.title,
      style: "title",
    },
    {
      columns: [
        { text: `${t.date}: ${dateParts[0]}`, style: "metaData" },
        { text: `${t.time}: ${dateParts[1].substring(0, 8)}Z`, style: "metaData", alignment: "right" },
      ],
      margin: [0, 0, 0, 20],
    },
    {
      text: t.classification,
      style: "classification",
      margin: [0, 0, 0, 30],
    },
  ];

  // Global Risk Summary
  const critical = report.assessments.filter((a) => a.riskLevel === "critical").length;
  const high = report.assessments.filter((a) => a.riskLevel === "high").length;
  
  content.push({
    text: t.executiveSummary,
    style: "sectionHeader",
  });
  
  content.push({
    text: t.summaryText(report.assessments.length, critical, high),
    margin: [0, 0, 0, 20],
  });

  // Table per region
  for (const assessment of report.assessments) {
    const tableBody: TableCell[][] = [];

    // Table Header
    tableBody.push([
      { text: t.indicator, style: "tableHeader" },
      { text: t.observedValue, style: "tableHeader" },
      { text: t.statusInterpretation, style: "tableHeader" },
    ]);

    // B-Value Row
    if (assessment.indicators.bValue) {
      tableBody.push([
        { text: t.bValue },
        { text: `${t.actual}: ${assessment.indicators.bValue.currentBValue.toFixed(2)}\n${t.base}: ${assessment.indicators.bValue.historicalBValue?.toFixed(2) ?? 'N/A'}\n${t.deviation}: ${assessment.indicators.bValue.deviation.toFixed(1)}` },
        { text: assessment.indicators.bValue.message || "" },
      ]);
    }

    // Seismicity Rate Row
    if (assessment.indicators.rate) {
      tableBody.push([
        { text: t.seismicityRate },
        { text: `Ratio: ${assessment.indicators.rate.rateRatio.toFixed(1)}x\n${t.significance}: ${assessment.indicators.rate.significance?.toFixed(2) ?? 'N/A'}` },
        { text: assessment.indicators.rate.message || "" },
      ]);
    }

    // ETAS Row(s)
    if (assessment.indicators.activeForecasts && assessment.indicators.activeForecasts.length > 0) {
      for (const etas of assessment.indicators.activeForecasts) {
        tableBody.push([
          { text: `${t.etasModel}\n(${t.etasEvent}: M${etas.mainshockMag} ${etas.mainshockPlace})` },
          { text: `${t.probM4}: ${(etas.forecast24h.probM4 * 100).toFixed(1)}%\n${t.probM5}: ${(etas.forecast24h.probM5 * 100).toFixed(1)}%` },
          { text: etas.message },
        ]);
      }
    } else {
      tableBody.push([
        { text: t.etasReplica },
        { text: t.noMajorEvents },
        { text: t.stableSequence },
      ]);
    }

    content.push({
      text: `${t.zone}: ${assessment.regionName.toUpperCase()}`,
      style: "regionTitle",
    });

    content.push({
      text: `${t.riskLevel}: ${getRiskText(assessment.riskLevel, lang)}`,
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

  content.push({ text: " ", margin: [0, 20, 0, 20] });
  content.push({ text: t.endReport, style: "subheader", alignment: "center" });

  // --- LEYENDA / GLOSARIO ---
  content.push({
    unbreakable: true,
    stack: [
      { text: t.legendTitle, style: "header", margin: [0, 40, 0, 10] },
      {
        text: [
          { text: t.legendBValueTitle, bold: true },
          t.legendBValueText,
          
          { text: t.legendRateTitle, bold: true },
          t.legendRateText,
          
          { text: t.legendETASTitle, bold: true },
          t.legendETASText,
          
          { text: t.legendRiskLevels, bold: true },
          { text: t.lowBadge, bold: true, color: "#16a34a" }, t.legendLowText,
          { text: t.moderateBadge, bold: true, color: "#d97706" }, t.legendModerateText,
          { text: t.highBadge, bold: true, color: "#ea580c" }, t.legendHighText,
          { text: t.criticalBadge, bold: true, color: "#dc2626" }, t.legendCriticalText
        ],
        fontSize: 9,
        alignment: "justify",
        color: "#4b5563",
        margin: [0, 0, 0, 10]
      }
    ]
  });

  // Footer Disclaimer
  content.push({
    text: t.disclaimer,
    style: "disclaimer",
  });

  return {
    content,
    footer: function(currentPage: number, pageCount: number) {
      return {
        columns: [
          { text: `${t.page} ${currentPage} ${t.of} ${pageCount}`, style: "footerText", alignment: "left" },
          { 
            text: [
              { text: "By ", color: "#000000" },
              { text: "Anthwam", color: "#dc2626" }
            ], 
            style: "watermark", 
            alignment: "right" 
          }
        ],
        margin: [40, 10, 40, 0]
      };
    },
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
      footerText: {
        fontSize: 8,
        color: "#9ca3af"
      },
      watermark: {
        fontSize: 10,
        bold: true,
        italics: true,
        color: "#d1d5db"
      }
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

      pdfmake.setFonts(fonts);
      
      const fileNameEs = `sismobot_boletin_${Date.now()}_es.pdf`;
      const fileNameEn = `sismobot_boletin_${Date.now()}_en.pdf`;
      
      const outputPathEs = path.join(os.tmpdir(), fileNameEs);
      const outputPathEn = path.join(os.tmpdir(), fileNameEn);
      
      const docEs = buildReportDocument(report, "es");
      const docEn = buildReportDocument(report, "en");
      
      const pdfDocEs = pdfmake.createPdf(docEs);
      const pdfDocEn = pdfmake.createPdf(docEn);
      
      await pdfDocEs.write(outputPathEs);
      await pdfDocEn.write(outputPathEn);
      
      const latestPathEs = path.join(os.tmpdir(), "sismobot_boletin_latest_es.pdf");
      const latestPathEn = path.join(os.tmpdir(), "sismobot_boletin_latest_en.pdf");
      
      fs.copyFileSync(outputPathEs, latestPathEs);
      fs.copyFileSync(outputPathEn, latestPathEn);

      logger.info("PDF", `Generated military-style PDF reports (ES/EN): ${outputPathEs}`);

      return {
        agentName: this.name,
        success: true,
        data: { 
          pdfPath: outputPathEs, 
          fileName: fileNameEs,
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
