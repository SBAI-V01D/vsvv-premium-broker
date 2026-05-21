/**
 * DossierApprovalTimeline — Visueller Audit-Trail der Freigabe-Aktionen
 * Zeigt approval_history als Timeline mit Icons, User, Zeitstempel und Aktion.
 */
import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Edit3, Clock } from 'lucide-react';

const ACTION_CONFIG = {
  approved: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-100',
    border: 'border-emerald-200',
    label: 'Dossier freigegeben',
  },
  approval_revoked: {
    icon: XCircle,
    color: 'text-rose-600',
    bg: 'bg-rose-100',
    border: 'border-rose-200',
    label: 'Freigabe widerrufen',
  },
  reapproval_triggered: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-100',
    border: 'border-amber-200',
    label: 'Erneute Freigabe erforderlich',
  },
  field_changed: {
    icon: Edit3,
    color: 'text-blue-600',
    bg: 'bg-blue-100',
    border: 'border-blue-200',
    label: 'Dossier geändert',
  },
};

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-CH', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function DossierApprovalTimeline({ dossier }) {
  const history = Array.isArray(dossier?.approval_history) ? dossier.approval_history : [];

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-border rounded-xl">
        <Clock className="w-6 h-6 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">Noch keine Freigabe-Aktionen.</p>
        <p className="text-xs text-muted-foreground mt-0.5">Freigaben und Widerrufe werden hier protokolliert.</p>
      </div>
    );
  }

  // Neueste zuerst
  const sorted = [...history].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  return (
    <div className="space-y-3">
      {sorted.map((entry, i) => {
        const cfg = ACTION_CONFIG[entry.action] || ACTION_CONFIG.field_changed;
        const Icon = cfg.icon;
        return (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.border} ${cfg.bg.replace('bg-', 'bg-')}`}>
            <div className={`w-7 h-7 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
              <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{fmtDateTime(entry.timestamp)}</span>
              </div>
              {entry.user_name && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  von <span className="font-medium text-foreground">{entry.user_name}</span>
                  {entry.user_id && <span className="text-muted-foreground/60 ml-1">({entry.user_id.slice(0, 8)}…)</span>}
                </p>
              )}
              {entry.changed_fields && (
                <p className="text-[10px] text-muted-foreground mt-1 font-mono bg-muted/40 rounded px-2 py-0.5 inline-block">
                  Felder: {entry.changed_fields}
                </p>
              )}
              {entry.notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">„{entry.notes}"</p>
              )}
            </div>
          </div>
        );
      })}

      {/* Aktueller Status */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <div className={`w-2 h-2 rounded-full ${dossier?.advisor_approved ? 'bg-emerald-500' : dossier?.reapproval_required ? 'bg-amber-500' : 'bg-slate-300'}`} />
        <span className="text-xs text-muted-foreground">
          Aktueller Status:{' '}
          <span className="font-medium text-foreground">
            {dossier?.advisor_approved
              ? `Freigegeben (${dossier.approved_by || 'Berater'})`
              : dossier?.reapproval_required
                ? 'Erneute Freigabe erforderlich'
                : 'Nicht freigegeben'}
          </span>
        </span>
      </div>
    </div>
  );
}