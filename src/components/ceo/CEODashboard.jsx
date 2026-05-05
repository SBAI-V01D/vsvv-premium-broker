import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, Users, FileText, Zap } from 'lucide-react'

export default function CEODashboard() {
  const { data: dashboard } = useQuery({
    queryKey: ['ceo_dashboard'],
    queryFn: () => base44.functions.invoke('createCEODashboard', {}),
  })

  const d = dashboard?.data || {}
  const kpi = d.kpi || {}
  const company = d.company || {}
  const topAdvisors = d.top_advisors || []

  // Prepare monthly data
  const monthlyData = Object.entries(d.monthly_history || {})
    .map(([month, commission]) => ({ month, commission }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)

  const metrics = [
    { label: 'Gesamtprämie', value: `CHF ${(kpi.total_premium || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}`, icon: FileText },
    { label: 'Verdiente Provision', value: `CHF ${(kpi.total_commission || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}`, icon: TrendingUp },
    { label: 'Ausbezahlt', value: `CHF ${(kpi.paid_commission || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}`, icon: Zap },
    { label: 'Offene Provision', value: `CHF ${(kpi.open_commission || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}`, icon: Users },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">👑 CEO Cockpit</h1>
        <p className="text-muted-foreground mt-2">Real-time KPI Dashboard</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <Card key={m.label}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {m.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{m.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* COMPANY OVERVIEW + FORECAST */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Unternehmensübersicht</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Aktive Kunden</p>
              <p className="text-2xl font-bold">{company.active_customers || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aktive Policen</p>
              <p className="text-2xl font-bold">{company.active_policies || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Berater im Team</p>
              <p className="text-2xl font-bold">{company.total_advisors || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Forecast (12 Monate)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Durchschnitt letzte 3 Monate × 12</p>
              <p className="text-4xl font-bold">CHF {(kpi.forecast_12months || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}</p>
              {kpi.storno_losses > 0 && <p className="text-xs text-red-500 mt-2">Storno-Verluste: CHF {(kpi.storno_losses || 0).toLocaleString('de-CH', { maximumFractionDigits: 0 })}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MONTHLY TREND */}
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Provision-Trend (12 Monate)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `CHF ${value.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="commission"
                  stroke="hsl(var(--primary))"
                  dot={false}
                  name="Provision"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* TOP ADVISORS */}
      {topAdvisors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Berater (nach Provision)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topAdvisors}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="advisor_name" type="category" width={190} />
                <Tooltip formatter={(value) => `CHF ${value.toLocaleString('de-CH', { maximumFractionDigits: 0 })}`} />
                <Legend />
                <Bar dataKey="commission" fill="hsl(var(--primary))" name="Provision" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}