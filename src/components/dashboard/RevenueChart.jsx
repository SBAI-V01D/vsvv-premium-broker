import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function buildMonthlyData(contracts, commissionEntries, months) {
  const now = new Date()
  const result = []

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleString('de-CH', { month: 'short', year: months > 6 ? '2-digit' : undefined })
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    // Prämien: Verträge die in diesem Monat aktiv waren
    const premien = contracts
      .filter(c => {
        const start = c.start_date ? c.start_date.slice(0, 7) : null
        return start && start <= monthStr && c.status === 'active'
      })
      .reduce((sum, c) => sum + (c.premium_monthly || 0), 0)

    // Provisionen: CommissionEntries in diesem Monat
    const provisionen = commissionEntries
      .filter(ce => ce.settlement_date && ce.settlement_date.slice(0, 7) === monthStr)
      .reduce((sum, ce) => sum + (ce.gross_commission || 0), 0)

    result.push({ label, premien: Math.round(premien), provisionen: Math.round(provisionen) })
  }
  return result
}

export default function RevenueChart({ contracts, commissionEntries }) {
  const [range, setRange] = useState('12')

  const data = useMemo(
    () => buildMonthlyData(contracts, commissionEntries, parseInt(range)),
    [contracts, commissionEntries, range]
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Prämien- & Provisionsübersicht</CardTitle>
        <div className="flex gap-1">
          {[{ v: '1', l: '30T' }, { v: '3', l: '3M' }, { v: '12', l: '12M' }].map(r => (
            <button
              key={r.v}
              onClick={() => setRange(r.v)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${range === r.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {r.l}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip
              formatter={(v, name) => [`CHF ${v.toLocaleString('de-CH')}`, name === 'premien' ? 'Prämien' : 'Provisionen']}
              labelStyle={{ fontSize: 12 }}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend formatter={v => v === 'premien' ? 'Monatsprämien' : 'Provisionen'} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="premien" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="provisionen" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}