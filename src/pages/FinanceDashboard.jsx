import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, DollarSign, Users, AlertTriangle, CheckCircle2 } from 'lucide-react'

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

  // FILTER
  const filteredCommissions = commissionEntries.filter(c => {
    if (filterOrg !== 'all' && c.organization_id !== filterOrg) return false
    if (filterAdvisor !== 'all' && c.advisor_id !== filterAdvisor) return false
    return true
  })

  // KPIs
  const totalCommission = filteredCommissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
  const activeCommissions = filteredCommissions.filter(c => c.status !== 'cancelled').length
  const cancelledCommissions = filteredCommissions.filter(c => c.status === 'cancelled').length
  const stornoLoss = commissionEntries
    .filter(c => c.status === 'cancelled')
    .reduce((sum, c) => sum + (c.commission_amount || 0), 0)

  // CHART: Commission pro Organisation
  const commissionByOrg = orgs.map(org => {
    const orgTotal = commissionEntries
      .filter(c => c.organization_id === org.id)
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    return { name: org.name, commission: orgTotal }
  })

  // CHART: Commission pro Berater (Top 10)
  const commissionByAdvisor = advisors.map(a => {
    const advTotal = commissionEntries
      .filter(c => c.advisor_id === a.id)
      .reduce((sum, c) => sum + (c.commission_amount || 0), 0)
    return { name: `${a.firstname} ${a.lastname}`, commission: advTotal }
  }).sort((a, b) => b.commission - a.commission).slice(0, 10)

  // CHART: Buchhaltungsübersicht (Pending vs Booked)
  const accountingStatus = [
    { name: 'Pending', value: accountingEntries.filter(e => e.status === 'pending').length },
    { name: 'Booked', value: accountingEntries.filter(e => e.status === 'booked').length },
    { name: 'Paid', value: accountingEntries.filter(e => e.status === 'paid').length },
  ]

  const COLORS = ['#f97316', '#06b6d4', '#10b981']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">💰 Finanz-Dashboard</h1>
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

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Provision</p>
                <p className="text-2xl font-bold">CHF {totalCommission.toLocaleString('de-CH')}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Aktive Provisionen</p>
                <p className="text-2xl font-bold">{activeCommissions}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Stornierte</p>
                <p className="text-2xl font-bold">{cancelledCommissions}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Stornoverlust</p>
                <p className="text-2xl font-bold">CHF {stornoLoss.toLocaleString('de-CH')}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commission pro Organisation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Provision nach Organisation</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={commissionByOrg}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={v => `CHF ${v.toLocaleString('de-CH')}`} />
                <Bar dataKey="commission" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Commission pro Berater (Top 10) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top 10 Berater</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={commissionByAdvisor} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                <Tooltip formatter={v => `CHF ${v.toLocaleString('de-CH')}`} />
                <Bar dataKey="commission" fill="#10b981" />
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

        {/* Offene Auszahlungen */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Offene Beträge</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {advisors.map(a => {
                const advTotal = accountingEntries
                  .filter(e => e.advisor_id === a.id && e.status === 'pending')
                  .reduce((sum, e) => sum + (e.amount || 0), 0)
                return advTotal > 0 ? (
                  <div key={a.id} className="flex justify-between items-center p-2 border rounded">
                    <span className="text-sm">{a.firstname} {a.lastname}</span>
                    <span className="font-semibold">CHF {advTotal.toLocaleString('de-CH')}</span>
                  </div>
                ) : null
              })}
              {advisors.every(a => {
                const advTotal = accountingEntries
                  .filter(e => e.advisor_id === a.id && e.status === 'pending')
                  .reduce((sum, e) => sum + (e.amount || 0), 0)
                return advTotal === 0
              }) && <p className="text-sm text-muted-foreground">Keine offenen Beträge</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}