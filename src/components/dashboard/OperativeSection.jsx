import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Clock, Users, TrendingUp } from 'lucide-react'

export default function OperativeSection({ metrics }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* CUSTOMERS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> Kundenbestand
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{metrics.customers.total}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Aktiv</p>
              <p className="text-lg font-semibold text-green-600">{metrics.customers.active}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Portal</p>
              <p className="text-lg font-semibold text-blue-600">{metrics.customers.portal}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* APPLICATIONS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" /> Anträge
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Neu</p>
              <p className="text-lg font-bold text-amber-600">{metrics.applications.new}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">In Bearbeitung</p>
              <p className="text-lg font-bold text-blue-600">{metrics.applications.inProgress}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Genehmigt</p>
              <p className="text-lg font-bold text-green-600">{metrics.applications.approved}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Abgelehnt</p>
              <p className="text-lg font-bold text-red-600">{metrics.applications.rejected}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TASKS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Aufgaben & Fokus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Offene Aufgaben</p>
            <p className="text-2xl font-bold">{metrics.tasks.open}</p>
          </div>
          <p className="text-xs text-muted-foreground pt-2">Nächste Aktionen:</p>
          <p className="text-sm text-blue-600 font-medium">AI schlägt vor...</p>
        </CardContent>
      </Card>

      {/* LEADS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Leads & Growth
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Total Leads</p>
            <p className="text-2xl font-bold">{metrics.leads.total}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Konvertiert</p>
              <p className="text-lg font-bold text-green-600">{metrics.leads.converted}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rate</p>
              <p className="text-lg font-bold text-blue-600">{metrics.leads.conversionRate}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}