/**
 * Customers — Broker Desk / Operational Command Center
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Plus, User, Building2, Upload, Download, Users, Search,
  Shield, CheckSquare, AlertTriangle, Target, Clock, Loader2,
  Filter, XCircle, TrendingUp, Briefcase
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

// ── Static color map (Tailwind needs literal class strings) ─────────────────
const KPI_COLORS = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',    icon: 'text-blue-600',    num: 'text-blue-700' },
  teal:    { bg: 'bg-teal-50',    border: 'border-teal-100',    icon: 'text-teal-600',    num: 'text-teal-700' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'text-emerald-600', num: 'text-emerald-700' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',   icon: 'text-amber-600',   num: 'text-amber-700' },
  red:     { bg: 'bg-red-50',     border: 'border-red-100',     icon: 'text-red-600',     num: 'text-red-700' },
};

// ── Segments ─────────────────────────────────────────────────────────────────
function buildSegments(customers, tasks, contracts) {
  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);

  const tasksByCustomer = {};
  (tasks || []).forEach(t => {
    if (t.customer_id && (t.status === 'open' || t.status === 'in_progress')) {
      tasksByCustomer[t.customer_id] = (tasksByCustomer[t.customer_id] || 0) + 1;
    }
  });

  const contractsByCustomer = {};
  (contracts || []).forEach(c => {
    if (c.customer_id && c.status === 'active') {
      contractsByCustomer[c.customer_id] = (contractsByCustomer[c.customer_id] || 0) + 1;
    }
  });

  const primary = customers.filter(c => !c.is_family_member);

  const segs = {
    all:      { label: 'Alle',                  count: primary.length,   filter: () => true },
    critical: { label: 'Kritisch',              count: 0,                filter: c => c.status === 'inactive' || ['invalid','expired'].includes(c.mandate_status) },
    mandate:  { label: 'Mandat ausstehend',     count: 0,                filter: c => c.mandate_status === 'pending' },
    tasks:    { label: 'Offene Tasks',          count: 0,                filter: c => (tasksByCustomer[c.id] || 0) > 0 },
    active:   { label: 'Aktiv',                 count: 0,                filter: c => c.status === 'active' },
    vip:      { label: 'VIP / High-Value',      count: 0,                filter: c => (c.total_premium || 0) >= 5000 },
    new:      { label: 'Neu (30 Tage)',         count: 0,                filter: c => new Date(c.created_date) >= thirtyAgo },
    prospect: { label: 'Interessenten',         count: 0,                filter: c => c.status === 'prospect' },
    private:  { label: 'Privatkunden',          count: 0,                filter: c => c.customer_type !== 'business' },
    business: { label: 'Unternehmen',           count: 0,                filter: c => c.customer_type === 'business' },
  };

  // Pre-compute counts
  Object.keys(segs).forEach(k => {
    if (k !== 'all') segs[k].count = primary.filter(segs[k].filter).length;
  });

  return { ...segs, tasksByCustomer, contractsByCustomer };
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, onClick }) {
  const c = KPI_COLORS[color] || KPI_COLORS.blue;
  return (
    <button
      onClick={onClick}
      className="group flex-1 min-w-[130px] bg-card border border-border rounded-xl px-4 py-4 text-left hover:shadow-card-md hover:border-border/80 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${c.bg} border ${c.border}`}>
          <Icon className={`w-3.5 h-3.5 ${c.icon}`} />
        </div>
      </div>
      <p className={`text-3xl font-black leading-none ${c.num}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1.5">{sub}</p>}
    </button>
  );
}

// ── Today Focus ───────────────────────────────────────────────────────────────
function TodayFocusPanel({ tasks, contracts }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const in14 = new Date(today); in14.setDate(in14.getDate() + 14);

  const urgentTasks = (tasks || []).filter(t =>
    (t.status === 'open' || t.status === 'in_progress') && t.priority === 'urgent'
  );
  const dueTodayTasks = (tasks || []).filter(t =>
    (t.status === 'open' || t.status === 'in_progress') &&
    t.due_date && new Date(t.due_date) <= tomorrow && t.priority !== 'urgent'
  );
  const expiringContracts = (contracts || []).filter(c => {
    if (['cancelled', 'archived', 'expired'].includes(c.status)) return false;
    const cd = c.cancellation_deadline ? new Date(c.cancellation_deadline) : null;
    return cd && cd >= today && cd <= in14;
  });

  const allOpen = (tasks || []).filter(t => t.status === 'open' || t.status === 'in_progress');
  const isEmpty = urgentTasks.length === 0 && dueTodayTasks.length === 0 && expiringContracts.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-black text-foreground uppercase tracking-wide">Today Focus</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {urgentTasks.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-red-600 mb-2">⚡ Dringend</p>
          <div className="space-y-1.5">
            {urgentTasks.slice(0, 4).map(t => (
              <div key={t.id} className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-[11px] font-bold text-red-900 truncate">{t.title}</p>
                {t.customer_name && <p className="text-[10px] text-red-700 mt-0.5">{t.customer_name}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {dueTodayTasks.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2">📅 Heute fällig</p>
          <div className="space-y-1.5">
            {dueTodayTasks.slice(0, 4).map(t => (
              <div key={t.id} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-[11px] font-bold text-amber-900 truncate">{t.title}</p>
                {t.customer_name && <p className="text-[10px] text-amber-700 mt-0.5">{t.customer_name}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {expiringContracts.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-orange-600 mb-2">⏰ Policen (14d)</p>
          <div className="space-y-1.5">
            {expiringContracts.slice(0, 3).map(c => (
              <div key={c.id} className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                <p className="text-[11px] font-bold text-orange-900 truncate">{c.insurer}</p>
                <p className="text-[10px] text-orange-700 mt-0.5">{c.customer_name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="border border-dashed border-emerald-200 rounded-xl px-4 py-6 text-center bg-emerald-50/50">
          <CheckSquare className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          <p className="text-xs font-bold text-emerald-700">Alles erledigt</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Keine Aktionen heute.</p>
        </div>
      )}

      {/* Summary stats */}
      <div className="space-y-2 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between py-1">
          <span className="text-[11px] text-muted-foreground">Offene Tasks</span>
          <span className="text-sm font-bold text-foreground">{allOpen.length}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[11px] text-muted-foreground">Dringende Tasks</span>
          <span className="text-sm font-bold text-red-600">{urgentTasks.length}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[11px] text-muted-foreground">Policen ablaufend</span>
          <span className="text-sm font-bold text-orange-600">{expiringContracts.length}</span>
        </div>
      </div>
    </div>
  );
}

