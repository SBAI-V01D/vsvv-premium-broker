import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, DollarSign, Users, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { calcKPIs, formatCHF, normalizeLegacyEntry } from '@/lib/commissionEngine'

export default function FinanceDashboard() {
  const [filterOrg, setFilterOrg] = useState('all')
  const [filterAdvisor, setFilterAdvisor] = useState('all')

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list(),
  })

  const { data: advisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  })

  const { data: commissionEntries = [] } = useQuery({
    queryKey: ['commission_entries'],
    queryFn: () => base44.entities.CommissionEntry.list(null, 1000),
  })

  const { data: commissionSplits = [] } = useQuery({
    queryKey: ['commission_splits'],
    queryFn: () => base44.entities.CommissionSplit.list(null, 1000),
  })

  const { data: accountingEntries = [] } = useQuery({
    queryKey: ['accounting_entries'],
    queryFn: () => base44.entities.AccountingEntry.list(null, 1000),
  })

  // 🔴 CRITICAL: Use central calcKPIs engine for all financial aggregations
  // Filter entries based on selected org/advisor
  const filteredCommissions = useMemo(() => 
    commissionEntries.filter(c => {
      if (filterOrg !== 'all' && c.organization_id !== filterOrg) return false
      if (filterAdvisor !== 'all' && c.advisor_id !== filterAdvisor) return false
      return true
    }), [commissionEntries, filterOrg, filterAdvisor])

  // KPIs via central engine
  const kpi = useMemo(() => calcKPIs(filteredCommissions), [filteredCommissions])

  // Org-level aggregation (via calcKPIs per org)
  const commissionByOrg = useMemo(() => {
    return orgs.map(org => {
      const orgEntries = commissionEntries.filter(c => c.organization_id === org.id)
      const orgKpi = calcKPIs(orgEntries)
      return {
        name: org.name,
        commission: orgKpi.totalAdvisorCourtage + orgKpi.totalAdvisorProvision,  // Brutto Berater
        courtage: orgKpi.totalAdvisorCourtage,
        provision: orgKpi.totalAdvisorProvision,
      }
    }).sort((a, b) => b.commission - a.commission)
  }, [orgs, commissionEntries])

  // Advisor-level aggregation (via calcKPIs per advisor)
  const commissionByAdvisor = useMemo(() => {
    return advisors.map(a => {
      const advEntries = commissionEntries.filter(c => c.advisor_id === a.id)
      const advKpi = calcKPIs(advEntries)
      return {
        name: `${a.firstname} ${a.lastname}`,
        commission: advKpi.totalAdvisorCourtage + advKpi.totalAdvisorProvision,  // Brutto Berater
        courtage: advKpi.totalAdvisorCourtage,
        provision: advKpi.totalAdvisorProvision,
      }
    }).sort((a, b) => b.commission - a.commission).slice(0, 10)
  }, [advisors, commissionEntries])

  // Accounting status (count-based, no financial aggregation)
  const accountingStatus = useMemo(() => [
    { name: 'Pending', value: accountingEntries.filter(e => e.status === 'pending').length },
    { name: 'Booked', value: accountingEntries.filter(e => e.status === 'booked').length },
    { name: 'Paid', value: accountingEntries.filter(e => e.status === 'paid').length },
  ], [accountingEntries])

  const COLORS = ['#f97316', '#06b6d4', '#10b981']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-[hsl(var(--primary))]">💰 Finanz-Dashboard</h1>
        <p className="text-muted-foreground">Provisionsverwaltung, Buchhaltung & Performance</p>
      </div>

      {/* FILTER */}
      <div className="flex gap-3">
        <Select value={filterOrg} onValueChange={setFilterOrg}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Alle Organisationen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Organisationen</SelectItem>
            {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAdvisor} onValueChange={setFilterAdvisor}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Alle Berater" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Berater</SelectItem>
            {advisors.map(a => <SelectItem key={a.id} value={a.id}>{a.firstname} {a.lastname}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* KPI CARDS – via central calcKPIs engine */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Beratercourtage (Brutto)</p>
                <p className="text-2xl font-bold">{formatCHF(kpi.totalAdvisorCourtage)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Beraterprovision (Brutto)</p>
                <p className="text-2xl font-bold">{formatCHF(kpi.totalAdvisorProvision)}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Stornierte Abrechnungen</p>
                <p className="text-2xl font-bold">{kpi.cancelledCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Offene Reserve</p>
                <p className="text-2xl font-bold">{formatCHF(kpi.totalReserveOpen)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Beratercourtage pro Organisation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Beratercourtage nach Organisation</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={commissionByOrg}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={v => formatCHF(v)} />
                <Bar dataKey="courtage" fill="#2563eb" name="Courtage" />
                <Bar dataKey="provision" fill="#059669" name="Provision" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Beratercourtage Top 10 Berater */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 10 Berater (Courtage + Provision)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={commissionByAdvisor} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                <Tooltip formatter={v => formatCHF(v)} />
                <Bar dataKey="courtage" fill="#2563eb" name="Courtage" />
                <Bar dataKey="provision" fill="#059669" name="Provision" />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Buchhaltungsstatus */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Buchhaltungsstatus</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={accountingStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Netto Auszahlbar (open courtage/provision) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Offene Netto-Auszahlungen (Periode)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 border rounded bg-blue-50">
                <span className="text-sm font-medium">Courtage Netto Offen</span>
                <span className="font-semibold text-blue-700">{formatCHF(kpi.openCourtage)}</span>
              </div>
              <div className="flex justify-between items-center p-2 border rounded bg-emerald-50">
                <span className="text-sm font-medium">Provision Netto Offen</span>
                <span className="font-semibold text-emerald-700">{formatCHF(kpi.openProvision)}</span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between items-center font-bold">
                <span>TOTAL OFFEN</span>
                <span>{formatCHF(kpi.openCourtage + kpi.openProvision)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}