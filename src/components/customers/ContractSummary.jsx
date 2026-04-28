import React from 'react';
import { format } from 'date-fns';
import { Shield, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const TYPE_EMOJI = {
  KVG: '🏥', VVG: '🏥', Leben: '❤️', Haftpflicht: '🛡️', Hausrat: '🏠',
  Rechtsschutz: '⚖️', Motorfahrzeug: '🚗', Gebäude: '🏢', Unfall: '🩺',
  Krankentaggeld: '📋', BVG: '💼', 'Säule 3a': '💰', Sonstige: '📄',
};

export default function ContractSummary({ contracts = [] }) {
  const active = contracts.filter(c => c.status === 'aktiv');
  const totalMonthly = active.reduce((s, c) => s + (c.premium_monthly || 0), 0);
  const totalYearly  = active.reduce((s, c) => s + (c.premium_yearly  || 0), 0);

  const today = new Date();
  const expiringSoon = active.filter(c => {
    if (!c.end_date) return false;
    const days = Math.ceil((new Date(c.end_date) - today) / 86400000);
    return days >= 0 && days <= 90;
  });

  if (contracts.length === 0) return null;

  return (
    <div className="mb-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Aktive Verträge', value: active.length, icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50' },
          { label: 'Verträge total', value: contracts.length, icon: Shield, color: 'text-primary bg-primary/10' },
          { label: 'Monatsprämie', value: totalMonthly > 0 ? `CHF ${totalMonthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '–', icon: Clock, color: 'text-blue-500 bg-blue-50' },
          { label: 'Jahresprämie', value: totalYearly > 0 ? `CHF ${totalYearly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '–', icon: Shield, color: 'text-amber-500 bg-amber-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                <p className="font-bold text-sm leading-tight">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Expiry warning */}
      {expiringSoon.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-start gap-3 mb-4">
          <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-orange-800">{expiringSoon.length} Police(n) laufen in &lt;90 Tagen ab:</span>
            <span className="text-orange-700 ml-1">
              {expiringSoon.map(c => `${c.insurance_type} (${format(new Date(c.end_date), 'dd.MM.yyyy')})`).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Active contract pills */}
      <div className="flex flex-wrap gap-2">
        {active.map(c => (
          <div key={c.id} className="flex items-center gap-2 bg-white border border-border rounded-full px-3 py-1.5 text-sm shadow-sm">
            <span>{TYPE_EMOJI[c.insurance_type] || '📄'}</span>
            <span className="font-medium">{c.insurance_type}</span>
            <span className="text-muted-foreground text-xs">{c.provider}</span>
            {c.premium_monthly > 0 && (
              <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                CHF {c.premium_monthly.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/Mt.
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}