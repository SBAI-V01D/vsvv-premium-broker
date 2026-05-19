import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Search, Shield, AlertTriangle, Activity, Clock, ChevronDown, ChevronRight, Play } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  1: { label: 'Critical', className: 'bg-red-50 text-red-700 border border-red-200' },
  2: { label: 'Lifecycle', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  3: { label: 'Guard', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  4: { label: 'Debug', className: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

const GUARD_CONFIG = {
  blocked: { className: 'bg-red-50 text-red-700 border border-red-200', label: 'Blocked' },
  allowed: { className: 'bg-green-50 text-green-700 border border-green-200', label: 'Allowed' },
  skipped: { className: 'bg-slate-100 text-slate-500 border border-slate-200', label: 'Skipped' },
  error:   { className: 'bg-red-100 text-red-800 border border-red-300', label: 'Error' },
};

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AuditRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const lvl = LEVEL_CONFIG[log.audit_level] || LEVEL_CONFIG[4];
  const guard = log.guard_result ? GUARD_CONFIG[log.guard_result] : null;

  return (
    <>
      <tr
        className="border-b border-border hover:bg-slate-50/60 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmt(log.timestamp)}</td>
        <td className="px-3 py-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${lvl.className}`}>{lvl.label}</span>
        </td>
        <td className="px-3 py-2">
          <span className="text-xs font-mono text-slate-600">{log.event_type || '—'}</span>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{log.trigger_source || '—'}</td>
        <td className="px-3 py-2">
          {guard && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${guard.className}`}>{guard.label}</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs font-mono text-primary truncate max-w-[140px]">{log.correlation_id || '—'}</td>
        <td className="px-3 py-2 text-xs font-mono text-slate-500 truncate max-w-[160px]">{log.decision_code || '—'}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{log.entity_type || '—'}</td>
        <td className="px-3 py-2 text-right">
          {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" /> : <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/80 border-b border-border">
          <td colSpan={9} className="px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <p><span className="font-semibold text-muted-foreground">Decision Logic:</span> <span>{log.decision_logic || '—'}</span></p>
                <p><span className="font-semibold text-muted-foreground">Guard:</span> <span className="font-mono">{log.guard_evaluated || '—'}</span></p>
                <p><span className="font-semibold text-muted-foreground">Guard Reason:</span> <span>{log.guard_reason || '—'}</span></p>
                <p><span className="font-semibold text-muted-foreground">Actor:</span> <span>{log.actor_name || log.actor_id || '—'} ({log.actor_type})</span></p>
                <p><span className="font-semibold text-muted-foreground">Process:</span> <span className="font-mono text-slate-600">{log.process_type} / {log.process_stage}</span></p>
                <p><span className="font-semibold text-muted-foreground">Process-ID:</span> <span className="font-mono text-slate-500 break-all">{log.process_id || '—'}</span></p>
              </div>
              <div className="space-y-1.5">
                <p><span className="font-semibold text-muted-foreground">Business Impact:</span> <span>{log.business_impact_description || '—'}</span>
                  {log.business_impact_financial_chf > 0 && <span className="ml-1 font-semibold text-emerald-700">CHF {log.business_impact_financial_chf?.toLocaleString('de-CH')}</span>}
                </p>
                <p><span className="font-semibold text-muted-foreground">Severity:</span> <span>{log.business_severity_type} / {log.business_severity_level}</span></p>
                <p><span className="font-semibold text-muted-foreground">Entity:</span> <span className="font-mono">{log.entity_type} / {log.entity_id}</span></p>
                <p><span className="font-semibold text-muted-foreground">Sequence:</span> <span>#{log.event_sequence}</span></p>
                {log.error_message && <p className="text-red-600"><span className="font-semibold">Error:</span> {log.error_message}</p>}
              </div>
              {(log.previous_state_summary && Object.keys(log.previous_state_summary).length > 0) && (
                <div>
                  <p className="font-semibold text-muted-foreground mb-1">Previous State:</p>
                  <pre className="bg-white border border-border rounded p-2 text-[10px] text-slate-600 overflow-auto">{JSON.stringify(log.previous_state_summary, null, 2)}</pre>
                </div>
              )}
              {(log.new_state_summary && Object.keys(log.new_state_summary).length > 0) && (
                <div>
                  <p className="font-semibold text-muted-foreground mb-1">New State:</p>
                  <pre className="bg-white border border-border rounded p-2 text-[10px] text-slate-600 overflow-auto">{JSON.stringify(log.new_state_summary, null, 2)}</pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function KpiTile({ icon: IconComponent, label, value, sub, color = 'slate' }) {
  const Icon = IconComponent;
  const colors = {
    red:   'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    blue:  'border-blue-200 bg-blue-50 text-blue-700',
    slate: 'border-border bg-card text-foreground',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${colors[color]}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <p className="text-[11px] font-medium opacity-70">{label}</p>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterGuard, setFilterGuard] = useState('all');
  const [filterProcess, setFilterProcess] = useState('all');
  const [validationResult, setValidationResult] = useState(null);

  const loadLogs = async () => {
    setLoading(true);
    const data = await base44.entities.AuditLog.list('-created_date', 200);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, []);

  const runValidation = async () => {
    setRunning(true);
    const res = await base44.functions.invoke('enterpriseValidationSuite', { suite: 'all' });
    setValidationResult(res.data);
    setRunning(false);
    loadLogs();
  };

  // Filtered logs
  const filtered = logs.filter(log => {
    if (filterLevel !== 'all' && String(log.audit_level) !== filterLevel) return false;
    if (filterGuard !== 'all' && log.guard_result !== filterGuard) return false;
    if (filterProcess !== 'all' && log.process_type !== filterProcess) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (log.correlation_id || '').toLowerCase().includes(q) ||
        (log.decision_code || '').toLowerCase().includes(q) ||
        (log.event_type || '').toLowerCase().includes(q) ||
        (log.trigger_source || '').toLowerCase().includes(q) ||
        (log.entity_id || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // KPIs
  const critical = logs.filter(l => l.audit_level === 1).length;
  const blocked = logs.filter(l => l.guard_result === 'blocked').length;
  const withCorrelation = logs.filter(l => l.correlation_id).length;
  const processTypes = [...new Set(logs.filter(l => l.process_type).map(l => l.process_type))];

  const readiness = validationResult?.enterprise_readiness;
  const readinessColor = !readiness ? 'slate' :
    readiness.level === 'ENTERPRISE_READY' ? 'green' :
    readiness.level === 'ALMOST_READY' ? 'blue' :
    readiness.level === 'NEEDS_ATTENTION' ? 'amber' : 'red';

  return (
    <div className="p-6 space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Enterprise Audit Monitor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Prozess-Observability · Guard Analytics · Lifecycle Intelligence</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={runValidation} disabled={running} className="gap-2">
            <Play className="w-3.5 h-3.5" />
            {running ? 'Validierung...' : 'Enterprise Validation'}
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
        <KpiTile icon={Activity} label="Total Audit Logs" value={logs.length} sub="Letzte 200 Einträge" color="slate" />
        <KpiTile icon={AlertTriangle} label="Critical Events (L1)" value={critical} sub="Financial / Compliance" color={critical > 0 ? 'red' : 'slate'} />
        <KpiTile icon={Shield} label="Guard Blocks" value={blocked} sub="Verhinderte Operationen" color={blocked > 0 ? 'amber' : 'slate'} />
        <KpiTile icon={Clock} label="Correlation Coverage" value={`${logs.length > 0 ? ((withCorrelation / logs.length) * 100).toFixed(0) : 0}%`} sub={`${withCorrelation} mit Correlation-ID`} color="blue" />
        {readiness && (
          <KpiTile icon={Shield} label="Enterprise Readiness" value={`${validationResult.summary.pass_rate}%`} sub={readiness.level} color={readinessColor} />
        )}
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div className={`rounded-xl border p-4 ${readiness.level === 'ENTERPRISE_READY' ? 'border-emerald-200 bg-emerald-50' : readiness.level.includes('BLOCKED') ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">{readiness.action_required}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {validationResult.summary.total_checks} Checks · {validationResult.summary.passed} bestanden · {validationResult.summary.warnings} Warnungen · {validationResult.summary.critical} Kritisch
              </p>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${readiness.level === 'ENTERPRISE_READY' ? 'bg-emerald-700 text-white' : 'bg-amber-700 text-white'}`}>
              {readiness.level}
            </span>
          </div>
          {/* Section details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {Object.entries(validationResult.sections).map(([key, section]) => (
              <div key={key} className="bg-white/70 rounded-lg border border-white p-3 text-xs">
                <p className="font-semibold text-slate-700 uppercase tracking-wide text-[10px] mb-1">{key}</p>
                <p className="text-emerald-700">✓ {section.passed} passed</p>
                {section.warnings > 0 && <p className="text-amber-600">⚠ {section.warnings} warnings</p>}
                {section.failures > 0 && <p className="text-red-600">✗ {section.failures} failures</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Correlation-ID, Decision-Code, Event-Type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Audit Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Level</SelectItem>
            <SelectItem value="1">L1 Critical</SelectItem>
            <SelectItem value="2">L2 Lifecycle</SelectItem>
            <SelectItem value="3">L3 Guard</SelectItem>
            <SelectItem value="4">L4 Debug</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterGuard} onValueChange={setFilterGuard}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Guard Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Guards</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="allowed">Allowed</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterProcess} onValueChange={setFilterProcess}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Prozess-Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prozesse</SelectItem>
            {processTypes.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} Einträge</span>
      </div>

      {/* Timeline Table */}
      <div className="surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-3 py-2.5 text-left font-semibold">Zeitstempel</th>
                <th className="px-3 py-2.5 text-left font-semibold">Level</th>
                <th className="px-3 py-2.5 text-left font-semibold">Event Type</th>
                <th className="px-3 py-2.5 text-left font-semibold">Source</th>
                <th className="px-3 py-2.5 text-left font-semibold">Guard</th>
                <th className="px-3 py-2.5 text-left font-semibold">Correlation-ID</th>
                <th className="px-3 py-2.5 text-left font-semibold">Decision Code</th>
                <th className="px-3 py-2.5 text-left font-semibold">Entity</th>
                <th className="px-3 py-2.5 text-right font-semibold w-8"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">Lade Audit Logs...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">Keine Einträge gefunden</td></tr>
              ) : (
                filtered.map(log => <AuditRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}