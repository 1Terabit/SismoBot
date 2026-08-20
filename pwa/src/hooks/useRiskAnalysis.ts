import { useState, useEffect } from "react";

export interface RiskAssessment {
  regionName: string;
  riskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number; // 0-100
  factors: string[];
}

export interface RiskAssessmentReport {
  timestamp: string;
  assessments: RiskAssessment[];
  globalStatus: "normal" | "elevated" | "warning" | "critical";
}

export function useRiskAnalysis() {
  const [report, setReport] = useState<RiskAssessmentReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchRiskReport() {
      try {
        setIsLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const response = await fetch(`${apiUrl}/api/analysis`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch risk report: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data && data.status !== "pending") {
          if (isMounted) {
            setReport(data);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error("Unknown error"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchRiskReport();

    // Poll every 15 minutes since the report updates every 6 hours
    const interval = setInterval(fetchRiskReport, 15 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { report, isLoading, error };
}
