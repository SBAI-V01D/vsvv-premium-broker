import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Zap } from 'lucide-react'

export default function AutopilotStatusPanel({ lead, onUpdate }) {
  const statusConfig = {
    off: { bg: 'bg-slate-50', color: 'text-slate-700', label: 'Manuell' },
    active: { bg: 'bg-green-50', color: 'text-green-700', label: 'Aktiv' },
    paused: { bg: 'bg-yellow-50', color: 'text-yellow-700', label: 'Pausiert' },
  }

  const offerConfig = {
    none: { badge: 'secondary', label: 'Kein Angebot' },
    preparing: { badge: 'outline', label: '⏳ Wird vorbereitet...' },
    ready: { badge: 'default', label: '✓ Bereit zur Sendung' },
    sent: { badge: 'default', label: '📧 Gesendet' },
    accepted: { badge: 'default', label: '✓ Angenommen' },
    rejected: { badge: 'destructive', label: '✗ Abgelehnt' },
  }

  const config = statusConfig[lead.autopilot_status || 'off']
  const offerConfig_ = offerConfig[lead.offer_status || 'none']

  return (
    <Card className={config.bg}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="w-4 h-4" /> 🤖 Sales Autopilot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AUTOPILOT STATUS */}
        <div>
          <p className="text-sm font-medium mb-2">Autopilot Status</p>
          <div className="flex gap-2">
            <ToggleGroup 
              type="single" 
              value={lead.autopilot_status || 'off'}
              onValueChange={(value) => onUpdate({ autopilot_status: value })}
            >
              <ToggleGroupItem value="off" className="text-xs">Aus</ToggleGroupItem>
              <ToggleGroupItem value="active" className="text-xs">Aktiv</ToggleGroupItem>
              <ToggleGroupItem value="paused" className="text-xs">Pausiert</ToggleGroupItem>
            </ToggleGroup>
            <Badge className={`${config.color} ml-auto`}>{config.label}</Badge>
          </div>
        </div>

        {/* OFFER STATUS */}
        <div className="border-t pt-3">
          <p className="text-sm font-medium mb-2">Angebot</p>
          <div className="flex items-center justify-between">
            <Badge variant={offerConfig_.badge}>{offerConfig_.label}</Badge>
            {lead.offer_status === 'ready' && (
              <Button 
                size="sm" 
                onClick={() => onUpdate({ offer_status: 'sent', offer_sent_date: new Date().toISOString() })}
              >
                → Senden
              </Button>
            )}
          </div>
        </div>

        {/* CONVERSION PROBABILITY */}
        {lead.conversion_probability && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-1">Abschlusswahrscheinlichkeit</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${lead.conversion_probability}%` }}
                />
              </div>
              <span className="text-sm font-bold">{lead.conversion_probability}%</span>
            </div>
          </div>
        )}

        {/* AUTO-ACTIONS */}
        {lead.autopilot_status === 'active' && (
          <div className="border-t pt-3 bg-green-100/30 p-2 rounded text-xs text-green-700">
            ✓ System arbeitet automatisch:
            <ul className="mt-1 space-y-0.5 ml-3">
              <li>• Follow-ups nach 2 Tagen</li>
              <li>• Angebot vorbereitet</li>
              <li>• Erinnerungen nach 3 Tagen</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}