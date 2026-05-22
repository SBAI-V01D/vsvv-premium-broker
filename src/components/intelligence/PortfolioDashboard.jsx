/**
 * PortfolioDashboard — Hauptansicht für Kunden-Portfolio
 * Drei Kern-Sektionen:
 * 1. Kunden ohne Mandat / Berater
 * 2. Cross-Selling / Household Intelligence
 * 3. Offene Aufgaben
 */
import React, { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingUp, CheckSquare, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Portfolio Section Card ───────────────────────────────────────────────
function PortfolioSectionCard({ icon: IconComponent, title, count, description, items, onNavigate, color }) {
  const colorClasses = {
    amber: 'bg-amber-50 border-amber-200/70 text-amber-700',
    blue: 'bg-blue-50 border-blue-200/70 text-blue-700',
    violet: 'bg-violet-50 border-violet-200/70 text-violet-700',
  };

  const iconColorClasses = {
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
  };

  return (
    <div className={cn(
      "rounded-xl border p-5 transition-all hover:shadow-md cursor-pointer",
      colorClasses[color] || colorClasses.amber
    )} onClick={onNavigate}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", iconColorClasses[color])}>
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold">{title}</h3>
            {count !== undefined && (
              <p className="text-sm font-semibold mt-0.5">{count} Kunden</p>
            )}
          </div>
        </div>
        <ArrowRight className="w-5 h-5 opacity-60" />
      </div>
      <p className="text-sm opacity-80 mb-3">{description}</p>
      {items && items.length > 0 && (
        <div className="space-y-1.5">
          {items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="text-xs flex items-center justify-between py-1 border-t border-black/5">
              <span className="font-medium truncate">{item.name}</span>
              {item.sub && <span className="opacity-70 text-[10px]">{item.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PortfolioDashboard({ setWorkspaceMode }) {
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const all = await base44.entities.Customer.filter({ archived: false }, '-updated_date', 500);
      return all.filter(c => !c.is_family_member);
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['portfolio_tasks'],
    queryFn: () => base44.entities.Task.filter({ status: 'open' }, '-due_date', 200),
    staleTime: 60_000,
  });

  // Section 1: Kunden ohne Mandat / Berater
  const noMandateNoAdvisor = React.useMemo(() => {
    return customers.filter(c => 
      c.mandate_status === 'pending' || 
      (!c.advisor_id && !c.primary_advisor_id)
    );
  }, [customers]);

  // Section 2: Cross-Selling / Household Intelligence
  const crossSellingHousehold = React.useMemo(() => {
    return customers.filter(c => {
      const hasFamily = customers.some(fc => fc.primary_customer_id === c.id);
      const hasSingleContract = (c.total_premium || 0) > 0;
      return hasFamily || hasSingleContract;
    });
  }, [customers]);

  // Section 3: Offene Aufgaben (customers mit open tasks)
  const customersWithOpenTasks = React.useMemo(() => {
    const tasksByCustomer = {};
    tasks.forEach(t => {
      if (t.customer_id && (t.status === 'open' || t.status === 'in_progress')) {
        tasksByCustomer[t.customer_id] = (tasksByCustomer[t.customer_id] || 0) + 1;
      }
    });
    return customers
      .filter(c => tasksByCustomer[c.id] && tasksByCustomer[c.id] > 0)
      .map(c => ({
        customer: c,
        taskCount: tasksByCustomer[c.id],
      }));
  }, [customers, tasks]);

  const handleNavigate = (mode) => {
    if (setWorkspaceMode) {
      setWorkspaceMode(mode);
    }
    // Scroll to top or trigger view change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[hsl(var(--primary))] tracking-tight">Portfolio Übersicht</h1>
        <p className="text-sm text-[hsl(var(--text-muted))] mt-1">
          Kritische Bereiche für sofortige Aktionen
        </p>
      </div>

      {/* Three Core Sections */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Section 1: Kunden ohne Mandat / Berater */}
        <PortfolioSectionCard
          icon={AlertTriangle}
          title="Kunden ohne Mandat / Berater"
          count={noMandateNoAdvisor.length}
          description="Kunden mit ausstehendem Mandat oder ohne zugewiesenen Berater"
          items={noMandateNoAdvisor.slice(0, 5).map(c => ({
            name: c.company_name || `${c.first_name} ${c.last_name}`,
            sub: c.mandate_status === 'pending' ? 'Mandat ausstehend' : 'Kein Berater',
          }))}
          onNavigate={() => handleNavigate('risks')}
          color="amber"
        />

        {/* Section 2: Cross-Selling / Household Intelligence */}
        <PortfolioSectionCard
          icon={TrendingUp}
          title="Cross-Selling / Household"
          count={crossSellingHousehold.length}
          description="Familien-Mitglieder oder Kunden mit Cross-Selling Potenzial"
          items={crossSellingHousehold.slice(0, 5).map(c => ({
            name: c.company_name || `${c.first_name} ${c.last_name}`,
            sub: customers.some(fc => fc.primary_customer_id === c.id) ? 'Familie' : 'Potenzial',
          }))}
          onNavigate={() => handleNavigate('actions')}
          color="blue"
        />

        {/* Section 3: Offene Aufgaben */}
        <PortfolioSectionCard
          icon={CheckSquare}
          title="Offene Aufgaben"
          count={customersWithOpenTasks.length}
          description="Kunden mit aktiven, offenen Aufgaben"
          items={customersWithOpenTasks.slice(0, 5).map(({ customer, taskCount }) => ({
            name: customer.company_name || `${customer.first_name} ${customer.last_name}`,
            sub: `${taskCount} Aufgabe${taskCount > 1 ? 'n' : ''}`,
          }))}
          onNavigate={() => handleNavigate('tasks')}
          color="violet"
        />
      </div>

      {/* Quick Stats Footer */}
      <div className="mt-8 p-4 rounded-lg bg-[hsl(var(--surface-2))]/40 border border-[hsl(var(--border-subtle))]/30">
        <div className="flex items-center justify-between text-xs text-[hsl(var(--text-muted))]">
          <span><strong>{customers.length}</strong> Kunden im Portfolio</span>
          <span><strong>{tasks.filter(t => t.status === 'open').length}</strong> offene Aufgaben</span>
          <span><strong>{noMandateNoAdvisor.length}</strong> benötigen Aufmerksamkeit</span>
        </div>
      </div>
    </div>
  );
}