import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, DollarSign, CheckCircle2, Clock } from 'lucide-react'

export default function FinanceSection({ metrics }) {
  const profit = metrics.commission.received - metrics.commission.paid

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* PREMIUM */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Prämienvolumen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary">
            CHF {(metrics.premium.total / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-muted-foreground mt-2">Aktive Verträge</p>
        </CardContent>
      </Card>

      {/* TOTAL COMMISSION */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Provisionen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">
              CHF {(metrics.commission.total / 1000).toFixed(0)}K
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
              Erhalten: {(metrics.commission.received / 1000).toFixed(0)}K
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
              Offen: {(metrics.commission.open / 1000).toFixed(0)}K
            </span>
          </div>
        </CardContent>
      </Card>

      {/* PAID COMMISSION */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Ausgezahlte Provision
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-green-600">
            CHF {(metrics.commission.paid / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-muted-foreground mt-2">An Berater gezahlt</p>
        </CardContent>
      </Card>

      {/* PROFIT */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" /> Gewinn (Differenz)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            CHF {(profit / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-muted-foreground mt-2">Empfangen - Gezahlt</p>
        </CardContent>
      </Card>
    </div>
  )
}