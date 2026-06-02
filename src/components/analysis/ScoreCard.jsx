/**
 * ScoreCard — Wiederverwendbare Score-Karte
 * Zeigt immer denselben Wert aus der zentralen Engine.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { getScoreColor, getScoreBg } from '@/lib/CentralAnalysisContext';

// eslint-disable-next-line no-unused-vars
export default function ScoreCard({ label, value, description, icon: Icon, size = 'md' }) {
  if (value === undefined || value === null) return null;
  
  return (
    <div className={cn('rounded-xl border p-4 transition-all hover:shadow-sm', getScoreBg(value))}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</p>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <p className={cn('font-bold', getScoreColor(value), size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-3xl')}>
        {value}
        <span className="text-sm font-normal text-muted-foreground ml-1">/ 100</span>
      </p>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </div>
  );
}