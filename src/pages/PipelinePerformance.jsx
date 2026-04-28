import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';
import { TrendingUp, Award, PieChartIcon, ArrowLeft, CheckCircle2, XCircle, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '../components/shared/PageHeader';

const COLORS = [
  'hsl(215,80%,48%)', 'hsl(160,60%,45%)', 'hsl(30,80%,55%)',
  'hsl(280,65%,60%)', 'hsl(340,75%,55%)', 'hsl(200,70%,50%)',
  'hsl(50,90%,50%)', 'hsl(0,72%,51%)', 'hsl(120,55%,42%)',
];

const STAGE_LABELS = {
  erstkontakt: 'Erstkontakt',
  bedarfsanalyse: 'Bedarfsanalyse',
  angebot_versendet: 'Angebot versendet',
  verhandlung: 'Verhandlung',
  abschluss: 'Abschluss',
  verloren: 'Verloren',
};

// Custom tooltip for currency values
function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">
            {typeof p.value === 'number' && p.name?.includes('CHF')
              ? `CHF ${p.value.toLocaleString('de-CH')}`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-bold text-lg leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PipelinePerformance() {
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => base44.entities.Deal.list('-created_date'),
  });

  // ── 1. Monatlicher Umsatzverlauf (letzte 9 Monate) ──────────────────────
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 8; i >= 0; i--) {
      months.push(startOfMonth(subMonths(new Date(), i)));
    }

    return months.map(monthStart => {
      const key = format(monthStart, 'yyyy-MM');
      const label = format(monthStart, 'MMM yy', { locale: de });

      const monthDeals = deals.filter(d => {
        const created = d.created_date ? d.created_date.substring(0, 7) : null;
        return created === key;
      });

      const abgeschlossen = monthDeals.filter(d => d.stage === 'abschluss');
      const verloren = monthDeals.filter(d => d.stage === 'verloren');
      const aktiv = monthDeals.filter(d => !['abschluss', 'verloren'].includes(d.stage));

      return {
        monat: label,
        'Abgeschlossen (CHF)': abgeschlossen.reduce((s, d) => s + (d.estimated_premium || 0), 0),
        'In Pipeline (CHF)': aktiv.reduce((s, d) => s + (d.estimated_premium || 0), 0),
        'Verloren (CHF)': verloren.reduce((s, d) => s + (d.estimated_premium || 0), 0),
        anzahlAbschluss: abgeschlossen.length,
        anzahlGesamt: monthDeals.length,
      };
    });
  }, [deals]);

  // ── 2. Gewinnrate pro Broker ─────────────────────────────────────────────
  const brokerData = useMemo(() => {
    const map = {};
    deals.forEach(d => {
      const broker = d.assigned_broker || 'Nicht zugewiesen';
      if (!map[broker]) map[broker] = { broker: broker.split('@')[0], gewonnen: 0, verloren: 0, aktiv: 0 };
      if (d.stage === 'abschluss') map[broker].gewonnen++;
      else if (d.stage === 'verloren') map[broker].verloren++;
      else map[broker].aktiv++;
    });

    return Object.values(map).map(b => ({
      ...b,
      gesamt: b.gewonnen + b.verloren + b.aktiv,
      gewinnrate: b.gewonnen + b.verloren > 0
        ? Math.round((b.gewonnen / (b.gewonnen + b.verloren)) * 100)
        : null,
    })).sort((a, b) => b.gesamt - a.gesamt);
  }, [deals]);

  // ── 3. Verteilung nach Versicherungsart ─────────────────────────────────
  const insuranceData = useMemo(() => {
    const map = {};
    deals.forEach(d => {
      if (!d.insurance_type) return;
      if (!map[d.insurance_type]) map[d.insurance_type] = { name: d.insurance_type, anzahl: 0, praemie: 0 };
      map[d.insurance_type].anzahl++;
      map[d.insurance_type].praemie += d.estimated_premium || 0;
    });
    return Object.values(map).sort((a, b) => b.praemie - a.praemie);
  }, [deals]);

  // ── 4. Funnel-Daten (Deals pro Phase) ───────────────────────────────────
  const funnelData = useMemo(() => {
    const order = ['erstkontakt', 'bedarfsanalyse', 'angebot_versendet', 'verhandlung', 'abschluss'];
    return order.map(stage => ({
      phase: STAGE_LABELS[stage],
      anzahl: deals.filter(d => d.stage === stage).length,
      wert: deals.filter(d => d.stage === stage).reduce((s, d) => s + (d.estimated_premium || 0), 0),
    }));
  }, [deals]);

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const closedDeals = deals.filter(d => d.stage === 'abschluss');
  const lostDeals = deals.filter(d => d.stage === 'verloren');
  const winRate = closedDeals.length + lostDeals.length > 0
    ? Math.round((closedDeals.length / (closedDeals.length + lostDeals.length)) * 100)
    : 0;
  const totalClosed = closedDeals.reduce((s, d) => s + (d.estimated_premium || 0), 0);
  const avgDealSize = closedDeals.length > 0 ? Math.round(totalClosed / closedDeals.length) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Pipeline-Performance" subtitle="Analyse und Kennzahlen der Verkaufspipeline">
        <Link to="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Kanban-Board
        </Link>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Gewinnrate" value={`${winRate}%`} sub={`${closedDeals.length} abgeschlossen`} icon={Award} color="text-emerald-500" />
        <StatCard label="Abschluss-Umsatz" value={`CHF ${totalClosed.toLocaleString('de-CH')}`} sub="Jahresprämien total" icon={TrendingUp} color="text-primary" />
        <StatCard label="Ø Deal-Grösse" value={`CHF ${avgDealSize.toLocaleString('de-CH')}`} sub="pro Abschluss" icon={Target} color="text-amber-500" />
        <StatCard label="Verloren" value={lostDeals.length} sub={`${deals.length} Deals total`} icon={XCircle} color="text-red-400" />
      </div>

      {/* Row 1: Monatlicher Umsatzverlauf + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Monatlicher Verlauf */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Monatlicher Umsatzverlauf
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.some(m => m['Abgeschlossen (CHF)'] > 0 || m['In Pipeline (CHF)'] > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAbschluss" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(160,60%,45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(160,60%,45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPipeline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(215,80%,48%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(215,80%,48%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,15%,91%)" />
                  <XAxis dataKey="monat" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Abgeschlossen (CHF)" stroke="hsl(160,60%,45%)" fill="url(#gradAbschluss)" strokeWidth={2} />
                  <Area type="monotone" dataKey="In Pipeline (CHF)" stroke="hsl(215,80%,48%)" fill="url(#gradPipeline)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="Noch keine Umsatzdaten vorhanden" />
            )}
          </CardContent>
        </Card>

        {/* Sales Funnel */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Sales Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelData.some(f => f.anzahl > 0) ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,15%,91%)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="phase" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip formatter={(v, name) => [v, name === 'anzahl' ? 'Deals' : 'CHF']} />
                  <Bar dataKey="anzahl" name="Anzahl Deals" fill="hsl(215,80%,48%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState label="Keine Deals vorhanden" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Gewinnrate Broker + Versicherungsart Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Gewinnrate pro Broker */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" /> Gewinnrate pro Broker
            </CardTitle>
          </CardHeader>
          <CardContent>
            {brokerData.length > 0 ? (
              <div className="space-y-3">
                {brokerData.map((b, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[160px]">{b.broker}</span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                        <span className="text-emerald-600 font-semibold">{b.gewonnen}✓</span>
                        <span className="text-red-500">{b.verloren}✗</span>
                        <span className="text-blue-500">{b.aktiv} aktiv</span>
                        <span className="font-bold text-foreground w-12 text-right">
                          {b.gewinnrate !== null ? `${b.gewinnrate}%` : '–'}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                      {b.gewonnen > 0 && (
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(b.gewonnen / b.gesamt) * 100}%` }}
                        />
                      )}
                      {b.aktiv > 0 && (
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${(b.aktiv / b.gesamt) * 100}%` }}
                        />
                      )}
                      {b.verloren > 0 && (
                        <div
                          className="h-full bg-red-300 rounded-full"
                          style={{ width: `${(b.verloren / b.gesamt) * 100}%` }}
                        />
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Gewonnen</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/60 inline-block" /> Aktiv</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-300 inline-block" /> Verloren</span>
                </div>
              </div>
            ) : (
              <EmptyState label="Keine Broker-Daten vorhanden" />
            )}
          </CardContent>
        </Card>

        {/* Versicherungsart Verteilung */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary" /> Verteilung nach Versicherungsart
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insuranceData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={insuranceData}
                      dataKey="praemie"
                      nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius={75}
                      innerRadius={40}
                    >
                      {insuranceData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `CHF ${v.toLocaleString('de-CH')}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {insuranceData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-foreground">{item.name}</span>
                      </div>
                      <div className="flex gap-3 text-muted-foreground">
                        <span>{item.anzahl} Deals</span>
                        <span className="font-medium text-foreground">CHF {item.praemie.toLocaleString('de-CH')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState label="Keine Vertragsdaten vorhanden" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
      {label}
    </div>
  );
}