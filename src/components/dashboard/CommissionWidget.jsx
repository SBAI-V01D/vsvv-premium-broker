import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { TrendingUp } from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function CommissionWidget() {
  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.Commission.list(),
  });

  const { data: commissionRates = [] } = useQuery({
    queryKey: ['commissionRates'],
    queryFn: () => base44.entities.CommissionRate.filter({ is_active: true }),
  });

  // Aggregation by month and provider
  const monthlyProviderData = useMemo(() => {
    const grouped = {};

    commissions.forEach(c => {
      if (!c.date) return;
      const month = format(new Date(c.date), 'MMM yyyy');
      if (!grouped[month]) {
        grouped[month] = {};
      }
      if (!grouped[month][c.provider]) {
        grouped[month][c.provider] = 0;
      }
      grouped[month][c.provider] += c.amount || 0;
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .slice(-6) // Last 6 months
      .map(([month, providers]) => ({
        month,
        ...providers,
        total: Object.values(providers).reduce((s, v) => s + v, 0),
      }));
  }, [commissions]);

  // Aggregation by provider (all time)
  const providerTotals = useMemo(() => {
    const grouped = {};

    commissions.forEach(c => {
      if (!grouped[c.provider]) {
        grouped[c.provider] = 0;
      }
      grouped[c.provider] += c.amount || 0;
    });

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [commissions]);

  // Summary stats
  const stats = useMemo(() => {
    const total = commissions.reduce((s, c) => s + (c.amount || 0), 0);
    const open = commissions.filter(c => c.status === 'offen').reduce((s, c) => s + (c.amount || 0), 0);
    const paid = commissions.filter(c => c.status === 'bezahlt').reduce((s, c) => s + (c.amount || 0), 0);

    return {
      total: Math.round(total * 100) / 100,
      open: Math.round(open * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      count: commissions.length,
    };
  }, [commissions]);

  const providers = [...new Set(monthlyProviderData.flatMap(m => Object.keys(m).filter(k => k !== 'month' && k !== 'total')))];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: `CHF ${stats.total.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`, icon: '💰', color: 'text-primary bg-primary/10' },
          { label: 'Offen', value: `CHF ${stats.open.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`, icon: '⏳', color: 'text-amber-500 bg-amber-50' },
          { label: 'Bezahlt', value: `CHF ${stats.paid.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`, icon: '✅', color: 'text-emerald-500 bg-emerald-50' },
          { label: 'Einträge', value: stats.count, icon: '📊', color: 'text-blue-500 bg-blue-50' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground font-semibold mb-1">{label}</p>
              <p className={`font-bold text-sm ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Chart */}
      {monthlyProviderData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Provisionen nach Versicherer (letzte 6 Monate)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyProviderData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip 
                  formatter={(value) => `CHF ${value.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`}
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend fontSize={12} />
                {providers.map((provider, idx) => (
                  <Bar key={provider} dataKey={provider} stackId="provider" fill={COLORS[idx % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Provider Distribution */}
      {providerTotals.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Versicherer-Verteilung (gesamt)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={providerTotals}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: CHF ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {providerTotals.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `CHF ${value.toLocaleString('de-CH', { minimumFractionDigits: 2 })}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Providers Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Versicherer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {providerTotals.slice(0, 5).map((provider, idx) => (
                  <div key={provider.name} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{provider.name}</span>
                    </div>
                    <span className="text-sm font-bold">CHF {provider.value.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {commissions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center">
            <TrendingUp className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">Keine Provisionen vorhanden</p>
            <p className="text-xs text-muted-foreground mt-1">Provisionen werden automatisch basierend auf aktiven Verträgen berechnet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}