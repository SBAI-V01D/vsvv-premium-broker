/**
 * TabIncidents — Enterprise Incident Resolution Framework with Action Layer
 *
 * Auto-Fix · Manual Review Workflow · Governance Block Details · Full Audit Trail
 */
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle, XCircle, Info, Shield, CheckCircle2,
  Wrench, Eye, Filter, Loader2, ChevronDown, ChevronUp,
  Search, FileText, ArrowRight, ExternalLink,
  Play, AlertCircle, ClipboardList, Lock, MessageSquare,
  CheckSquare, SkipForward
} from 'lucide-react';

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_CFG = {
  info:     { icon: Info,          bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700 border-blue-200',   label: 'INFO' },
  warning:  { icon: AlertTriangle, bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'WARNING' },
  critical: { icon: XCircle,       bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700',    badge: 'bg-red-100 text-red-700 border-red-200',       label: 'CRITICAL' },
  blocking: { icon: Shield,        bg: 'bg-rose-50',   border: 'border-rose-300',  text: 'text-rose-800',   badge: 'bg-rose-200 text-rose-800 border-rose-300',    label: 'BLOCKING' },
};

const STATUS_CFG = {
  open:          { label: 'Offen',             color: 'text-red-600 bg-red-50 border-red-200' },
  investigating: { label: 'Untersucht',        color: 'text-amber-600 bg-amber-50 border-amber-200' },
  in_progress:   { label: 'In Bearbeitung',    color: 'text-blue-600 bg-blue-50 border-blue-200' },
  in_review:     { label: 'In Prüfung',        color: 'text-amber-700 bg-amber-50 border-amber-200' },
  resolved:      { label: 'Behoben',           color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  closed:        { label: 'Geschlossen',       color: 'text-slate-600 bg-slate-100 border-slate-200' },
  accepted_risk: { label: 'Risiko akzeptiert', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  auto_fixed:    { label: 'Auto-repariert',    color: 'text-blue-700 bg-blue-50 border-blue-200' },
  rejected:      { label: 'Abgelehnt',         color: 'text-slate-500 bg-slate-50 border-slate-200' },
};

const CATEGORY_LABELS = {
  export_gate:        'Export-Gate',
  approval:           'Approval',
  snapshots:          'Snapshots',
  tenant_isolation:   'Tenant-Isolation',
  data_integrity:     'Datenintegrität',
  audit_trail:        'Audit-Trail',
  pdf_integrity:      'PDF-Integrität',
  security:           'Security',
  document_integrity: 'Dokumente',
  recovery:           'Recovery',
  performance:        'Performance',
  sla_breach:         'SLA-Breach',
  other:              'Sonstiges',
};

const AUTO_FIX_REGISTRY = {
  sync_customer_status:       { label: 'Kundenstatus synchronisieren',         fn: 'syncCustomerStatusFromContracts' },
  check_data_consistency:     { label: 'Datenkonsistenz prüfen & reparieren',  fn: 'checkDataConsistency' },
  repair_dossier_org_ids:     { label: 'Fehlende organization_id ergänzen',    fn: 'repairDossierOrgIds' },
  repair_broken_relations:    { label: 'Broken Relations reparieren',          fn: 'repairBrokenRelations' },
  validate_tenant_integrity:  { label: 'Tenant-Integrität validieren',         fn: 'validateTenantIntegrity' },
  validate_enterprise:        { label: 'Enterprise-Integrität validieren',     fn: 'validateEnterpriseIntegrity' },
  sync_application_customer:  { label: 'Antrag-Kunden-Zuweisung reparieren',  fn: 'syncApplicationCustomerAuto' },
};

const GOVERNANCE_CATEGORIES = new Set(['approval', 'pdf_integrity', 'security', 'export_gate', 'snapshots']);

// ─── Sub-Components ────────────────────────────────────────────────────────────

function MetaGrid({ incident }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
      {[
        ['Erkannt am',    incident.detected_at ? new Date(incident.detected_at).toLocaleString('de-CH') : '—'],
        ['Erkannt durch', incident.detected_by || '—'],
        ['Modul',         incident.module || incident.entity_type || '—'],
        ['SLA-Status',    incident.sla_status ? incident.sla_status.toUpperCase() : '—'],
      ].map(([l, v]) => (
        <div key={l}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{l}</div>
          <div className={`font-medium truncate ${l === 'SLA-Status' && incident.sla_status === 'breached' ? 'text-rose-600' : 'text-foreground'}`}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function RootCauseSection({ incident }) {
  if (!incident.root_cause && !incident.technical_details) return null;
  let affectedRecords = null;
  try {
    const parsed = JSON.parse(incident.technical_details);
    if (parsed?.affected_records?.length > 0) affectedRecords = parsed.affected_records;
  } catch {}

  return (
    <div className="space-y-2">
      {incident.root_cause && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Search className="w-3 h-3 text-rose-600" />
            <span className="text-[10px] font-black text-rose-700 uppercase tracking-wide">Root Cause</span>
          </div>
          <p className="text-xs text-rose-900 leading-relaxed">{incident.root_cause}</p>
        </div>
      )}
      {affectedRecords ? (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              Betroffene Datensätze ({affectedRecords.length})
            </span>
          </div>
          <div className="space-y-1">
            {affectedRecords.map((rec, i) => (
              <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2 py-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">{rec.type}</span>
                {rec.link ? (
                  <a href={rec.link} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 truncate">
                    {rec.name}<ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                  </a>
                ) : (
                  <span className="text-xs font-semibold text-foreground truncate">{rec.name}</span>
                )}
                {rec.detail && <span className="text-[10px] text-muted-foreground ml-auto shrink-0 truncate max-w-[200px]">{rec.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      ) : incident.technical_details && incident.technical_details !== incident.description && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="w-3 h-3 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Technische Details</span>
          </div>
          <p className="text-xs text-slate-700 font-mono leading-relaxed whitespace-pre-wrap">{incident.technical_details}</p>
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
        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wide">Empfohlene Lösungsschritte</span>
      </div>
      {steps.length > 1 ? (
        <ol className="space-y-1">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-emerald-900">
              <span className="shrink-0 w-4 h-4 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-[9px] font-bold mt-0.5">{i + 1}</span>
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

function GovernanceBlockSection({ incident }) {
  if (!incident.governance_block) return null;
  const blockReasons = [];
  const desc = (incident.description || '').toLowerCase();
  if (desc.includes('freigabe') || desc.includes('approval')) blockReasons.push('Fehlende Berater-Freigabe (advisor_approved)');
  if (desc.includes('reapproval')) blockReasons.push('Reapproval nach Änderung ausstehend');
  if (desc.includes('pdf') || desc.includes('hash')) blockReasons.push('Fehlender oder ungültiger PDF-Hash');
  if (desc.includes('rolle') || desc.includes('role')) blockReasons.push('Fehlende oder unzureichende Benutzerrolle');
  if (desc.includes('provision') || desc.includes('commission')) blockReasons.push('Provisionsentscheid manuell erforderlich');
  if (blockReasons.length === 0) blockReasons.push('Governance-Entscheid durch Administrator erforderlich');

  return (
    <div className="border border-rose-300 bg-rose-50 rounded-lg px-3 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span className="text-xs font-black text-rose-800 uppercase tracking-wide">Governance-Block — Manueller Entscheid zwingend</span>
      </div>
      <div>
        <p className="text-[10px] font-bold text-rose-700 uppercase mb-1.5">Blockierungsgründe</p>
        <ul className="space-y-1">
          {blockReasons.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-rose-900">
              <XCircle className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />{r}
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-rose-100 border border-rose-200 rounded px-2.5 py-2 text-xs text-rose-800">
        <strong>Warum kein Auto-Fix?</strong> Approval-, PDF-, Rollen- und Compliance-Entscheide berühren rechtlich bindende Prozesse und dürfen ausschliesslich durch einen autorisierten Administrator manuell entschieden und dokumentiert werden.
      </div>
      {incident.affected_entities?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-rose-700 uppercase mb-1">Betroffene Entitäten</p>
          <div className="space-y-1">
            {incident.affected_entities.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs bg-white/60 rounded px-2 py-1">
                <span className="text-[9px] font-bold bg-rose-200 text-rose-800 px-1.5 rounded">{e.entity_type}</span>
                <span className="text-rose-900 truncate">{e.description || e.entity_id}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AutoFixSection({ incident, onAutoFixed }) {
  const [state, setState] = useState('idle');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!incident.auto_fix_possible || incident.governance_block) return null;
  if (GOVERNANCE_CATEGORIES.has(incident.category)) return null;
  if (!incident.auto_fix_action) return null;
  const action = AUTO_FIX_REGISTRY[incident.auto_fix_action];
  if (!action?.fn) return null;

  async function runAutoFix() {
    setState('running');
    setErrorMsg('');
    try {
      const res = await base44.functions.invoke(action.fn, {
        entity_id: incident.entity_id,
        entity_type: incident.entity_type,
        incident_id: incident.id,
      });
      setResult(res.data);
      setState('success');
      onAutoFixed(incident.id, `Auto-Fix via ${action.fn} — ${JSON.stringify(res.data).slice(0, 120)}`);
    } catch (e) {
      setErrorMsg(e?.response?.data?.error || e.message || 'Unbekannter Fehler');
      setState('error');
    }
  }

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Wrench className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="text-xs font-black text-blue-800 uppercase tracking-wide">Auto-Fix verfügbar</span>
        <span className="ml-auto text-[10px] bg-blue-100 border border-blue-200 text-blue-700 px-2 py-0.5 rounded font-semibold">SICHER — Keine Governance-Daten</span>
      </div>
      <p className="text-xs text-blue-800"><strong>Aktion:</strong> {action.label}</p>
      {state === 'idle' && (
        <button onClick={runAutoFix} className="flex items-center gap-2 text-xs font-bold px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Play className="w-3.5 h-3.5" /> Auto-Fix ausführen
        </button>
      )}
      {state === 'running' && (
        <div className="flex items-center gap-2 text-xs text-blue-700">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reparatur läuft…
        </div>
      )}
      {state === 'success' && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-emerald-800">Auto-Fix erfolgreich ausgeführt</p>
            {result && <p className="text-[10px] text-emerald-700 mt-0.5 font-mono">{JSON.stringify(result).slice(0, 200)}</p>}
          </div>
        </div>
      )}
      {state === 'error' && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-800">Auto-Fix fehlgeschlagen</p>
            <p className="text-[10px] text-red-700 mt-0.5">{errorMsg}</p>
            <button onClick={() => setState('idle')} className="text-[10px] text-red-600 underline mt-1">Erneut versuchen</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManualReviewSection({ incident, onUpdateStatus, updating }) {
  const [comment, setComment] = useState('');
  const [decision, setDecision] = useState('');
  const isGovBlock = incident.governance_block;
  const requiresComment = isGovBlock || incident.manual_review_required;
  const canSubmit = !requiresComment || (comment.trim().length >= 10 && decision);

  const DECISIONS = isGovBlock
    ? [
        { value: 'resolved',      label: 'Manuell behoben',       cls: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' },
        { value: 'accepted_risk', label: 'Risiko akzeptiert',     cls: 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100' },
        { value: 'rejected',      label: 'Finding abgelehnt',     cls: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' },
      ]
    : [
        { value: 'in_review',     label: 'In Prüfung setzen',     cls: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100' },
        { value: 'resolved',      label: 'Als behoben markieren', cls: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' },
        { value: 'accepted_risk', label: 'Risiko akzeptieren',    cls: 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100' },
      ];

  return (
    <div className="border border-amber-200 bg-amber-50/40 rounded-lg px-3 py-3 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span className="text-xs font-black text-amber-800 uppercase tracking-wide">
          {isGovBlock ? 'Governance-Entscheid dokumentieren' : 'Manual Review Workflow'}
        </span>
      </div>
      {requiresComment ? (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-amber-700 uppercase flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Pflicht-Kommentar {comment.trim().length < 10 && <span className="text-rose-500">({Math.max(0, 10 - comment.trim().length)} Zeichen noch)</span>}
          </label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={isGovBlock ? 'Was wurde geprüft? Welche Entscheidung wurde getroffen und warum? (min. 10 Zeichen)' : 'Was wurde untersucht? Was wurde getan oder entschieden? (min. 10 Zeichen)'}
            rows={3}
            className="w-full text-xs border border-amber-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none bg-white"
          />
        </div>
      ) : (
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Optionale Resolution Notes..."
          rows={2}
          className="w-full text-xs border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      )}
      <div className="flex gap-2 flex-wrap">
        {DECISIONS.map(d => (
          <button
            key={d.value}
            onClick={() => { setDecision(d.value); onUpdateStatus(incident.id, d.value, comment.trim() || undefined); }}
            disabled={updating || !canSubmit}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${d.cls}`}
          >
            {d.value === 'resolved' || d.value === 'in_review' ? <CheckSquare className="w-3 h-3" /> : <SkipForward className="w-3 h-3" />}
            {d.label}
          </button>
        ))}
      </div>
      {requiresComment && !canSubmit && (
        <p className="text-[10px] text-amber-700 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Bitte Pflicht-Kommentar ausfüllen (min. 10 Zeichen) um eine Entscheidung zu treffen.
        </p>
      )}
    </div>
  );
}

function ResolutionSummary({ incident }) {
  if (!['resolved', 'closed', 'accepted_risk', 'auto_fixed', 'rejected'].includes(incident.status)) return null;
  return (
    <div className="bg-muted/30 border border-border/60 rounded-lg px-3 py-2.5 space-y-1">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Resolution</span>
        <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded border ${STATUS_CFG[incident.status]?.color || ''}`}>
          {STATUS_CFG[incident.status]?.label || incident.status}
        </span>
      </div>
      {incident.resolution_notes && <p className="text-xs text-foreground">{incident.resolution_notes}</p>}
      {incident.resolved_at && (
        <p className="text-[10px] text-muted-foreground">
          {new Date(incident.resolved_at).toLocaleString('de-CH')} · {incident.resolved_by || '—'}
        </p>
      )}
    </div>
  );
}

// ─── Incident Row ──────────────────────────────────────────────────────────────

function IncidentRow({ incident, onUpdateStatus, onAutoFixed, updating }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_CFG[incident.severity] || SEVERITY_CFG.warning;
  const SevIcon = sev.icon;
  const statusCfg = STATUS_CFG[incident.status] || STATUS_CFG.open;
  const isActive = ['open', 'investigating', 'in_progress', 'in_review'].includes(incident.status);

  return (
    <div className={`border rounded-xl overflow-hidden ${sev.border}`}>
      <div
        className={`px-4 py-3 flex items-start gap-3 cursor-pointer ${sev.bg} hover:brightness-95 transition-all`}
        onClick={() => setExpanded(e => !e)}
      >
        <SevIcon className={`w-4 h-4 mt-0.5 shrink-0 ${sev.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${sev.badge}`}>{sev.label}</span>
            <span className="text-xs bg-white/70 text-muted-foreground px-2 py-0.5 rounded border border-border/60">
              {CATEGORY_LABELS[incident.category] || incident.category}
            </span>
            {incident.governance_block && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-rose-100 text-rose-700 border-rose-200 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Gov-Block
              </span>
            )}
            {incident.auto_fix_possible && !incident.governance_block && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1">
                <Wrench className="w-2.5 h-2.5" /> Auto-Fix
              </span>
            )}
            {incident.sla_status === 'breached' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-rose-100 text-rose-700 border-rose-200">SLA BREACH</span>
            )}
            <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded border ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground mt-1.5">{incident.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{incident.description}</p>
          {!expanded && incident.root_cause && (
            <p className="text-[11px] text-rose-700 mt-1 italic truncate">Ursache: {incident.root_cause.split('.')[0]}.</p>
          )}
        </div>
        <div className="shrink-0 text-muted-foreground mt-1">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>

      {expanded && (
        <div className="bg-white border-t border-border/60 px-4 py-4 space-y-4">
          <MetaGrid incident={incident} />
          <RootCauseSection incident={incident} />
          {incident.governance_block && <GovernanceBlockSection incident={incident} />}
          <RecommendedFixSection incident={incident} />
          {isActive && (
            <div className="space-y-3 pt-1 border-t border-border/30">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Resolution Actions</p>
              <AutoFixSection incident={incident} onAutoFixed={onAutoFixed} />
              <ManualReviewSection incident={incident} onUpdateStatus={onUpdateStatus} updating={updating} />
            </div>
          )}
          <ResolutionSummary incident={incident} />
          {incident.incident_audit_log?.length > 0 && (
            <div className="border border-border/40 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Audit-Trail ({incident.incident_audit_log.length} Einträge)</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {[...incident.incident_audit_log].reverse().map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] text-muted-foreground">
                    <span className="shrink-0 font-mono">{entry.timestamp ? new Date(entry.timestamp).toLocaleString('de-CH') : '—'}</span>
                    <span className="text-foreground font-medium">{entry.user_name || entry.user_id || '—'}</span>
                    <span>→ {entry.action}</span>
                    {entry.comment && <span className="italic truncate max-w-[200px]">"{entry.comment}"</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Tab ──────────────────────────────────────────────────────────────────

export default function TabIncidents() {
  const [filter, setFilter] = useState('open');
  const [severityFilter, setSeverityFilter] = useState('all');
  const qc = useQueryClient();

  const { data: allIncidents = [] } = useQuery({
    queryKey: ['ecc_incidents'],
    queryFn: () => base44.entities.EnterpriseIncident.list('-detected_at', 200),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['enterprise_incidents', filter],
    queryFn: () => {
      if (filter === 'open')      return base44.entities.EnterpriseIncident.filter({ status: 'open' }, '-detected_at', 100);
      if (filter === 'in_review') return base44.entities.EnterpriseIncident.filter({ status: 'in_review' }, '-detected_at', 100);
      if (filter === 'resolved')  return base44.entities.EnterpriseIncident.filter({ status: 'resolved' }, '-resolved_at', 50);
      return base44.entities.EnterpriseIncident.list('-detected_at', 200);
    },
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, notes }) => {
      const me = await base44.auth.me();
      const isResolved = ['resolved', 'accepted_risk', 'auto_fixed', 'rejected', 'closed'].includes(status);
      const existing = incidents.find(i => i.id === id);
      const auditEntry = {
        timestamp: new Date().toISOString(),
        user_id: me.id,
        user_name: me.full_name || me.email,
        action: status,
        previous_status: existing?.status,
        new_status: status,
        comment: notes || '',
      };
      return base44.entities.EnterpriseIncident.update(id, {
        status,
        resolution_notes: notes || undefined,
        resolved_at: isResolved ? new Date().toISOString() : undefined,
        resolved_by: isResolved ? (me.full_name || me.email) : undefined,
        incident_audit_log: [...(existing?.incident_audit_log || []), auditEntry],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enterprise_incidents'] });
      qc.invalidateQueries({ queryKey: ['ecc_incidents'] });
    },
  });

  const handleUpdateStatus = useCallback((id, status, notes) => updateMutation.mutate({ id, status, notes }), [updateMutation]);
  const handleAutoFixed    = useCallback((id, notes) => updateMutation.mutate({ id, status: 'auto_fixed', notes }), [updateMutation]);

  const displayed = useMemo(
    () => severityFilter === 'all' ? incidents : incidents.filter(i => i.severity === severityFilter),
    [incidents, severityFilter]
  );

  const counts = useMemo(() => ({
    blocking:   allIncidents.filter(i => i.severity === 'blocking' && ['open','investigating','in_progress'].includes(i.status)).length,
    critical:   allIncidents.filter(i => i.severity === 'critical' && ['open','investigating','in_progress'].includes(i.status)).length,
    warning:    allIncidents.filter(i => i.severity === 'warning'  && ['open','investigating','in_progress'].includes(i.status)).length,
    governance: allIncidents.filter(i => i.governance_block && ['open','investigating','in_progress'].includes(i.status)).length,
    open:       allIncidents.filter(i => ['open','investigating','in_progress','in_review'].includes(i.status)).length,
  }), [allIncidents]);

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Incident Resolution Framework</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Root Cause · Auto-Fix · Manual Review · Governance-Entscheid · Vollständiger Audit-Trail
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="border border-blue-200 bg-blue-50 rounded-lg px-4 py-3 flex items-start gap-2">
          <Wrench className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-blue-800">Auto-Fix</p>
            <p className="text-xs text-blue-700">Deterministische Reparatur. Keine Governance-Daten. Vollständiger Audit-Eintrag.</p>
          </div>
        </div>
        <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 flex items-start gap-2">
          <Eye className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-800">Manual Review</p>
            <p className="text-xs text-amber-700">Admin-Entscheid. Pflicht-Kommentar. Dokumentierte Entscheidung.</p>
          </div>
        </div>
        <div className="border border-rose-200 bg-rose-50 rounded-lg px-4 py-3 flex items-start gap-2">
          <Lock className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-rose-800">Governance-Block</p>
            <p className="text-xs text-rose-700">Approval, PDFs, Rollen, Provisionen — immer human, immer dokumentiert.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {[
          ['Blocking',   counts.blocking,   'text-rose-700 bg-rose-50 border-rose-300'],
          ['Critical',   counts.critical,   'text-red-700 bg-red-50 border-red-300'],
          ['Warning',    counts.warning,    'text-amber-700 bg-amber-50 border-amber-300'],
          ['Governance', counts.governance, 'text-rose-800 bg-rose-50 border-rose-200'],
          ['Aktiv ges.', counts.open,       'text-foreground bg-muted border-border'],
        ].map(([l, v, cls]) => (
          <div key={l} className={`border rounded-xl px-3 py-3 text-center ${cls}`}>
            <div className="text-xl font-black">{v}</div>
            <div className="text-[10px] font-medium mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {[['open','Offen'],['in_review','In Prüfung'],['resolved','Behoben'],['all','Alle']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${filter === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        {['all','blocking','critical','warning','info'].map(v => (
          <button key={v} onClick={() => setSeverityFilter(v)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${severityFilter === v ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {v === 'all' ? 'Alle' : v.toUpperCase()}
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
            {filter === 'open' ? 'Keine offenen Governance-Incidents.' : 'Keine Einträge für diesen Filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(inc => (
            <IncidentRow
              key={inc.id}
              incident={inc}
              onUpdateStatus={handleUpdateStatus}
              onAutoFixed={handleAutoFixed}
              updating={updateMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}