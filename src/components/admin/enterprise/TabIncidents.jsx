/**
 * TabIncidents — Enterprise Incident Resolution & Repair Framework
 *
 * Root Cause Analysis · Concrete Fix Steps · Governance Separation · Resolution Workflow
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle, XCircle, Info, Shield, CheckCircle2,
  Wrench, Eye, Filter, Loader2, ChevronDown, ChevronUp,
  Search, FileText, ArrowRight, Ban
} from 'lucide-react';

const SEVERITY_CFG = {
  info:     { icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700 border-blue-200',   label: 'INFO' },
  warning:  { icon: AlertTriangle, bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'WARNING' },
  critical: { icon: XCircle,       bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',    badge: 'bg-red-100 text-red-700 border-red-200',       label: 'CRITICAL' },
  blocking: { icon: Shield,        bg: 'bg-rose-50',   border: 'border-rose-300',  text: 'text-rose-800',   badge: 'bg-rose-200 text-rose-800 border-rose-300',    label: 'BLOCKING' },
};

const STATUS_CFG = {
  open:          { label: 'Offen',             color: 'text-red-600 bg-red-50 border-red-200' },
  in_review:     { label: 'In Pruefung',       color: 'text-amber-700 bg-amber-50 border-amber-200' },
  resolved:      { label: 'Behoben',           color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  accepted_risk: { label: 'Risiko akzeptiert', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  auto_fixed:    { label: 'Auto-repariert',    color: 'text-blue-700 bg-blue-50 border-blue-200' },
};

const CATEGORY_LABELS = {
  export_gate:        'Export-Gate',
  approval:           'Approval',
  snapshots:          'Snapshots',
  tenant_isolation:   'Tenant-Isolation',
  data_integrity:     'Datenintegritaet',
  audit_trail:        'Audit-Trail',
  pdf_integrity:      'PDF-Integritaet',
  security:           'Security',
  document_integrity: 'Dokumente',
  recovery:           'Recovery',
  performance:        'Performance',
  other:              'Sonstiges',
};

const REPAIR_ACTIONS = {
  sync_customer_status:   { label: 'Kundenstatus synchronisieren', fn: 'syncCustomerStatusFromContracts' },
  check_data_consistency: { label: 'Konsistenz pruefen',           fn: 'checkDataConsistency' },
};

function RootCauseSection({ incident }) {
  if (!incident.root_cause && !incident.technical_details) return null;
  return (
    <div className="space-y-2">
      {incident.root_cause && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Search className="w-3 h-3 text-rose-600" />
            <span className="text-[10px] font-black text-rose-700 uppercase tracking-wide">Ursache (Root Cause)</span>
          </div>
          <p className="text-xs text-rose-900 leading-relaxed">{incident.root_cause}</p>
        </div>
      )}
      {incident.technical_details && incident.technical_details !== incident.description && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Technische Details</span>
          </div>
          <p className="text-xs text-slate-700 font-mono leading-relaxed">{incident.technical_details}</p>
        </div>
      )}
    </div>
  );
}

function RecommendedFixSection({ incident }) {
  const fix = incident.recommended_action;
  if (!fix) return null;
  const steps = fix.split('\n').map(s => s.trim()).filter(Boolean);
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <ArrowRight className="w-3 h-3 text-emerald-700" />
        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wide">Empfohlene Loesung</span>
      </div>
      {steps.length > 1 ? (
        <ol className="space-y-1">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-emerald-900">
              <span className="shrink-0 w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-[9px] font-bold mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{step.replace(/^\d+\.\s*/, '')}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-emerald-900 leading-relaxed">{fix}</p>
      )}
    </div>
  );
}

function ClassificationBadge({ incident }) {
  if (incident.governance_block) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs">
        <Ban className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span className="text-rose-800"><strong>Governance-Block</strong> — Menschlicher Entscheid zwingend. Niemals automatisch beheben.</span>
      </div>
    );
  }
  if (incident.auto_fix_possible) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
        <Wrench className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="text-blue-800"><strong>Auto-Fix verfuegbar</strong> — Sichere technische Reparatur. Keine Geschaeftsdaten betroffen.</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
      <Eye className="w-3.5 h-3.5 text-amber-600 shrink-0" />
      <span className="text-amber-800"><strong>Manueller Review</strong> — Admin-Entscheid erforderlich.</span>
    </div>
  );
}

