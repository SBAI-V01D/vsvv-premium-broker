import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, AlertCircle, InfoIcon } from 'lucide-react'

const ALERT_COLORS = {
  danger: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: AlertTriangle },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: AlertCircle },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: InfoIcon },
}

export default function AlertsPanel({ alerts }) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-green-600 font-medium">✓ Alle Systeme OK</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">⚠️ Alerts & Risiken</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert, idx) => {
          const config = ALERT_COLORS[alert.type] || ALERT_COLORS.info
          const Icon = config.icon
          return (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${config.bg} ${config.border} flex items-start gap-2`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${config.text}`} />
              <p className={`text-sm ${config.text}`}>{alert.message}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}