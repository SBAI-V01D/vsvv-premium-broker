/**
 * CustomerIntelligenceWorkspace — Broker Intelligence / Operations Workspace
 * Ultimate restructuring: Operations · Risks · Tasks · Actions
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Plus, User, Building2, Upload, Download, Users, Search,
  AlertTriangle, Loader2, XCircle, TrendingUp, Target, Calendar, ChevronRight,
  Heart
} from 'lucide-react';
import BirthdaySection from '@/components/customers/BirthdaySection';
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

// Intelligence Components
import OperationsIntelligence from '@/components/intelligence/OperationsIntelligence';
import PortfolioDashboard from '@/components/intelligence/PortfolioDashboard';
import RenewalsSection from '@/components/customers/RenewalsSection';
import CancellationsSection from '@/components/customers/CancellationsSection';
import HouseholdIntelligenceSection from '@/components/customers/HouseholdIntelligenceSection';
import NewCustomersSection from '@/components/customers/NewCustomersSection';

// ── Segment builder ────────────────────────────────────────────────────────
function buildSegments(customers, tasks, contracts, documents) {
  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const ninetyAgo = new Date();
  ninetyAgo.setDate(ninetyAgo.getDate() - 90);

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
  };

  const segs = {};
  Object.entries(defs).forEach(([k, v]) => {
    segs[k] = { ...v, count: primary.filter(v.filter).length };
  });

  return { ...segs, tasksByCustomer, contractsByCustomer, docsByCustomer };
}

// ── Sort helper ────────────────────────────────────────────────────────────
function sortCustomers(list, sortBy) {
  if (sortBy === 'updated') return [...list];
  if (sortBy === 'premium') return [...list].sort((a, b) => (b.total_premium || 0) - (a.total_premium || 0));
  if (sortBy === 'new') return [...list].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  return [...list].sort((a, b) => {
    const na = (a.company_name || a.last_name || '').toLowerCase();
    const nb = (b.company_name || b.last_name || '').toLowerCase();
    if (!na && nb) return 1;
    if (na && !nb) return -1;
    if (na !== nb) return na.localeCompare(nb, 'de-CH');
    return (a.first_name || '').toLowerCase().localeCompare((b.first_name || '').toLowerCase(), 'de-CH');
  });
}

// Interne Navigation: AUSSCHLIESSLICH Fokusansichten
const WORKSPACE_MODES = [
  { id: 'kundenaktionen', label: 'Kundenübersicht', icon: Users },
  { id: 'private', label: 'Privatkunden', icon: User },
  { id: 'business', label: 'Unternehmen', icon: Building2 },
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
          <div className="flex items-center gap-2 pt-2 pb-1">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Privatkunden</h3>
            <span className="text-[10px] text-slate-400">({privates.length})</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
          {privates.map(renderCard)}
        </>
      )}
      {businesses.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-4 pb-1">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Firmenkunden</h3>
            <span className="text-[10px] text-slate-400">({businesses.length})</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
          {businesses.map(renderCard)}
        </>
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function CustomerIntelligenceWorkspace() {
  const navigate = useNavigate();
  const [showForm, setShowForm]         = useState(false);
  const [editing, setEditing]           = useState(null);
  const [newCustomerType, setNewCustomerType] = useState('private');
  const [workspaceMode, setWorkspaceMode] = useState('kundenaktionen');
  const [sortBy, setSortBy]               = useState('alpha');
  const [search, setSearch]             = useState('');
  const [showImport, setShowImport]     = useState(false);
  const [showMerge, setShowMerge]       = useState(false);
  const [showAllMandate, setShowAllMandate] = useState(false);

  const DISPLAY_LIMIT = 3;
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list('-created_date', 50),
    staleTime: 30 * 60 * 1000,
    retry: false,
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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['customers_tasks'],
    queryFn: () => base44.entities.Task.filter({ status: 'open' }, '-due_date', 200),
    enabled: !isLoading,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['customers_contracts'],
    queryFn: () => base44.entities.Contract.filter({ archived: false }, '-created_date', 500),
    enabled: !isLoading,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['customers_documents'],
    queryFn: () => base44.entities.Document.filter({ archived: false }, '-uploaded_at', 500),
    enabled: !isLoading,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['customers_verkaufschancen'],
    queryFn: () => base44.entities.Verkaufschance.filter({}),
    enabled: !isLoading,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
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

  const mandateIssues = useMemo(() =>
    customers.filter(c =>
      !c.archived && (
        (!c.advisor_id && !c.primary_advisor_id && (!c.assigned_advisors || c.assigned_advisors.length === 0)) ||
        ['expired', 'pending', 'invalid'].includes(c.mandate_status)
      )
    ),
    [customers]
  );

  const householdCustomers = useMemo(() =>
    primaryCustomers.filter(c => !c.is_family_member && customers.some(fm => fm.primary_customer_id === c.id)),
    [primaryCustomers, customers]
  );

  // URL params for view mode
  const urlParams = new URLSearchParams(window.location.search);
  const urlView = urlParams.get('view');

  useEffect(() => {
    if (urlView) {
      if (['private', 'business', 'vip', 'birthdays'].includes(urlView)) {
        setWorkspaceMode(urlView);
      }
    }
  }, [urlView]);

  const modeFiltered = useMemo(() => {
    if (workspaceMode === 'private') return primaryCustomers.filter(c => c.customer_type !== 'business');
    if (workspaceMode === 'business') return primaryCustomers.filter(c => c.customer_type === 'business');
    if (workspaceMode === 'vip') return primaryCustomers.filter(c => (c.total_premium || 0) >= 5000);
    if (workspaceMode === 'birthdays') return primaryCustomers;
    return primaryCustomers;
  }, [primaryCustomers, workspaceMode]);

  const { displayed, matchedFamilyIds } = useMemo(() => {
    const familyMembers = customers.filter(c => c.is_family_member);
    if (!search.trim()) {
      return { displayed: sortCustomers(modeFiltered, sortBy), matchedFamilyIds: new Set() };
    }
    const allCustomers = [...primaryCustomers, ...familyMembers];
    const directMatches = searchCustomers(allCustomers, search);

    const primaryMatches = directMatches.filter(c => !c.is_family_member);
    const matchedFamily = directMatches.filter(m => m.is_family_member);
    const matchedFamilyMemberIds = new Set(matchedFamily.map(m => m.id));

    const parentIds = new Set(matchedFamily.map(m => m.primary_customer_id).filter(Boolean));
    const familyParents = primaryCustomers.filter(c => parentIds.has(c.id));

    const combinedMap = new Map();
    [...primaryMatches, ...familyParents].forEach(c => {
      if (!combinedMap.has(c.id)) combinedMap.set(c.id, c);
    });

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
    a.download = `kunden_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (workspaceMode === 'kundenaktionen') {
      params.delete('view');
    } else {
      params.set('view', workspaceMode);
    }
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [workspaceMode]);



  const renderIntelligenceView = () => {
    if (workspaceMode === 'kundenaktionen') {
      // Filter mandate issues by search
      const filteredMandateIssues = search.trim()
        ? mandateIssues.filter(c => {
            const query = search.toLowerCase();
            const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
            const email = (c.email || '').toLowerCase();
            const number = (c.customer_number || '').toLowerCase();
            return name.includes(query) || email.includes(query) || number.includes(query);
          })
        : mandateIssues;

      return (
        <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
          {/* Search bar for kundenaktionen mode */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--text-subtle))]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Kunden suchen (Name, E-Mail, Kundennummer)…"
                  className="w-full pl-9 pr-8 py-1.5 text-[13px] border border-[hsl(var(--border-subtle))] rounded-lg bg-[hsl(var(--surface-0))] text-[hsl(var(--text-heading))] placeholder:text-[hsl(var(--text-subtle))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))/0.3] focus:border-[hsl(var(--primary))/0.4] transition-all"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--text-subtle))] hover:text-[hsl(var(--text-heading))]">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <NewCustomersSection searchQuery={search} />
          <RenewalsSection contracts={contracts} customers={customers} verkaufschancen={verkaufschancen} />
          <CancellationsSection contracts={contracts} customers={customers} />

          {/* Combined layout: Mandat/Berater first, then Haushalt */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Kunden ohne Mandat oder Berater */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--critical-hsl))]" />
                <h3 className="text-sm font-bold text-[hsl(var(--primary))]">Mandat / Berater</h3>
                <span className="text-[9px] font-medium text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded-full">
                  {filteredMandateIssues.length} Kunden
                </span>
              </div>
              {filteredMandateIssues.length === 0 ? (
                search ? (
                  <p className="text-[9px] text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-1))] rounded-lg p-3">
                    Keine Mandat-Probleme für diese Suche gefunden
                  </p>
                ) : (
                  <p className="text-[9px] text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-1))] rounded-lg p-3">
                    Keine offenen Mandat- oder Beraterzuweisungen
                  </p>
                )
              ) : (
                <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-[hsl(var(--border-subtle))]/40">
                  <div className="space-y-1">
                    {(showAllMandate ? filteredMandateIssues : filteredMandateIssues.slice(0, DISPLAY_LIMIT)).map(customer => (
                      <button
                        key={customer.id}
                        onClick={() => navigate(`/kunden/${customer.id}/360`)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-[hsl(var(--surface-2))]/40 transition-colors text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-[hsl(var(--text-heading))] truncate">
                            {customer.first_name} {customer.last_name}
                          </p>
                          <p className="text-[9px] text-[hsl(var(--text-muted))] truncate">
                            {!customer.advisor_id && !customer.primary_advisor_id && (
                              <span>⚠ Kein Berater</span>
                            )}
                            {['expired', 'pending', 'invalid'].includes(customer.mandate_status) && (
                              <span className={!customer.advisor_id && !customer.primary_advisor_id ? 'ml-1' : ''}>
                                Mandat: {customer.mandate_status}
                              </span>
                            )}
                          </p>
                        </div>
                        <ChevronRight className="w-3 h-3 text-[hsl(var(--text-muted))]" />
                      </button>
                    ))}
                  </div>
                  {filteredMandateIssues.length > DISPLAY_LIMIT && (
                    <button
                      onClick={() => setShowAllMandate(!showAllMandate)}
                      className="mt-2 text-[10px] font-medium text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]/80"
                    >
                      {showAllMandate ? 'Weniger anzeigen' : `Alle ${filteredMandateIssues.length} Kunden anzeigen`}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Haushalte */}
            <div>
              <HouseholdIntelligenceSection
                householdCustomers={householdCustomers}
                customers={customers}
                contracts={contracts}
              />
            </div>
          </div>
        </div>
      );
    }
    
    if (workspaceMode === 'birthdays') {
      const today = new Date();
      const currentMonth = today.getMonth();
      const birthdayCustomers = primaryCustomers.filter(c => {
        if (!c.birthdate) return false;
        const birthDate = new Date(c.birthdate);
        return birthDate.getMonth() === currentMonth;
      }).sort((a, b) => {
        const dateA = new Date(a.birthdate).getDate();
        const dateB = new Date(b.birthdate).getDate();
        return dateA - dateB;
      });
      return (
        <div className="p-6 max-w-[1600px] mx-auto">
          <BirthdaySection customers={birthdayCustomers} />
        </div>
      );
    }
    
    if (workspaceMode === 'vip') {
      return (
        <div className="p-6 max-w-[1600px] mx-auto">
          <OperationsIntelligence />
        </div>
      );
    }
    
    return null;
  };

  const isIntelligenceMode = ['kundenaktionen', 'vip', 'birthdays'].includes(workspaceMode);
  const isCustomerListMode = ['private', 'business'].includes(workspaceMode);

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--surface-1))]">

      {/* ── Operational Workspace Bar ───────────────── */}
      <div className="px-6 py-4 border-b border-[hsl(var(--border-subtle))] bg-white shrink-0">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {WORKSPACE_MODES.map(mode => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => setWorkspaceMode(mode.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-[12.5px] font-medium rounded-lg transition-all whitespace-nowrap',
                    workspaceMode === mode.id
                      ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                      : 'text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-2))]'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>

          {isCustomerListMode && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* ── Main Content Area ─────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {isIntelligenceMode ? (
          renderIntelligenceView()
        ) : isCustomerListMode ? (
          <div className="p-6 max-w-6xl mx-auto">
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
              <CustomerFeed
                displayed={displayed}
                customers={customers}
                segments={segments}
                matchedFamilyIds={matchedFamilyIds}
                onEdit={(c) => { setEditing(c); setShowForm(true); }}
                onDelete={(id) => { if (confirm('Kunde löschen?')) deleteMutation.mutate(id); }}
                allContracts={contracts}
                allTasks={tasks}
                allDocuments={documents}
              />
            )}
          </div>
        ) : null}
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
        onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setSearch(''); setWorkspaceMode('private'); }} />
      <CustomerMergeDialog open={showMerge} onOpenChange={setShowMerge} />
    </div>
  );
}