import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { AlertTriangle, TrendingDown, Award } from 'lucide-react'

function formatCHF(amount) {
  return (amount || 0).toLocaleString('de-CH', { style: 'currency', currency: 'CHF' })
}

const COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#065f46']

export default function CommissionIntelligenceTab({ entries }) {
  const active = useMemo(() => entries.filter(e => !e.archived), [entries])

  // Gesellschaftsvergleich
  const byInsurer = useMemo(() => {
    const map = {}
    active.forEach(e => {
      if (!e.insurer) return
      if (!map[e.insurer]) map[e.insurer] = { insurer: e.insurer, commission: 0, received: 0, count: 0, cancelled: 0 }
      if (e.status !== 'cancelled') {
        map[e.insurer].commission += e.commission_amount || 0
        map[e.insurer].received += e.received_amount || 0
        map[e.insurer].count += 1
      } else {
        map[e.insurer].cancelled += 1
      }
    })
    return Object.values(map).sort((a, b) => b.commission - a.commission).slice(0, 8)
  }, [active])

  // Stornoquote pro Berater
  const stornoByAdvisor = useMemo(() => {
    const map = {}
    active.forEach(e => {
      const key = e.advisor_id || '–'
      if (!map[key]) map[key] = { name: e.advisor_name || '–', total: 0, cancelled: 0 }
      map[key].total += 1
      if (e.status === 'cancelled') map[key].cancelled += 1
    })
    return Object.values(map)
      .filter(b => b.total >= 3)
      .map(b => ({ ...b, rate: b.total > 0 ? (b.cancelled / b.total) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate)
  }, [active])

  // Stornoquote pro Sparte
  const stornoBySparte = useMemo(() => {
    const map = {}
    active.forEach(e => {
      const key = e.product_category || 'Unbekannt'
      if (!map[key]) map[key] = { sparte: key, total: 0, cancelled: 0 }
      map[key].total += 1
      if (e.status === 'cancelled') map[key].cancelled += 1
    })
    return Object.values(map)
      .filter(s => s.total >= 2)
      .map(s => ({ ...s, rate: s.total > 0 ? (s.cancelled / s.total) * 100 : 0 }))
      .sort((a, b) => b.rate - a.rate)
  }, [active])

  // Monatsverlauf letzter 6 Monate
  const monthlyTrend = useMemo(() => {
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear().toString()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const label = d.toLocaleDateString('de-CH', { month: 'short', year: '2-digit' })
      const monthEntries = active.filter(e => {
        if (!e.entry_date) return false
        const ed = new Date(e.entry_date)
        return ed.getFullYear().toString() === year && String(ed.getMonth() + 1).padStart(2, '0') === month && e.status !== 'cancelled'
      })
      months.push({
        label,
        provision: Math.round(monthEntries.reduce((s, e) => s + (e.commission_amount || 0), 0)),
        courtage: Math.round(monthEntries.reduce((s, e) => s + (e.received_amount || 0), 0)),
      })
    }
    return months
  }, [active])

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

  const highStornoAdvisors = stornoByAdvisor.filter(a => a.rate > 15)
  const highStornoSparten = stornoBySparte.filter(s => s.rate > 15)

  return (
    <div className="space-y-6">
      {/* Warnungen */}
      {(highStornoAdvisors.length > 0 || highStornoSparten.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" /> Storno-Risikowarnungen
          </div>
          {highStornoAdvisors.map(a => (
            <p key={a.name} className="text-sm text-red-700">
              ⚠ Berater <strong>{a.name}</strong>: {a.rate.toFixed(0)}% Stornoquote ({a.cancelled}/{a.total})
            </p>
          ))}
          {highStornoSparten.map(s => (
            <p key={s.sparte} className="text-sm text-red-700">
              ⚠ Sparte <strong>{s.sparte}</strong>: {s.rate.toFixed(0)}% Stornoquote ({s.cancelled}/{s.total})
            </p>
          ))}
        </div>
      )}

      {/* Monatstrend */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Provision & Courtage – 6-Monatstrend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCHF(v)} />
              <Bar dataKey="courtage" name="Courtage erhalten" fill="#2563eb" radius={[2,2,0,0]} />
              <Bar dataKey="provision" name="Beraterprovision" fill="#16a34a" radius={[2,2,0,0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gesellschaftsvergleich */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Award className="w-4 h-4 text-primary" />Top Gesellschaften</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {byInsurer.slice(0, 6).map((ins, i) => {
                const max = byInsurer[0]?.commission || 1
                const pct = (ins.commission / max) * 100
                return (
                  <div key={ins.insurer}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium truncate max-w-[120px]">{ins.insurer}</span>
                      <span className="text-muted-foreground">{formatCHF(ins.commission)} · {ins.count} Pol.</span>
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
          <CardHeader className="pb-2"><CardTitle className="text-base">Spartenverteilung</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={sparteDistribution} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" nameKey="name" label={({ name, percent }) => percent > 0.08 ? `${name} ${(percent*100).toFixed(0)}%` : ''} labelLine={false} fontSize={11}>
                  {sparteDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCHF(v)} />
              </PieChart>
            </ResponsiveContainer>
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
                  <th className="text-right pb-2">Quote</th>
                </tr></thead>
                <tbody>
                  {stornoByAdvisor.map(a => (
                    <tr key={a.name} className="border-b">
                      <td className="py-1.5 font-medium">{a.name}</td>
                      <td className="text-right py-1.5 text-muted-foreground">{a.total}</td>
                      <td className="text-right py-1.5 text-red-600">{a.cancelled}</td>
                      <td className={`text-right py-1.5 font-bold ${a.rate > 15 ? 'text-red-700' : a.rate > 8 ? 'text-amber-600' : 'text-green-600'}`}>
                        {a.rate.toFixed(1)}%
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
                  <th className="text-right pb-2">Quote</th>
                </tr></thead>
                <tbody>
                  {stornoBySparte.map(s => (
                    <tr key={s.sparte} className="border-b">
                      <td className="py-1.5 font-medium">{s.sparte}</td>
                      <td className="text-right py-1.5 text-muted-foreground">{s.total}</td>
                      <td className="text-right py-1.5 text-red-600">{s.cancelled}</td>
                      <td className={`text-right py-1.5 font-bold ${s.rate > 15 ? 'text-red-700' : s.rate > 8 ? 'text-amber-600' : 'text-green-600'}`}>
                        {s.rate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}