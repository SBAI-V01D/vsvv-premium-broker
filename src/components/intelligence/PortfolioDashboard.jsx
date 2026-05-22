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
import { AlertTriangle, TrendingUp, CheckSquare, ArrowRight, Gift, Users } from 'lucide-react';
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
  const noMandateNoAdvisor = useMemo(() => {
    return customers.filter(c => 
      c.mandate_status === 'pending' || 
      (!c.advisor_id && !c.primary_advisor_id)
    );
  }, [customers]);

  // Section 2: Geburtstage (Altersgruppen)
  const birthdays = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    return customers
      .filter(c => c.birthdate && new Date(c.birthdate).getMonth() === currentMonth)
      .map(c => {
        const birthDate = new Date(c.birthdate);
        const age = today.getFullYear() - birthDate.getFullYear() - 
          (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate()) ? 1 : 0);
        return {
          customer: c,
          birthdate: c.birthdate,
          age,
        };
      });
  }, [customers]);

  // Section 3: Hohe Prämien (VIP Kunden)
  const highPremium = useMemo(() => {
    return customers
      .filter(c => (c.total_premium || 0) >= 5000)
      .sort((a, b) => (b.total_premium || 0) - (a.total_premium || 0));
  }, [customers]);

  // Section 4: Cross-Selling / Household Intelligence
  const crossSellingHousehold = useMemo(() => {
    return customers.filter(c => {
      const hasFamily = customers.some(fc => fc.primary_customer_id === c.id);
      const hasSingleContract = (c.total_premium || 0) > 0;
      return hasFamily || hasSingleContract;
    });
  }, [customers]);

  const handleNavigate = (mode) => {
    if (setWorkspaceMode) {
      setWorkspaceMode(mode);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[hsl(var(--primary))] tracking-tight">Portfolio Übersicht</h1>
        <p className="text-sm text-[hsl(var(--text-muted))] mt-1">
          Vier kritische Bereiche für sofortige Aktionen
        </p>
      </div>

      {/* Four Core Sections - 2x2 Grid */}
      <div className="grid gap-6 md:grid-cols-2">
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

        {/* Section 2: Geburtstage (Altersgruppen) */}
        <PortfolioSectionCard
          icon={Gift}
          title="Altersgruppen (Geburtstage)"
          count={birthdays.length}
          description="Kunden mit Geburtstag im aktuellen Monat"
          items={birthdays.slice(0, 5).map(({ customer, birthdate, age }) => ({
            name: customer.company_name || `${customer.first_name} ${customer.last_name}`,
            sub: `${birthdate} (${age} Jahre)`,
          }))}
          onNavigate={() => handleNavigate('operations')}
          color="blue"
        />

        {/* Section 3: Hohe Prämien */}
        <PortfolioSectionCard
          icon={TrendingUp}
          title="Hohe Prämien"
          count={highPremium.length}
          description="Kunden mit Jahresprämie ≥ 5'000 CHF"
          items={highPremium.slice(0, 5).map(c => ({
            name: c.company_name || `${c.first_name} ${c.last_name}`,
            sub: `${(c.total_premium || 0).toLocaleString('de-CH')} CHF/Jahr`,
          }))}
          onNavigate={() => handleNavigate('private')}
          color="violet"
        />

        {/* Section 4: Cross-Selling / Household */}
        <PortfolioSectionCard
          icon={Users}
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
      </div>

      {/* Quick Stats Footer */}
      <div className="mt-8 p-4 rounded-lg bg-[hsl(var(--surface-2))]/40 border border-[hsl(var(--border-subtle))]/30">
        <div className="flex items-center justify-between text-xs text-[hsl(var(--text-muted))]">
          <span><strong>{customers.length}</strong> Kunden im Portfolio</span>
          <span><strong>{birthdays.length}</strong> Geburtstage diesen Monat</span>
          <span><strong>{highPremium.length}</strong> VIP-Kunden</span>
        </div>
      </div>
    </div>
  );
}