/**
 * Customers — Relationship Intelligence Workspace
 * Premium Financial Platform: monochrome · whitespace · typography-first
 */
import React, { useState, useMemo } from 'react';
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
import { searchCustomers } from '@/lib/customerSearch';

// ── Segment builder ────────────────────────────────────────────────────────
function buildSegments(customers, tasks, contracts) {
  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);

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

  const primary = customers.filter(c => !c.is_family_member);

  const defs = {
    all:      { label: 'Alle Kunden',       filter: () => true },
    critical: { label: 'Attention Required', filter: c => c.status === 'inactive' || ['invalid','expired'].includes(c.mandate_status) },
    mandate:  { label: 'Mandat ausstehend',  filter: c => c.mandate_status === 'pending' },
    tasks:    { label: 'Offene Tasks',       filter: c => (tasksByCustomer[c.id] || 0) > 0 },
    active:   { label: 'Aktiv',              filter: c => c.status === 'active' },
    vip:      { label: 'High Value',         filter: c => (c.total_premium || 0) >= 5000 },
    new:      { label: 'Neuzugänge',         filter: c => new Date(c.created_date) >= thirtyAgo },
    prospect: { label: 'Interessenten',      filter: c => c.status === 'prospect' },
    private:  { label: 'Privatkunden',       filter: c => c.customer_type !== 'business' },
    business: { label: 'Unternehmen',        filter: c => c.customer_type === 'business' },
  };

  const segs = {};
  Object.entries(defs).forEach(([k, v]) => {
    segs[k] = { ...v, count: primary.filter(v.filter).length };
  });

  return { ...segs, tasksByCustomer, contractsByCustomer };
}

