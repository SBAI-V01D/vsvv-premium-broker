/**
 * OperationsIntelligence — Main Operations Workspace
 * Combines: Mandate compliance, unassigned customers, no contracts, tasks, inactivity, cross-selling
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, UserX, FileX, CheckCircle, Clock, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'no_mandate', label: 'Ohne Mandat', icon: AlertTriangle, severity: 'warning' },
  { id: 'no_advisor', label: 'Ohne Berater', icon: UserX, severity: 'critical' },
  { id: 'no_contracts', label: 'Ohne Verträge', icon: FileX, severity: 'info' },
  { id: 'critical_tasks', label: 'Kritische Aufgaben', icon: AlertTriangle, severity: 'critical' },
  { id: 'no_activity', label: 'Keine Aktivität 90T+', icon: Clock, severity: 'warning' },
  { id: 'cross_selling', label: 'Cross-Selling Potenzial', icon: Target, severity: 'info' },
];

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const today = new Date();
  const target = new Date(dateStr);
  const diff = today - target;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function OperationsIntelligence() {
  const { data: customers = [] } = useQuery({
    queryKey: ['ops_customers'],
    queryFn: () => base44.entities.Customer.filter({ archived: false }, '-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['ops_contracts'],
    queryFn: () => base44.entities.Contract.filter({ status: 'active', archived: false }, '-created_date', 500),
    staleTime: 5 * 60 * 1000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['ops_tasks'],
    queryFn: () => base44.entities.Task.filter({ status: 'open' }, '-due_date', 200),
    staleTime: 5 * 60 * 1000,
  });

  const { data: verkaufschancen = [] } = useQuery({
    queryKey: ['ops_opportunities'],
    queryFn: () => base44.entities.Verkaufschance.filter({}),
    staleTime: 5 * 60 * 1000,
  });

  const primaryCustomers = customers.filter(c => !c.is_family_member);

  // Categorize
  const noMandate = primaryCustomers.filter(c => c.mandate_status === 'pending' || c.mandate_status === 'invalid');
  const noAdvisor = primaryCustomers.filter(c => !c.advisor_id && !c.primary_advisor_id);
  const noContracts = primaryCustomers.filter(c => {
    const hasContracts = contracts.some(contract => contract.customer_id === c.id && contract.status === 'active');
    return !hasContracts;
  });
  const criticalTasks = tasks.filter(t => t.priority === 'urgent' || t.priority === 'high');
  const noActivity = primaryCustomers.filter(c => daysSince(c.updated_date) > 90);
  const crossSelling = primaryCustomers.filter(c => {
    const custContracts = contracts.filter(contract => contract.customer_id === c.id && contract.status === 'active');
    const sparten = new Set(custContracts.map(contract => contract.sparte));
    return sparten.size < 2 && custContracts.length >= 1;
  });

  const categorized = {
    no_mandate: noMandate,
    no_advisor: noAdvisor,
    no_contracts: noContracts,
    critical_tasks: criticalTasks,
    no_activity: noActivity,
    cross_selling: crossSelling,
  };

  const CustomerCard = ({ customer, type }) => {
    const hasContracts = contracts.some(c => c.customer_id === customer.id && c.status === 'active');
    const taskCount = tasks.filter(t => t.customer_id === customer.id && (t.status === 'open' || t.status === 'in_progress')).length;
    const hasOpportunity = verkaufschancen.some(v => v.customer_id === customer.id && !['gewonnen', 'verloren'].includes(v.status));

    return (
      <div className="surface-0 p-4 transition-all hover:shadow-card-md">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-heading font-semibold text-[hsl(var(--text-heading))]">
              {customer.first_name} {customer.last_name}
            </h3>
            <p className="text-body-sm text-[hsl(var(--text-muted))] mt-0.5">
              {customer.email || customer.phone || 'Keine Kontaktdaten'}
            </p>
          </div>
          {type === 'no_mandate' && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
              {customer.mandate_status}
            </span>
          )}
        </div>

        <div className="space-y-2 text-body-sm mb-4">
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--text-muted))]">Berater</span>
            <span className="text-[hsl(var(--text-heading))]">
              {customer.advisor_id || customer.primary_advisor_id ? 'Zugewiesen' : 'Nicht zugewiesen'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--text-muted))]">Verträge</span>
            <span className="text-[hsl(var(--text-heading))]">{hasContracts ? 'Ja' : 'Nein'}</span>
          </div>
          {taskCount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--text-muted))]">Offene Tasks</span>
              <span className="text-amber-600 font-semibold">{taskCount}</span>
            </div>
          )}
          {hasOpportunity && (
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--text-muted))]">Opportunity</span>
              <span className="text-[hsl(var(--primary))]">Aktiv</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-[hsl(var(--border-subtle))]">
          {type === 'no_mandate' && (
            <button className="flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))/0.9] transition-colors">
              Mandat anfordern
            </button>
          )}
          {type === 'no_advisor' && (
            <button className="flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))/0.9] transition-colors">
              Berater zuweisen
            </button>
          )}
          {type === 'no_contracts' && (
            <>
              <button className="flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))/0.9] transition-colors">
                Opportunity
              </button>
              <button className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-3))] transition-colors">
                Beratung
              </button>
            </>
          )}
          {type === 'no_activity' && (
            <>
              <button className="flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))/0.9] transition-colors">
                Kontakt
              </button>
              <button className="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--surface-2))] text-[hsl(var(--text-heading))] hover:bg-[hsl(var(--surface-3))] transition-colors">
                Follow-up
              </button>
            </>
          )}
          {type === 'cross_selling' && (
            <button className="flex-1 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))/0.9] transition-colors">
              Potenzial prüfen
            </button>
          )}
        </div>
      </div>
    );
  };

  const TaskCard = ({ task }) => {
    const customer = customers.find(c => c.id === task.customer_id);

    return (
      <div className="surface-0 p-4 transition-all hover:shadow-card-md">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-heading font-semibold text-[hsl(var(--text-heading))]">
              {task.title}
            </h3>
            <p className="text-body-sm text-[hsl(var(--text-muted))] mt-0.5">
              {task.description || 'Keine Beschreibung'}
            </p>
          </div>
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-widest",
            task.priority === 'urgent' ? 'text-red-600' : 'text-amber-600'
          )}>
            {task.priority}
          </span>
        </div>

        <div className="space-y-2 text-body-sm mb-4">
          {customer && (
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--text-muted))]">Kunde</span>
              <span className="text-[hsl(var(--text-heading))]">
                {customer.first_name} {customer.last_name}
              </span>
            </div>
          )}
          {task.due_date && (
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--text-muted))]">Fällig</span>
              <span className="text-[hsl(var(--text-heading))]">
                {new Date(task.due_date).toLocaleDateString('de-CH')}
              </span>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-[hsl(var(--border-subtle))]">
          <button className="w-full px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))/0.9] transition-colors">
            Task bearbeiten
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {SECTIONS.map(section => {
        const items = categorized[section.id] || [];
        if (items.length === 0) return null;

        const Icon = section.icon;
        const severityColor = {
          critical: 'text-red-600',
          warning: 'text-amber-600',
          info: 'text-[hsl(var(--primary))]',
        }[section.severity];

        return (
          <section key={section.id}>
            <div className="flex items-center gap-3 mb-4">
              <Icon className={cn("w-5 h-5", severityColor)} />
              <h2 className="text-h2 font-bold text-[hsl(var(--text-heading))]">{section.label}</h2>
              <span className="text-[11px] font-bold text-[hsl(var(--text-muted))]">{items.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.id === 'critical_tasks'
                ? items.map(t => <TaskCard key={t.id} task={t} />)
                : items.map(c => <CustomerCard key={c.id} customer={c} type={section.id} />)
              }
            </div>
          </section>
        );
      })}

      {Object.values(categorized).every(arr => arr.length === 0) && (
        <div className="text-center py-12">
          <p className="text-[hsl(var(--text-muted))]">Keine offenen Aktionen</p>
        </div>
      )}
    </div>
  );
}