// ── Nav Segment Config (static) ───────────────────────────────────────────────
const NAV_SEGMENTS = [
  { key: 'all',      dotCls: 'bg-slate-400' },
  { key: 'critical', dotCls: 'bg-red-500' },
  { key: 'mandate',  dotCls: 'bg-amber-400' },
  { key: 'tasks',    dotCls: 'bg-amber-500' },
  { key: 'active',   dotCls: 'bg-emerald-500' },
  { key: 'vip',      dotCls: 'bg-violet-500' },
  { key: 'new',      dotCls: 'bg-blue-500' },
  { key: 'prospect', dotCls: 'bg-teal-500' },
  { key: 'private',  dotCls: 'bg-slate-400' },
  { key: 'business', dotCls: 'bg-purple-500' },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Customers() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newCustomerType, setNewCustomerType] = useState('private');
  const [activeSegment, setActiveSegment] = useState('all');
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list('-created_date', 50),
    staleTime: 10 * 60 * 1000,
  });

  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
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
  const primaryCustomers = customers.filter(c => !c.is_family_member);

  const segmentFiltered = useMemo(() => {
    const seg = segments[activeSegment];
    if (!seg?.filter) return primaryCustomers;
    return primaryCustomers.filter(seg.filter);
  }, [primaryCustomers, activeSegment, segments]);

  const displayed = useMemo(() => {
    if (!search.trim()) return segmentFiltered;
    return searchCustomers(segmentFiltered, search);
  }, [segmentFiltered, search]);

  // KPIs
  const openTasks = tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  const urgentCount = tasks.filter(t => t.priority === 'urgent' && (t.status === 'open' || t.status === 'in_progress')).length;
  const totalPremium = contracts.reduce((s, c) => s + (c.premium_yearly || 0), 0);

  const handleSave = async (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      const orgId = data.organization_id || organizations[0]?.id || '';
      let cData = { ...data, organization_id: orgId };
      if (!cData.customer_number) {
        try {
          const r = await base44.functions.invoke('generateCustomerNumber', {});
          if (r?.data?.customer_number) cData.customer_number = r.data.customer_number;
        } catch {}
      }
      createMutation.mutate(cData);
    }
  };

  const handleExport = () => {
    if (!displayed.length) return;
    const headers = ['Nr.', 'Vorname', 'Nachname', 'Email', 'Telefon', 'Stadt', 'Status'];
    const rows = displayed.map(c => [c.customer_number || '', c.first_name, c.last_name, c.email, c.phone || '', c.city || '', c.status]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `portfolio_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="flex flex-col h-full page-enter">

      {/* ── Top Action Bar ── */}
      <div className="px-6 py-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Title */}
          <div className="flex items-center gap-2 mr-2 shrink-0">
            <Briefcase className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Broker Desk</span>
            <span className="text-muted-foreground/40 text-sm font-light">·</span>
            <span className="text-sm text-muted-foreground">Kunden</span>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Name, E-Mail, Kundennummer, Stadt…"
                className="w-full pl-9 pr-8 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleExport} className="text-muted-foreground">
              <Download className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowMerge(true)} className="text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowImport(true)} className="text-muted-foreground">
              <Upload className="w-3.5 h-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Neuer Kunde
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

      {/* ── KPI Strip ── */}
      <div className="px-6 py-4 border-b border-border/60 bg-muted/10 shrink-0">
        <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
          <KpiCard label="Aktive Kunden"    value={segments.active?.count ?? 0}  sub={`${primaryCustomers.length} im Portfolio`} icon={Users}         color="blue"    onClick={() => setActiveSegment('active')} />
          <KpiCard label="Leads offen"      value={leads.length}                   sub="Neue Interessenten"                        icon={Target}        color="teal"    onClick={() => {}} />
          <KpiCard label="Policen aktiv"    value={contracts.length}               sub={`CHF ${Math.round(totalPremium / 12).toLocaleString('de-CH')}/Mt.`} icon={Shield} color="emerald" onClick={() => {}} />
          <KpiCard label="Offene Tasks"     value={openTasks}                      sub={urgentCount > 0 ? `${urgentCount} dringend` : 'Alle im Griff'}  icon={CheckSquare} color="amber" onClick={() => setActiveSegment('tasks')} />
          <KpiCard label="Kritisch"         value={segments.critical?.count ?? 0} sub="Mandat / Status"                           icon={AlertTriangle} color="red"     onClick={() => setActiveSegment('critical')} />
        </div>
      </div>

      {/* ── 3-Column Layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT — Smart Nav */}
        <div className="w-52 shrink-0 border-r border-border bg-card/60 overflow-y-auto py-5 px-3 hidden md:flex md:flex-col gap-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground px-2 mb-3">Segmente</p>
          {NAV_SEGMENTS.map(({ key, dotCls }) => {
            const seg = segments[key];
            if (!seg) return null;
            const isActive = activeSegment === key;
            return (
              <button
                key={key}
                onClick={() => setActiveSegment(key)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'hover:bg-muted/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-primary-foreground' : dotCls}`} />
                  <span className="text-xs truncate">{seg.label}</span>
                </div>
                {seg.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    isActive ? 'bg-white/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {seg.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* CENTER — Customer Feed */}
        <div className="flex-1 overflow-y-auto">
          {/* Sticky segment bar */}
          <div className="sticky top-0 z-10 px-5 py-2.5 bg-card/95 backdrop-blur-sm border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">{segments[activeSegment]?.label ?? 'Alle'}</span>
              <span className="text-xs text-muted-foreground">· {displayed.length} Kunden</span>
              {search && <span className="text-xs text-primary">· "{search}"</span>}
            </div>
            {/* Mobile seg select */}
            <div className="md:hidden">
              <select value={activeSegment} onChange={e => setActiveSegment(e.target.value)}
                className="text-xs border border-input rounded px-2 py-1 bg-background">
                {NAV_SEGMENTS.map(({ key }) => (
                  <option key={key} value={key}>{segments[key]?.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-5 space-y-3">
            {loadingCustomers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Lade Portfolio…
              </div>
            ) : displayed.length === 0 ? (
              <EmptyState icon={User}
                title="Keine Kunden in diesem Segment"
                description={search ? 'Suche anpassen oder Segment wechseln.' : 'Dieses Segment ist leer.'}
              />
            ) : (
              displayed.map(customer => (
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
        <div className="w-60 shrink-0 border-l border-border bg-card/60 overflow-y-auto py-5 px-4 hidden lg:block">
          <TodayFocusPanel tasks={tasks} contracts={contracts} />
        </div>
      </div>

      {/* ── Dialogs ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? (editing.is_family_member ? 'Familienmitglied bearbeiten' : editing.customer_type === 'business' ? 'Unternehmen bearbeiten' : 'Privatkunde bearbeiten')
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