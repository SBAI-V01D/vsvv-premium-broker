import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Calendar, Hash, AlertTriangle, TrendingUp, FileText, Upload, ExternalLink, Plus } from 'lucide-react';
import { format, differenceInDays, addMonths } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../shared/StatusBadge';
import ContractDocuments from './ContractDocuments';
import PolicyUploadDialog from './PolicyUploadDialog';

const insuranceIcons = {
  KVG: '🏥', VVG: '🏥', Leben: '❤️', Haftpflicht: '🛡️', Hausrat: '🏠',
  Rechtsschutz: '⚖️', Motorfahrzeug: '🚗', 'Gebäude': '🏢', Unfall: '🩺',
  Krankentaggeld: '📋', BVG: '💼', 'Säule 3a': '💰', Sonstige: '📄',
};

export default function ContractDetailCard({ contract, customerId, customerName, familyMembers = [] }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showPolicyUpload, setShowPolicyUpload] = useState(false);
  const queryClient = useQueryClient();

  const handleCreateMutation = () => {
    navigate(`/verkaufschancen?new=true&customer_id=${customerId || contract.customer_id}&linked_contract_id=${contract.id}`);
  };

  const familyMemberName = contract.family_member_id && familyMembers.length > 0
    ? (() => {
        const member = familyMembers.find(m => m.id === contract.family_member_id);
        return member ? `${member.first_name} ${member.last_name}` : null;
      })()
    : null;

  const today = new Date();
  const endDate = contract.end_date ? new Date(contract.end_date) : null;
  const daysUntilExpiry = endDate ? differenceInDays(endDate, today) : null;
  const expiresInThreeMonths = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 90;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;

  return (
    <Card className={`overflow-hidden transition-all ${expiresInThreeMonths ? 'border-orange-300' : isExpired ? 'border-red-200' : ''}`}>
      <button className="w-full text-left" onClick={() => setExpanded(!expanded)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl flex-shrink-0">{insuranceIcons[contract.insurance_type] || '📄'}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{contract.insurance_type} {familyMemberName && `(${familyMemberName})`}</p>
                  <StatusBadge status={contract.status} />
                  {expiresInThreeMonths && (
                    <Badge variant="outline" className="border-orange-300 text-orange-600 bg-orange-50 text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Läuft in {daysUntilExpiry}T ab
                    </Badge>
                  )}
                  {isExpired && (
                    <Badge variant="outline" className="border-red-300 text-red-600 bg-red-50 text-xs">
                      Abgelaufen
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{contract.provider}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right hidden sm:block">
                <p className="font-bold text-sm">CHF {contract.premium_monthly != null ? contract.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}</p>
                <p className="text-xs text-muted-foreground">/ Monat</p>
              </div>
              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </CardContent>
      </button>

      {expanded && (
        <div className="border-t border-border bg-slate-50 px-4 py-4 space-y-4">
          {/* Police Document */}
          <div className="bg-white rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Police (PDF)</p>
                  {contract.policy_document_url ? (
                    <p className="text-sm text-emerald-600 font-medium mt-0.5">✓ Hochgeladen</p>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-0.5">Keine Police hochgeladen</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {contract.policy_document_url && (
                  <a href={contract.policy_document_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ansehen
                    </Button>
                  </a>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPolicyUpload(true)}
                  className="gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {contract.policy_document_url ? 'Ersetzen' : 'Hochladen'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateMutation}
                  className="gap-2 text-primary border-primary/30 hover:bg-primary/5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Mutation/Wechsel
                </Button>
              </div>
            </div>
          </div>

          {/* Prämienübersicht */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Prämienübersicht
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Monatsprämie</p>
                <p className="font-semibold text-sm mt-0.5">CHF {contract.premium_monthly != null ? contract.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}</p>
              </div>
              <div className="bg-white rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Jahresprämie</p>
                <p className="font-semibold text-sm mt-0.5">CHF {contract.premium_yearly != null ? contract.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}</p>
              </div>
              <div className="bg-white rounded-lg border border-border p-3 col-span-2 sm:col-span-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Policen-Nummer</p>
                <p className="font-semibold text-sm mt-0.5">{contract.policy_number || '–'}</p>
              </div>
            </div>
          </div>

          {/* Fristen */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Laufzeit & Fristen
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Vertragsbeginn</p>
                <p className="font-semibold text-sm mt-0.5">
                  {contract.start_date ? format(new Date(contract.start_date), 'dd.MM.yyyy') : '–'}
                </p>
              </div>
              <div className={`rounded-lg border p-3 ${isExpired ? 'bg-red-50 border-red-200' : expiresInThreeMonths ? 'bg-orange-50 border-orange-200' : 'bg-white border-border'}`}>
                <p className="text-xs text-muted-foreground">Vertragsende</p>
                <p className={`font-semibold text-sm mt-0.5 ${isExpired ? 'text-red-600' : expiresInThreeMonths ? 'text-orange-600' : ''}`}>
                  {contract.end_date ? format(new Date(contract.end_date), 'dd.MM.yyyy') : 'Unbefristet'}
                </p>
                {daysUntilExpiry !== null && !isExpired && (
                  <p className="text-xs text-muted-foreground mt-0.5">in {daysUntilExpiry} Tagen</p>
                )}
              </div>
              <div className={`rounded-lg border p-3 ${contract.cancellation_deadline && new Date(contract.cancellation_deadline) <= addMonths(today, 1) ? 'bg-amber-50 border-amber-200' : 'bg-white border-border'}`}>
                <p className="text-xs text-muted-foreground">Kündigungsfrist</p>
                <p className="font-semibold text-sm mt-0.5">
                  {contract.cancellation_deadline ? format(new Date(contract.cancellation_deadline), 'dd.MM.yyyy') : '–'}
                </p>
              </div>
            </div>
          </div>

          {/* Ablauf-Warnung */}
          {expiresInThreeMonths && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-800">Vertrag läuft bald ab</p>
                <p className="text-xs text-orange-700 mt-0.5">
                  Dieser Vertrag läuft am {format(endDate, 'dd.MM.yyyy')} ab ({daysUntilExpiry} Tage). 
                  Bitte kontaktieren Sie den Kunden rechtzeitig für eine Erneuerung.
                </p>
              </div>
            </div>
          )}

          {/* Dokumente */}
          <ContractDocuments
            contractId={contract.id}
            customerId={customerId || contract.customer_id}
            customerName={customerName || contract.customer_name}
          />

          {contract.notes && (
            <div className="bg-white border border-border rounded-lg p-3 text-sm text-muted-foreground">
              {contract.notes}
            </div>
          )}
        </div>
      )}

      <PolicyUploadDialog
        open={showPolicyUpload}
        onOpenChange={setShowPolicyUpload}
        contractId={contract.id}
        onUploadSuccess={() => queryClient.invalidateQueries({ queryKey: ['contracts'] })}
      />
    </Card>
  );
}