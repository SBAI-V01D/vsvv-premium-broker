import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingDown, 
  Shield, 
  Users, 
  ArrowUpRight,
  Calculator,
  Sparkles,
  Upload
} from 'lucide-react';
import BAGDatenImport from './BAGDatenImport';

export default function KrankenkassenCockpit() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['krankenkassen-stats'],
    queryFn: async () => {
      const vergleiche = await base44.entities.KrankenkassenVergleich.list();
      
      const letzte30Tage = vergleiche.filter(v => {
        const datum = new Date(v.vergleichsdatum);
        const vor30Tagen = new Date();
        vor30Tagen.setDate(vor30Tagen.getDate() - 30);
        return datum >= vor30Tagen;
      });

      const gesamtEinsparung = letzte30Tage.reduce((sum, v) => {
        const besteErsparnis = v.vergleichsergebnisse?.[0]?.ersparnis_jaehrlich || 0;
        return sum + besteErsparnis;
      }, 0);

      const durchschnittlicheEinsparung = letzte30Tage.length > 0 
        ? gesamtEinsparung / letzte30Tage.length 
        : 0;

      const wechselEmpfohlen = letzte30Tage.filter(v => v.ki_analyse?.wechsel_empfohlen).length;

      return {
        vergleicheLetzte30Tage: letzte30Tage.length,
        gesamtEinsparung,
        durchschnittlicheEinsparung,
        wechselEmpfohlen,
        wechselQuote: letzte30Tage.length > 0 
          ? (wechselEmpfohlen / letzte30Tage.length) * 100 
          : 0
      };
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Krankenkassen Cockpit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <p className="text-muted-foreground">Lade Daten...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const kpis = [
    {
      label: 'Vergleiche (30 Tage)',
      value: stats?.vergleicheLetzte30Tage || 0,
      icon: Calculator,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      label: 'Ø Ersparnis pro Kunde',
      value: `CHF ${Math.round(stats?.durchschnittlicheEinsparung || 0).toLocaleString('de-CH')}`,
      icon: TrendingDown,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    {
      label: 'Gesamt-Einsparung',
      value: `CHF ${Math.round(stats?.gesamtEinsparung || 0).toLocaleString('de-CH')}`,
      icon: ArrowUpRight,
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      label: 'Wechsel empfohlen',
      value: `${Math.round(stats?.wechselQuote || 0)}%`,
      icon: Sparkles,
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Krankenkassen Cockpit
          </CardTitle>
          <Badge variant="outline" className="badge-info">
            KVG
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-md ${kpi.bg}`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground mb-1">
                {kpi.value}
              </p>
              <p className="text-xs text-muted-foreground">
                {kpi.label}
              </p>
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/krankenkassen-vergleich">
              <Calculator className="w-3.5 h-3.5 mr-2" />
              Neuer Vergleich
            </a>
          </Button>
          <BAGDatenImport />
        </div>
      </CardContent>
    </Card>
  );
}