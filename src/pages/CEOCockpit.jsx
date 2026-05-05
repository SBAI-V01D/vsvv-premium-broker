import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { AlertTriangle, TrendingUp, Users, FileText, AlertCircle } from 'lucide-react'

export default function CEOCockpit() {
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [filterAdvisor, setFilterAdvisor] = useState('all')
  const [filterOrg, setFilterOrg] = useState('all')

  // ─── Data Fetching ───
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  })

  const { data: commissions = [] } = useQuery({
    queryKey: ['commissions'],
    queryFn: () => base44.entities.CommissionEntry.list('-created_date', 500),
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date', 500),
  })

  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  })

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list(),
  })

  // ─── Filtering ───
  const filteredContracts = useMemo(() => {
    return contracts.filter(c => {
      if (filterAdvisor !== 'all' && c.advisor_id !== filterAdvisor) return false
      if (filterOrg !== 'all' && c.organization_id !== filterOrg) return false
      return true
    })
  }, [contracts, filterAdvisor, filterOrg])

  const filteredCommissions = useMemo(() => {
    return commissions.filter(c => {
      const month = new Date(c.entry_date).toISOString().slice(0, 7)
      if (month !== filterMonth) return false
      if (filterAdvisor !== 'all' && c.advisor_id !== filterAdvisor) return false
      if (filterOrg !== 'all' && c.organization_id !== filterOrg) return false
      return true
    })
  }, [commissions, filterMonth, filterAdvisor, filterOrg])

  // ─── KPI Calculation ───
  const kpis = useMemo(() => {
    const totalPremium = filteredContracts
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + (c.premium_yearly || 0), 0)

    const totalCommission = filteredCommissions
      .filter(c => ['pending', 'invoiced', 'received', 'earned'].includes(c.status))
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0)

    const receivedCommission = filteredCommissions
      .filter(c => c.status === 'received')
      .reduce((sum, c) => sum + (c.received_amount || c.commission_amount || 0), 0)

    const paidCommission = filteredCommissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0)

    const openCommission = totalCommission - paidCommission
    const profit = receivedCommission - paidCommission

    return {
      totalPremium,
      totalCommission,
      receivedCommission,
      paidCommission,
      openCommission,
      profit,
    }
  }, [filteredContracts, filteredCommissions])

  // ─── Advisor Performance ───
  const advisorPerformance = useMemo(() => {
    const map = {}
    filteredContracts.forEach(c => {
      if (!map[c.advisor_id]) {
        map[c.advisor_id] = { advisor_id: c.advisor_id, policies: 0, premium: 0, customers: new Set() }
      }
      if (c.status === 'active') {
        map[c.advisor_id].policies += 1
        map[c.advisor_id].premium += c.premium_yearly || 0
      }
      map[c.advisor_id].customers.add(c.customer_id)
    })

    // Add commission
    filteredCommissions.forEach(c => {
      if (!map[c.advisor_id]) {
        map[c.advisor_id] = { advisor_id: c.advisor_id, policies: 0, premium: 0, commission: 0, customers: new Set() }
      }
      if (c.status !== 'cancelled') {
        map[c.advisor_id].commission = (map[c.advisor_id].commission || 0) + (c.commission_amount || 0)
      }
    })

    return Object.values(map)
      .map(a => ({
        ...a,
        customers: a.customers.size,
        advisor_name: advisors.find(ad => ad.id === a.advisor_id)?.firstname + ' ' + (advisors.find(ad => ad.id === a.advisor_id)?.lastname || ''),
      }))
      .sort((a, b) => (b.premium || 0) - (a.premium || 0))
  }, [filteredContracts, filteredCommissions, advisors])

  // ─── Pipeline Status ───
  const pipelineStatus = useMemo(() => {
    const stages = {
      'uploaded': 0,
      'parsed': 0,
      'entities_detected': 0,
      'customer_mapped': 0,
      'application_created': 0,
      'policy_created': 0,
      'stuck': 0,
    }

    documents.forEach(doc => {
      const stage = doc.processing_stage || 'uploaded'
      if (stages.hasOwnProperty(stage)) {
        stages[stage] += 1
      }
      
      // Detect stuck documents (older than 7 days in same stage)
      if (doc.created_date) {
        const daysOld = Math.floor((new Date() - new Date(doc.created_date)) / (1000 * 60 * 60 * 24))
        if (daysOld > 7 && stage !== 'policy_created') {
          stages['stuck'] += 1
        }
      }
    })

    return stages
  }, [documents])

  // ─── Alerts ───
  const alerts = useMemo(() => {
    const list = []

    // Stuck documents
    if (pipelineStatus.stuck > 0) {
      list.push({
        severity: 'critical',
        title: `${pipelineStatus.stuck} verarbeitete Dokumente stecken fest`,
        description: 'Dokumente sind länger als 7 Tage in gleicher Verarbeitungsstufe',
      })
    }

    // Missing commissions
    const policiesWithoutCommission = filteredContracts.filter(c => 
      c.status === 'active' && !commissions.some(com => com.policy_id === c.id && com.status !== 'cancelled')
    ).length
    if (policiesWithoutCommission > 0) {
      list.push({
        severity: 'warning',
        title: `${policiesWithoutCommission} Policen ohne Provision`,
        description: 'Diese aktiven Policen haben noch keine Provisions-Einträge',
      })
    }

    // Pending commissions overdue
    const pendingOld = filteredCommissions.filter(c => {
      if (c.status !== 'pending') return false
      const daysOld = Math.floor((new Date() - new Date(c.entry_date)) / (1000 * 60 * 60 * 24))
      return daysOld > 30
    }).length
    if (pendingOld > 0) {
      list.push({
        severity: 'warning',
        title: `${pendingOld} ausstehende Provisionen älter als 30 Tage`,
        description: 'Diese sollten überprüft werden',
      })
    }

    return list
  }, [filteredContracts, commissions, filteredCommissions, pipelineStatus])

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">

        {/* HEADER */}
        <div>
          <h1 className="text-4xl font-bold mb-2">🚀 CEO Cockpit</h1>
          <p className="text-muted-foreground">Dein Steuerungsinstrument für strategische Entscheidungen</p>
        </div>

        {/* FILTER ROW */}
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Monat</label>
            <input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-input bg-background"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Berater</label>
            <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Berater</SelectItem>
                {advisors.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.firstname} {a.lastname}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Organisation</label>
            <Select value={filterOrg} onValueChange={setFilterOrg}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Organisationen</SelectItem>
                {orgs.map(o => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 1. UMSATZ & PROVISION (KERNZAHLEN) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div>
          <h2 className="text-xl font-bold mb-4">💰 Umsatz & Provision</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gesamtumsatz</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  CHF {(kpis.totalPremium / 1000).toFixed(0)}k
                </p>
                <p className="text-xs text-muted-foreground mt-1">aktive Policen</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Provision</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">
                  CHF {(kpis.totalCommission / 1000).toFixed(0)}k
                </p>
                <p className="text-xs text-muted-foreground mt-1">verdient</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Erhalten</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">
                  CHF {(kpis.receivedCommission / 1000).toFixed(0)}k
                </p>
                <p className="text-xs text-muted-foreground mt-1">eingegangen</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ausbezahlt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-purple-600">
                  CHF {(kpis.paidCommission / 1000).toFixed(0)}k
                </p>
                <p className="text-xs text-muted-foreground mt-1">ausbezahlt</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gewinn</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${kpis.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  CHF {(kpis.profit / 1000).toFixed(0)}k
                </p>
                <p className="text-xs text-muted-foreground mt-1">Differenz</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 2. BERATER PERFORMANCE */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div>
          <h2 className="text-xl font-bold mb-4">📊 Berater Performance (Top 10)</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-semibold">Berater</th>
                      <th className="text-right p-3 font-semibold">Kunden</th>
                      <th className="text-right p-3 font-semibold">Policen</th>
                      <th className="text-right p-3 font-semibold">Umsatz</th>
                      <th className="text-right p-3 font-semibold">Provision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advisorPerformance.slice(0, 10).map((a, idx) => (
                      <tr key={a.advisor_id} className="border-b hover:bg-muted/30">
                        <td className="p-3">
                          <span className="font-medium">{idx + 1}. {a.advisor_name}</span>
                        </td>
                        <td className="text-right p-3">{a.customers}</td>
                        <td className="text-right p-3">{a.policies}</td>
                        <td className="text-right p-3 font-semibold">CHF {(a.premium / 1000).toFixed(0)}k</td>
                        <td className="text-right p-3 font-semibold text-green-600">CHF {((a.commission || 0) / 1000).toFixed(0)}k</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 3. PIPELINE STATUS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div>
          <h2 className="text-xl font-bold mb-4">⚙️ Pipeline Status (Verarbeitungsstadien)</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Verarbeitungsstadien</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: 'Hochgeladen', value: pipelineStatus.uploaded, color: 'bg-gray-200' },
                    { label: 'In Bearbeitung', value: pipelineStatus.parsed + pipelineStatus.entities_detected + pipelineStatus.customer_mapped, color: 'bg-blue-200' },
                    { label: 'Abgeschlossen', value: pipelineStatus.application_created + pipelineStatus.policy_created, color: 'bg-green-200' },
                    { label: '⚠️ Steckengeblieben', value: pipelineStatus.stuck, color: 'bg-red-200' },
                  ].map((s, i) => (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{s.label}</span>
                        <span className="font-bold">{s.value}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${s.color}`}
                          style={{
                            width: `${s.value === 0 ? 0 : Math.min(100, (s.value / Math.max(...[pipelineStatus.uploaded, pipelineStatus.parsed + pipelineStatus.entities_detected + pipelineStatus.customer_mapped, pipelineStatus.application_created + pipelineStatus.policy_created, pipelineStatus.stuck || 1])) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Zusammenfassung</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Total Dokumente:</span> {documents.length}</p>
                  <p><span className="font-semibold">Bereit:</span> {pipelineStatus.policy_created} (Policy erstellt)</p>
                  <p><span className="font-semibold">In Arbeit:</span> {pipelineStatus.uploaded + pipelineStatus.parsed + pipelineStatus.entities_detected}</p>
                  {pipelineStatus.stuck > 0 && (
                    <p className="text-red-600 font-semibold">⚠️ Steckengeblieben: {pipelineStatus.stuck}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 4. RISIKEN & ALERTS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {alerts.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">⚠️ Risiken & Alerts</h2>
            <div className="space-y-3">
              {alerts.map((alert, idx) => (
                <Card
                  key={idx}
                  className={`border-l-4 ${
                    alert.severity === 'critical' ? 'border-l-red-500 bg-red-50' : 'border-l-yellow-500 bg-yellow-50'
                  }`}
                >
                  <CardContent className="p-4 flex gap-3">
                    <AlertTriangle
                      className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                        alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
                      }`}
                    />
                    <div>
                      <p className="font-semibold">{alert.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* 5. KUNDENÜBERSICHT */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div>
          <h2 className="text-xl font-bold mb-4">👥 Kundenübersicht</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" /> Total Kunden
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{customers.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Aktive Kunden
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {customers.filter(c => c.status === 'active').length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Portal User
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {customers.filter(c => c.portal_enabled).length}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

      </div>
    </div>
  )
}