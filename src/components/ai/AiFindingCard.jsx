/**
 * AiFindingCard — Aufklappbare AI Finding Karte mit voller Explainability
 * Zeigt: Confidence · Evidence · Reasoning · Violated Rules · Remediation Steps
 */
import { useState } from 'react';
import {
  ChevronDown, ChevronRight, Shield, AlertTriangle,
  CheckCircle2, XCircle, Info, Database, Zap, Eye,
  BookOpen, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY_CONFIG = {
  blocking: { colorClass: 'rose',   label: 'BLOCKING', Icon: XCircle },
  critical: { colorClass: 'red',    label: 'KRITISCH', Icon: AlertTriangle },
  warning:  { colorClass: 'amber',  label: 'WARNUNG',  Icon: AlertTriangle },
  info:     { colorClass: 'blue',   label: 'INFO',     Icon: Info },
};

const EVIDENCE_STRENGTH_LABEL = {
  conclusive: { label: 'Schlüssig', color: 'emerald' },
  strong:     { label: 'Stark',     color: 'blue' },
  moderate:   { label: 'Moderat',   color: 'amber' },
  weak:       { label: 'Schwach',   color: 'rose' },
};

function confidenceLevel(score) {
  if (score >= 0.85) return 'high';
  if (score >= 0.65) return 'medium';
  return 'low';
}

function ConfidenceBar({ score }) {
  const level = confidenceLevel(score);
  const pct = Math.round(score * 100);
  const barColor = level === 'high' ? 'bg-emerald-500' : level === 'medium' ? 'bg-amber-400' : 'bg-rose-400';
  const textColor = level === 'high' ? 'text-emerald-700 bg-emerald-50' : level === 'medium' ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5">
        <div className={cn('h-1.5 rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', textColor)}>{pct}%</span>
    </div>
  );
}

