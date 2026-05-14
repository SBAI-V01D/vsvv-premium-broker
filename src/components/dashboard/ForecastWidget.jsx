import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { TrendingUp, Calendar } from 'lucide-react'
import { formatCHF } from '@/lib/commissionEngine'

export default function ForecastWidget() {
  const { data: entries = [] } = useQuery({
    queryKey: ['commissionEntries-forecast'],
    queryFn: () => base44.entities.CommissionEntry.list('-entry_date', 2000),
  })

  const forecastData = useMemo(() => {
    const months = []
    const now = new Date()
    
    // Generate last 6 months + next 6 months forecast
    for (let i = -6; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = d.toLocaleDateString('de-CH', { month: 'short', year: '2-digit' })
      
      const monthEntries = entries.filter(e => {
        if (!e.entry_date) return false
        const ed = new Date(e.entry_date)
        return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth()
      })
      
      const courtage = monthEntries.reduce((s, e) => s + (e.courtage_payout_amount || 0), 0)
      const provision = monthEntries.reduce((s, e) => s + (e.provision_payout_amount || 0), 0)
      
      months.push({
        month: monthLabel,
        courtage: Math.round(courtage),
        provision: Math.round(provision),
        total: Math.round(courtage + provision),
        isForecast: i > 0,
      })
    }
    
    return months
  }, [entries])

  const currentYearTotal = useMemo(() => {
    const now = new Date()
    return entries
      .filter(e => {
        if (!e.entry_date) return false
        const ed = new Date(e.entry_date)
        return ed.getFullYear() === now.getFullYear()
      })
      .reduce((s, e) => s + (e.courtage_payout_amount || 0) + (e.provision_payout_amount || 0), 0)
  }, [entries])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Umsatz-Forecast
        </CardTitle>
        <CardDescription>
          Letzter 12M + Prognose nächster 6M (auf Basis bisherige Abrechnungen)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Dieses Jahr (bis heute)</p>
          <p className="text-2xl font-bold text-blue-700">{formatCHF(currentYearTotal)}</p>
        </div>
        
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={v => formatCHF(v)} />
            <Legend />
            <Bar dataKey="courtage" fill="#3b82f6" name="Courtage" />
            <Bar dataKey="provision" fill="#10b981" name="Provision" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}