/**
 * Customers — Relationship Intelligence Workspace
 * Premium Financial Platform: monochrome · whitespace · typography-first
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Plus, User, Building2, Upload, Download, Users, Search,
  AlertTriangle, Loader2, XCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import CustomerForm from '@/components/customers/CustomerForm';
import CompanyForm from '@/components/customers/CompanyForm';
import FastImportWizard from '@/components/customers/FastImportWizard';
import CustomerMergeDialog from '@/components/customers/CustomerMergeDialog';
import CustomerCard from '@/components/customers/CustomerCard';
import { searchCustomers, scoreCustomer } from '@/lib/customerSearch';
import EmptyState, { LoadingTable } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';

// ── Segment builder ────────────────────────────────────────────────────────
function buildSegments(customers, tasks, contracts, documents) {
  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const ninetyAgo = new Date();
  ninetyAgo.setDate(ninetyAgo.getDate() - 90);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in90Days = new Date(today); in90Days.setDate(in90Days.getDate() + 90);

  const tasksByCustomer = {};
  (tasks || []).forEach(t => {
    if (t.customer_id && (t.status === 'open' || t.status === 'in_progress'))
      tasksByCustomer[t.customer_id] = (tasksByCustomer[t.customer_id] || 0) + 1;
  });

  const contractsByCustomer = {};
  (contracts || []).forEach(c => {
    if (c.customer_id && c.status === 'active')
      contractsByCustomer[c.customer_id] = (contractsByCustomer[c.customer_id] || 0) + 1;
  });

  const docsByCustomer = {};
  (documents || []).forEach(d => {
    if (d.customer_id)
      docsByCustomer[d.customer_id] = (docsByCustomer[d.customer_id] || 0) + 1;
  });

  const primary = customers.filter(c => !c.is_family_member);

  const defs = {
    all:              { label: 'Alle Kunden',          filter: () => true },
    no_advisor:       { label: '⚠ Kein Berater',       filter: c => !c.advisor_id && !c.primary_advisor_id },
    critical:         { label: 'Attention Required',   filter: c => c.status === 'inactive' || ['invalid','expired'].includes(c.mandate_status) },
    mandate:          { label: 'Mandat ausstehend',    filter: c => c.mandate_status === 'pending' },
    tasks:            { label: 'Offene Tasks',         filter: c => (tasksByCustomer[c.id] || 0) > 0 },
    active:           { label: 'Aktiv',                filter: c => c.status === 'active' },
    vip:              { label: 'High Value',           filter: c => (c.total_premium || 0) >= 5000 },
    new:              { label: 'Neuzugänge',           filter: c => new Date(c.created_date) >= thirtyAgo },
    prospect:         { label: 'Interessenten',        filter: c => c.status === 'prospect' },
    private:          { label: 'Privatkunden',         filter: c => c.customer_type !== 'business' },
    business:         { label: 'Unternehmen',          filter: c => c.customer_type === 'business' },
    
    // NEW: Operational Intelligence Segments
    renewal_critical: { label: '🔴 Renewal kritisch',  filter: c => {
      const custContracts = (contracts || []).filter(cc => cc.customer_id === c.id && cc.status === 'active');
      return custContracts.some(cc => {
        if (!cc.cancellation_deadline) return false;
        const cd = new Date(cc.cancellation_deadline);
        return cd >= today && cd <= in90Days;
      });
    }},
    no_activity_90:   { label: '🕐 Keine Aktivität 90T', filter: c => new Date(c.updated_date) <= ninetyAgo },
    no_documents:     { label: '📄 Fehlende Dokumente', filter: c => (docsByCustomer[c.id] || 0) === 0 },
    high_commission:  { label: '💰 Hohe Provision',     filter: c => (c.total_premium || 0) >= 10000 },
    household_potential: { label: '👥 Household Potenzial', filter: c => !c.is_family_member && (c.civil_status === 'married' || c.civil_status === 'registered_partnership') },
    cross_selling:    { label: '🎯 Cross-Selling',      filter: c => {
      const custContracts = (contracts || []).filter(cc => cc.customer_id === c.id && cc.status === 'active');
      const sparten = new Set(custContracts.map(cc => cc.sparte));
      return sparten.size < 2 && custContracts.length >= 1;
    }},
  };

  const segs = {};
  Object.entries(defs).forEach(([k, v]) => {
    segs[k] = { ...v, count: primary.filter(v.filter).length };
  });

  return { ...segs, tasksByCustomer, contractsByCustomer, docsByCustomer };
}

// ── Today Focus Panel ──────────────────────────────────────────────────────
function TodayFocusPanel({ tasks, contracts }) {
  const navigate = useNavigate();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const in14 = new Date(today); in14.setDate(in14.getDate() + 14);

  const urgent = (tasks || []).filter(t =>
    (t.status === 'open' || t.status === 'in_progress') && t.priority === 'urgent'
  );
  const dueToday = (tasks || []).filter(t =>
    (t.status === 'open' || t.status === 'in_progress') &&
    t.due_date && new Date(t.due_date) <= tomorrow && t.priority !== 'urgent'
  );
  const expiring = (contracts || []).filter(c => {
    if (['cancelled', 'archived', 'expired'].includes(c.status)) return false;
    const cd = c.cancellation_deadline ? new Date(c.cancellation_deadline) : null;
    return cd && cd >= today && cd <= in14;
  });
  const allOpen = (tasks || []).filter(t => t.status === 'open' || t.status === 'in_progress');

  return (
    <div className="space-y-5">

      <div className="space-y-3">
        {[
          { label: 'Offene Tasks',      value: allOpen.length,    alert: allOpen.length > 0 },
          { label: 'Dringend',          value: urgent.length,     alert: urgent.length > 0, red: true },
          { label: 'Policen ablaufend', value: expiring.length,   alert: expiring.length > 0 },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400">{item.label}</span>
            <span className={`text-[13px] font-bold tabular-nums ${
              item.red && item.alert ? 'text-red-600' :
              item.alert ? 'text-amber-600' : 'text-slate-400'
            }`}>{item.value}</span>
          </div>
        ))}
      </div>

      {urgent.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-red-500 mb-2">Dringend</p>
          <div className="space-y-1.5">
            {urgent.slice(0, 4).map(t => (
              <div key={t.id} className="border-l-2 border-red-400 pl-3 py-1">
                <p className="text-[11px] font-semibold text-slate-700 truncate">{t.title}</p>
                {t.customer_name && <p className="text-[10px] text-slate-400">{t.customer_name}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {dueToday.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-amber-500 mb-2">Heute fällig</p>
          <div className="space-y-1.5">
            {dueToday.slice(0, 4).map(t => (
              <button
                key={t.id}
                onClick={() => navigate('/aufgaben')}
                className="w-full text-left border-l-2 border-amber-300 pl-3 py-1 hover:bg-amber-50/60 rounded-r transition-colors"
              >
                <p className="text-[11px] font-semibold text-slate-700 truncate">{t.title}</p>
                {t.customer_name && <p className="text-[10px] text-slate-400">{t.customer_name}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      {expiring.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-2">Renewal Risk</p>
          <div className="space-y-1.5">
            {expiring.slice(0, 3).map(c => (
              <div key={c.id} className="border-l-2 border-slate-300 pl-3 py-1">
                <p className="text-[11px] font-semibold text-slate-700 truncate">{c.insurer}</p>
                <p className="text-[10px] text-slate-400">{c.customer_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {urgent.length === 0 && dueToday.length === 0 && expiring.length === 0 && (
        <p className="text-[11px] text-slate-400 py-4 text-center">Keine Aktionen heute</p>
      )}
    </div>
  );
}

// ── Sort helper ────────────────────────────────────────────────────────────
function sortCustomers(list, sortBy) {
  if (sortBy === 'updated') return [...list];
  if (sortBy === 'premium') return [...list].sort((a, b) => (b.total_premium || 0) - (a.total_premium || 0));
  if (sortBy === 'new') return [...list].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  // Default: alphabetical
  return [...list].sort((a, b) => {
    const na = (a.company_name || a.last_name || '').toLowerCase();
    const nb = (b.company_name || b.last_name || '').toLowerCase();
    if (!na && nb) return 1;
    if (na && !nb) return -1;
    if (na !== nb) return na.localeCompare(nb, 'de-CH');
    return (a.first_name || '').toLowerCase().localeCompare((b.first_name || '').toLowerCase(), 'de-CH');
  });
}

// Operational Workspace Modes — horizontal, ruhig
const WORKSPACE_MODES = [
  { id: 'all', label: 'Portfolio' },
  { id: 'private', label: 'Privatkunden' },
  { id: 'business', label: 'Unternehmen' },
  { id: 'risks', label: 'Risiken' },
  { id: 'actions', label: 'Handlungen' },
];

// ── Grouped customer feed ─────────────────────────────────────────────────
function CustomerFeed({ displayed, customers, segments, matchedFamilyIds, onEdit, onDelete, allContracts, allTasks, allDocuments }) {
  const businesses = displayed.filter(c => c.customer_type === 'business');
  const privates   = displayed.filter(c => c.customer_type !== 'business');
  const showGroups = businesses.length > 0 && privates.length > 0;

  const renderCard = (customer) => (
    <CustomerCard
      key={customer.id}
      customer={customer}
      familyMembers={customers.filter(c => c.primary_customer_id === customer.id)}
      contractCount={segments.contractsByCustomer?.[customer.id] || 0}
      taskCount={segments.tasksByCustomer?.[customer.id] || 0}
      matchedFamilyIds={matchedFamilyIds}
      onEdit={onEdit}
      onDelete={onDelete}
      allContracts={allContracts}
      allTasks={allTasks}
      allDocuments={allDocuments}
    />
  );

  if (!showGroups) return <>{displayed.map(renderCard)}</>;

  return (
    <>
      {privates.length > 0 && (
        <>
          <div className="flex items-center gap-3 pt-2 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Privatkunden</span>
            <span className="text-[10px] text-slate-300">{privates.length}</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
          {privates.map(renderCard)}
        </>
      )}
      {businesses.length > 0 && (
        <>
          <div className="flex items-center gap-3 pt-4 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Unternehmen</span>
            <span className="text-[10px] text-slate-300">{businesses.length}</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
          {businesses.map(renderCard)}
        </>
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Customers() {
  const navigate = useNavigate();
  const [showForm, setShowForm]         = useState(false);
  const [editing, setEditing]           = useState(null);
  const [newCustomerType, setNewCustomerType] = useState('private');
  const [workspaceMode, setWorkspaceMode] = useState('all');
  const [sortBy, setSortBy]               = useState('alpha');
  const [search, setSearch]             = useState('');
  const [showImport, setShowImport]     = useState(false);
  const [showMerge, setShowMerge]       = useState(false);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list('-created_date', 50),
    staleTime: 10 * 60 * 1000,
  });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const all = await base44.entities.Customer.filter({ archived: false }, '-updated_date', 500);
      if (currentUser?.role === 'admin') return all;
      if (currentUser?.role === 'broker' || currentUser?.role === 'assistenz') {
        return all.filter(c =>
          c.primary_advisor_id === currentUser.id ||
          (c.assigned_advisors || []).includes(currentUser.id) ||
          (c.assigned_assistants || []).includes(currentUser.id) ||
          c.advisor_id === currentUser.id
        );
      }
      return [];
    },
    enabled: !!currentUser,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['customers_tasks'],
    queryFn: () => base44.entities.Task.filter({ status: 'open' }, '-due_date', 200),
    staleTime: 60_000,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['customers_contracts'],
    queryFn: () => base44.entities.Contract.filter({ status: 'active', archived: false }, '-created_date', 500),
    staleTime: 60_000,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['customers_leads'],
    queryFn: () => base44.entities.Lead.filter({ status: 'new' }, '-created_date', 100),
    staleTime: 60_000,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['customers_documents'],
    queryFn: () => base44.entities.Document.filter({ archived: false }, '-uploaded_at', 500),
    staleTime: 60_000,
  });

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['customers_verkaufschancen'],
    queryFn: () => base44.entities.Verkaufschance.filter({}),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); setEditing(null); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); setEditing(null); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });

  const segments = useMemo(() => buildSegments(customers, tasks, contracts, documents), [customers, tasks, contracts, documents]);
  const primaryCustomers = useMemo(() => customers.filter(c => !c.is_family_member), [customers]);

  // Workspace Mode Filtering
  const modeFiltered = useMemo(() => {
    if (workspaceMode === 'all') return primaryCustomers;
    if (workspaceMode === 'private') return primaryCustomers.filter(c => c.customer_type !== 'business');
    if (workspaceMode === 'business') return primaryCustomers.filter(c => c.customer_type === 'business');
    if (workspaceMode === 'risks') {
      // Alle Risikosegmente combined
      return primaryCustomers.filter(c => {
        const hasRisk = segments.renewal_critical?.filter?.(c) || segments.no_activity_90?.filter?.(c) || 
                        segments.no_documents?.filter?.(c) || segments.no_advisor?.filter?.(c) ||
                        segments.critical?.filter?.(c);
        return hasRisk;
      });
    }
    if (workspaceMode === 'actions') {
      // Alle Handlungen: Tasks + Opportunities
      return primaryCustomers.filter(c => {
        const hasTasks = segments.tasks?.filter?.(c);
        const hasOpportunity = verkaufschancen.some(v => v.customer_id === c.id && !['gewonnen','verloren'].includes(v.status));
        return hasTasks || hasOpportunity;
      });
    }
    return primaryCustomers;
  }, [primaryCustomers, workspaceMode, segments, verkaufschancen]);

  // Search: when query active, search ALL customers (primary + family members)
  const { displayed, matchedFamilyIds } = useMemo(() => {
    const familyMembers = customers.filter(c => c.is_family_member);
    if (!search.trim()) {
      return { displayed: sortCustomers(modeFiltered, sortBy), matchedFamilyIds: new Set() };
    }
    // Search across ALL customers (primary + family) so mode filter doesn't hide results
    const allCustomers = [...primaryCustomers, ...familyMembers];
    const directMatches = searchCustomers(allCustomers, search);
    
    // Separate matches into primary customers and family members
    const primaryMatches = directMatches.filter(c => !c.is_family_member);
    const matchedFamily = directMatches.filter(m => m.is_family_member);
    const matchedFamilyMemberIds = new Set(matchedFamily.map(m => m.id));
    
    // Get ALL parent customers for matched family members
    const parentIds = new Set(matchedFamily.map(m => m.primary_customer_id).filter(Boolean));
    // Include parent customers even if they're also direct matches (they should appear once)
    const familyParents = primaryCustomers.filter(c => parentIds.has(c.id));
    
    // Combine: primary matches + parents of matched family members (deduplicated)
    const combinedMap = new Map();
    [...primaryMatches, ...familyParents].forEach(c => {
      if (!combinedMap.has(c.id)) {
        combinedMap.set(c.id, c);
      }
    });
    
    // When searching, sort by relevance (score), not alphabetically
    const searchResults = Array.from(combinedMap.values());
    if (search.trim()) {
      const tokens = search.trim().split(/\s+/);
      const withScores = searchResults.map(c => ({ customer: c, score: scoreCustomer(c, tokens) }));
      return {
        displayed: withScores.sort((a, b) => b.score - a.score).map(({ customer }) => customer),
        matchedFamilyIds: matchedFamilyMemberIds,
      };
    }
    
    return {
      displayed: sortCustomers(searchResults, sortBy),
      matchedFamilyIds: matchedFamilyMemberIds,
    };
  }, [modeFiltered, search, customers, primaryCustomers, sortBy]);

  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  const criticalCount = segments.critical?.count ?? 0;
  const totalPremium = contracts.reduce((s, c) => s + (c.premium_yearly || 0), 0);

  const handleSave = async (data) => {
    if (editing) { updateMutation.mutate({ id: editing.id, data }); return; }
    const orgId = data.organization_id || organizations[0]?.id || '';
    let cData = { ...data, organization_id: orgId };
    if (!cData.customer_number) {
      try {
        const r = await base44.functions.invoke('generateCustomerNumber', {});
        if (r?.data?.customer_number) cData.customer_number = r.data.customer_number;
      } catch {}
    }
    createMutation.mutate(cData);
  };

  const handleExport = () => {
    if (!displayed.length) return;
    const headers = ['Nr.', 'Vorname', 'Nachname', 'Email', 'Telefon', 'Stadt', 'Status'];
    const rows = displayed.map(c => [c.customer_number || '', c.first_name, c.last_name, c.email, c.phone || '', c.city || '', c.status]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `portfolio_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Operational Workspace Bar — horizontal, ruhig ───────────────── */}
      <div className="px-6 py-4 border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] shrink-0">
        <div className="flex items-center gap-6 flex-wrap">
          {/* Title */}
          <div className="shrink-0">
            <h1 className="text-h2 font-bold text-[hsl(var(--primary))] tracking-tight">Portfolio</h1>
            <p className="text-body-sm text-[hsl(var(--text-muted))] mt-0.5">{primaryCustomers.length} Kunden</p>
          </div>

          {/* Workspace Modes */}
          <div className="flex items-center gap-1">
            {WORKSPACE_MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => setWorkspaceMode(mode.id)}
                className={cn(
                  'px-4 py-2 text-[13px] font-medium rounded-lg transition-all',
                  workspaceMode === mode.id
                    ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                    : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-2))]'
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[280px] max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--text-subtle))]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name, E-Mail, Kundennummer…"
                className="w-full pl-9 pr-8 py-1.5 text-[13px] border border-[hsl(var(--border-subtle))] rounded-lg bg-[hsl(var(--surface-0))] text-[hsl(var(--text-heading))] placeholder:text-[hsl(var(--text-subtle))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))/0.3] focus:border-[hsl(var(--primary))/0.4] transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-heading))]">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button onClick={handleExport} className="p-2 text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-2))] rounded-md transition-colors" title="Export">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => setShowMerge(true)} className="p-2 text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-2))] rounded-md transition-colors" title="Zusammenführen">
              <Users className="w-4 h-4" />
            </button>
            <button onClick={() => setShowImport(true)} className="p-2 text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-2))] rounded-md transition-colors" title="Import">
              <Upload className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-[hsl(var(--border-subtle))] mx-0.5" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="rounded-md h-8 text-[12.5px]">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Neuer Kunde
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditing(null); setNewCustomerType('private'); setShowForm(true); }}>
                  <User className="w-4 h-4 mr-2 text-[hsl(var(--text-muted))]" /> Privatkunde
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setEditing(null); setNewCustomerType('business'); setShowForm(true); }}>
                  <Building2 className="w-4 h-4 mr-2 text-[hsl(var(--text-muted))]" /> Firmenkunde
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ── 2-Column Layout — Workspace + Today Focus ─────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* CENTER — Relationship Feed (volle Breite) */}
        <div className="flex-1 overflow-y-auto bg-[hsl(var(--surface-1))]">
          {/* Mode Indicator */}
          <div className="sticky top-0 z-10 px-6 py-3 bg-white/95 backdrop-blur-sm border-b border-[hsl(var(--border-subtle))] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-[hsl(var(--text-heading))]">
                {WORKSPACE_MODES.find(m => m.id === workspaceMode)?.label || 'Portfolio'}
              </span>
              <span className="text-[11px] text-[hsl(var(--text-muted))]">
                {displayed.length} Kunden{search ? ` · "${search}"` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="text-[11px] border border-[hsl(var(--border-subtle))] rounded-lg px-2.5 py-1.5 bg-[hsl(var(--surface-0))] text-[hsl(var(--text-heading))] focus:outline-none"
              >
                <option value="alpha">A – Z</option>
                <option value="updated">Zuletzt aktualisiert</option>
                <option value="premium">Höchste Prämie</option>
                <option value="new">Neuste zuerst</option>
              </select>
            </div>
          </div>

          <div className="p-6 space-y-6 max-w-6xl mx-auto">
            {isLoading ? (
              <LoadingTable rows={8} className="py-12" />
            ) : displayed.length === 0 ? (
              <EmptyState
                type={search ? 'empty' : 'customers'}
                title={search ? 'Keine Ergebnisse' : 'Keine Kunden'}
                description={search ? 'Passen Sie den Suchbegriff an oder ändern Sie das Filter.' : 'Fügen Sie Ihren ersten Kunden hinzu, um zu starten.'}
                action={
                  !search && (
                    <button
                      onClick={() => { setEditing(null); setNewCustomerType('private'); setShowForm(true); }}
                      className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
                    >
                      <Plus className="w-4 h-4" /> Kunde hinzufügen
                    </button>
                  )
                }
                size="lg"
              />
            ) : (
              <>
                {/* Privatkunden Gruppe */}
                {displayed.filter(c => c.customer_type !== 'business').length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Privatkunden</h3>
                      <span className="text-[10px] text-slate-400">({displayed.filter(c => c.customer_type !== 'business').length})</span>
                    </div>
                    <CustomerFeed
                      displayed={displayed.filter(c => c.customer_type !== 'business')}
                      customers={customers}
                      segments={segments}
                      matchedFamilyIds={matchedFamilyIds}
                      onEdit={(c) => { setEditing(c); setShowForm(true); }}
                      onDelete={(id) => { if (confirm('Kunde löschen?')) deleteMutation.mutate(id); }}
                      allContracts={contracts}
                      allTasks={tasks}
                      allDocuments={documents}
                    />
                  </div>
                )}

                {/* Firmenkunden Gruppe */}
                {displayed.filter(c => c.customer_type === 'business').length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-border/40">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Firmenkunden</h3>
                      <span className="text-[10px] text-slate-400">({displayed.filter(c => c.customer_type === 'business').length})</span>
                    </div>
                    <CustomerFeed
                      displayed={displayed.filter(c => c.customer_type === 'business')}
                      customers={customers}
                      segments={segments}
                      matchedFamilyIds={matchedFamilyIds}
                      onEdit={(c) => { setEditing(c); setShowForm(true); }}
                      onDelete={(id) => { if (confirm('Kunde löschen?')) deleteMutation.mutate(id); }}
                      allContracts={contracts}
                      allTasks={tasks}
                      allDocuments={documents}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT — Today Focus (nur Kritisches) */}
        <div className="w-64 shrink-0 border-l border-[hsl(var(--border-subtle))] bg-[hsl(var(--card))] overflow-y-auto py-6 px-5 hidden xl:block">
          <TodayFocusPanel tasks={tasks} contracts={contracts} />
        </div>
      </div>

      {/* ── Dialogs ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? (editing.is_family_member ? 'Familienmitglied' : editing.customer_type === 'business' ? 'Unternehmen' : 'Privatkunde') + ' bearbeiten'
                : newCustomerType === 'business' ? 'Neuer Firmenkunde' : 'Neuer Privatkunde'}
            </DialogTitle>
          </DialogHeader>
          {(editing?.customer_type === 'business' || (!editing && newCustomerType === 'business')) ? (
            <CompanyForm customer={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} saving={createMutation.isPending || updateMutation.isPending} />
          ) : (
            <CustomerForm customer={editing || { customer_type: 'private' }} primaryCustomers={primaryCustomers} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} saving={createMutation.isPending || updateMutation.isPending} />
          )}
        </DialogContent>
      </Dialog>

      <FastImportWizard open={showImport} onOpenChange={setShowImport}
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setSearch(''); setWorkspaceMode('all'); }} />
      <CustomerMergeDialog open={showMerge} onOpenChange={setShowMerge} />
    </div>
  );
}