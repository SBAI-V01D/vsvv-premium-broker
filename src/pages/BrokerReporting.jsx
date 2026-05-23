/**
 * Broker Reporting — V1
 * Entität → Filter → Felder → Vorschau → Export (CSV/Excel-kompatibel)
 * RLS: Provisionsdaten nur für admin/broker
 * Schweizer Formate: DD.MM.YYYY, Semikolon-CSV, CHF, UTF-8
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import * as XLSX from 'xlsx';
import {
  Download, Filter, Table2, ChevronRight, ChevronDown, Plus, X,
  BookOpen, Star, FileSpreadsheet, Eye, Loader2, AlertTriangle,
  Users, FileText, CheckSquare, Wallet, Target, FolderOpen, BarChart2, Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Swiss format helpers ────────────────────────────────────────────────────
const fmtDate = (v) => {
  if (!v) return '';
  try { return new Date(v).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return v; }
};
const fmtCHF = (v) => v != null ? `CHF ${Number(v).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
const fmtVal = (v) => {
  if (v == null || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return fmtDate(v);
  if (typeof v === 'number') return String(v).replace('.', ',');
  return String(v);
};

// ── Entity definitions ──────────────────────────────────────────────────────
const ENTITIES = [
  {
    id: 'customers', label: 'Kunden', icon: Users, adminOnly: false,
    fetch: () => base44.entities.Customer.filter({ archived: false }, '-updated_date', 1000),
    fields: [
      { id: 'customer_number', label: 'Kundennummer' },
      { id: 'last_name',       label: 'Nachname' },
      { id: 'first_name',      label: 'Vorname' },
      { id: 'email',           label: 'E-Mail' },
      { id: 'phone',           label: 'Telefon' },
      { id: 'birthdate',       label: 'Geburtsdatum', type: 'date' },
      { id: 'city',            label: 'Ort' },
      { id: 'canton',          label: 'Kanton' },
      { id: 'status',          label: 'Status' },
      { id: 'mandate_status',  label: 'Mandat-Status' },
      { id: 'customer_type',   label: 'Kundentyp' },
      { id: 'civil_status',    label: 'Zivilstand' },
      { id: 'nationality',     label: 'Nationalität' },
      { id: 'total_premium',   label: 'Jahresprämie', type: 'chf' },
      { id: 'assigned_broker', label: 'Berater (E-Mail)' },
      { id: 'notes',           label: 'Notizen' },
    ],
    filterFields: ['status', 'mandate_status', 'customer_type', 'canton', 'assigned_broker'],
  },
  {
    id: 'contracts', label: 'Verträge', icon: FileText, adminOnly: false,
    fetch: () => base44.entities.Contract.filter({ archived: false }, '-created_date', 1000),
    fields: [
      { id: 'policy_number',    label: 'Police-Nummer' },
      { id: 'customer_name',    label: 'Kunde' },
      { id: 'insurer',          label: 'Gesellschaft' },
      { id: 'insurance_type',   label: 'Sparte' },
      { id: 'product',          label: 'Produkt' },
      { id: 'status',           label: 'Status' },
      { id: 'premium_yearly',   label: 'Jahresprämie', type: 'chf' },
      { id: 'premium_monthly',  label: 'Monatsprämie', type: 'chf' },
      { id: 'start_date',       label: 'Beginn', type: 'date' },
      { id: 'end_date',         label: 'Ablauf', type: 'date' },
      { id: 'cancellation_deadline', label: 'Kündigungsfrist', type: 'date' },
      { id: 'renewal_status',   label: 'Renewal-Status' },
      { id: 'assigned_broker',  label: 'Berater' },
    ],
    filterFields: ['status', 'insurer', 'insurance_type', 'renewal_status', 'assigned_broker'],
  },
  {
    id: 'tasks', label: 'Aufgaben', icon: CheckSquare, adminOnly: false,
    fetch: () => base44.entities.Task.list('-created_date', 1000),
    fields: [
      { id: 'title',       label: 'Titel' },
      { id: 'status',      label: 'Status' },
      { id: 'priority',    label: 'Priorität' },
      { id: 'task_type',   label: 'Typ' },
      { id: 'due_date',    label: 'Fälligkeit', type: 'date' },
      { id: 'customer_name', label: 'Kunde' },
      { id: 'assigned_to', label: 'Zugewiesen an' },
      { id: 'notes',       label: 'Notizen' },
    ],
    filterFields: ['status', 'priority', 'task_type', 'assigned_to'],
  },
  {
    id: 'commissions', label: 'Provisionen', icon: Wallet, adminOnly: true,
    fetch: () => base44.entities.CommissionEntry.list('-created_date', 1000),
    fields: [
      { id: 'advisor_name',             label: 'Berater' },
      { id: 'customer_name',            label: 'Kunde' },
      { id: 'insurer',                  label: 'Gesellschaft' },
      { id: 'product_category',         label: 'Produkt' },
      { id: 'premium_yearly',           label: 'Jahresprämie', type: 'chf' },
      { id: 'courtage_status',          label: 'Courtage-Status' },
      { id: 'advisor_courtage_amount',  label: 'Courtage Brutto', type: 'chf' },
      { id: 'courtage_payout_amount',   label: 'Courtage Netto', type: 'chf' },
      { id: 'provision_status',         label: 'Provisions-Status' },
      { id: 'advisor_provision_amount', label: 'Provision Brutto', type: 'chf' },
      { id: 'provision_payout_amount',  label: 'Provision Netto', type: 'chf' },
      { id: 'entry_date',               label: 'Buchungsdatum', type: 'date' },
    ],
    filterFields: ['courtage_status', 'provision_status', 'insurer', 'advisor_name'],
  },
  {
    id: 'opportunities', label: 'Verkaufschancen', icon: Target, adminOnly: false,
    fetch: () => base44.entities.Verkaufschance.list('-created_date', 500),
    fields: [
      { id: 'title',           label: 'Bezeichnung' },
      { id: 'customer_name',   label: 'Kunde' },
      { id: 'sparte',          label: 'Sparte' },
      { id: 'status',          label: 'Status' },
      { id: 'priority',        label: 'Priorität' },
      { id: 'estimated_value', label: 'Geschätzter Wert', type: 'chf' },
      { id: 'expected_close_date', label: 'Abschluss erwartet', type: 'date' },
      { id: 'assigned_broker', label: 'Berater' },
    ],
    filterFields: ['status', 'priority', 'sparte', 'assigned_broker'],
  },
  {
    id: 'documents', label: 'Dokumente', icon: FolderOpen, adminOnly: false,
    fetch: () => base44.entities.Document.list('-uploaded_at', 500),
    fields: [
      { id: 'name',                    label: 'Dokumentname' },
      { id: 'customer_name',           label: 'Kunde' },
      { id: 'category',                label: 'Kategorie' },
      { id: 'doc_type',                label: 'Typ' },
      { id: 'classification_status',   label: 'Klassifizierung' },
      { id: 'uploaded_at',             label: 'Hochgeladen am', type: 'date' },
      { id: 'uploaded_by',             label: 'Hochgeladen von' },
    ],
    filterFields: ['category', 'classification_status', 'doc_type'],
  },
];

// ── Predefined templates ────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'renewal_90',
    label: 'Renewal nächste 90 Tage',
    entity: 'contracts',
    fields: ['policy_number', 'customer_name', 'insurer', 'insurance_type', 'premium_yearly', 'end_date', 'cancellation_deadline', 'renewal_status', 'assigned_broker'],
    filters: [{ field: 'status', op: 'eq', value: 'active' }],
    postFilter: (rows) => {
      const now = new Date();
      const d90 = new Date(); d90.setDate(d90.getDate() + 90);
      return rows.filter(r => {
        const ed = r.end_date ? new Date(r.end_date) : null;
        const cd = r.cancellation_deadline ? new Date(r.cancellation_deadline) : null;
        return (ed && ed >= now && ed <= d90) || (cd && cd >= now && cd <= d90);
      });
    },
  },
  {
    id: 'no_mandate',
    label: 'Kunden ohne Mandat',
    entity: 'customers',
    fields: ['customer_number', 'last_name', 'first_name', 'email', 'phone', 'mandate_status', 'assigned_broker'],
    filters: [{ field: 'mandate_status', op: 'in', value: 'pending,expired,invalid' }],
    postFilter: null,
  },
  {
    id: 'no_advisor',
    label: 'Kunden ohne Berater',
    entity: 'customers',
    fields: ['customer_number', 'last_name', 'first_name', 'email', 'phone', 'status', 'mandate_status'],
    filters: [],
    postFilter: (rows) => rows.filter(r => !r.assigned_broker && !r.advisor_id && !r.primary_advisor_id),
  },
  {
    id: 'active_contracts',
    label: 'Aktive Verträge — Übersicht',
    entity: 'contracts',
    fields: ['policy_number', 'customer_name', 'insurer', 'insurance_type', 'product', 'premium_yearly', 'start_date', 'end_date', 'assigned_broker'],
    filters: [{ field: 'status', op: 'eq', value: 'active' }],
    postFilter: null,
  },
  {
    id: 'open_opportunities',
    label: 'Offene Verkaufschancen',
    entity: 'opportunities',
    fields: ['title', 'customer_name', 'sparte', 'status', 'priority', 'estimated_value', 'expected_close_date', 'assigned_broker'],
    filters: [],
    postFilter: (rows) => rows.filter(r => !['gewonnen','verloren'].includes(r.status)),
  },
  {
    id: 'overdue_tasks',
    label: 'Überfällige Aufgaben',
    entity: 'tasks',
    fields: ['title', 'status', 'priority', 'due_date', 'customer_name', 'assigned_to'],
    filters: [],
    postFilter: (rows) => {
      const now = new Date();
      return rows.filter(r => r.due_date && new Date(r.due_date) < now && r.status !== 'completed');
    },
  },
];

// ── Filter operators ────────────────────────────────────────────────────────
const OPS = [
  { id: 'eq',       label: '=' },
  { id: 'neq',      label: '≠' },
  { id: 'contains', label: 'enthält' },
  { id: 'in',       label: 'ist eines von (Komma)' },
];

function applyFilter(row, filter) {
  const val = (row[filter.field] || '').toString().toLowerCase();
  const fv  = (filter.value || '').toLowerCase();
  if (filter.op === 'eq')       return val === fv;
  if (filter.op === 'neq')      return val !== fv;
  if (filter.op === 'contains') return val.includes(fv);
  if (filter.op === 'in')       return fv.split(',').map(s => s.trim()).includes(val);
  return true;
}

// ── CSV Export (Semikolon, UTF-8-BOM, Schweizer Formate) ───────────────────
function exportCSV(rows, fields, entityDef, filename) {
  const fieldDefs = entityDef.fields.filter(f => fields.includes(f.id));
  const header = fieldDefs.map(f => `"${f.label}"`).join(';');
  const lines = rows.map(row =>
    fieldDefs.map(f => {
      let v = row[f.id];
      if (f.type === 'date') v = fmtDate(v);
      else if (f.type === 'chf') v = v != null ? Number(v).toFixed(2).replace('.', ',') : '';
      else v = fmtVal(v);
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(';')
  );
  const csv = '\uFEFF' + [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── Excel Export (.xlsx, Schweizer Formate) ────────────────────────────────
function exportExcel(rows, fields, entityDef, filename) {
  const fieldDefs = entityDef.fields.filter(f => fields.includes(f.id));
  const header = fieldDefs.map(f => f.label);
  const data = rows.map(row =>
    fieldDefs.map(f => {
      let v = row[f.id];
      if (f.type === 'date') {
        if (!v) return '';
        try {
          const d = new Date(v);
          return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
        } catch { return v; }
      }
      else if (f.type === 'chf') {
        return v != null ? Number(v) : null;
      }
      else if (typeof v === 'boolean') return v ? 'Ja' : 'Nein';
      else if (typeof v === 'number') return v;
      else return v || '';
    })
  );
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  const colWidths = fieldDefs.map(f => ({ wch: Math.max(f.label.length, 12) }));
  ws['!cols'] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daten');
  XLSX.writeFile(wb, filename);
}

// ── PDF Export (Browser Print) ─────────────────────────────────────────────
function exportPDF(rows, fields, entityDef, filename) {
  const printWindow = window.open('', '_blank');
  const fieldDefs = entityDef.fields.filter(f => fields.includes(f.id));
  
  const tableRows = rows.map(row =>
    `<tr>
      ${fieldDefs.map(f => {
        let v = row[f.id];
        if (f.type === 'date') v = fmtDate(v);
        else if (f.type === 'chf') v = fmtCHF(v);
        else v = fmtVal(v);
        return `<td>${v || '—'}</td>`;
      }).join('')}
    </tr>`
  ).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${entityDef.label} - ${filename}</title>
      <style>
        @media print {
          @page { margin: 1.5cm; size: A4 landscape; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: Arial, sans-serif; margin: 2cm; }
        h1 { color: #1e3a5f; margin-bottom: 0.5cm; }
        .meta { font-size: 11px; color: #666; margin-bottom: 1cm; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #f1f5f9; padding: 8px 6px; text-align: left; font-weight: 600; border-bottom: 2px solid #cbd5e1; }
        td { padding: 6px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
      </style>
    </head>
    <body>
      <h1>${entityDef.label}</h1>
      <div class="meta">
        Export: ${new Date().toLocaleString('de-CH')} | Datensätze: ${rows.length} | Felder: ${fieldDefs.length}
      </div>
      <table>
        <thead>
          <tr>
            ${fieldDefs.map(f => `<th>${f.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
}

// ── Step indicator ──────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Entität', 'Filter', 'Felder', 'Vorschau & Export'];
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all',
            i === current ? 'bg-[hsl(var(--primary))] text-white' :
            i < current  ? 'bg-emerald-100 text-emerald-700' :
                           'bg-slate-100 text-slate-400'
          )}>
            <span className={cn(
              'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold',
              i === current ? 'bg-white/30' : i < current ? 'bg-emerald-200' : 'bg-slate-200'
            )}>{i < current ? '✓' : i + 1}</span>
            {s}
          </div>
          {i < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 mx-1 flex-shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function BrokerReporting() {
  const [step, setStep]               = useState(0);
  const [entityId, setEntityId]       = useState(null);
  const [filters, setFilters]         = useState([]);
  const [logic, setLogic]             = useState('AND');
  const [selectedFields, setSelectedFields] = useState([]);
  const [previewRows, setPreviewRows] = useState(null);
  const [totalCount, setTotalCount]   = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [postFilterFn, setPostFilterFn] = useState(null);
  const [showAllRows, setShowAllRows] = useState(false);

  const { data: currentUser } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const isAdmin  = currentUser?.role === 'admin';
  const isBroker = currentUser?.role === 'broker' || isAdmin;

  const entityDef = ENTITIES.find(e => e.id === entityId);
  const visibleEntities = ENTITIES.filter(e => !e.adminOnly || isBroker);
  const visibleTemplates = TEMPLATES.filter(t => {
    const ent = ENTITIES.find(e => e.id === t.entity);
    return !ent?.adminOnly || isBroker;
  });

  // Apply template
  const loadTemplate = (tpl) => {
    setActiveTemplate(tpl.id);
    setEntityId(tpl.entity);
    setFilters(tpl.filters.map((f, i) => ({ ...f, id: i })));
    setSelectedFields(tpl.fields);
    setPostFilterFn(() => tpl.postFilter || null);
    setPreviewRows(null);
    setTotalCount(null);
    setStep(3);
  };

  const addFilter = () => {
    if (filters.length >= 5) return;
    const ff = entityDef?.filterFields?.[0] || '';
    setFilters(prev => [...prev, { id: Date.now(), field: ff, op: 'eq', value: '' }]);
  };
  const removeFilter = (id) => setFilters(prev => prev.filter(f => f.id !== id));
  const updateFilter = (id, key, val) => setFilters(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));

  const toggleField = (fid) => setSelectedFields(prev =>
    prev.includes(fid) ? prev.filter(x => x !== fid) : [...prev, fid]
  );
  const selectAllFields = () => setSelectedFields(entityDef?.fields.map(f => f.id) || []);
  const clearAllFields  = () => setSelectedFields([]);

  const runPreview = async () => {
    if (!entityDef) return;
    setLoadingPreview(true);
    setShowAllRows(false);
    try {
      let rows = await entityDef.fetch();
      // Apply filters
      rows = rows.filter(row => {
        const results = filters
          .filter(f => f.field && f.value)
          .map(f => applyFilter(row, f));
        if (results.length === 0) return true;
        return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
      });
      // Post-filter (template logic)
      if (postFilterFn) rows = postFilterFn(rows);
      setTotalCount(rows.length);
      setPreviewRows(rows.slice(0, 10));
    } finally {
      setLoadingPreview(false);
    }
  };

  const showAllPreview = async () => {
    if (!entityDef || totalCount === null) return;
    setLoadingPreview(true);
    try {
      let rows = await entityDef.fetch();
      rows = rows.filter(row => {
        const results = filters
          .filter(f => f.field && f.value)
          .map(f => applyFilter(row, f));
        if (results.length === 0) return true;
        return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
      });
      if (postFilterFn) rows = postFilterFn(rows);
      setPreviewRows(rows); // Alle anzeigen
      setShowAllRows(true);
    } finally {
      setLoadingPreview(false);
    }
  };

  const runExport = async () => {
    if (!entityDef) return;
    setLoadingPreview(true);
    try {
      let rows = await entityDef.fetch();
      rows = rows.filter(row => {
        const results = filters
          .filter(f => f.field && f.value)
          .map(f => applyFilter(row, f));
        if (results.length === 0) return true;
        return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
      });
      if (postFilterFn) rows = postFilterFn(rows);
      const fields = selectedFields.length > 0 ? selectedFields : entityDef.fields.map(f => f.id);
      const date = new Date().toLocaleDateString('de-CH').replace(/\./g, '-');
      exportCSV(rows, fields, entityDef, `${entityDef.label}_${date}.csv`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const runExportExcel = async () => {
    if (!entityDef) return;
    setLoadingPreview(true);
    try {
      let rows = await entityDef.fetch();
      rows = rows.filter(row => {
        const results = filters
          .filter(f => f.field && f.value)
          .map(f => applyFilter(row, f));
        if (results.length === 0) return true;
        return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
      });
      if (postFilterFn) rows = postFilterFn(rows);
      const fields = selectedFields.length > 0 ? selectedFields : entityDef.fields.map(f => f.id);
      const date = new Date().toLocaleDateString('de-CH').replace(/\./g, '-');
      exportExcel(rows, fields, entityDef, `${entityDef.label}_${date}.xlsx`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const runExportPDF = async () => {
    if (!entityDef) return;
    setLoadingPreview(true);
    try {
      let rows = await entityDef.fetch();
      rows = rows.filter(row => {
        const results = filters
          .filter(f => f.field && f.value)
          .map(f => applyFilter(row, f));
        if (results.length === 0) return true;
        return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
      });
      if (postFilterFn) rows = postFilterFn(rows);
      const fields = selectedFields.length > 0 ? selectedFields : entityDef.fields.map(f => f.id);
      const date = new Date().toLocaleDateString('de-CH').replace(/\./g, '-');
      exportPDF(rows, fields, entityDef, `${entityDef.label}_${date}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const canProceedStep0 = !!entityId;
  const canProceedStep1 = true;
  const canProceedStep2 = selectedFields.length > 0;

  return (
    <div className="min-h-full bg-[hsl(var(--surface-1))]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-sm">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Broker Reporting</h1>
            <p className="text-xs text-slate-500">Operative Auswertungen — Entität · Filter · Felder · Export (CSV, Excel-kompatibel, Schweizer Format)</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Templates */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
            <Star className="w-3 h-3" /> Schnelltemplates
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {visibleTemplates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => loadTemplate(tpl)}
                className={cn(
                  'text-left px-3 py-2.5 rounded-lg border text-[12px] font-medium transition-all',
                  activeTemplate === tpl.id
                    ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                )}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200" />

        {/* Steps */}
        <Steps current={step} />

        {/* ── STEP 0: Entität ── */}
        {step === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-800 mb-4">Welche Daten möchten Sie auswerten?</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {visibleEntities.map(ent => {
                const Icon = ent.icon;
                return (
                  <button
                    key={ent.id}
                    onClick={() => {
                      setEntityId(ent.id);
                      setFilters([]);
                      setSelectedFields([]);
                      setPreviewRows(null);
                      setTotalCount(null);
                      setActiveTemplate(null);
                      setPostFilterFn(null);
                    }}
                    className={cn(
                      'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left',
                      entityId === ent.id
                        ? 'border-[hsl(var(--primary))] bg-blue-50'
                        : 'border-slate-200 hover:border-blue-300 bg-white'
                    )}
                  >
                    <Icon className={cn('w-5 h-5', entityId === ent.id ? 'text-[hsl(var(--primary))]' : 'text-slate-400')} />
                    <div>
                      <p className={cn('text-sm font-semibold', entityId === ent.id ? 'text-[hsl(var(--primary))]' : 'text-slate-700')}>{ent.label}</p>
                      {ent.adminOnly && <p className="text-[10px] text-amber-600 font-medium">Admin/Broker</p>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!canProceedStep0} className="gap-2">
                Weiter <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Filter ── */}
        {step === 1 && entityDef && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">Filter definieren</h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Logik:</span>
                {['AND', 'OR'].map(l => (
                  <button key={l} onClick={() => setLogic(l)}
                    className={cn('text-[11px] font-bold px-2.5 py-1 rounded border transition-all',
                      logic === l ? 'bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    )}>{l}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {filters.map(f => (
                <div key={f.id} className="flex items-center gap-2">
                  <select value={f.field} onChange={e => updateFilter(f.id, 'field', e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 flex-1">
                    {entityDef.filterFields.map(ff => {
                      const fd = entityDef.fields.find(x => x.id === ff);
                      return <option key={ff} value={ff}>{fd?.label || ff}</option>;
                    })}
                  </select>
                  <select value={f.op} onChange={e => updateFilter(f.id, 'op', e.target.value)}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 w-36">
                    {OPS.map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
                  </select>
                  <input value={f.value} onChange={e => updateFilter(f.id, 'value', e.target.value)}
                    placeholder="Wert…"
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                  <button onClick={() => removeFilter(f.id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {filters.length === 0 && (
                <p className="text-xs text-slate-400 italic py-2">Kein Filter — alle Datensätze werden exportiert.</p>
              )}
            </div>

            {filters.length < 5 && (
              <button onClick={addFilter} className="flex items-center gap-1.5 text-xs font-medium text-[hsl(var(--primary))] hover:text-blue-700 mb-4">
                <Plus className="w-3.5 h-3.5" /> Filter hinzufügen {filters.length > 0 && `(${filters.length}/5)`}
              </button>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>Zurück</Button>
              <Button onClick={() => setStep(2)} className="gap-2">
                Weiter <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Felder ── */}
        {step === 2 && entityDef && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">Felder auswählen</h2>
              <div className="flex gap-2">
                <button onClick={selectAllFields} className="text-[11px] text-[hsl(var(--primary))] hover:underline font-medium">Alle</button>
                <span className="text-slate-300">|</span>
                <button onClick={clearAllFields} className="text-[11px] text-slate-500 hover:underline font-medium">Keine</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5">
              {entityDef.fields.map(f => (
                <label key={f.id} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={selectedFields.includes(f.id)}
                    onChange={() => toggleField(f.id)}
                    className="w-3.5 h-3.5 rounded accent-[hsl(var(--primary))]" />
                  <span className={cn('text-xs transition-colors', selectedFields.includes(f.id) ? 'text-slate-800 font-medium' : 'text-slate-500 group-hover:text-slate-700')}>
                    {f.label}
                    {f.type === 'chf' && <span className="ml-1 text-[9px] text-emerald-600 font-semibold">CHF</span>}
                    {f.type === 'date' && <span className="ml-1 text-[9px] text-blue-500 font-semibold">Datum</span>}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mb-4">{selectedFields.length} von {entityDef.fields.length} Felder gewählt</p>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
              <Button onClick={() => { setStep(3); runPreview(); }} disabled={!canProceedStep2} className="gap-2">
                Vorschau laden <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Vorschau & Export ── */}
        {step === 3 && entityDef && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  {React.createElement(entityDef.icon, { className: 'w-4 h-4 text-blue-600' })}
                </div>
                <span className="text-sm font-bold text-slate-700">{entityDef.label}</span>
              </div>
              {filters.filter(f => f.value).length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  {filters.filter(f => f.value).map(f => {
                    const fd = entityDef.fields.find(x => x.id === f.field);
                    return (
                      <span key={f.id} className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                        {fd?.label || f.field} {OPS.find(o => o.id === f.op)?.label} {f.value}
                      </span>
                    );
                  })}
                  {filters.filter(f => f.value).length > 1 && (
                    <span className="text-[10px] font-bold text-slate-400">{logic}</span>
                  )}
                </div>
              )}
              <div className="ml-auto flex items-center gap-2">
                {totalCount !== null && (
                  <span className={cn(
                    'text-sm font-bold px-3 py-1 rounded-full',
                    totalCount === 0 ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'
                  )}>
                    {totalCount} Datensätze
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={runPreview} disabled={loadingPreview} className="gap-1.5 text-xs">
                  {loadingPreview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  Aktualisieren
                </Button>
              </div>
            </div>

            {/* Loading */}
            {loadingPreview && (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
                <Loader2 className="w-7 h-7 text-blue-400 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Lade Daten…</p>
              </div>
            )}

            {/* Preview table */}
            {!loadingPreview && previewRows && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">
                    {showAllRows
                      ? `Alle ${totalCount} Datensätze`
                      : `Vorschau — erste ${previewRows.length} von ${totalCount} Datensätzen`
                    }
                  </p>
                  {!showAllRows && totalCount > 10 && (
                    <Button variant="outline" size="sm" onClick={showAllPreview} disabled={loadingPreview} className="gap-1.5 text-xs">
                      {loadingPreview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Table2 className="w-3.5 h-3.5" />}
                      Alle {totalCount} anzeigen
                    </Button>
                  )}
                </div>
                {previewRows.length === 0 ? (
                  <div className="p-8 text-center">
                    <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Keine Datensätze für diese Filter gefunden.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          {selectedFields.map(fid => {
                            const fd = entityDef.fields.find(x => x.id === fid);
                            return <th key={fid} className="text-left px-3 py-2 font-semibold text-slate-500 whitespace-nowrap">{fd?.label || fid}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={row.id || i} className="border-b border-slate-50 hover:bg-slate-50/60">
                            {selectedFields.map(fid => {
                              const fd = entityDef.fields.find(x => x.id === fid);
                              let val = row[fid];
                              if (fd?.type === 'date') val = fmtDate(val);
                              else if (fd?.type === 'chf') val = fmtCHF(val);
                              else val = fmtVal(val);
                              return (
                                <td key={fid} className="px-3 py-1.5 text-slate-700 max-w-[180px] truncate">
                                  {val || <span className="text-slate-300">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Export actions */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-600 mb-3">Export</p>
              <div className="flex flex-wrap gap-3 items-center">
                <Button onClick={runExport} disabled={loadingPreview || totalCount === 0}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 border-0">
                  {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  CSV {totalCount != null && `(${totalCount} Zeilen)`}
                </Button>
                <Button onClick={runExportExcel} disabled={loadingPreview || totalCount === 0}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 border-0">
                  {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  Excel {totalCount != null && `(${totalCount} Zeilen)`}
                </Button>
                <Button onClick={runExportPDF} disabled={loadingPreview || totalCount === 0}
                  variant="outline" className="gap-2">
                  {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                  PDF
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                CSV: Semikolon · UTF-8 | Excel: .xlsx mit Formatierung | PDF: A4 quer, druckoptimiert
              </p>
            </div>

            {/* Edit steps */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setStep(0)} className="text-[11px] text-slate-500 hover:text-slate-700 underline">Entität ändern</button>
              <span className="text-slate-300">·</span>
              <button onClick={() => setStep(1)} className="text-[11px] text-slate-500 hover:text-slate-700 underline">Filter ändern</button>
              <span className="text-slate-300">·</span>
              <button onClick={() => setStep(2)} className="text-[11px] text-slate-500 hover:text-slate-700 underline">Felder ändern</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}