import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, TrendingUp, Users, FileText } from 'lucide-react'

export default function TabCEO() {
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [filterAdvisor, setFilterAdvisor] = useState('all')
  const [filterOrg, setFilterOrg] = useState('all')

  const { data: customers = [] }  = useQuery({ queryKey: ['customers'],        queryFn: () => base44.entities.Customer.list() })
  const { data: contracts = [] }  = useQuery({ queryKey: ['contracts'],        queryFn: () => base44.entities.Contract.list() })
  const { data: commissions = [] }= useQuery({ queryKey: ['commissionEntries'],queryFn: () => base44.entities.CommissionEntry.list('-created_date', 500) })
  const { data: documents = [] }  = useQuery({ queryKey: ['documents'],        queryFn: () => base44.entities.Document.list('-created_date', 500) })
  const { data: advisors = [] }   = useQuery({ queryKey: ['advisors'],         queryFn: () => base44.entities.Advisor.list() })
  const { data: orgs = [] }       = useQuery({ queryKey: ['organizations'],    queryFn: () => base44.entities.Organization.list() })
  const { data: leads = [] }      = useQuery({ queryKey: ['leads'],            queryFn: () => base44.entities.Lead.list() })

  const filteredContracts = useMemo(() =>
    contracts.filter(c => {
      if (filterAdvisor !== 'all' && c.advisor_id !== filterAdvisor) return false
      if (filterOrg !== 'all' && c.organization_id !== filterOrg) return false
      return true
    }), [contracts, filterAdvisor, filterOrg])

  const filteredCommissions = useMemo(() =>
    commissions.filter(c => {
      const month = c.entry_date ? new Date(c.entry_date).toISOString().slice(0, 7) : ''
      if (month !== filterMonth) return false
      if (filterAdvisor !== 'all' && c.advisor_id !== filterAdvisor) return false
      if (filterOrg !== 'all' && c.organization_id !== filterOrg) return false
      return true
    }), [commissions, filterMonth, filterAdvisor, filterOrg])

  const kpis = useMemo(() => {
    const totalPremium      = filteredContracts.filter(c => c.status === 'active').reduce((s, c) => s + (c.premium_yearly || 0), 0)
    const totalCommission   = filteredCommissions.filter(c => ['pending','invoiced','received','earned'].includes(c.status)).reduce((s, c) => s + (c.commission_amount || 0), 0)
    const receivedCommission= filteredCommissions.filter(c => c.status === 'received').reduce((s, c) => s + (c.received_amount || c.commission_amount || 0), 0)
    const paidCommission    = filteredCommissions.filter(c => c.status === 'paid').reduce((s, c) => s + (c.commission_amount || 0), 0)
    return { totalPremium, totalCommission, receivedCommission, paidCommission, profit: receivedCommission - paidCommission }
  }, [filteredContracts, filteredCommissions])

  const advisorPerformance = useMemo(() => {
    const map = {}
    filteredContracts.forEach(c => {
      if (!map[c.advisor_id]) map[c.advisor_id] = { advisor_id: c.advisor_id, policies: 0, premium: 0, commission: 0, customers: new Set() }
      if (c.status === 'active') { map[c.advisor_id].policies++; map[c.advisor_id].premium += c.premium_yearly || 0 }
      map[c.advisor_id].customers.add(c.customer_id)
    })
    filteredCommissions.forEach(c => {
      if (!map[c.advisor_id]) map[c.advisor_id] = { advisor_id: c.advisor_id, policies: 0, premium: 0, commission: 0, customers: new Set() }
      if (c.status !== 'cancelled') map[c.advisor_id].commission += (c.commission_amount || 0)
    })
    return Object.values(map).map(a => ({
      ...a,
      customers: a.customers.size,
      advisor_name: (() => { const ad = advisors.find(x => x.id === a.advisor_id); return ad ? `${ad.firstname} ${ad.lastname}` : '–' })(),
    })).sort((a, b) => b.premium - a.premium)
  }, [filteredContracts, filteredCommissions, advisors])

  const pipelineStatus = useMemo(() => {
    const s = { uploaded: 0, inProgress: 0, done: 0, stuck: 0 }
    documents.forEach(doc => {
      const stage = doc.processing_stage || 'uploaded'
      if (stage === 'uploaded') s.uploaded++
      else if (stage === 'policy_created' || stage === 'application_created') s.done++
      else s.inProgress++
      if (doc.created_date) {
        const daysOld = Math.floor((new Date() - new Date(doc.created_date)) / 86400000)
        if (daysOld > 7 && stage !== 'policy_created') s.stuck++
      }
    })
    return s
  }, [documents])

  const alerts = useMemo(() => {
    const list = []
    if (pipelineStatus.stuck > 0) list.push({ severity: 'critical', title: `${pipelineStatus.stuck} Dokumente stecken fest`, desc: 'Älter als 7 Tage in gleicher Verarbeitungsstufe' })
    const policiesWithoutCommission = filteredContracts.filter(c => c.status === 'active' && !commissions.some(com => com.policy_id === c.id && com.status !== 'cancelled')).length
    if (policiesWithoutCommission > 0) list.push({ severity: 'warning', title: `${policiesWithoutCommission} Policen ohne Provision`, desc: 'Aktive Policen ohne Provisions-Eintrag' })
    return list
  }, [filteredContracts, commissions, pipelineStatus])

  const fmt = (n) => `CHF ${(n / 1000).toFixed(0)}k`

  return (
    <div className="space-y-8">

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="min-w-[160px]">
          <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-widest">Monat</label>
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" />
        </div>
        <div className="min-w-[160px]">
          <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-widest">Berater</label>
          <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Berater</SelectItem>
              {advisors.map(a => <SelectItem key={a.id} value={a.id}>{a.firstname} {a.lastname}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-widest">Organisation</label>
          <Select value={filterOrg} onValueChange={setFilterOrg}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Org.</SelectItem>
              {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Umsatz KPIs */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Umsatz & Provision</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Gesamtumsatz',   value: fmt(kpis.totalPremium),       sub: 'aktive Policen',  color: 'text-foreground' },
            { label: 'Total Provision',value: fmt(kpis.totalCommission),    sub: 'verdient',        color: 'text-emerald-600' },
            { label: 'Erhalten',       value: fmt(kpis.receivedCommission), sub: 'eingegangen',     color: 'text-blue-600' },
            { label: 'Ausbezahlt',     value: fmt(kpis.paidCommission),     sub: 'ausbezahlt',      color: 'text-violet-600' },
            { label: 'Gewinn',         value: fmt(kpis.profit),             sub: 'Differenz',       color: kpis.profit >= 0 ? 'text-emerald-600' : 'text-red-600' },
          ].map(k => (
            <Card key={k.label} className="shadow-sm border-l-4 border-l-primary/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
                <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Growth */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Growth & Lead-Funnel</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Leads',     value: leads.length,                                                              color: 'text-foreground' },
            { label: 'Konvertiert',     value: leads.filter(l => l.status === 'converted').length,                       color: 'text-emerald-600' },
            { label: 'Conversion Rate', value: `${leads.length > 0 ? ((leads.filter(l => l.status === 'converted').length / leads.length) * 100).toFixed(1) : 0}%`, color: 'text-blue-600' },
            { label: 'Aktive Leads',    value: leads.filter(l => ['new','contacted','qualified'].includes(l.status)).length, color: 'text-violet-600' },
          ].map(k => (
            <Card key={k.label} className="shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
                <p className={`text-2xl font-bold mt-1 ${k.color}`}>{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Berater Performance */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Berater Performance (Top 10)</h3>
        <Card className="shadow-sm">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Berater</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kunden</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Policen</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Umsatz</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Provision</th>
                </tr>
              </thead>
              <tbody>
                {advisorPerformance.slice(0, 10).map((a, idx) => (
                  <tr key={a.advisor_id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{idx + 1}. {a.advisor_name}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{a.customers}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{a.policies}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{fmt(a.premium)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{fmt(a.commission || 0)}</td>
                  </tr>
                ))}
                {advisorPerformance.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Keine Daten</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Kundenübersicht */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Kundenübersicht</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Kunden',  value: customers.length,                               icon: Users },
            { label: 'Aktive Kunden', value: customers.filter(c => c.status === 'active').length, icon: TrendingUp },
            { label: 'Portal User',   value: customers.filter(c => c.portal_enabled).length, icon: FileText },
          ].map(k => (
            <Card key={k.label} className="shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <k.icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-bold">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Pipeline + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Pipeline Status</h3>
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-3">
              {[
                { label: 'Hochgeladen',       value: pipelineStatus.uploaded,   color: 'bg-slate-400' },
                { label: 'In Bearbeitung',    value: pipelineStatus.inProgress, color: 'bg-blue-500' },
                { label: 'Abgeschlossen',     value: pipelineStatus.done,       color: 'bg-emerald-500' },
                { label: 'Steckengeblieben',  value: pipelineStatus.stuck,      color: 'bg-red-500' },
              ].map(s => {
                const total = Math.max(pipelineStatus.uploaded + pipelineStatus.inProgress + pipelineStatus.done, 1)
                return (
                  <div key={s.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-semibold">{s.value}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${s.color} rounded-full`} style={{ width: `${(s.value / total) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {alerts.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Alerts</h3>
            <div className="space-y-2">
              {alerts.map((alert, idx) => (
                <div key={idx} className={`flex gap-3 p-3 rounded-lg border-l-4 ${alert.severity === 'critical' ? 'bg-red-50 border-l-red-500' : 'bg-amber-50 border-l-amber-500'}`}>
                  <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />
                  <div>
                    <p className="font-semibold text-sm">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}