// ── Today Focus Panel ──────────────────────────────────────────────────────
function TodayFocusPanel({ tasks, contracts }) {
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
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400">
          {new Date().toLocaleDateString('de-CH', { weekday: 'long' })}
        </p>
        <p className="text-sm font-semibold text-slate-800 mt-0.5">
          {new Date().toLocaleDateString('de-CH', { day: 'numeric', month: 'long' })}
        </p>
      </div>

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
              <div key={t.id} className="border-l-2 border-amber-300 pl-3 py-1">
                <p className="text-[11px] font-semibold text-slate-700 truncate">{t.title}</p>
                {t.customer_name && <p className="text-[10px] text-slate-400">{t.customer_name}</p>}
              </div>
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

const NAV_KEYS = ['all','critical','mandate','tasks','active','vip','new','prospect','private','business'];

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Customers() {
  const [showForm, setShowForm]         = useState(false);
  const [editing, setEditing]           = useState(null);
  const [newCustomerType, setNewCustomerType] = useState('private');
  const [activeSegment, setActiveSegment] = useState('all');
  const [sortBy, setSortBy]             = useState('alpha');
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

  const segments = useMemo(() => buildSegments(customers, tasks, contracts), [customers, tasks, contracts]);
  const primaryCustomers = useMemo(() => customers.filter(c => !c.is_family_member), [customers]);

  const segFiltered = useMemo(() => {
    const seg = segments[activeSegment];
    if (!seg?.filter) return primaryCustomers;
    return primaryCustomers.filter(seg.filter);
  }, [primaryCustomers, activeSegment, segments]);

  // Search: when query active, search ALL primary customers (not just current segment)
  const { displayed, matchedFamilyIds } = useMemo(() => {
    const familyMembers = customers.filter(c => c.is_family_member);
    if (!search.trim()) {
      return { displayed: sortCustomers(segFiltered, sortBy), matchedFamilyIds: new Set() };
    }
    // Search across all primary customers so segment filter doesn't hide results
    const directMatches = searchCustomers(primaryCustomers, search);
    const directMatchIds = new Set(directMatches.map(c => c.id));
    const matchedFamily = searchCustomers(familyMembers, search);
    const matchedFamilyMemberIds = new Set(matchedFamily.map(m => m.id));
    const parentIds = new Set(matchedFamily.map(m => m.primary_customer_id).filter(Boolean));
    const familyParents = primaryCustomers.filter(c => parentIds.has(c.id) && !directMatchIds.has(c.id));
    return {
      displayed: sortCustomers([...directMatches, ...familyParents], sortBy),
      matchedFamilyIds: matchedFamilyMemberIds,
    };
  }, [segFiltered, search, customers, primaryCustomers, sortBy]);

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

      {/* ── Executive Header ── */}
      <div className="px-8 py-5 border-b border-border/50 bg-card shrink-0">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="shrink-0">
            <h1 className="text-[15px] font-semibold text-slate-900 leading-none">Portfolio</h1>
            <p className="text-[11px] text-slate-400 mt-0.5 tracking-wide">{primaryCustomers.length} Kunden</p>
          </div>

          <div className="flex-1 min-w-[240px] max-w-lg">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name, E-Mail, Kundennummer, Familienmitglied…"
                className="w-full pl-10 pr-9 py-2 text-[13px] border border-border/60 rounded-xl bg-background text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <button onClick={handleExport} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors" title="Export">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => setShowMerge(true)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors" title="Zusammenführen">
              <Users className="w-4 h-4" />
            </button>
            <button onClick={() => setShowImport(true)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors" title="Import">
              <Upload className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="rounded-xl">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Neuer Kunde
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditing(null); setNewCustomerType('private'); setShowForm(true); }}>
                  <User className="w-4 h-4 mr-2 text-slate-400" /> Privatkunde
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setEditing(null); setNewCustomerType('business'); setShowForm(true); }}>
                  <Building2 className="w-4 h-4 mr-2 text-slate-400" /> Firmenkunde
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* KPI Strip — monochrome */}
        <div className="mt-5 flex items-stretch gap-8 overflow-x-auto scrollbar-none">
          {[
            { label: 'Aktive Kunden', value: segments.active?.count ?? 0, onClick: () => setActiveSegment('active') },
            { label: 'Policen',       value: contracts.length,             onClick: () => {} },
            { label: 'Jahresprämien', value: `CHF ${Math.round(totalPremium / 1000)}k`, onClick: () => {} },
            { label: 'Offene Tasks',  value: openTasks,    alert: openTasks > 0,      onClick: () => setActiveSegment('tasks') },
            { label: 'Leads offen',   value: leads.length, onClick: () => {} },
            { label: 'Kritisch',      value: criticalCount, alert: criticalCount > 0, red: true, onClick: () => setActiveSegment('critical') },
          ].map((kpi, i, arr) => (
            <button
              key={kpi.label}
              onClick={kpi.onClick}
              className={`shrink-0 text-left hover:opacity-70 transition-opacity ${i < arr.length - 1 ? 'pr-8 border-r border-border/40' : ''}`}
            >
              <p className="text-[10px] uppercase tracking-widest font-medium text-slate-400">{kpi.label}</p>
              <p className={`text-2xl font-black mt-0.5 tabular-nums leading-none ${
                kpi.red && kpi.alert ? 'text-red-600' :
                kpi.alert ? 'text-amber-600' : 'text-slate-800'
              }`}>
                {kpi.value}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── 3-Column Layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT — Smart Navigation */}
        <div className="w-48 shrink-0 border-r border-border/40 bg-card overflow-y-auto py-6 px-4 hidden md:flex md:flex-col gap-0.5">
          {NAV_KEYS.map(key => {
            const seg = segments[key];
            if (!seg) return null;
            const isActive = activeSegment === key;
            const isCritical = key === 'critical' && seg.count > 0;
            return (
              <button
                key={key}
                onClick={() => setActiveSegment(key)}
                className={`flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive ? 'bg-slate-900 text-white' : 'hover:bg-slate-50 text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="text-[12px] font-medium truncate">{seg.label}</span>
                {seg.count > 0 && (
                  <span className={`text-[10px] font-bold tabular-nums ${
                    isActive ? 'text-white/60' :
                    isCritical ? 'text-red-500' :
                    key === 'mandate' && seg.count > 0 ? 'text-amber-500' : 'text-slate-400'
                  }`}>
                    {seg.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* CENTER — Relationship Feed */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30">
          {/* Segment bar */}
          <div className="sticky top-0 z-10 px-6 py-3 bg-white/90 backdrop-blur-sm border-b border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-slate-800">{segments[activeSegment]?.label ?? 'Alle'}</span>
              <span className="text-[11px] text-slate-400">
                {displayed.length} Kunden{search ? ` · "${search}"` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="text-[11px] border border-border/50 rounded-lg px-2 py-1 bg-background text-slate-500 focus:outline-none"
              >
                <option value="alpha">A – Z</option>
                <option value="updated">Zuletzt aktualisiert</option>
                <option value="premium">Höchste Prämie</option>
                <option value="new">Neuste zuerst</option>
              </select>
              <div className="md:hidden">
                <select value={activeSegment} onChange={e => setActiveSegment(e.target.value)}
                  className="text-xs border border-border rounded px-2 py-1 bg-background">
                  {NAV_KEYS.map(k => <option key={k} value={k}>{segments[k]?.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-3 max-w-3xl">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-20 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Lade Portfolio…
              </div>
            ) : displayed.length === 0 ? (
              <div className="py-20 text-center">
                <p className="text-sm font-medium text-slate-500">Keine Kunden in diesem Segment</p>
                <p className="text-[12px] text-slate-400 mt-1">{search ? 'Suchbegriff anpassen.' : 'Dieses Segment ist leer.'}</p>
              </div>
            ) : (
              displayed.map(customer => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  familyMembers={customers.filter(c => c.primary_customer_id === customer.id)}
                  contractCount={segments.contractsByCustomer?.[customer.id] || 0}
                  taskCount={segments.tasksByCustomer?.[customer.id] || 0}
                  matchedFamilyIds={matchedFamilyIds}
                  onEdit={(c) => { setEditing(c); setShowForm(true); }}
                  onDelete={(id) => { if (confirm('Kunde löschen?')) deleteMutation.mutate(id); }}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT — Operational Intelligence */}
        <div className="w-52 shrink-0 border-l border-border/40 bg-card overflow-y-auto py-6 px-5 hidden lg:block">
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
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setSearch(''); setActiveSegment('all'); }} />
      <CustomerMergeDialog open={showMerge} onOpenChange={setShowMerge} />
    </div>
  );
}