import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, Shield, TrendingUp, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const INSURANCE_TYPE_LABELS = {
  life: 'Leben', health: 'Kranken', property: 'Sach', liability: 'Haftpflicht',
  motor: 'Motorfahrzeug', other: 'Sonstige',
};

const FAMILY_ROLE_LABELS = {
  primary: 'Hauptperson', spouse: 'Partner/in', child: 'Kind', parent: 'Elternteil', other: 'Mitglied',
};

function PolicyPill({ contract }) {
  const statusColor = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
  }[contract.status] || 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px]', statusColor)}>
      <Shield className="w-2.5 h-2.5 flex-shrink-0" />
      <span className="font-medium truncate max-w-[120px]">{contract.insurer}</span>
      <span className="text-[9px] opacity-70">·</span>
      <span className="text-[9px] opacity-80">{INSURANCE_TYPE_LABELS[contract.insurance_type] || contract.insurance_type}</span>
      {(contract.premium_yearly || contract.premium_monthly) && (
        <>
          <span className="text-[9px] opacity-70">·</span>
          <span className="font-semibold">
            {((contract.premium_yearly || (contract.premium_monthly * 12)) || 0).toLocaleString('de-CH')} CHF/J
          </span>
        </>
      )}
    </div>
  );
}

function PersonRow({ person, contracts, isMain }) {
  const personContracts = contracts.filter(c => c.customer_id === person.id && c.status === 'active');
  const totalPremium = personContracts.reduce((sum, c) => sum + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0);
  const role = FAMILY_ROLE_LABELS[person.family_role] || 'Mitglied';

  return (
    <div className={cn(
      'px-3 py-2 rounded-lg',
      isMain ? 'bg-[hsl(var(--surface-2))]/40' : 'bg-transparent border-l-2 border-[hsl(var(--border-subtle))]/60 ml-3 pl-3'
    )}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0',
          isMain ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--surface-3))] text-[hsl(var(--text-muted))]'
        )}>
          {(person.first_name?.[0] || '') + (person.last_name?.[0] || '')}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-semibold text-[hsl(var(--text-heading))]">
            {person.first_name} {person.last_name}
          </span>
          <span className="ml-1.5 text-[9px] text-[hsl(var(--text-subtle))] bg-[hsl(var(--surface-3))] px-1.5 py-0.5 rounded-full">
            {role}
          </span>
        </div>
        {totalPremium > 0 && (
          <span className="text-[10px] font-semibold text-[hsl(var(--primary))] flex-shrink-0">
            {totalPremium.toLocaleString('de-CH')} CHF
          </span>
        )}
      </div>

      {personContracts.length > 0 ? (
        <div className="flex flex-wrap gap-1 ml-7">
          {personContracts.map(c => (
            <PolicyPill key={c.id} contract={c} />
          ))}
        </div>
      ) : (
        <div className="ml-7 flex items-center gap-1 text-[9px] text-[hsl(var(--text-subtle))]">
          <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
          <span>Keine aktiven Policen</span>
        </div>
      )}
    </div>
  );
}

function HouseholdCard({ primaryCustomer, familyMembers, contracts }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const allMembers = [primaryCustomer, ...familyMembers];
  const allContracts = contracts.filter(c => allMembers.some(m => m.id === c.customer_id) && c.status === 'active');
  const totalPremium = allContracts.reduce((sum, c) => sum + (c.premium_yearly || (c.premium_monthly || 0) * 12), 0);
  const totalPolicies = allContracts.length;

  // Find members without policies (cross-sell signal)
  const membersWithoutPolicies = allMembers.filter(m =>
    !contracts.some(c => c.customer_id === m.id && c.status === 'active')
  );

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-[hsl(var(--border-subtle))]/40 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-[hsl(var(--surface-2))]/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center flex-shrink-0">
          <Users className="w-4 h-4 text-[hsl(var(--primary))]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[12px] font-semibold text-[hsl(var(--text-heading))]">
              Familie {primaryCustomer.last_name}
            </p>
            <span className="text-[9px] text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded-full">
              {allMembers.length} Personen
            </span>
            <span className="text-[9px] text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded-full">
              {totalPolicies} Policen
            </span>
            {membersWithoutPolicies.length > 0 && (
              <span className="text-[9px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                ⚡ {membersWithoutPolicies.length}× Cross-Sell
              </span>
            )}
          </div>
          <p className="text-[10px] text-[hsl(var(--text-muted))] mt-0.5">
            Gesamtprämie: <span className="font-semibold text-[hsl(var(--primary))]">{totalPremium.toLocaleString('de-CH')} CHF/Jahr</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); navigate(`/kunden/${primaryCustomer.id}/360`); }}
            className="text-[9px] font-medium text-[hsl(var(--primary))] hover:underline flex items-center gap-0.5"
          >
            360° <ChevronRight className="w-3 h-3" />
          </button>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[hsl(var(--text-muted))]" /> : <ChevronDown className="w-3.5 h-3.5 text-[hsl(var(--text-muted))]" />}
        </div>
      </div>

      {/* Expanded: Person-by-Person Policies */}
      {expanded && (
        <div className="border-t border-[hsl(var(--border-subtle))]/30 p-3 space-y-2">
          {allMembers.map((member, idx) => (
            <PersonRow
              key={member.id}
              person={member}
              contracts={contracts}
              isMain={idx === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HouseholdIntelligenceSection({ householdCustomers, customers, contracts }) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 4;

  const displayed = showAll ? householdCustomers : householdCustomers.slice(0, LIMIT);

  const totalHouseholds = householdCustomers.length;
  const totalPremium = householdCustomers.reduce((sum, c) => {
    const members = [c, ...customers.filter(fm => fm.primary_customer_id === c.id)];
    return sum + contracts.filter(ct => members.some(m => m.id === ct.customer_id) && ct.status === 'active')
      .reduce((s, ct) => s + (ct.premium_yearly || (ct.premium_monthly || 0) * 12), 0);
  }, 0);

  return (
    <div>
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
        <h3 className="text-sm font-bold text-[hsl(var(--primary))]">Haushalte</h3>
        <span className="text-[9px] font-medium text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-2))] px-1.5 py-0.5 rounded-full">
          {totalHouseholds}
        </span>
        {totalPremium > 0 && (
          <span className="ml-auto text-[10px] font-semibold text-[hsl(var(--primary))] flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {totalPremium.toLocaleString('de-CH')} CHF/J gesamt
          </span>
        )}
      </div>

      {householdCustomers.length === 0 ? (
        <p className="text-[9px] text-[hsl(var(--text-muted))] bg-[hsl(var(--surface-1))] rounded-lg p-3">
          Keine Haushalte mit Familienmitgliedern
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {displayed.map(customer => (
              <HouseholdCard
                key={customer.id}
                primaryCustomer={customer}
                familyMembers={customers.filter(fm => fm.primary_customer_id === customer.id)}
                contracts={contracts}
              />
            ))}
          </div>
          {householdCustomers.length > LIMIT && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="mt-2 text-[10px] font-medium text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]/80"
            >
              {showAll ? 'Weniger anzeigen' : `+${householdCustomers.length - LIMIT} weitere Haushalte`}
            </button>
          )}
        </>
      )}
    </div>
  );
}