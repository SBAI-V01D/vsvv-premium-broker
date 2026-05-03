import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { usePortalCustomer } from '@/hooks/usePortalCustomer';
import { FileText, AlertCircle, FolderOpen, CheckCircle2, Clock, ChevronRight, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import PortalStatusBadge from '../../components/portal/PortalStatusBadge';

export default function PortalOverview() {
  const { customer: user } = usePortalCustomer();

  const customerId = localStorage.getItem('portal_customer_id');

  const { data: contracts = [] } = useQuery({
    queryKey: ['portal-contracts', customerId],
    queryFn: () => base44.entities.Contract.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['portal-claims', customerId],
    queryFn: () => base44.entities.Claim.filter({ customer_id: customerId }),
    enabled: !!customerId,
  });

  const activeContracts = contracts.filter(c => c.status === 'aktiv');
  const openClaims = claims.filter(c => !['ausbezahlt', 'abgelehnt'].includes(c.status));
  const totalDocs = contracts.reduce((sum, c) => sum + (c.documents?.length || 0), 0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Guten Morgen';
    if (h < 18) return 'Guten Tag';
    return 'Guten Abend';
  };

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          {greeting()}, {user?.full_name?.split(' ')[0] || 'Willkommen'} 👋
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Heute ist der {format(new Date(), 'EEEE, d. MMMM yyyy', { locale: de })}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Link to="/portal/vertraege">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Aktive Verträge</p>
                <p className="text-3xl font-bold text-foreground mt-1">{activeContracts.length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/portal/schaden">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-amber-400">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Offene Schäden</p>
                <p className="text-3xl font-bold text-foreground mt-1">{openClaims.length}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/portal/dokumente">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-emerald-400">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dokumente</p>
                <p className="text-3xl font-bold text-foreground mt-1">{totalDocs}</p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Contracts */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Meine Verträge</CardTitle>
            <Link to="/portal/vertraege" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              Alle <ChevronRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {activeContracts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Keine aktiven Verträge</p>
            ) : (
              <div className="space-y-3">
                {activeContracts.slice(0, 3).map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Shield className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.insurance_type}</p>
                        <p className="text-xs text-muted-foreground">{c.provider}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">CHF {c.premium_monthly?.toLocaleString('de-CH')}/Mt.</p>
                      <PortalStatusBadge status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Claims */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Schadensmeldungen</CardTitle>
            <Link to="/portal/schaden" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              Alle <ChevronRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {claims.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Keine Schadensmeldungen</p>
              </div>
            ) : (
              <div className="space-y-3">
                {claims.slice(0, 3).map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.incident_date ? format(new Date(c.incident_date), 'dd.MM.yyyy') : '–'}
                        {c.claim_number && <> · Nr. {c.claim_number}</>}
                      </p>
                    </div>
                    <PortalStatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}