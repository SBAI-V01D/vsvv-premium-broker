/**
 * CentralAnalysisContext — Shared Analysis State
 * 
 * Enterprise Control, System Check und KI Analyse teilen dieselbe Datenbasis.
 * Alle Scores und Metriken kommen ausschliesslich von der centralAnalysisEngine.
 * Single Source of Truth.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const CentralAnalysisContext = createContext(null);

export function CentralAnalysisProvider({ children }) {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRun, setLastRun] = useState(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('centralAnalysisEngine', {});
      setAnalysisData(res.data);
      setLastRun(new Date());
      return res.data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysisData(null);
    setLastRun(null);
    setError(null);
  }, []);

  return (
    <CentralAnalysisContext.Provider value={{ analysisData, loading, error, lastRun, runAnalysis, clearAnalysis }}>
      {children}
    </CentralAnalysisContext.Provider>
  );
}

export function useCentralAnalysis() {
  const ctx = useContext(CentralAnalysisContext);
  if (!ctx) throw new Error('useCentralAnalysis must be used within CentralAnalysisProvider');
  return ctx;
}

// Score-Farben — wird von allen 3 Modulen verwendet
export function getScoreColor(score) {
  if (score >= 85) return 'text-emerald-600';
  if (score >= 70) return 'text-amber-600';
  if (score >= 50) return 'text-orange-600';
  return 'text-rose-600';
}

export function getScoreBg(score) {
  if (score >= 85) return 'bg-emerald-50 border-emerald-200';
  if (score >= 70) return 'bg-amber-50 border-amber-200';
  if (score >= 50) return 'bg-orange-50 border-orange-200';
  return 'bg-rose-50 border-rose-200';
}

export function getRiskBadge(risk_level) {
  const map = {
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  return map[risk_level] || map.medium;
}

export function getRiskLabel(risk_level) {
  const map = { low: 'Tief', medium: 'Mittel', high: 'Hoch', critical: 'Kritisch' };
  return map[risk_level] || risk_level;
}