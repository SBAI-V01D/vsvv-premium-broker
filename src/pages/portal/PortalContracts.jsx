import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Shield, ChevronDown, ChevronUp, Download, FileText, Calendar, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import PortalStatusBadge from '../../components/portal/PortalStatusBadge';
import PortalPageHeader from '../../components/portal/PortalPageHeader';

const insuranceIcons = {
  KVG: '🏥', VVG: '🏥', Leben: '❤️', Haftpflicht: '🛡️', Hausrat: '🏠',
  Rechtsschutz: '⚖️', Motorfahrzeug: '🚗', Gebäude: '🏢', Unfall: '🩺',
  Krankentaggeld: '📋', BVG: '💼', 'Säule 3a': '💰', Sonstige: '📄',
};

function ContractCard({ contract }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                {insuranceIcons[contract.insurance_type] || '📄'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground">{contract.insurance_type}</h3>
                  <PortalStatusBadge status={contract.status} />
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{contract.provider}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="font-bold text-foreground">CHF {contract.premium_monthly?.toLocaleString('de-CH')}</p>
                <p className="text-xs text-muted-foreground">pro Monat</p>
              </div>
              {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </div>
          </div>
        </CardContent>
      </button>

      {expanded && (
        <div className="border-t border-border bg-slate-50 px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Policen-Nr.</p>
              <p className="text-sm font-medium mt-0.5">{contract.policy_number || '–'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Beginn</p>
              <p className="text-sm font-medium mt-0.5">{contract.start_date ? format(new Date(contract.start_date), 'dd.MM.yyyy') : '–'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Ende</p>
              <p className="text-sm font-medium mt-0.5">{contract.end_date ? format(new Date(contract.end_date), 'dd.MM.yyyy') : 'Unbefristet'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Jahresprämie</p>
              <p className="text-sm font-medium mt-0.5">CHF {contract.premium_yearly?.toLocaleString('de-CH') || '–'}</p>
            </div>
          </div>

          {contract.cancellation_deadline && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
              <span className="font-medium text-amber-800">⚠️ Kündigungsfrist:</span>
              <span className="text-amber-700 ml-2">{format(new Date(contract.cancellation_deadline), 'dd.MM.yyyy')}</span>
            </div>
          )}

          {contract.documents?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">DOKUMENTE</p>
              <div className="space-y-1">
                {contract.documents.map((doc, i) => (
                  <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Download className="w-3.5 h-3.5" />
                    {doc.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {contract.notes && (
            <div className="text-sm text-muted-foreground bg-white border border-border rounded-lg p-3">
              {contract.notes}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function PortalContracts() {
  const { user } = useOutletContext();
  const [filter, setFilter] = useState('all');

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['portal-contracts', user?.id],
    queryFn: () => base44.entities.Contract.filter({ customer_id: user?.id }),
    enabled: !!user?.id,
  });

  const filtered = filter === 'all' ? contracts : contracts.filter(c => c.status === filter);

  return (
    <div>
      <PortalPageHeader
        icon={<FileText className="w-5 h-5 text-primary" />}
        title="Meine Verträge"
        subtitle={`${contracts.filter(c => c.status === 'aktiv').length} aktive Verträge`}
      />

      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'aktiv', 'pendent', 'gekündigt', 'abgelaufen'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === s ? 'bg-primary text-white' : 'bg-white border border-border text-slate-600 hover:bg-slate-50'}`}>
            {s === 'all' ? 'Alle' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-200 animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-muted-foreground">Keine Verträge vorhanden</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => <ContractCard key={c.id} contract={c} />)}
        </div>
      )}
    </div>
  );
}