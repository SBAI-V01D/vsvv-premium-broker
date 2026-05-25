/**
 * TabGovernanceRules — Governance Observability & Rule Management
 *
 * Shows: active rules, enforcement distribution, violation metrics,
 * simulate_only tracking, timeout monitoring, rule lifecycle management.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Shield, Plus, Edit2, ToggleLeft, ToggleRight,
  AlertTriangle, CheckCircle2, Clock, Zap,
  BarChart3, Eye, Lock, Filter, Loader2,
  ChevronDown, ChevronUp, Info, Play
} from 'lucide-react';

// ─── Config ───────────────────────────────────────────────────────────────────

const LAYER_CFG = {
  WARNING:          { color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  VALIDATION:       { color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  GOVERNANCE_BLOCK: { color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-300',   badge: 'bg-rose-100 text-rose-700 border-rose-300' },
  SECURITY_BLOCK:   { color: 'text-red-800',    bg: 'bg-red-50',    border: 'border-red-300',    badge: 'bg-red-200 text-red-800 border-red-300' },
};

const STATUS_CFG = {
  draft:      { label: 'Draft',      color: 'text-slate-500  bg-slate-100 border-slate-200' },
  testing:    { label: 'Testing',    color: 'text-violet-600 bg-violet-50 border-violet-200' },
  active:     { label: 'Active',     color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  deprecated: { label: 'Deprecated', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  archived:   { label: 'Archived',   color: 'text-slate-400 bg-slate-50 border-slate-200' },
};

const MODE_CFG = {
  monitor: { label: 'Monitor', color: 'text-sky-600 bg-sky-50 border-sky-200' },
  enforce: { label: 'Enforce', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  strict:  { label: 'Strict',  color: 'text-rose-700 bg-rose-50 border-rose-200' },
};

const DEFAULT_RULE = {
  name: '',
  description: '',
  rule_version: '1.0',
  effective_from: new Date().toISOString(),
  entity_type: 'Customer',
  event_types: ['create', 'update'],
  layer: 'WARNING',
  business_criticality: 'MEDIUM',
  enforcement_mode: 'monitor',
  simulate_only: true,
  condition_json: { field: 'organization_id', op: 'exists' },
  custom_validator_function_name: '',
  error_message: '',
  resolution_guidance: '',
  rule_status: 'draft',
  rule_scope: 'GLOBAL',
  timeout_ms: 50,
};

// ─── KPI Bar ──────────────────────────────────────────────────────────────────

function GovernanceKpiBar({ rules }) {
  const active     = rules.filter(r => r.rule_status === 'active').length;
  const simOnly    = rules.filter(r => r.rule_status === 'active' && r.simulate_only).length;
  const enforcing  = rules.filter(r => r.rule_status === 'active' && !r.simulate_only && r.enforcement_mode !== 'monitor').length;
  const strict     = rules.filter(r => r.rule_status === 'active' && r.enforcement_mode === 'strict').length;
  const timedOut   = rules.filter(r => r.last_execution_ms > 0 && r.last_execution_ms > (r.timeout_ms || 50)).length;
  const totalViol  = rules.reduce((s, r) => s + (r.violation_count || 0), 0);

  const kpis = [
    { label: 'Aktive Regeln',     value: active,    color: 'text-foreground bg-white border-border' },
    { label: 'Simulate Only',     value: simOnly,   color: 'text-sky-700 bg-sky-50 border-sky-200' },
    { label: 'Enforcing',         value: enforcing, color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { label: 'Strict',            value: strict,    color: 'text-rose-700 bg-rose-50 border-rose-200' },
    { label: 'Timeout Warnings',  value: timedOut,  color: timedOut > 0 ? 'text-red-700 bg-red-50 border-red-200' : 'text-slate-500 bg-slate-50 border-slate-200' },
    { label: 'Total Violations',  value: totalViol, color: totalViol > 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {kpis.map(({ label, value, color }) => (
        <div key={label} className={`border rounded-xl px-3 py-3 text-center ${color}`}>
          <div className="text-xl font-black">{value}</div>
          <div className="text-[10px] font-medium mt-0.5 leading-tight">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Rule Form ────────────────────────────────────────────────────────────────

function RuleForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || DEFAULT_RULE);
  const useCustomValidator = !!(form.custom_validator_function_name?.trim());

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleEventType = (evt) => {
    const curr = form.event_types || [];
    set('event_types', curr.includes(evt) ? curr.filter(e => e !== evt) : [...curr, evt]);
  };

  return (
    <div className="bg-white border border-border/60 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Regelname *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder="z.B. CustomerOrgIdMandatory"
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Beschreibung *</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            rows={2} className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Entität</label>
          <input value={form.entity_type} onChange={e => set('entity_type', e.target.value)}
            placeholder="Customer"
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Version</label>
          <input value={form.rule_version} onChange={e => set('rule_version', e.target.value)}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Layer</label>
          <select value={form.layer} onChange={e => set('layer', e.target.value)}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring">
            {['WARNING','VALIDATION','GOVERNANCE_BLOCK','SECURITY_BLOCK'].map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Enforcement Mode</label>
          <select value={form.enforcement_mode} onChange={e => set('enforcement_mode', e.target.value)}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring">
            {['monitor','enforce','strict'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Kritikalität</label>
          <select value={form.business_criticality} onChange={e => set('business_criticality', e.target.value)}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring">
            {['LOW','MEDIUM','HIGH','CRITICAL'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Status</label>
          <select value={form.rule_status} onChange={e => set('rule_status', e.target.value)}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring">
            {['draft','testing','active','deprecated','archived'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Event Types */}
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Event Types</label>
          <div className="flex gap-2">
            {['create','update','delete','read'].map(evt => (
              <button key={evt} onClick={() => toggleEventType(evt)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  form.event_types?.includes(evt) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                }`}>{evt}</button>
            ))}
          </div>
        </div>

        {/* Simulate Only Toggle */}
        <div className="col-span-2 flex items-center justify-between border border-border/60 rounded-lg px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-foreground">Simulate Only</p>
            <p className="text-[10px] text-muted-foreground">Nur auditieren, niemals blockieren</p>
          </div>
          <button onClick={() => set('simulate_only', !form.simulate_only)}
            className={`transition-colors ${form.simulate_only ? 'text-sky-600' : 'text-slate-400'}`}>
            {form.simulate_only ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
          </button>
        </div>

        {/* Condition Type */}
        <div className="col-span-2 space-y-2">
          <div className="flex gap-2">
            <button onClick={() => set('custom_validator_function_name', '')}
              className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${!useCustomValidator ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
              condition_json (einfach)
            </button>
            <button onClick={() => set('custom_validator_function_name', '_')}
              className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${useCustomValidator ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
              custom_validator (komplex)
            </button>
          </div>

          {!useCustomValidator ? (
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">
                Condition JSON <span className="normal-case font-normal">(nur: exists, not_exists, equals, not_equals, in, not_in, AND/OR)</span>
              </label>
              <textarea
                value={typeof form.condition_json === 'object' ? JSON.stringify(form.condition_json, null, 2) : form.condition_json}
                onChange={e => { try { set('condition_json', JSON.parse(e.target.value)); } catch { set('condition_json', e.target.value); } }}
                rows={3} className="w-full text-xs font-mono border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
              <p className="text-[9px] text-muted-foreground mt-1">Beispiel: {"{"}"field": "organization_id", "op": "exists"{"}"}</p>
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Validator Function Name</label>
              <input value={form.custom_validator_function_name === '_' ? '' : form.custom_validator_function_name}
                onChange={e => set('custom_validator_function_name', e.target.value)}
                placeholder="z.B. validateTenantIntegrity"
                className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
              <p className="text-[9px] text-muted-foreground mt-1">Funktion muss {"{"}valid: boolean, message?: string{"}"} zurückgeben. Kein rekursiver enforceGovernance-Aufruf.</p>
            </div>
          )}
        </div>

        <div className="col-span-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Fehlermeldung *</label>
          <input value={form.error_message} onChange={e => set('error_message', e.target.value)}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Resolution Guidance</label>
          <input value={form.resolution_guidance || ''} onChange={e => set('resolution_guidance', e.target.value)}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>

        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Timeout Budget (ms)</label>
          <input type="number" value={form.timeout_ms || 50} onChange={e => set('timeout_ms', Number(e.target.value))}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Scope</label>
          <select value={form.rule_scope} onChange={e => set('rule_scope', e.target.value)}
            className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring">
            {['GLOBAL','ORGANIZATION','ENTITY','FEATURE'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-1 border-t border-border/40">
        <button onClick={() => onSave(form)} disabled={saving || !form.name || !form.error_message}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Speichern
        </button>
        <button onClick={onCancel}
          className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// ─── Rule Row ─────────────────────────────────────────────────────────────────

function RuleRow({ rule, onEdit, onToggleStatus, onTest }) {
  const [expanded, setExpanded] = useState(false);
  const layerCfg  = LAYER_CFG[rule.layer]  || LAYER_CFG.WARNING;
  const statusCfg = STATUS_CFG[rule.rule_status] || STATUS_CFG.draft;
  const modeCfg   = MODE_CFG[rule.enforcement_mode] || MODE_CFG.monitor;
  const isTimedOut = rule.last_execution_ms > 0 && rule.last_execution_ms > (rule.timeout_ms || 50);

  return (
    <div className={`border rounded-xl overflow-hidden ${layerCfg.border}`}>
      <div
        className={`px-4 py-3 flex items-start gap-3 cursor-pointer ${layerCfg.bg} hover:brightness-95 transition-all`}
        onClick={() => setExpanded(e => !e)}
      >
        <Shield className={`w-4 h-4 mt-0.5 shrink-0 ${layerCfg.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${layerCfg.badge}`}>{rule.layer}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${statusCfg.color}`}>{statusCfg.label}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${modeCfg.color}`}>{modeCfg.label}</span>
            {rule.simulate_only && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-sky-50 text-sky-700 border-sky-200 flex items-center gap-1"><Eye className="w-2.5 h-2.5" /> Simulate</span>}
            {isTimedOut && <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Timeout</span>}
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">v{rule.rule_version}</span>
          </div>
          <p className="text-sm font-semibold text-foreground mt-1">{rule.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{rule.description}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
            <span>{rule.entity_type} · {rule.event_types?.join(', ')}</span>
            {rule.execution_count > 0 && <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5" />{rule.execution_count} runs</span>}
            {rule.violation_count > 0 && <span className="flex items-center gap-1 text-rose-600"><AlertTriangle className="w-2.5 h-2.5" />{rule.violation_count} violations</span>}
            {rule.last_execution_ms > 0 && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{rule.last_execution_ms}ms</span>}
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>

      {expanded && (
        <div className="bg-white border-t border-border/60 px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              ['Scope',         rule.rule_scope],
              ['Kritikalität',  rule.business_criticality],
              ['Timeout Budget', `${rule.timeout_ms || 50}ms`],
              ['Simulate Count', rule.simulate_count || 0],
            ].map(([l, v]) => (
              <div key={l}>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{l}</div>
                <div className="font-medium text-foreground">{v}</div>
              </div>
            ))}
          </div>

          {rule.condition_json && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">condition_json</p>
              <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">{JSON.stringify(rule.condition_json, null, 2)}</pre>
            </div>
          )}
          {rule.custom_validator_function_name && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
              <p className="text-[10px] font-bold text-violet-600 uppercase mb-1">Custom Validator</p>
              <p className="text-xs font-mono text-violet-800">{rule.custom_validator_function_name}</p>
            </div>
          )}
          {rule.error_message && (
            <div className="text-xs text-foreground"><span className="font-semibold">Fehlermeldung:</span> {rule.error_message}</div>
          )}
          {rule.resolution_guidance && (
            <div className="text-xs text-foreground"><span className="font-semibold">Resolution:</span> {rule.resolution_guidance}</div>
          )}

          <div className="flex gap-2 pt-1 border-t border-border/40 flex-wrap">
            <button onClick={() => onEdit(rule)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-border rounded-lg hover:bg-accent transition-colors">
              <Edit2 className="w-3 h-3" /> Bearbeiten
            </button>
            {rule.rule_status !== 'active' && (
              <button onClick={() => onToggleStatus(rule.id, 'active')}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors">
                <Play className="w-3 h-3" /> Aktivieren
              </button>
            )}
            {rule.rule_status === 'active' && (
              <button onClick={() => onToggleStatus(rule.id, 'deprecated')}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors">
                Deaktivieren
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export default function TabGovernanceRules() {
  const [showForm, setShowForm]   = useState(false);
  const [editRule, setEditRule]   = useState(null);
  const [statusFilter, setStatus] = useState('all');
  const qc = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['governance_rules'],
    queryFn: () => base44.entities.GovernanceRule.list('-effective_from', 100),
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (form) => {
      const me = await base44.auth.me();
      const payload = {
        ...form,
        condition_json: form.custom_validator_function_name?.trim()
          ? undefined
          : (typeof form.condition_json === 'string' ? JSON.parse(form.condition_json) : form.condition_json),
        custom_validator_function_name: form.custom_validator_function_name?.trim() || undefined,
      };
      if (form.id) {
        return base44.entities.GovernanceRule.update(form.id, { ...payload, updated_by: me.id, updated_by_email: me.email, updated_at: new Date().toISOString() });
      }
      return base44.entities.GovernanceRule.create({ ...payload, created_by: me.id, created_by_email: me.email, created_at: new Date().toISOString() });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['governance_rules'] }); setShowForm(false); setEditRule(null); },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.GovernanceRule.update(id, { rule_status: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['governance_rules'] }),
  });

  const displayed = statusFilter === 'all' ? rules : rules.filter(r => r.rule_status === statusFilter);

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Governance Rule Framework</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Policy-as-Code · Simulate-First · Execution Budget · Async Audit · Reproduzierbar
          </p>
        </div>
        <button onClick={() => { setEditRule(null); setShowForm(true); }}
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Neue Regel
        </button>
      </div>

      {/* Design Principles reminder */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="border border-sky-200 bg-sky-50 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <Eye className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
          <div><p className="font-bold text-sky-800">Simulate First</p><p className="text-sky-700">Alle neuen Regeln starten mit simulate_only=true</p></div>
        </div>
        <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div><p className="font-bold text-amber-800">Execution Budget</p><p className="text-amber-700">WARNING 20ms · VALIDATION 50ms · BLOCK 100ms</p></div>
        </div>
        <div className="border border-rose-200 bg-rose-50 rounded-lg px-3 py-2.5 flex items-start gap-2">
          <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          <div><p className="font-bold text-rose-800">No Recursion</p><p className="text-rose-700">Kein enforceGovernance-Aufruf in Validatoren</p></div>
        </div>
      </div>

      <GovernanceKpiBar rules={rules} />

      {/* Form */}
      {(showForm || editRule) && (
        <RuleForm
          initial={editRule || DEFAULT_RULE}
          onSave={(form) => saveMutation.mutate(form)}
          onCancel={() => { setShowForm(false); setEditRule(null); }}
          saving={saveMutation.isPending}
        />
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap items-center">
        <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        {['all','draft','testing','active','deprecated','archived'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {s === 'all' ? 'Alle' : STATUS_CFG[s]?.label || s}
            {s !== 'all' && <span className="ml-1.5 text-[9px] opacity-60">{rules.filter(r => r.rule_status === s).length}</span>}
          </button>
        ))}
      </div>

      {/* Rule List */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Lade Governance Rules...
        </div>
      ) : displayed.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl px-8 py-12 text-center">
          <Shield className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground">Keine Governance Rules</p>
          <p className="text-xs text-muted-foreground mt-1">
            {statusFilter === 'all' ? 'Erstellen Sie die erste Governance-Regel.' : `Keine Regeln mit Status "${statusFilter}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(rule => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onEdit={(r) => { setEditRule(r); setShowForm(false); }}
              onToggleStatus={(id, status) => statusMutation.mutate({ id, status })}
            />
          ))}
        </div>
      )}
    </div>
  );
}