function IncidentRow({ incident, onUpdateStatus, updating }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const sev = SEVERITY_CFG[incident.severity] || SEVERITY_CFG.warning;
  const SevIcon = sev.icon;
  const statusCfg = STATUS_CFG[incident.status] || STATUS_CFG.open;
  const isOpen = incident.status === 'open' || incident.status === 'in_review';

  return (
    <div className={`border rounded-xl overflow-hidden ${sev.border}`}>
      <div
        className={`px-4 py-3 flex items-start gap-3 cursor-pointer ${sev.bg} hover:brightness-95 transition-all`}
        onClick={() => setExpanded(e => !e)}
      >
        <SevIcon className={`w-4 h-4 mt-0.5 shrink-0 ${sev.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${sev.badge}`}>
              {sev.label}
            </span>
            <span className="text-xs bg-white/70 text-muted-foreground px-2 py-0.5 rounded border border-border/60">
              {CATEGORY_LABELS[incident.category] || incident.category}
            </span>
            {incident.governance_block && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-rose-100 text-rose-700 border-rose-200 flex items-center gap-1">
                <Ban className="w-2.5 h-2.5" /> Governance
              </span>
            )}
            {incident.auto_fix_possible && !incident.governance_block && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1">
                <Wrench className="w-2.5 h-2.5" /> Auto-Fix
              </span>
            )}
            <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded border ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground mt-1.5">{incident.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{incident.description}</p>
          {!expanded && incident.root_cause && (
            <p className="text-[11px] text-rose-700 mt-1 italic truncate">
              Ursache: {incident.root_cause.split('.')[0]}.
            </p>
          )}
        </div>
        <div className="shrink-0 text-muted-foreground mt-1">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>

      {expanded && (
        <div className="bg-white border-t border-border/60 px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              ['Erkannt am', incident.detected_at ? new Date(incident.detected_at).toLocaleString('de-CH') : '—'],
              ['Erkannt durch', incident.detected_by || '—'],
              ['Zugewiesen', incident.assigned_to || 'Nicht zugewiesen'],
              ['Entity-ID', incident.entity_id ? incident.entity_id.slice(0, 14) + '...' : '—'],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{l}</div>
                <div className="font-medium text-foreground truncate">{v}</div>
              </div>
            ))}
          </div>

          <RootCauseSection incident={incident} />
          <ClassificationBadge incident={incident} />
          <RecommendedFixSection incident={incident} />

          {isOpen && (
            <div className="space-y-2 pt-1 border-t border-border/40">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Resolution Notes — Was wurde getan? Warum sicher?"
                rows={2}
                className="w-full text-xs border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => onUpdateStatus(incident.id, 'in_review', notes)}
                  disabled={updating}
                  className="text-xs font-semibold px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  In Pruefung setzen
                </button>
                <button
                  onClick={() => onUpdateStatus(incident.id, 'resolved', notes)}
                  disabled={updating}
                  className="text-xs font-semibold px-3 py-1.5 border border-emerald-300 bg-emerald-50 text-emerald-800 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3 h-3 inline mr-1" />Behoben markieren
                </button>
                <button
                  onClick={() => onUpdateStatus(incident.id, 'accepted_risk', notes)}
                  disabled={updating}
                  className="text-xs font-semibold px-3 py-1.5 border border-slate-300 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Risiko akzeptieren
                </button>
                {incident.auto_fix_possible && !incident.governance_block && incident.auto_fix_action && REPAIR_ACTIONS[incident.auto_fix_action]?.fn && (
                  <button
                    onClick={() =>
                      base44.functions.invoke(REPAIR_ACTIONS[incident.auto_fix_action].fn, { entity_id: incident.entity_id })
                        .then(() => onUpdateStatus(incident.id, 'auto_fixed', 'Auto-repair via ' + REPAIR_ACTIONS[incident.auto_fix_action].fn))}
                    disabled={updating}
                    className="text-xs font-semibold px-3 py-1.5 border border-blue-300 bg-blue-50 text-blue-800 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    <Wrench className="w-3 h-3 inline mr-1" />
                    {REPAIR_ACTIONS[incident.auto_fix_action]?.label || 'Auto-Fix ausfuehren'}
                  </button>
                )}
              </div>
            </div>
          )}

          {!isOpen && incident.resolution_notes && (
            <div className="bg-muted/30 border border-border/60 rounded-lg px-3 py-2.5">
              <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Resolution</div>
              <p className="text-xs text-foreground">{incident.resolution_notes}</p>
              {incident.resolved_at && (
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {new Date(incident.resolved_at).toLocaleString('de-CH')} · {incident.resolved_by}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TabIncidents() {
  const [filter, setFilter] = useState('open');
  const [severityFilter, setSeverityFilter] = useState('all');
  const qc = useQueryClient();

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['enterprise_incidents', filter],
    queryFn: () => {
      if (filter === 'open')      return base44.entities.EnterpriseIncident.filter({ status: 'open' }, '-detected_at', 100);
      if (filter === 'in_review') return base44.entities.EnterpriseIncident.filter({ status: 'in_review' }, '-detected_at', 100);
      if (filter === 'resolved')  return base44.entities.EnterpriseIncident.filter({ status: 'resolved' }, '-resolved_at', 50);
      return base44.entities.EnterpriseIncident.list('-detected_at', 200);
    },
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }) => {
      const me = await base44.auth.me();
      return base44.entities.EnterpriseIncident.update(id, {
        status,
        resolution_notes: notes || undefined,
        resolved_at: ['resolved', 'accepted_risk', 'auto_fixed'].includes(status) ? new Date().toISOString() : undefined,
        resolved_by: ['resolved', 'accepted_risk', 'auto_fixed'].includes(status) ? (me.full_name || me.email) : undefined,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enterprise_incidents'] }),
  });

  const displayed = severityFilter === 'all' ? incidents : incidents.filter(i => i.severity === severityFilter);
  const counts = {
    blocking:   incidents.filter(i => i.severity === 'blocking' && i.status === 'open').length,
    critical:   incidents.filter(i => i.severity === 'critical' && i.status === 'open').length,
    warning:    incidents.filter(i => i.severity === 'warning'  && i.status === 'open').length,
    governance: incidents.filter(i => i.governance_block && i.status === 'open').length,
    open:       incidents.filter(i => i.status === 'open').length,
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Incident Resolution Framework</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Root Cause · Concrete Fix Steps · Governance Separation · Resolution Workflow
        </p>
      </div>

      {/* 3-Typen-Erklarung */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-blue-200 bg-blue-50 rounded-lg px-4 py-3 flex items-start gap-2">
          <Wrench className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-blue-800">Auto-Fix</p>
            <p className="text-xs text-blue-700">Sichere technische Reparaturen. Keine Governance-Daten.</p>
          </div>
        </div>
        <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 flex items-start gap-2">
          <Eye className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-800">Manual Review</p>
            <p className="text-xs text-amber-700">Admin-Entscheid erforderlich. Pruefen und dokumentieren.</p>
          </div>
        </div>
        <div className="border border-rose-200 bg-rose-50 rounded-lg px-4 py-3 flex items-start gap-2">
          <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-rose-800">Governance-Block</p>
            <p className="text-xs text-rose-700">Approval, PDFs, Rollen, Provisionen — immer human.</p>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-5 gap-3">
        {[
          ['Blocking',   counts.blocking,   'text-rose-700 bg-rose-50 border-rose-300'],
          ['Critical',   counts.critical,   'text-red-700 bg-red-50 border-red-300'],
          ['Warning',    counts.warning,    'text-amber-700 bg-amber-50 border-amber-300'],
          ['Governance', counts.governance, 'text-rose-800 bg-rose-50 border-rose-200'],
          ['Offen ges.', counts.open,       'text-foreground bg-muted border-border'],
        ].map(([l, v, cls]) => (
          <div key={l} className={`border rounded-xl px-3 py-3 text-center ${cls}`}>
            <div className="text-xl font-black">{v}</div>
            <div className="text-[10px] font-medium mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {[['open','Offen'],['in_review','In Pruefung'],['resolved','Behoben'],['all','Alle']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${filter === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        {['all','blocking','critical','warning','info'].map(v => (
          <button key={v} onClick={() => setSeverityFilter(v)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${severityFilter === v ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {v === 'all' ? 'Alle Severity' : v.toUpperCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Lade Incidents...
        </div>
      ) : displayed.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl px-8 py-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">Keine Incidents</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter === 'open' ? 'Keine offenen Governance-Incidents.' : 'Keine Eintraege fuer diesen Filter.'}
          </p>
          <p className="text-xs text-muted-foreground mt-3">
            Incidents werden automatisch durch <code className="bg-muted px-1 rounded">runLiveSystemValidation</code> erzeugt.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(inc => (
            <IncidentRow
              key={inc.id}
              incident={inc}
              onUpdateStatus={(id, status, notes) => updateMutation.mutate({ id, status, notes })}
              updating={updateMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}