function EvidenceItem({ item }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-100 last:border-0">
      <Database className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-[hsl(var(--text-heading))]">{item.description}</p>
        {item.field && (
          <div className="flex gap-3 mt-0.5">
            <span className="text-[9px] text-[hsl(var(--text-muted))]">Feld: <code className="bg-slate-100 px-1 rounded">{item.field}</code></span>
            {item.actual_value && (
              <span className="text-[9px] text-rose-600">Ist: <code className="bg-rose-50 px-1 rounded">{item.actual_value}</code></span>
            )}
            {item.expected_value && (
              <span className="text-[9px] text-emerald-600">Soll: <code className="bg-emerald-50 px-1 rounded">{item.expected_value}</code></span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const SECTIONS = [
  { id: 'reasoning',      label: 'Begründung',       Icon: BookOpen },
  { id: 'evidence',       label: 'Evidenz',           Icon: Database },
  { id: 'remediation',    label: 'Lösung',            Icon: Zap },
  { id: 'explainability', label: 'KI-Transparenz',    Icon: Eye },
];

export default function AiFindingCard({ finding, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState('reasoning');

  const sev = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.warning;
  const { Icon: SevIcon, colorClass, label: sevLabel } = sev;
  const evidenceMeta = EVIDENCE_STRENGTH_LABEL[finding.evidence_strength] || EVIDENCE_STRENGTH_LABEL.moderate;

  const evidenceCount = finding.evidence?.length || 0;

  return (
    <div className={cn(
      'bg-white rounded-xl border transition-all',
      colorClass === 'rose' ? 'border-rose-300' :
      colorClass === 'red' ? 'border-red-200' :
      colorClass === 'amber' ? 'border-amber-200' : 'border-blue-200'
    )}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
          colorClass === 'rose' ? 'bg-rose-100' :
          colorClass === 'red' ? 'bg-red-100' :
          colorClass === 'amber' ? 'bg-amber-100' : 'bg-blue-100'
        )}>
          <SevIcon className={cn('w-3.5 h-3.5',
            colorClass === 'rose' ? 'text-rose-600' :
            colorClass === 'red' ? 'text-red-600' :
            colorClass === 'amber' ? 'text-amber-600' : 'text-blue-600'
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn(
              'text-[9px] font-black px-2 py-0.5 rounded tracking-widest',
              colorClass === 'rose' ? 'bg-rose-100 text-rose-700' :
              colorClass === 'red' ? 'bg-red-100 text-red-700' :
              colorClass === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
            )}>
              {sevLabel}
            </span>
            <span className="text-[9px] text-[hsl(var(--text-muted))] bg-slate-100 px-2 py-0.5 rounded">
              {finding.finding_type?.replace(/_/g, ' ')}
            </span>
            <span className="text-[9px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-600">
              Evidenz: {evidenceMeta.label}
            </span>
          </div>

          <p className="text-sm font-semibold text-[hsl(var(--text-heading))] leading-tight">
            {finding.explanation?.summary || `${finding.finding_type} erkannt`}
          </p>

          {finding.confidence_score !== undefined && (
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[9px] text-[hsl(var(--text-muted))]">KI-Konfidenz</span>
              <div className="w-32">
                <ConfidenceBar score={finding.confidence_score} />
              </div>
              {finding.governance_risk_score !== undefined && (
                <span className="text-[9px] text-[hsl(var(--text-muted))] ml-2">
                  Governance Risk: <strong className="text-[hsl(var(--text-heading))]">{finding.governance_risk_score}/100</strong>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {finding.status && (
            <span className={cn(
              'text-[9px] font-bold px-2 py-0.5 rounded-full border',
              finding.status === 'new' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              finding.status === 'confirmed' ? 'bg-rose-50 text-rose-700 border-rose-200' :
              finding.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              'bg-slate-100 text-slate-600 border-slate-200'
            )}>
              {finding.status?.replace(/_/g, ' ')}
            </span>
          )}
          {expanded
            ? <ChevronDown className="w-4 h-4 text-[hsl(var(--text-muted))]" />
            : <ChevronRight className="w-4 h-4 text-[hsl(var(--text-muted))]" />
          }
        </div>
      </div>

      {/* Expandable Detail */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Section Tabs */}
          <div className="flex gap-1 flex-wrap">
            {SECTIONS.map(s => {
              const SIcon = s.Icon;
              const isActive = activeSection === s.id;
              const sLabel = s.id === 'evidence' ? `Evidenz (${evidenceCount})` : s.label;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors',
                    isActive ? 'bg-[hsl(var(--primary))] text-white' : 'bg-slate-100 text-[hsl(var(--text-muted))] hover:bg-slate-200'
                  )}
                >
                  <SIcon className="w-2.5 h-2.5" />
                  {sLabel}
                </button>
              );
            })}
          </div>

          {/* Reasoning */}
          {activeSection === 'reasoning' && (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-bold text-[hsl(var(--text-label))] uppercase mb-1">Detaillierte Begründung</p>
                <p className="text-xs text-[hsl(var(--text-body))] leading-relaxed">
                  {finding.explanation?.reasoning || 'Keine Begründung verfügbar.'}
                </p>
              </div>
              {finding.explanation?.violated_rules?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[hsl(var(--text-label))] uppercase mb-1">Verletzte Regeln</p>
                  <div className="space-y-1">
                    {finding.explanation.violated_rules.map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[hsl(var(--text-body))]">
                        <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
                        {rule}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {finding.explanation?.governance_impact && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-amber-800 mb-0.5">Governance-Auswirkung</p>
                  <p className="text-xs text-amber-700">{finding.explanation.governance_impact}</p>
                </div>
              )}
            </div>
          )}

          {/* Evidence */}
          {activeSection === 'evidence' && (
            <div>
              <p className="text-[10px] font-bold text-[hsl(var(--text-label))] uppercase mb-2">Datenpunkte &amp; Belege</p>
              {finding.evidence?.length > 0 ? (
                <div>{finding.evidence.map((item, i) => <EvidenceItem key={i} item={item} />)}</div>
              ) : (
                <p className="text-xs text-[hsl(var(--text-muted))] italic">
                  Keine spezifischen Datenpunkte — Finding basiert auf statistischer Inference
                </p>
              )}
              {finding.explanation?.data_sources?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold text-[hsl(var(--text-label))] uppercase mb-1">Datenquellen</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {finding.explanation.data_sources.map((src, i) => (
                      <span key={i} className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{src}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Remediation */}
          {activeSection === 'remediation' && (
            <div className="space-y-3">
              {finding.explanation?.recommendation && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-emerald-800 mb-0.5">Empfehlung</p>
                  <p className="text-xs text-emerald-700">{finding.explanation.recommendation}</p>
                </div>
              )}
              {finding.explanation?.remediation_steps?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[hsl(var(--text-label))] uppercase mb-2">Lösungsschritte</p>
                  <div className="space-y-2">
                    {finding.explanation.remediation_steps.map((step, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-xs text-[hsl(var(--text-body))] leading-relaxed">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI Explainability */}
          {activeSection === 'explainability' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Erkennungsmethode', value: finding.explainability?.detection_method?.replace(/_/g, ' ') },
                  { label: 'Halluzinationsrisiko', value: finding.explainability?.hallucination_risk?.toUpperCase() || 'LOW', highlight: finding.explainability?.hallucination_risk === 'high' },
                  { label: 'Tenant Validation', value: finding.explainability?.tenant_validation_passed ? 'Bestanden' : 'Fehlgeschlagen' },
                  { label: 'Pipeline Version', value: finding.explainability?.pipeline_version },
                ].map(({ label, value, highlight }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[9px] font-bold text-[hsl(var(--text-label))] uppercase mb-1">{label}</p>
                    <p className={cn('text-xs font-semibold', highlight ? 'text-rose-600' : 'text-[hsl(var(--text-heading))]')}>
                      {value || '—'}
                    </p>
                  </div>
                ))}
              </div>

              {finding.explainability?.validation_checks_passed?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-[hsl(var(--text-label))] uppercase mb-1">Validierungs-Checks bestanden</p>
                  <div className="space-y-1">
                    {finding.explainability.validation_checks_passed.map((check, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] text-emerald-700">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        {check.replace(/_/g, ' ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-[9px] text-[hsl(var(--text-muted))] pt-2 border-t border-slate-100">
                <Clock className="w-3 h-3" />
                {finding.audit?.generated_at ? new Date(finding.audit.generated_at).toLocaleString('de-CH') : '—'}
                {finding.audit?.processing_time_ms ? ` · ${finding.audit.processing_time_ms}ms` : ''}
                {finding.audit?.generated_by ? ` · ${finding.audit.generated_by}` : ''}
              </div>
            </div>
          )}

          {/* Status Actions */}
          {onStatusChange && finding.status === 'new' && (
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => onStatusChange(finding.id, 'confirmed')}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors"
              >
                <CheckCircle2 className="w-3 h-3" /> Bestätigen
              </button>
              <button
                onClick={() => onStatusChange(finding.id, 'false_positive')}
                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <XCircle className="w-3 h-3" /> False Positive
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}