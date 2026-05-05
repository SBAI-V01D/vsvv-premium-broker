import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

export default function SalesAutopilotDashboard({ leads }) {
  const autopilotStats = useMemo(() => {
    const active = leads.filter(l => l.autopilot_status === 'active').length
    const paused = leads.filter(l => l.autopilot_status === 'paused').length
    const offersReady = leads.filter(l => l.offer_status === 'ready').length
    const offersSent = leads.filter(l => l.offer_status === 'sent').length
    const hot = leads.filter(l => (l.lead_score || 0) > 80 && l.autopilot_status === 'active').length

    return {
      active,
      paused,
      offersReady,
      offersSent,
      hot,
    }
  }, [leads])

  return (
    <div className="space-y-4">
      {/* STATS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Aktive Leads</p>
            <p className="text-2xl font-bold text-green-600">{autopilotStats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pausiert</p>
            <p className="text-2xl font-bold text-yellow-600">{autopilotStats.paused}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Angebote bereit</p>
            <p className="text-2xl font-bold text-blue-600">{autopilotStats.offersReady}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Gesendet</p>
            <p className="text-2xl font-bold text-purple-600">{autopilotStats.offersSent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Hot Leads</p>
            <p className="text-2xl font-bold text-red-600">{autopilotStats.hot}</p>
          </CardContent>
        </Card>
      </div>

      {/* ACTIVE OFFERS READY */}
      {autopilotStats.offersReady > 0 && (
        <Card className="border-l-4 border-l-blue-500 bg-blue-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4" /> 📄 {autopilotStats.offersReady} Angebote zur Freigabe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-700">System hat Angebote vorbereitet. Bitte prüfen und freigeben.</p>
          </CardContent>
        </Card>
      )}

      {/* HOT LEADS NO RESPONSE */}
      {autopilotStats.hot > 0 && (
        <Card className="border-l-4 border-l-red-500 bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="w-4 h-4 text-red-600" /> 🔥 {autopilotStats.hot} Hot Leads (kein Kontakt)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700">System schickt Erinnerungen. Gegebenenfalls manuell nachfassen.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}