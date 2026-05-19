/**
 * DossierPolicenTab — Phase 2
 * Zeigt bestehende Verträge des Kunden (inkl. Familienmitglieder) read-only.
 * Kein Write auf Contract/Customer-Entity.
 */
import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, FileText, AlertCircle } from 'lucide-react';

const INSURANCE_TYPE_LABELS = {
  life: 'Leben', health: 'Krankheit', property: 'Sach', liability: 'Haftpflicht',
  motor: 'Motorfahrzeug', other: 'Sonstige',
};

const STATUS_CONFIG = {
  active:    { label: 'Aktiv',      className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending:   { label: 'Pendent',    className: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Gekündigt',  className: 'bg-red-50 text-red-700 border-red-200' },
  expired:   { label: 'Abgelaufen', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  archived:  { label: 'Archiviert', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function ContractRow({ contract }) {
  const st = STATUS_CONFIG[contract.status] || STATUS_CONFIG.active;
  const premium = contract.premium_yearly ?? (contract.premium_monthly ? contract.premium_monthly * 12 : null);
  const renewalDays = contract.renewal_date
    ? Math.ceil((new Date(contract.renewal_date) - Date.now()) / 86400000)
    : null;

  return (
    <div className="border border-border rounded-xl px-5 py-4 bg-card space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">
              {contract.insurer}
            </span>
            {contract.product && (
              <span className="text-xs text-muted-foreground">· {contract.product}</span>
            )}
            <span className={`text-[10px] font-medium border px-2 py-0.5 rounded-full ${st.className}`}>
              {st.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {INSURANCE_TYPE_LABELS[contract.insurance_type] || contract.insurance_type}
              {contract.sparte ? ` · ${contract.sparte}` : ''}
            </span>
            {contract.policy_number && (
              <span className="text-xs text-muted-foreground font-mono">#{contract.policy_number}</span>
            )}
            {contract.customer_name && contract.customer_name !== '' && (
              <span className="text-xs text-muted-foreground">für: {contract.customer_name}</span>
            )}
          </div>
        </div>

        {premium != null && (
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-foreground">CHF {premium.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-muted-foreground">pro Jahr</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        {contract.start_date && (
          <span>Beginn: {new Date(contract.start_date).toLocaleDateString('de-CH')}</span>
        )}
        {contract.renewal_date && (
          <span className={renewalDays !== null && renewalDays <= 90 ? 'text-amber-600 font-medium' : ''}>
            Ablauf: {new Date(contract.renewal_date).toLocaleDateString('de-CH')}
            {renewalDays !== null && renewalDays >= 0 && renewalDays <= 90 && (
              <span className="ml-1">(in {renewalDays}d)</span>
            )}
          </span>
        )}
        {contract.end_date && !contract.renewal_date && (
          <span>Ende: {new Date(contract.end_date).toLocaleDateString('de-CH')}</span>
        )}
      </div>
    </div>
  );
}

export default function DossierPolicenTab({ dossier }) {
  const customerId = dossier?.customer_id;

  const { data: familyMembers = [] } = useQuery({
    queryKey: ['dossier_family_ro', customerId],
    queryFn: () => base44.entities.Customer.filter({ primary_customer_id: customerId }),
    enabled: !!customerId,
  });

  const allCustomerIds = useMemo(() => {
    if (!customerId) return [];
    return [customerId, ...familyMembers.map(m => m.id)];
  }, [customerId, familyMembers]);

  const { data: allContracts = [], isLoading } = useQuery({
    queryKey: ['dossier_contracts_ro', allCustomerIds],
    queryFn: async () => {
      const results = await Promise.all(
        allCustomerIds.map(id => base44.entities.Contract.filter({ customer_id: id }))
      );
      return results.flat().filter(c => c.status !== 'archived');
    },
    enabled: allCustomerIds.length > 0,
  });

  // Group by insurance type
  const grouped = useMemo(() => {
    const groups = {};
    allContracts.forEach(c => {
      const key = c.insurance_type || 'other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return groups;
  }, [allContracts]);

  const totalPremium = useMemo(() => {
    return allContracts
      .filter(c => c.status === 'active')
      .reduce((sum, c) => {
        const p = c.premium_yearly ?? (c.premium_monthly ? c.premium_monthly * 12 : 0);
        return sum + (p || 0);
      }, 0);
  }, [allContracts]);

  if (!customerId) {
    return (
      <div className="flex items-center justify-center py-16 text-center">
        <div>
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Bitte zuerst einen Kunden im Stammdaten-Tab auswählen.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-lg px-3 py-2">
        <Shield className="w-3.5 h-3.5 shrink-0" />
        Policen werden ausschliesslich lesend aus dem CRM angezeigt.
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Verträge total', value: allContracts.length },
          { label: 'Davon aktiv', value: allContracts.filter(c => c.status === 'active').length },
          { label: 'Jahresprämie aktiv', value: `CHF ${totalPremium.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-lg font-bold text-foreground">{kpi.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {allContracts.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">Keine Verträge im CRM gefunden.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([type, contracts]) => (
          <div key={type}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {INSURANCE_TYPE_LABELS[type] || type} ({contracts.length})
            </h4>
            <div className="space-y-2">
              {contracts.map(c => <ContractRow key={c.id} contract={c} />)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}