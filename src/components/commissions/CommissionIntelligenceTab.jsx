import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts'
import { AlertTriangle, TrendingDown, Award, Clock, AlertCircle, Landmark, TrendingUp } from 'lucide-react'
import { formatCHF, formatPct, calcStornoByDimension, calcMonthlyTrend, roundCHF, normalizeLegacyEntry } from '@/lib/commissionEngine'

const COLORS_BLUE    = ['#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe']
const COLORS_EMERALD = ['#065f46','#047857','#059669','#10b981','#34d399','#6ee7b7']
const COLORS_MIXED   = ['#2563eb','#059669','#d97706','#dc2626','#7c3aed','#0891b2']

export default function CommissionIntelligenceTab({ entries, period }) {
  const [trendMonths, setTrendMonths] = useState(6)

  const active     = useMemo(() => entries.filter(e => !e.archived).map(normalizeLegacyEntry), [entries])
  const monthlyTrend = useMemo(() => calcMonthlyTrend(active, trendMonths), [active, trendMonths])

  // Prognose: 3 Monate (linear)
  const forecast = useMemo(() => {
    const last3 = monthlyTrend.slice(-3)
    if (last3.length < 2) return null
    const avgC = last3.reduce((s, m) => s + m.advisorCourtage, 0) / last3.length
    const growthC = (last3[last3.length - 1].advisorCourtage - last3[0].advisorCourtage) / Math.max(last3.length - 1, 1)
    const avgP = last3.reduce((s, m) => s + m.advisorProvision, 0) / last3.length
    const growthP = (last3[last3.length - 1].advisorProvision - last3[0].advisorProvision) / Math.max(last3.length - 1, 1)
    const now = new Date()
    return [1, 2, 3].map(i => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      return {
        label: d.toLocaleDateString('de-CH', { month: 'short', year: '2-digit' }),
        advisorCourtage:  Math.max(0, roundCHF(avgC + growthC * i)),
        advisorProvision: Math.max(0, roundCHF(avgP + growthP * i)),
        isForecast: true,
      }
    })
  }, [monthlyTrend])

  const chartData = useMemo(() => [...monthlyTrend, ...(forecast || [])], [monthlyTrend, forecast])

  // Gesellschaftsvergleich: getrennt nach Courtage / Provision
  const byInsurer = useMemo(() => {
    const map = {}
    active.forEach(e => {
      if (!e.insurer) return
      if (!map[e.insurer]) map[e.insurer] = {
        insurer: e.insurer, courtage: 0, provision: 0, count: 0, cancelled: 0
      }
      const cStatus = e.courtage_status || e.status
      if (cStatus !== 'cancelled') {
        map[e.insurer].courtage  += e.advisor_courtage_amount || 0
        map[e.insurer].provision += e.advisor_provision_amount || 0
        map[e.insurer].count     += 1
      } else {
        map[e.insurer].cancelled += 1
      }
    })
    return Object.values(map)
      .sort((a, b) => (b.courtage + b.provision) - (a.courtage + a.provision))
      .slice(0, 8)
  }, [active])

  // Spartenverteilung – Courtage
  const sparteCourtage = useMemo(() => {
    const map = {}
    active.filter(e => (e.courtage_status || e.status) !== 'cancelled').forEach(e => {
      const key = e.product_category || 'Andere'
      if (!map[key]) map[key] = { name: key, value: 0 }
      map[key].value += e.advisor_courtage_amount || 0
    })
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [active])

  // Spartenverteilung – Provision
  const sparteProvision = useMemo(() => {
    const map = {}
    active.filter(e => (e.provision_status || 'pending') !== 'cancelled').forEach(e => {
      const key = e.product_category || 'Andere'
      if (!map[key]) map[key] = { name: key, value: 0 }
      map[key].value += e.advisor_provision_amount || 0
    })
    return Object.values(map).filter(x => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [active])

  const stornoByAdvisor = useMemo(() => calcStornoByDimension(active, 'advisor_id', 'advisor_name'), [active])
  const stornoBySparte  = useMemo(() => calcStornoByDimension(active, 'product_category', 'product_category'), [active])

  const overdueEntries = useMemo(() => active.filter(e => {
    if ((e.courtage_status || e.status) !== 'invoiced') return false
    const date = e.courtage_invoiced_date || e.invoiced_date
    if (!date) return false
    return (Date.now() - new Date(date).getTime()) / 86400000 > 60
  }), [active])

  const highStornoAdvisors = stornoByAdvisor.filter(a => a.rate > 15)
  const highStornoSparten  = stornoBySparte.filter(s => s.rate > 15)

  return (
    <div className="space-y-6">

      {/* Period Display */}
      {period && (
        <div className="p-3 bg-slate-50 border border-border rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground">ZEITRAUM DIESER ANALYTIK</p>
          <p className="text-sm font-bold text-foreground">
            {period.start.toLocaleDateString('de-CH')} – {period.end.toLocaleDateString('de-CH')}
          </p>
        </div>
      )}

      {/* Automatische Warnungen */}
      {(highStornoAdvisors.length > 0 || highStornoSparten.length > 0 || overdueEntries.length > 0) && (
        <div className="space-y-2">
          {overdueEntries.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">
                <strong>{overdueEntries.length} überfällige Courtage-Positionen</strong> (eingereicht vor &gt;60 Tagen) ·
                Offen: <strong>{formatCHF(overdueEntries.reduce((s,e)=>s+(e.advisor_courtage_amount||0),0))}</strong>
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
                  ⚠ Berater <strong>{a.name}</strong>: {formatPct(a.rate, 0)} Stornoquote · Verlust: {formatCHF(a.commissionLost)}
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

      {/* COURTAGE TREND */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-blue-200" />
          <span className="text-xs font-bold text-blue-700 uppercase tracking-widest flex items-center gap-1">
            <Landmark className="w-3.5 h-3.5" /> Courtage Analytics
          </span>
          <div className="h-px flex-1 bg-blue-200" />
        </div>
        <Card className="border-blue-200">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base text-blue-800">Beratercourtage – Trend + Prognose</CardTitle>
            <div className="flex gap-1">
              {[6, 12].map(m => (
                <button key={m} onClick={() => setTrendMonths(m)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${trendMonths === m ? 'bg-blue-600 text-white border-blue-600' : 'border-border hover:bg-muted'}`}>
                  {m}M
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v, name) => [formatCHF(v), name]} />
                <Bar dataKey="advisorCourtage" name="Beratercourtage" fill="#2563eb" radius={[2,2,0,0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
            {forecast && (
              <p className="text-xs text-muted-foreground mt-1 text-center">Prognose: Ø letzte 3 Monate · 3 Monate voraus</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PROVISION TREND */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-emerald-200" />
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Provisions Analytics
          </span>
          <div className="h-px flex-1 bg-emerald-200" />
        </div>
        <Card className="border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-emerald-800">Beraterprovision – Trend + Prognose</CardTitle>
          </CardHeader>
          <CardContent>
            {sparteProvision.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Keine Provisions-Daten vorhanden</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v, name) => [formatCHF(v), name]} />
                  <Bar dataKey="advisorProvision" name="Beraterprovision" fill="#059669" radius={[2,2,0,0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gesellschaften + Spartenverteilung */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Gesellschaften */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" /> Top Gesellschaften
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {byInsurer.slice(0, 6).map((ins, i) => {
                const max = (byInsurer[0]?.courtage || 0) + (byInsurer[0]?.provision || 0) || 1
                const total = ins.courtage + ins.provision
                const pct = (total / max) * 100
                const stornoRate = (ins.count + ins.cancelled) > 0
                  ? (ins.cancelled / (ins.count + ins.cancelled)) * 100 : 0
                return (
                  <div key={ins.insurer}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium truncate max-w-[120px]">{ins.insurer}</span>
                      <span className="text-muted-foreground text-right">
                        <span className="text-blue-600">{formatCHF(ins.courtage)}</span>
                        {ins.provision > 0 && <span className="text-emerald-600 ml-1">+{formatCHF(ins.provision)}</span>}
                        {stornoRate > 10 && <span className="text-red-500 ml-1">⚠{stornoRate.toFixed(0)}%</span>}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(ins.courtage / max) * 100}%` }} />
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(ins.provision / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> Courtage</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Provision</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Spartenverteilung Courtage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-blue-800">Spartenverteilung – Courtage</CardTitle>
          </CardHeader>
          <CardContent>
            {sparteCourtage.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Keine Daten</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={sparteCourtage} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    dataKey="value" nameKey="name"
                    label={({ name, percent }) => percent > 0.08 ? `${name} ${(percent*100).toFixed(0)}%` : ''}
                    labelLine={false} fontSize={11}>
                    {sparteCourtage.map((_, i) => <Cell key={i} fill={COLORS_BLUE[i % COLORS_BLUE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCHF(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {sparteProvision.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-emerald-800">Spartenverteilung – Provision</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={sparteProvision} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                  dataKey="value" nameKey="name"
                  label={({ name, percent }) => percent > 0.08 ? `${name} ${(percent*100).toFixed(0)}%` : ''}
                  labelLine={false} fontSize={11}>
                  {sparteProvision.map((_, i) => <Cell key={i} fill={COLORS_EMERALD[i % COLORS_EMERALD.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCHF(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

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
                  <th className="text-right pb-2">Courtage Verlust</th>
                  <th className="text-right pb-2">Quote</th>
                </tr></thead>
                <tbody>
                  {stornoByAdvisor.map(a => (
                    <tr key={a.key} className="border-b">
                      <td className="py-1.5 font-medium">{a.name}</td>
                      <td className="text-right py-1.5 text-muted-foreground">{a.total}</td>
                      <td className="text-right py-1.5 text-red-600">{a.cancelled}</td>
                      <td className="text-right py-1.5 text-red-500">{formatCHF(a.commissionLost)}</td>
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
                  <th className="text-right pb-2">Courtage Verlust</th>
                  <th className="text-right pb-2">Quote</th>
                </tr></thead>
                <tbody>
                  {stornoBySparte.map(s => (
                    <tr key={s.key} className="border-b">
                      <td className="py-1.5 font-medium">{s.name}</td>
                      <td className="text-right py-1.5 text-muted-foreground">{s.total}</td>
                      <td className="text-right py-1.5 text-red-600">{s.cancelled}</td>
                      <td className="text-right py-1.5 text-red-500">{formatCHF(s.commissionLost)}</td>
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

      {/* Überfällige Courtagen */}
      {overdueEntries.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <Clock className="w-4 h-4" /> Überfällige Courtagen (&gt;60 Tage eingereicht)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead><tr className="border-b text-muted-foreground">
                <th className="text-left pb-2">Eingereicht</th>
                <th className="text-left pb-2">Gesellschaft</th>
                <th className="text-left pb-2">Kunde</th>
                <th className="text-right pb-2">Ges.courtage</th>
                <th className="text-right pb-2">Beratercourtage</th>
              </tr></thead>
              <tbody>
                {overdueEntries.map(e => {
                  const d = e.courtage_invoiced_date || e.invoiced_date
                  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
                  return (
                    <tr key={e.id} className="border-b hover:bg-red-50/30">
                      <td className="py-1.5 text-red-600 font-medium">{d} <span className="text-muted-foreground">({days}d)</span></td>
                      <td className="py-1.5">{e.insurer}</td>
                      <td className="py-1.5">{e.customer_name}</td>
                      <td className="py-1.5 text-right text-blue-700">{formatCHF(e.company_courtage_amount)}</td>
                      <td className="py-1.5 text-right font-bold text-red-600">{formatCHF(e.advisor_courtage_amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-red-50 font-bold text-red-700">
                  <td colSpan="3" className="py-2 px-0">Total überfällig</td>
                  <td className="text-right py-2 text-blue-700">{formatCHF(overdueEntries.reduce((s,e)=>s+(e.company_courtage_amount||0),0))}</td>
                  <td className="text-right py-2">{formatCHF(overdueEntries.reduce((s,e)=>s+(e.advisor_courtage_amount||0),0))}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}