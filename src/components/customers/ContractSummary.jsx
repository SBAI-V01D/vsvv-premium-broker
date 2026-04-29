import React, { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Shield, AlertTriangle, CheckCircle2, Clock, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const TYPE_EMOJI = {
  KVG: '🏥', VVG: '🏥', Leben: '❤️', Haftpflicht: '🛡️', Hausrat: '🏠',
  Rechtsschutz: '⚖️', Motorfahrzeug: '🚗', Gebäude: '🏢', Unfall: '🩺',
  Krankentaggeld: '📋', BVG: '💼', 'Säule 3a': '💰', Sonstige: '📄',
};

export default function ContractSummary({ contracts = [] }) {
  const [sortBy, setSortBy] = useState('name');
  const [showChart, setShowChart] = useState(false);

  const active = contracts.filter(c => c.status === 'active' || c.status === 'aktiv' || c.custom_status === 'aktiv');
  const totalMonthly = active.reduce((s, c) => s + (c.premium_monthly || 0), 0);
  const totalYearly = active.reduce((s, c) => s + (c.premium_yearly || 0), 0);

  const today = new Date();
  const expiringSoon = active.filter(c => {
    if (!c.end_date) return false;
    const days = differenceInDays(new Date(c.end_date), today);
    return days >= 0 && days <= 90;
  });

  // Type distribution for chart
  const typeCount = {};
  active.forEach(c => {
    typeCount[c.insurance_type] = (typeCount[c.insurance_type] || 0) + 1;
  });
  const chartData = Object.entries(typeCount).map(([name, value]) => ({ name, value }));

  // Sort contracts
  const sortedActive = [...active].sort((a, b) => {
    switch (sortBy) {
      case 'expiry':
        const daysA = a.end_date ? differenceInDays(new Date(a.end_date), today) : Infinity;
        const daysB = b.end_date ? differenceInDays(new Date(b.end_date), today) : Infinity;
        return daysA - daysB;
      case 'premium':
        return (b.premium_yearly || 0) - (a.premium_yearly || 0);
      default:
        return a.insurance_type.localeCompare(b.insurance_type);
    }
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  if (contracts.length === 0) return null;

  return (
    <div className="mb-6 space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {/* Chart Section */}
      {chartData.length > 1 && (
        <div className="bg-white border border-border rounded-lg p-4">
          <button
            onClick={() => setShowChart(!showChart)}
            className="flex items-center justify-between w-full mb-3"
          >
            <h3 className="text-sm font-semibold">Vertragsverteilung nach Typ</h3>
            <ChevronDown className={`w-4 h-4 transition-transform ${showChart ? 'rotate-180' : ''}`} />
          </button>
          {showChart && (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${v} Verträge`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Sorting & List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Verträge ({active.length})</h3>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue placeholder="Sortieren..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nach Typ</SelectItem>
              <SelectItem value="expiry">Nach Ablaufdatum</SelectItem>
              <SelectItem value="premium">Nach Prämie</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {sortedActive.map(c => {
            const daysLeft = c.end_date ? differenceInDays(new Date(c.end_date), today) : null;
            const isExpiring = daysLeft !== null && daysLeft >= 0 && daysLeft <= 90;
            return (
              <div key={c.id} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm shadow-sm border ${
                isExpiring ? 'bg-orange-50 border-orange-200' : 'bg-white border-border'
              }`}>
                <span>{TYPE_EMOJI[c.insurance_type] || '📄'}</span>
                <span className="font-medium">{c.insurance_type}</span>
                <span className="text-muted-foreground text-xs">{c.provider}</span>
                {c.premium_yearly > 0 && (
                  <span className="text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                    CHF {c.premium_yearly.toLocaleString('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/J.
                  </span>
                )}
                {daysLeft !== null && (
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                    isExpiring ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {daysLeft < 0 ? 'Abgelaufen' : `${daysLeft}T`}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}