/**
 * Customers — Operational Command Center
 * Architektur: KPI-Bar · Smart Nav · Customer Cards · Today Focus
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Plus, User, Building2, Upload, Download, Users, Search,
  TrendingUp, Shield, CheckSquare, AlertTriangle, Target,
  FileText, Clock, Wallet, ChevronRight, Loader2, Filter,
  XCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import CustomerForm from '@/components/customers/CustomerForm';
import CompanyForm from '@/components/customers/CompanyForm';
import FastImportWizard from '@/components/customers/FastImportWizard';
import CustomerMergeDialog from '@/components/customers/CustomerMergeDialog';
import EmptyState from '@/components/shared/EmptyState';
import CustomerCard from '@/components/customers/CustomerCard';
import { searchCustomers } from '@/lib/customerSearch';

// ── Smart Nav Segmente ──────────────────────────────────────────────────────
function buildSegments(customers, tasks, contracts) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Task counts per customer
  const tasksByCustomer = {};
  (tasks || []).forEach(t => {
    if (t.customer_id && (t.status === 'open' || t.status === 'in_progress')) {
      tasksByCustomer[t.customer_id] = (tasksByCustomer[t.customer_id] || 0) + 1;
    }
  });

  // Contract counts per customer
  const contractsByCustomer = {};
  (contracts || []).forEach(c => {
    if (c.customer_id && c.status === 'active') {
      contractsByCustomer[c.customer_id] = (contractsByCustomer[c.customer_id] || 0) + 1;
    }
  });

  const primary = customers.filter(c => !c.is_family_member);

  return {
    all:        { label: 'Alle Kunden',        count: primary.length,                                  filter: () => true },
    active:     { label: 'Aktiv',              count: primary.filter(c => c.status === 'active').length, filter: c => c.status === 'active' },
    prospect:   { label: 'Interessenten',      count: primary.filter(c => c.status === 'prospect').length, filter: c => c.status === 'prospect' },
    new:        { label: 'Neu (30 Tage)',      count: primary.filter(c => new Date(c.created_date) >= thirtyDaysAgo).length, filter: c => new Date(c.created_date) >= thirtyDaysAgo },
    vip:        { label: 'VIP / High-Value',   count: primary.filter(c => (c.total_premium || 0) >= 5000).length, filter: c => (c.total_premium || 0) >= 5000 },
    mandate:    { label: 'Mandat offen',       count: primary.filter(c => c.mandate_status === 'pending').length, filter: c => c.mandate_status === 'pending' },
    critical:   { label: 'Kritisch',           count: primary.filter(c => c.status === 'inactive' || c.mandate_status === 'invalid' || c.mandate_status === 'expired').length, filter: c => c.status === 'inactive' || c.mandate_status === 'invalid' || c.mandate_status === 'expired' },
    tasks:      { label: 'Offene Tasks',       count: primary.filter(c => (tasksByCustomer[c.id] || 0) > 0).length, filter: c => (tasksByCustomer[c.id] || 0) > 0 },
    private:    { label: 'Privatkunden',       count: primary.filter(c => c.customer_type !== 'business').length, filter: c => c.customer_type !== 'business' },
    business:   { label: 'Unternehmen',        count: primary.filter(c => c.customer_type === 'business').length, filter: c => c.customer_type === 'business' },
    tasksByCustomer,
    contractsByCustomer,
  };
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`group flex-1 min-w-0 bg-card border border-border rounded-xl px-4 py-3.5 text-left hover:shadow-card-md transition-all hover:border-${color}-300/60`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
          <p className="text-2xl font-black text-foreground mt-0.5 leading-none">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-${color}-50 border border-${color}-100`}>
          <Icon className={`w-4 h-4 text-${color}-600`} />
        </div>
      </div>
    </button>
  );
}

// ── Today Focus Panel ────────────────────────────────────────────────────────
function TodayFocusPanel({ tasks, contracts }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const in14 = new Date(today);
  in14.setDate(in14.getDate() + 14);

  const todayTasks = (tasks || []).filter(t =>
    (t.status === 'open' || t.status === 'in_progress') &&
    t.due_date && new Date(t.due_date) <= tomorrow
  );

  const urgentTasks = (tasks || []).filter(t =>
    (t.status === 'open' || t.status === 'in_progress') &&
    t.priority === 'urgent'
  );

  const expiringContracts = (contracts || []).filter(c => {
    if (['cancelled', 'archived', 'expired'].includes(c.status)) return false;
    const cd = c.cancellation_deadline ? new Date(c.cancellation_deadline) : null;
    return cd && cd >= today && cd <= in14;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-4 rounded-full bg-primary" />
        <h3 className="text-sm font-bold text-foreground">Today Focus</h3>
      </div>

      {/* Urgent tasks */}
      {urgentTasks.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-red-600 mb-2">⚡ Dringend</p>
          <div className="space-y-1.5">
            {urgentTasks.slice(0, 3).map(t => (
              <div key={t.id} className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-red-900 truncate">{t.title}</p>
                {t.customer_name && <p className="text-[10px] text-red-700 mt-0.5">{t.customer_name}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today tasks */}
      {todayTasks.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-amber-600 mb-2">📅 Heute fällig</p>
          <div className="space-y-1.5">
            {todayTasks.slice(0, 5).map(t => (
              <div key={t.id} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-amber-900 truncate">{t.title}</p>
                {t.customer_name && <p className="text-[10px] text-amber-700 mt-0.5">{t.customer_name}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expiring contracts */}
      {expiringContracts.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-orange-600 mb-2">⏰ Policen ablaufend (14d)</p>
          <div className="space-y-1.5">
            {expiringContracts.slice(0, 4).map(c => (
              <div key={c.id} className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-orange-900 truncate">{c.insurer}</p>
                <p className="text-[10px] text-orange-700 mt-0.5">{c.customer_name} · {c.cancellation_deadline}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {todayTasks.length === 0 && urgentTasks.length === 0 && expiringContracts.length === 0 && (
        <div className="border border-dashed border-border rounded-xl px-4 py-6 text-center">
          <CheckSquare className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <p className="text-xs font-semibold text-emerald-700">Alles im grünen Bereich</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Keine dringenden Aktionen heute.</p>
        </div>
      )}

      {/* All open tasks summary */}
      <div className="border border-border rounded-xl px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">Offene Tasks gesamt</p>
          <span className="text-sm font-black text-amber-600">
            {(tasks || []).filter(t => t.status === 'open' || t.status === 'in_progress').length}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function Customers() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newCustomerType, setNewCustomerType] = useState('private');
  const [activeSegment, setActiveSegment] = useState('all');
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list('-created_date', 50),
    staleTime: 10 * 60 * 1000,
  });

  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const allCustomers = await base44.entities.Customer.filter({ archived: false }, '-updated_date', 500);
      if (currentUser?.role === 'admin') return allCustomers;
      if (currentUser?.role === 'broker' || currentUser?.role === 'assistenz') {
        return allCustomers.filter(c =>
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

  const primaryCustomers = customers.filter(c => !c.is_family_member);

  // Filter by segment + search
  const segmentFiltered = useMemo(() => {
    const seg = segments[activeSegment];
    if (!seg || !seg.filter) return primaryCustomers;
    return primaryCustomers.filter(seg.filter);
  }, [primaryCustomers, activeSegment, segments]);

  const searchFiltered = useMemo(() => {
    if (!search.trim()) return segmentFiltered;
    return searchCustomers(segmentFiltered, search);
  }, [segmentFiltered, search]);

  // KPIs
  const totalProvision = contracts.reduce((s, c) => s + (c.premium_yearly || 0), 0);
  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  const handleSave = async (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      const orgId = data.organization_id || organizations[0]?.id || '';
      let customerData = { ...data, organization_id: orgId };
      if (!customerData.customer_number) {
        try {
          const result = await base44.functions.invoke('generateCustomerNumber', {});
          if (result?.data?.customer_number) customerData.customer_number = result.data.customer_number;
        } catch {}
      }
      createMutation.mutate(customerData);
    }
  };

  const handleExport = () => {
    if (searchFiltered.length === 0) return;
    const headers = ['Kundennummer', 'Vorname', 'Nachname', 'Email', 'Telefon', 'Stadt', 'Status'];
    const rows = searchFiltered.map(c => [c.customer_number || '', c.first_name, c.last_name, c.email, c.phone || '', c.city || '', c.status]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `kunden_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const NAV_SEGMENTS = [
    { key: 'all',      color: 'text-foreground',      dot: 'bg-slate-400' },
    { key: 'active',   color: 'text-emerald-700',     dot: 'bg-emerald-500' },
    { key: 'critical', color: 'text-red-700',         dot: 'bg-red-500' },
    { key: 'mandate',  color: 'text-amber-700',       dot: 'bg-amber-500' },
    { key: 'tasks',    color: 'text-amber-700',       dot: 'bg-amber-400' },
    { key: 'vip',      color: 'text-violet-700',      dot: 'bg-violet-500' },
    { key: 'new',      color: 'text-blue-700',        dot: 'bg-blue-500' },
    { key: 'prospect', color: 'text-teal-700',        dot: 'bg-teal-500' },
    { key: 'private',  color: 'text-slate-700',       dot: 'bg-slate-400' },
    { key: 'business', color: 'text-purple-700',      dot: 'bg-purple-500' },
  ];

  return (
    <div className="flex flex-col h-full page-enter">
      {/* ── Top Bar ── */}
      <div className="px-6 py-4 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name, E-Mail, Kundennummer, Stadt…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-3.5 h-3.5 mr-1" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowMerge(true)} className="text-amber-700 border-amber-300 hover:bg-amber-50">
              <Users className="w-3.5 h-3.5 mr-1" /> Zusammenführen
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="w-3.5 h-3.5 mr-1" /> Import
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Neuer Kunde
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditing(null); setNewCustomerType('private'); setShowForm(true); }}>
                  <User className="w-4 h-4 mr-2 text-blue-600" /> Privatkunde
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setEditing(null); setNewCustomerType('business'); setShowForm(true); }}>
                  <Building2 className="w-4 h-4 mr-2 text-purple-600" /> Firmenkunde
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ── KPI Bar ── */}
      <div className="px-6 py-4 border-b border-border/60 bg-muted/20 shrink-0">
        <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
          <KpiCard
            label="Kunden aktiv"
            value={segments.active?.count ?? 0}
            sub={`${primaryCustomers.length} gesamt`}
            icon={Users}
            color="blue"
            onClick={() => setActiveSegment('active')}
          />
          <KpiCard
            label="Leads offen"
            value={leads.length}
            sub="Neue Interessenten"
            icon={Target}
            color="teal"
            onClick={() => {}}
          />
          <KpiCard
            label="Policen aktiv"
            value={contracts.length}
            sub={`CHF ${Math.round(totalProvision / 12).toLocaleString('de-CH')}/Mt.`}
            icon={Shield}
            color="emerald"
            onClick={() => {}}
          />
          <KpiCard
            label="Tasks offen"
            value={openTasks}
            sub={`${tasks.filter(t => t.priority === 'urgent' && (t.status === 'open' || t.status === 'in_progress')).length} dringend`}
            icon={CheckSquare}
            color="amber"
            onClick={() => setActiveSegment('tasks')}
          />
          <KpiCard
            label="Kritisch"
            value={segments.critical?.count ?? 0}
            sub="Mandat/Status Problem"
            icon={AlertTriangle}
            color="red"
            onClick={() => setActiveSegment('critical')}
          />
        </div>
      </div>

      {/* ── 3-Column Main ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT — Smart Nav */}
        <div className="w-52 shrink-0 border-r border-border bg-card overflow-y-auto py-4 px-2 hidden md:block">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-2 mb-2">Segmente</p>
          <div className="space-y-0.5">
            {NAV_SEGMENTS.map(({ key, color, dot }) => {
              const seg = segments[key];
              if (!seg) return null;
              const isActive = activeSegment === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveSegment(key)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
                    <span className="text-[12px] truncate">{seg.label}</span>
                  </div>
                  {seg.count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {seg.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* CENTER — Customer Feed */}
        <div className="flex-1 overflow-y-auto">
          {/* Segment header */}
          <div className="sticky top-0 z-10 px-4 py-2.5 bg-card/95 backdrop-blur-sm border-b border-border/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                {segments[activeSegment]?.label || 'Alle'}
              </span>
              <span className="text-xs text-muted-foreground">
                {searchFiltered.length} Kunden{search ? ` · Suche: "${search}"` : ''}
              </span>
            </div>
            {/* Mobile segment select */}
            <div className="md:hidden">
              <select
                value={activeSegment}
                onChange={e => setActiveSegment(e.target.value)}
                className="text-xs border border-input rounded-md px-2 py-1 bg-background"
              >
                {NAV_SEGMENTS.map(({ key }) => (
                  <option key={key} value={key}>{segments[key]?.label} ({segments[key]?.count ?? 0})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {loadingCustomers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Lade Kunden…
              </div>
            ) : searchFiltered.length === 0 ? (
              <EmptyState
                icon={User}
                title="Keine Kunden in diesem Segment"
                description={search ? 'Suche anpassen oder Segment wechseln.' : 'Noch keine Kunden in dieser Kategorie.'}
              />
            ) : (
              searchFiltered.map(customer => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  familyMembers={customers.filter(c => c.primary_customer_id === customer.id)}
                  contractCount={segments.contractsByCustomer?.[customer.id] || 0}
                  taskCount={segments.tasksByCustomer?.[customer.id] || 0}
                  onEdit={(c) => { setEditing(c); setShowForm(true); }}
                  onDelete={(id) => { if (confirm('Kunde löschen?')) deleteMutation.mutate(id); }}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT — Today Focus */}
        <div className="w-60 shrink-0 border-l border-border bg-card overflow-y-auto py-4 px-4 hidden lg:block">
          <TodayFocusPanel tasks={tasks} contracts={contracts} />
        </div>
      </div>

      {/* ── Dialogs ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? (editing.is_family_member ? 'Familienmitglied bearbeiten' : (editing.customer_type === 'business' ? 'Unternehmen bearbeiten' : 'Privatkunde bearbeiten'))
                : newCustomerType === 'business' ? 'Neuer Firmenkunde' : 'Neuer Privatkunde'}
            </DialogTitle>
          </DialogHeader>
          {(editing?.customer_type === 'business' || (!editing && newCustomerType === 'business')) ? (
            <CompanyForm
              customer={editing}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null); }}
              saving={createMutation.isPending || updateMutation.isPending}
            />
          ) : (
            <CustomerForm
              customer={editing || { customer_type: 'private' }}
              primaryCustomers={primaryCustomers}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null); }}
              saving={createMutation.isPending || updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <FastImportWizard
        open={showImport}
        onOpenChange={setShowImport}
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setSearch(''); setActiveSegment('all'); }}
      />

      <CustomerMergeDialog open={showMerge} onOpenChange={setShowMerge} />
    </div>
  );
}