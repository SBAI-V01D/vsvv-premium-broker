import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid } from 'recharts'
import { AlertTriangle, TrendingDown, Award, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import {
  formatCHF, formatPct, calcStornoByDimension, calcMonthlyTrend, roundCHF
} from '@/lib/commissionEngine'

const COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#065f46']

export default function CommissionIntelligenceTab({ entries }) {
  const [trendMonths, setTrendMonths] = useState(6)

  const active = useMemo(() => entries.filter(e => !e.archived), [entries])

  // Gesellschaftsvergleich
  const byInsurer = useMemo(() => {
    const map = {}
    active.forEach(e => {
      if (!e.insurer) return
      if (!map[e.insurer]) map[e.insurer] = { insurer: e.insurer, commission: 0, received: 0, count: 0, cancelled: 0 }
      if (e.status !== 'cancelled') {
        map[e.insurer].commission += e.commission_amount || 0
        map[e.insurer].received  += e.received_amount   || 0
        map[e.insurer].count     += 1
      } else {
        map[e.insurer].cancelled += 1
      }
    })
    return Object.values(map).sort((a, b) => b.commission - a.commission).slice(0, 8)
  }, [active])

  const stornoByAdvisor = useMemo(() => calcStornoByDimension(active, 'advisor_id', 'advisor_name'), [active])
  const stornoBySparte  = useMemo(() => calcStornoByDimension(active, 'product_category', 'product_category'), [active])
  const monthlyTrend    = useMemo(() => calcMonthlyTrend(active, trendMonths), [active, trendMonths])

  // 3-Monats-Prognose (linearer Trend)
  const forecast = useMemo(() => {
    const last3 = monthlyTrend.slice(-3)
    if (last3.length < 2) return null
    const avg = last3.reduce((s, m) => s + m.provision, 0) / last3.length
    const growth = last3.length >= 2
      ? (last3[last3.length - 1].provision - last3[0].provision) / Math.max(last3.length - 1, 1)
      : 0
    const now = new Date()
    return [1, 2, 3].map(i => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      return {
        label: d.toLocaleDateString('de-CH', { month: 'short', year: '2-digit' }),
        provision: Math.max(0, roundCHF(avg + growth * i)),
        isForecast: true,
      }
    })
  }, [monthlyTrend])

  const chartData = useMemo(() => [
    ...monthlyTrend,
    ...(forecast || []),
  ], [monthlyTrend, forecast])

  // Spartenverteilung (Pie)
  const sparteDistribution = useMemo(() => {
    const map = {}
    active.filter(e => e.status !== 'cancelled').forEach(e => {
      const key = e.product_category || 'Andere'
      if (!map[key]) map[key] = { name: key, value: 0 }
      map[key].value += e.commission_amount || 0
    })
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [active])

  // Überfälligkeitsanalyse
  const overdueEntries = useMemo(() => active.filter(e => {
    if (e.status !== 'invoiced' || !e.invoiced_date) return false
    return (Date.now() - new Date(e.invoiced_date).getTime()) / 86400000 > 60
  }), [active])

  const highStornoAdvisors = stornoByAdvisor.filter(a => a.rate > 15)
  const highStornoSparten  = stornoBySparte.filter(s => s.rate > 15)

  return (
    <div className="space-y-6">

      {/* ── Automatische Warnungen ── */}
      {(highStornoAdvisors.length > 0 || highStornoSparten.length > 0 || overdueEntries.length > 0) && (
        <div className="space-y-2">
          {overdueEntries.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">
                <strong>{overdueEntries.length} überfällige Positionen</strong> (eingereicht vor &gt;60 Tagen) ·
                Offen: <strong>{formatCHF(overdueEntries.reduce((s,e)=>s+(e.commission_amount||0),0))}</strong>
                <div className="text-xs mt-1 text-red-600">
                  {overdueEntries.slice(0, 3).map(e => (
                    <span key={e.id} className="mr-3">{e.insurer} – {e.customer_name}</span>
                  ))}
                  {overdueEntries.length > 3 && <span>+{overdueEntries.length - 3} weitere</span>}
                </div>
              </div>
            </div>
          )}
          {(highStornoAdvisors.length > 0 || highStornoSparten.length > 0) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" /> Storno-Risikowarnungen (&gt;15% Stornoquote)
              </div>
              {highStornoAdvisors.map(a => (
                <p key={a.key} className="text-sm text-amber-700">
                  ⚠ Berater <strong>{a.name}</strong>: {formatPct(a.rate, 0)} Stornoquote
                  · Verlust: {formatCHF(a.commissionLost)}
                </p>
              ))}
              {highStornoSparten.map(s => (
                <p key={s.key} className="text-sm text-amber-700">
                  ⚠ Sparte <strong>{s.name}</strong>: {formatPct(s.rate, 0)} Stornoquote
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Trend + Prognose ── */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Provision & Courtage – Trend + Prognose</CardTitle>
          <div className="flex gap-1">
            {[6, 12].map(m => (
              <button key={m} onClick={() => setTrendMonths(m)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${trendMonths === m ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                {m}M
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v, name) => [formatCHF(v), name]} />
              <Bar dataKey="courtage"  name="Courtage erhalten" fill="#2563eb" radius={[2,2,0,0]}
                fillOpacity={(entry) => entry?.isForecast ? 0.3 : 1} />
              <Bar dataKey="provision" name="Beraterprovision"  fill="#16a34a" radius={[2,2,0,0]}
                fillOpacity={(entry) => entry?.isForecast ? 0.3 : 1} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
          {forecast && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Prognose (hellere Balken): Ø der letzten 3 Monate · 3 Monate voraus
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gesellschaftsvergleich */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" /> Top Gesellschaften
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {byInsurer.slice(0, 6).map((ins, i) => {
                const max = byInsurer[0]?.commission || 1
                const pct = (ins.commission / max) * 100
                const stornoRate = (ins.count + ins.cancelled) > 0
                  ? (ins.cancelled / (ins.count + ins.cancelled)) * 100 : 0
                return (
                  <div key={ins.insurer}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium truncate max-w-[120px]">{ins.insurer}</span>
                      <span className="text-muted-foreground">
                        {formatCHF(ins.commission)} · {ins.count} Pol.
                        {stornoRate > 10 && <span className="text-red-500 ml-1">⚠{stornoRate.toFixed(0)}% Storno</span>}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Spartenverteilung */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Spartenverteilung</CardTitle>
          </CardHeader>
          <CardContent>
            {sparteDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Keine Daten</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={sparteDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    dataKey="value" nameKey="name"
                    label={({ name, percent }) => percent > 0.08 ? `${name} ${(percent*100).toFixed(0)}%` : ''}
                    labelLine={false} fontSize={11}>
                    {sparteDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCHF(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Storno-Analytik */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" /> Stornoquote pro Berater
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stornoByAdvisor.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Keine Daten</p>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left pb-2">Berater</th>
                  <th className="text-right pb-2">Total</th>
                  <th className="text-right pb-2">Storno</th>
                  <th className="text-right pb-2">Verlust</th>
                  <th className="text-right pb-2">Quote</th>
                </tr></thead>
                <tbody>
                  {stornoByAdvisor.map(a => (
                    <tr key={a.key} className="border-b">
                      <td className="py-1.5 font-medium">{a.name}</td>
                      <td className="text-right py-1.5 text-muted-foreground">{a.total}</td>
                      <td className="text-right py-1.5 text-red-600">{a.cancelled}</td>
                      <td className="text-right py-1.5 text-red-500 text-xs">{formatCHF(a.commissionLost)}</td>
                      <td className={`text-right py-1.5 font-bold ${a.rate > 15 ? 'text-red-700' : a.rate > 8 ? 'text-amber-600' : 'text-green-600'}`}>
                        {formatPct(a.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" /> Stornoquote pro Sparte
            </CardTitle>
          </CardHeader>
        
          <CardContent>
            {stornoBySparte.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Keine Daten</p>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground">
                  <th className="text-left pb-2">Sparte</th>
                  <th className="text-right pb-2">Total</th>
                  <th className="text-right pb-2">Storno</th>
                  <th className="text-right pb-2">Verlust</th>
                  <th className="text-right pb-2">Quote</th>
                </tr></thead>
                <tbody>
                  {stornoBySparte.map(s => (
                    <tr key={s.key} className="border-b">
                      <td className="py-1.5 font-medium">{s.name}</td>
                      <td className="text-right py-1.5 text-muted-foreground">{s.total}</td>
                      <td className="text-right py-1.5 text-red-600">{s.cancelled}</td>
                      <td className="text-right py-1.5 text-red-500 text-xs">{formatCHF(s.commissionLost)}</td>
                      <td className={`text-right py-1.5 font-bold ${s.rate > 15 ? 'text-red-700' : s.rate > 8 ? 'text-amber-600' : 'text-green-600'}`}>
                        {formatPct(s.rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Überfälligkeits-Tabelle */}
      {overdueEntries.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <Clock className="w-4 h-4" /> Überfällige Positionen (&gt;60 Tage eingereicht)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead><tr className="border-b text-muted-foreground">
                <th className="text-left pb-2">Eingereicht</th>
                <th className="text-left pb-2">Gesellschaft</th>
                <th className="text-left pb-2">Kunde</th>
                <th className="text-right pb-2">Provision</th>
              </tr></thead>
              <tbody>
                {overdueEntries.map(e => {
                  const days = Math.floor((Date.now() - new Date(e.invoiced_date).getTime()) / 86400000)
                  return (
                    <tr key={e.id} className="border-b hover:bg-red-50/30">
                      <td className="py-1.5 text-red-600 font-medium">{e.invoiced_date} <span className="text-muted-foreground">({days}d)</span></td>
                      <td className="py-1.5">{e.insurer}</td>
                      <td className="py-1.5">{e.customer_name}</td>
                      <td className="py-1.5 text-right font-bold text-red-600">{formatCHF(e.commission_amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-red-50 font-bold text-red-700">
                  <td colSpan="3" className="py-2 px-0">Total überfällig</td>
                  <td className="text-right py-2">{formatCHF(overdueEntries.reduce((s,e)=>s+(e.commission_amount||0),0))}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}