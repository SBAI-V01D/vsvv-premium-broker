/**
 * ConfidenceBadge — KI-Confidence Indikator
 *
 * Farblogik:
 *   < 0.70  → rot   (kritisch — Pflichtreview)
 *   0.70–0.89 → orange (prüfen — Standardreview)
 *   ≥ 0.90  → grün  (plausibel — Fast-Track)
 *   null    → grau  (keine KI-Extraktion)
 */
import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

function getLevel(confidence) {
  if (confidence == null) return 'none';
  if (confidence < 0.70) return 'critical';
  if (confidence < 0.90) return 'review';
  return 'ok';
}

const LEVEL_CONFIG = {
  critical: {
    icon: AlertTriangle,
    bg: 'bg-rose-50',
    border: 'border-rose-300',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    label: 'Kritisch',
    hint: 'Pflichtreview',
  },
  review: {
    icon: AlertCircle,
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'Prüfen',
    hint: 'Standardreview',
  },
  ok: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Plausibel',
    hint: 'Fast-Track',
  },
  none: {
    icon: HelpCircle,
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-500',
    dot: 'bg-slate-300',
    label: 'Keine KI',
    hint: 'Manuell erfasst',
  },
};

/**
 * @param {number|null} confidence  0.0–1.0
 * @param {string} [label]          Optionales Label (z.B. "Prämie")
 * @param {'sm'|'md'} [size]
 */
export default function ConfidenceBadge({ confidence, label, size = 'sm' }) {
  const level = getLevel(confidence);
  const cfg = LEVEL_CONFIG[level];
  const Icon = cfg.icon;
  const pct = confidence != null ? Math.round(confidence * 100) : null;

  if (size === 'md') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${cfg.bg} ${cfg.border}`}>
        <Icon className={`w-4 h-4 ${cfg.text}`} />
        <div>
          {label && <div className="text-[10px] text-muted-foreground font-medium">{label}</div>}
          <div className={`text-xs font-bold ${cfg.text}`}>
            {pct != null ? `${pct}%` : '—'} · {cfg.label}
          </div>
        </div>
        <span className={`text-[9px] font-medium ${cfg.text} opacity-70`}>{cfg.hint}</span>
      </div>
    );
  }

  return (
    <span
      title={`${label ? label + ': ' : ''}${pct != null ? pct + '%' : '—'} (${cfg.hint})`}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {pct != null ? `${pct}%` : '—'}
    </span>
  );
}

/**
 * Berechnet den durchschnittlichen Confidence-Score aus ComparisonEntries.
 * @param {Array} entries
 * @returns {number|null}
 */
export function calcAvgConfidence(entries = []) {
  const withConf = entries.filter(e => e.ai_confidence != null && e.ai_extracted);
  if (withConf.length === 0) return null;
  return withConf.reduce((s, e) => s + e.ai_confidence, 0) / withConf.length;
}

/**
 * Bestimmt ai_risk_level aus durchschnittlicher Confidence.
 * @param {number|null} avg
 * @returns {'low'|'medium'|'high'|'critical'}
 */
export function calcRiskLevel(avg) {
  if (avg == null) return 'low';
  if (avg < 0.60) return 'critical';
  if (avg < 0.70) return 'high';
  if (avg < 0.90) return 'medium';
  return 'low';
}