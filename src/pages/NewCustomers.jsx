/**
 * NewCustomers — Neukunden Relationship Workspace
 * Zeigt alle neu erfassten Kunden ab 22.05.2026
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Users, User, Building2, Plus, Calendar, CheckCircle2,
  AlertTriangle, FileText, Target, Upload,
  ChevronRight, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import EmptyState, { LoadingTable } from '@/components/shared/EmptyState';

const NEW_CUSTOMER_DATE = '2026-05-22';
const SEGMENTS = [
  { id: 'all', label: 'Alle', icon: Users },
  { id: 'today', label: 'Heute', icon: Calendar },
  { id: 'week', label: 'Diese Woche', icon: Calendar },
  { id: 'month', label: 'Dieser Monat', icon: Calendar },
  { id: 'no_mandate', label: 'Ohne Mandat', icon: AlertTriangle },
  { id: 'no_advisor', label: 'Ohne Berater', icon: User },
  { id: 'no_contracts', label: 'Ohne Verträge', icon: FileText },
];

const isToday = (date) => {
  const today = new Date();
  const d = new Date(date);
  return d.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
};
const isThisWeek = (date) => {
  const now = new Date();
  const d = new Date(date);
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return d >= weekAgo;
};
const isThisMonth = (date) => {
  const now = new Date();
  const d = new Date(date);
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};
const fmtDate = (date) => {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return date; }
};
const custName = (c) => c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email;

function SegmentBadge({ customer, contracts }) {
  const created = customer.created_date;
  const hasContract = contracts.some(c => c.customer_id === customer.id && c.status === 'active');
  const hasMandate = ['valid'].includes(customer.mandate_status);
  const hasAdvisor = !!(customer.advisor_id || customer.primary_advisor_id || (customer.assigned_advisors || []).length > 0);
  const badges = [];
  if (isToday(created)) {
    badges.push({ label: 'Heute', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' });
  } else if (isThisWeek(created)) {
    badges.push({ label: 'Diese Woche', color: 'bg-blue-50 text-blue-700 border-blue-200' });
  }
  if (!hasContract) badges.push({ label: 'Ohne Vertrag', color: 'bg-amber-50 text-amber-700 border-amber-200' });
  if (!hasMandate) badges.push({ label: 'Ohne Mandat', color: 'bg-rose-50 text-rose-700 border-rose-200' });
  if (!hasAdvisor) badges.push({ label: 'Ohne Berater', color: 'bg-slate-50 text-slate-600 border-slate-200' });
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {badges.slice(0, 3).map((b, i) => (
        <span key={i} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${b.color}`}>{b.label}</span>
      ))}
    </div>
  );
}

function NewCustomerCard({ customer, contracts, tasks }) {
  const navigate = useNavigate();
  const customerContracts = contracts.filter(c => c.customer_id === customer.id);
  const activeContracts = customerContracts.filter(c => c.status === 'active');
  const totalPremium = activeContracts.reduce((sum, c) => sum + (c.premium_yearly || 0), 0);
  const openTasks = tasks.filter(t => t.customer_id === customer.id && t.status !== 'completed');
  const hasMandate = ['valid'].includes(customer.mandate_status);
  const hasAdvisor = !!(customer.advisor_id || customer.primary_advisor_id || (customer.assigned_advisors || []).length > 0);
  const advisor = customer.assigned_broker || customer.advisor_id || '—';

  return (
    <div className="bg-white rounded-xl border border-[hsl(var(--border-subtle))]/40 p-4 hover:shadow-sm transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            customer.customer_type === 'business'
              ? 'bg-[hsl(var(--primary))/0.1] border border-[hsl(var(--primary))/0.2]'
              : 'bg-blue-50 border border-blue-200'
          )}>
            {customer.customer_type === 'business' ? (
              <Building2 className="w-5 h-5 text-[hsl(var(--primary))]" />
            ) : (
              <User className="w-5 h-5 text-blue-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[hsl(var(--text-heading))] truncate group-hover:text-[hsl(var(--primary))] transition-colors">
              {custName(customer)}
            </h3>
            <p className="text-[11px] text-[hsl(var(--text-muted))] truncate">
              {customer.customer_type === 'business' ? 'Unternehmen' : 'Privatkunde'} · {fmtDate(customer.created_date)}
            </p>
            <SegmentBadge customer={customer} contracts={contracts} />
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-[hsl(var(--text-subtle))] group-hover:text-[hsl(var(--primary))] transition-colors flex-shrink-0" />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[hsl(var(--surface-1))] rounded-lg p-2">
          <p className="text-[9px] text-[hsl(var(--text-subtle))] font-medium uppercase">Verträge</p>
          <p className="text-sm font-bold text-[hsl(var(--text-heading))]">{activeContracts.length}</p>
        </div>
        <div className="bg-[hsl(var(--surface-1))] rounded-lg p-2">
          <p className="text-[9px] text-[hsl(var(--text-subtle))] font-medium uppercase">Prämie/Jahr</p>
          <p className="text-sm font-bold text-[hsl(var(--text-heading))]">
            {totalPremium > 0 ? `CHF ${totalPremium.toLocaleString('de-CH')}` : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-[11px]">
          <Shield className={cn('w-3 h-3', hasMandate ? 'text-emerald-600' : 'text-rose-500')} />
          <span className={cn(hasMandate ? 'text-emerald-700' : 'text-rose-600')}>
            Mandat: {customer.mandate_status || 'pending'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <User className={cn('w-3 h-3', hasAdvisor ? 'text-blue-600' : 'text-amber-500')} />
          <span className={cn(hasAdvisor ? 'text-blue-700' : 'text-amber-600')}>
            {advisor === '—' ? 'Kein Berater' : advisor}
          </span>
        </div>
        {openTasks.length > 0 && (
          <div className="flex items-center gap-2 text-[11px]">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            <span className="text-amber-700">{openTasks.length} offene Tasks</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[hsl(var(--border-subtle))]/40">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/kunden/${customer.id}`); }}
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-[hsl(var(--primary))/0.08] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))/0.12] transition-colors"
        >
          <User className="w-3 h-3" /> Öffnen
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/aufgaben`); }}
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Plus className="w-3 h-3" /> Task
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/verkaufschancen`); }}
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Target className="w-3 h-3" /> Opportunity
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/dokumente`); }}
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <Upload className="w-3 h-3" /> Dokument
        </button>
      </div>
    </div>
  );
}

export default function NewCustomers() {
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState('all');

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['new_customers'],
    queryFn: async () => {
      const all = await base44.entities.Customer.filter({ archived: false }, '-created_date', 500);
      return all.filter(c => {
        const created = c.created_date ? new Date(c.created_date) : null;
        if (!created) return false;
        return created >= new Date(NEW_CUSTOMER_DATE);
      });
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['new_customers_contracts'],
    queryFn: () => base44.entities.Contract.filter({ archived: false }, '-created_date', 1000),
    enabled: !isLoading,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['new_customers_tasks'],
    queryFn: () => base44.entities.Task.filter({}, '-created_date', 500),
    enabled: !isLoading,
    staleTime: 5 * 60 * 1000,
  });

  const filteredCustomers = useMemo(() => {
    if (activeSegment === 'all') return customers;
    return customers.filter(c => {
      const created = c.created_date ? new Date(c.created_date) : null;
      if (!created) return false;
      if (activeSegment === 'today') return isToday(created);
      if (activeSegment === 'week') return isThisWeek(created);
      if (activeSegment === 'month') return isThisMonth(created);
      if (activeSegment === 'no_mandate') return !['valid'].includes(c.mandate_status);
      if (activeSegment === 'no_advisor') return !c.advisor_id && !c.primary_advisor_id && (!c.assigned_advisors || c.assigned_advisors.length === 0);
      if (activeSegment === 'no_contracts') return !contracts.some(ct => ct.customer_id === c.id && ct.status === 'active');
      return true;
    });
  }, [customers, activeSegment, contracts]);

  const stats = useMemo(() => ({
    all: customers.length,
    today: customers.filter(c => isToday(c.created_date)).length,
    week: customers.filter(c => isThisWeek(c.created_date)).length,
    month: customers.filter(c => isThisMonth(c.created_date)).length,
    no_mandate: customers.filter(c => !['valid'].includes(c.mandate_status)).length,
    no_advisor: customers.filter(c => !c.advisor_id && !c.primary_advisor_id && (!c.assigned_advisors || c.assigned_advisors.length === 0)).length,
    no_contracts: customers.filter(c => !contracts.some(ct => ct.customer_id === c.id && ct.status === 'active')).length,
  }), [customers, contracts]);

  return (
    <div className="page-enter flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[hsl(var(--primary))] tracking-tight">Neukunden</h1>
            <p className="text-xs text-muted-foreground">Relationship Workspace · Alle Kunden ab {fmtDate(NEW_CUSTOMER_DATE)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Segment Navigation */}
        <div className="bg-card border-b border-border px-6 py-3">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {SEGMENTS.map(seg => {
              const Icon = seg.icon;
              const count = stats[seg.id] || 0;
              const isActive = activeSegment === seg.id;
              if (count === 0 && seg.id !== 'all') return null;
              return (
                <button
                  key={seg.id}
                  onClick={() => setActiveSegment(seg.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all',
                    isActive
                      ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                      : 'bg-[hsl(var(--surface-1))] text-[hsl(var(--text-muted))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--text-heading))]'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {seg.label}
                  {count > 0 && (
                    <span className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                      isActive ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-600'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          {isLoading ? (
            <LoadingTable rows={8} className="py-12" />
          ) : filteredCustomers.length === 0 ? (
            <EmptyState
              type="empty"
              title="Keine Neukunden in diesem Segment"
              description="Passen Sie das Filter an oder warten Sie auf neue Kundenerfassungen."
              size="lg"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomers.map(customer => (
                <NewCustomerCard
                  key={customer.id}
                  customer={customer}
                  contracts={contracts}
                  tasks={tasks}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}