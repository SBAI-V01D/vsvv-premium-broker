/**
 * RenewalRadar — Contract Renewal Intelligence
 * Categories: critical (<30 days), 30-90 days, high premium, no follow-up, no activity
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Calendar, TrendingUp, Activity, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'critical', label: 'Kritisch (<30 Tage)', icon: AlertTriangle, color: 'text-red-600', threshold: 30 },
  { id: 'upcoming', label: '30–90 Tage', icon: Calendar, color: 'text-amber-600', threshold: 90 },
  { id: 'high_premium', label: 'Hohe Prämie', icon: TrendingUp, color: 'text-[hsl(var(--primary))]', threshold: null },
  { id: 'no_followup', label: 'Ohne Folgeangebot', icon: FileText, color: 'text-slate-500', threshold: null },
  { id: 'no_activity', label: 'Keine Aktivität', icon: Activity, color: 'text-slate-400', threshold: null },
];

function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date();
  const target = new Date(dateStr);
  const diff = target - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(amount);
}

export default function RenewalRadar() {
  const { data: contracts = [] } = useQuery({
    queryKey: ['renewal_contracts'],
    queryFn: () => base44.entities.Contract.filter({ archived: false }, '-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['renewal_customers'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, '-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['renewal_opportunities'],
    queryFn: () => base44.entities.Verkaufschance.filter({}),
    staleTime: 5 * 60 * 1000,
  });

  const customerMap = new Map(customers.map(c => [c.id, c]));

  // Categorize contracts
  const activeContracts = contracts.filter(c => c.status === 'active' && c.cancellation_deadline);

  const categorized = {
    critical: [],
    upcoming: [],
    high_premium: [],
    no_followup: [],
    no_activity: [],
  };

  activeContracts.forEach(contract => {
    const days = daysUntil(contract.cancellation_deadline);
    const hasFollowup = verkaufschancen.some(v => v.linked_contract_id === contract.id);
    const lastActivity = contract.updated_date ? new Date(contract.updated_date) : new Date(0);
    const daysSinceActivity = Math.floor((new Date() - lastActivity) / (1000 * 60 * 60 * 24));

    if (days >= 0 && days <= 30) {
      categorized.critical.push({ ...contract, daysUntil: days });
    } else if (days > 30 && days <= 90) {
      categorized.upcoming.push({ ...contract, daysUntil: days });
    }

    if ((contract.premium_yearly || 0) >= 5000) {
      categorized.high_premium.push(contract);
    }

    if (!hasFollowup && days > 0 && days <= 90) {
      categorized.no_followup.push({ ...contract, daysUntil: days });
    }

    if (daysSinceActivity > 90) {
      categorized.no_activity.push({ ...contract, daysSinceActivity });
    }
  });

  const RenewalCard = ({ contract, category }) => {
    const customer = customerMap.get(contract.customer_id);
    const categoryName = CATEGORIES.find(c => c.id === category)?.label || category;

    return (
      <div className="surface-0 p-5 transition-all hover:shadow-card-md">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-heading font-semibold text-[hsl(var(--text-heading))]">
              {contract.insurer}
            </h3>
            <p className="text-body-sm text-[hsl(var(--text-muted))] mt-0.5">
              {contract.policy_number || 'Keine Police'}
            </p>
          </div>
          <div className={cn("text-[11px] font-bold uppercase tracking-widest", CATEGORIES.find(c => c.id === category)?.color)}>
            {categoryName}
          </div>
        </div>

        <div className="space-y-2 text-body-sm mb-4">
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--text-muted))]">Kunde</span>
            <span className="text-[hsl(var(--text-heading))] font-medium">
              {customer ? `${customer.first_name} ${customer.last_name}` : 'Unbekannt'}
            </span>
          </div>
          {contract.cancellation_deadline && (
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--text-muted))]">Ablaufdatum</span>
              <span className="text-[hsl(var(--text-heading))]">
                {new Date(contract.cancellation_deadline).toLocaleDateString('de-CH')}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--text-muted))]">Jahresprämie</span>
            <span className="text-[hsl(var(--text-heading))] font-semibold">
              {formatCurrency(contract.premium_yearly || 0)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-[hsl(var(--border-subtle))]">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))/0.9] transition-colors">
            <FileText className="w-3.5 h-3.5" />
            Renewal starten
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-3))] transition-colors">
            <Calendar className="w-3.5 h-3.5" />
            Task
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-3))] transition-colors">
            Kontakt
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {CATEGORIES.map(cat => {
        const items = categorized[cat.id] || [];
        if (items.length === 0) return null;

        const Icon = cat.icon;
        return (
          <section key={cat.id}>
            <div className="flex items-center gap-3 mb-4">
              <Icon className={cn("w-5 h-5", cat.color)} />
              <h2 className="text-h2 font-bold text-[hsl(var(--text-heading))]">{cat.label}</h2>
              <span className="text-[11px] font-bold text-[hsl(var(--text-muted))]">{items.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(c => (
                <RenewalCard key={c.id} contract={c} category={cat.id} />
              ))}
            </div>
          </section>
        );
      })}

      {Object.values(categorized).every(arr => arr.length === 0) && (
        <div className="text-center py-12">
          <p className="text-[hsl(var(--text-muted))]">Keine anstehenden Verlängerungen</p>
        </div>
      )}
    </div>
  );
}