/**
 * DossierPolicenTab — Phase 5.2
 * Kompakte Policen-Darstellung gruppiert nach Person.
 * Automatischer Filter nach dossier_type.
 * "In Vergleich übernehmen"-Button pro Police.
 * Read-only gegenüber Contract-Entity.
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, FileText, AlertCircle, ChevronDown, ChevronUp, ArrowRight, Filter } from 'lucide-react';

// ── Dossier-Typ → relevante insurance_types ──────────────────────────────────
const DOSSIER_TYPE_FILTER = {
  kk_vergleich:     ['health'],
  vorsorge:         ['life'],
  sachversicherung: ['property', 'liability', 'motor'],
  gesamtdossier:    null, // alle
};

const INSURANCE_TYPE_LABELS = {
  life:      'Leben / Vorsorge',
  health:    'Krankheit / KVG+VVG',
  property:  'Sach',
  liability: 'Haftpflicht',
  motor:     'Motorfahrzeug',
  other:     'Sonstige',
};

const STATUS_CONFIG = {
  active:    { label: 'Aktiv',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending:   { label: 'Pendent',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelled: { label: 'Gekündigt',  cls: 'bg-red-50 text-red-700 border-red-200' },
  expired:   { label: 'Abgelaufen', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  archived:  { label: 'Archiviert', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function ContractCard({ contract, onImport }) {
  const st = STATUS_CONFIG[contract.status] || STATUS_CONFIG.active;
  const premium = contract.premium_yearly ?? (contract.premium_monthly ? contract.premium_monthly * 12 : null);
  const renewalDays = contract.renewal_date
    ? Math.ceil((new Date(contract.renewal_date) - Date.now()) / 86400000)
    : null;

  return (
    <div className="border border-border rounded-lg bg-card p-3 hover:shadow-card-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{contract.insurer}</span>
            <span className={`text-[10px] font-medium border px-1.5 py-0.5 rounded-full ${st.cls}`}>
              {st.label}
            </span>
          </div>
          {contract.product && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{contract.product}</p>
          )}
          {contract.sparte && (
            <p className="text-xs text-muted-foreground truncate">{contract.sparte}</p>
          )}
        </div>
        {premium != null && (
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-foreground">
              CHF {(premium / 12).toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground">/Monat</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/60">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          {contract.policy_number && <span className="font-mono">#{contract.policy_number}</span>}
          {contract.start_date && <span>ab {new Date(contract.start_date).toLocaleDateString('de-CH')}</span>}
          {contract.renewal_date && (
            <span className={renewalDays !== null && renewalDays <= 90 ? 'text-amber-600 font-medium' : ''}>
              Ablauf: {new Date(contract.renewal_date).toLocaleDateString('de-CH')}
            </span>
          )}
        </div>
        {onImport && contract.status === 'active' && (
          <button
            onClick={() => onImport(contract)}
            className="flex items-center gap-1 text-[10px] text-primary font-medium hover:bg-primary/5 px-2 py-1 rounded-md transition-colors shrink-0"
          >
            <ArrowRight className="w-3 h-3" />
            Übernehmen
          </button>
        )}
      </div>
    </div>
  );
}

function PersonAccordion({ person, contracts, isMain, onImport }) {
  const [open, setOpen] = useState(isMain); // Hauptperson standardmässig offen

  const grouped = useMemo(() => {
    const g = {};
    contracts.forEach(c => {
      const k = c.insurance_type || 'other';
      if (!g[k]) g[k] = [];
      g[k].push(c);
    });
    return g;
  }, [contracts]);

  const totalMonthly = contracts
    .filter(c => c.status === 'active')
    .reduce((s, c) => s + ((c.premium_yearly ?? (c.premium_monthly ? c.premium_monthly * 12 : 0)) / 12), 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {person[0]?.toUpperCase()}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">{person}</p>
            <p className="text-[10px] text-muted-foreground">
              {contracts.length} Vertrag{contracts.length !== 1 ? 'e' : ''}
              {totalMonthly > 0 && ` · CHF ${totalMonthly.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/Mt.`}
              {isMain && <span className="ml-1.5 text-primary font-medium">Hauptperson</span>}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {Object.entries(grouped).map(([type, typeContracts]) => (
            <div key={type}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {INSURANCE_TYPE_LABELS[type] || type} ({typeContracts.length})
              </p>
              <div className="space-y-2">
                {typeContracts.map(c => (
                  <ContractCard key={c.id} contract={c} onImport={onImport} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DossierPolicenTab({ dossier, onImportContract }) {
  const customerId = dossier?.customer_id;
  const dossierType = dossier?.dossier_type || 'gesamtdossier';
  const [filterActive, setFilterActive] = useState(true); // Auto-Filter aktiv

  const { data: familyMembers = [] } = useQuery({
    queryKey: ['dossier_family_ro', customerId],
    queryFn: () => base44.entities.Customer.filter({ primary_customer_id: customerId }),
    enabled: !!customerId,
  });

  const { data: mainCustomer } = useQuery({
    queryKey: ['dossier_customer_ro', customerId],
    queryFn: () => base44.entities.Customer.filter({ id: customerId }).then(r => r[0]),
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

  // Auto-Filter nach Dossier-Typ
  const relevantTypes = DOSSIER_TYPE_FILTER[dossierType];
  const filteredContracts = useMemo(() => {
    if (!filterActive || !relevantTypes) return allContracts;
    return allContracts.filter(c => relevantTypes.includes(c.insurance_type));
  }, [allContracts, filterActive, relevantTypes]);

  // Gruppierung nach Person
  const personGroups = useMemo(() => {
    const groups = {};
    const allPersons = [
      ...(mainCustomer ? [{ id: customerId, name: `${mainCustomer.first_name} ${mainCustomer.last_name}`.trim(), isMain: true }] : []),
      ...familyMembers.map(m => ({ id: m.id, name: `${m.first_name} ${m.last_name}`.trim(), isMain: false })),
    ];
    allPersons.forEach(p => {
      const personContracts = filteredContracts.filter(c => c.customer_id === p.id);
      if (personContracts.length > 0) {
        groups[p.name] = { contracts: personContracts, isMain: p.isMain };
      }
    });
    return groups;
  }, [filteredContracts, mainCustomer, familyMembers, customerId]);

  const totalPremium = allContracts.filter(c => c.status === 'active')
    .reduce((sum, c) => sum + ((c.premium_yearly ?? (c.premium_monthly ? c.premium_monthly * 12 : 0)) / 12), 0);

  const filteredOut = allContracts.length - filteredContracts.length;

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
        {[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info-Bar + Filter-Toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 border border-border/60 rounded-lg px-3 py-2 flex-1">
          <Shield className="w-3.5 h-3.5 shrink-0" />
          Policen read-only aus CRM — «Übernehmen» vorbefüllt den Vergleich.
        </div>
        {relevantTypes && (
          <button
            onClick={() => setFilterActive(f => !f)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
              filterActive
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <Filter className="w-3 h-3" />
            {filterActive ? 'Filter aktiv' : 'Alle anzeigen'}
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Verträge total', value: allContracts.length },
          { label: 'Davon aktiv', value: allContracts.filter(c => c.status === 'active').length },
          { label: 'Prämie/Monat', value: `CHF ${totalPremium.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-lg font-bold text-foreground">{kpi.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filter-Hinweis */}
      {filterActive && filteredOut > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Filter className="w-3.5 h-3.5 shrink-0" />
          {filteredOut} Vertrag{filteredOut !== 1 ? 'e' : ''} ausgeblendet (nicht relevant für {dossierType.replace(/_/g, ' ')}).
          <button onClick={() => setFilterActive(false)} className="underline hover:no-underline ml-1">Alle anzeigen</button>
        </div>
      )}

      {/* Leerer State */}
      {filteredContracts.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl p-8 text-center">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            {filterActive && filteredOut > 0
              ? 'Keine passenden Verträge für diesen Dossier-Typ.'
              : 'Keine Verträge im CRM gefunden.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(personGroups).map(([name, { contracts, isMain }]) => (
            <PersonAccordion
              key={name}
              person={name}
              contracts={contracts}
              isMain={isMain}
              onImport={onImportContract}
            />
          ))}
        </div>
      )}
    </div>
  );
}