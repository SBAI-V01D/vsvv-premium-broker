import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Zap } from 'lucide-react'
import SalesAutopilotDashboard from '@/components/autopilot/SalesAutopilotDashboard'
import AutopilotStatusPanel from '@/components/autopilot/AutopilotStatusPanel'

export default function SalesAutopilot() {
  const queryClient = useQueryClient()
  const [selectedLead, setSelectedLead] = useState(null)

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => base44.entities.Lead.list(),
  })

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  const runAutopilotMutation = useMutation({
    mutationFn: (action) => base44.functions.invoke(`autopilot${action}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  const activeLead = selectedLead ? leads.find(l => l.id === selectedLead) : null

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="border-b pb-6">
        <h1 className="text-4xl font-bold flex items-center gap-2">
          <Zap className="w-8 h-8 text-green-600" /> 🤖 Sales Autopilot
        </h1>
        <p className="text-muted-foreground mt-2">
          Automatisierte Vertriebsmaschine mit Kontrolle – System arbeitet vor, du bestätigst
        </p>
      </div>

      {/* DASHBOARD */}
      <div>
        <h2 className="text-lg font-bold mb-4">📊 Autopilot Status</h2>
        <SalesAutopilotDashboard leads={leads} />
      </div>

      {/* CONTROL BUTTONS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">⚙️ Autopilot Steuerung</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Button 
            onClick={() => runAutopilotMutation.mutate('SendFollowup')}
            disabled={runAutopilotMutation.isPending}
          >
            {runAutopilotMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : '📞'} 
            Follow-ups Senden
          </Button>
          <Button 
            onClick={() => runAutopilotMutation.mutate('PrepareOffer')}
            disabled={runAutopilotMutation.isPending}
          >
            {runAutopilotMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : '📄'} 
            Angebote Vorbereiten
          </Button>
          <Button 
            onClick={() => runAutopilotMutation.mutate('OfferReminder')}
            disabled={runAutopilotMutation.isPending}
          >
            {runAutopilotMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : '⏰'} 
            Erinnerungen Senden
          </Button>
        </CardContent>
      </Card>

      {/* LEADS LIST + DETAIL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LIST */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">🎯 Leads mit Autopilot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leads.filter(l => l.autopilot_status !== 'off').map(lead => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedLead === lead.id ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Badge className="text-xs">
                        {lead.autopilot_status === 'active' ? '🟢 Aktiv' : '🟡 Pausiert'}
                      </Badge>
                      {lead.offer_status !== 'none' && (
                        <Badge variant="outline" className="text-xs">{lead.offer_status}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* DETAIL */}
        {activeLead && (
          <AutopilotStatusPanel 
            lead={activeLead}
            onUpdate={(data) => updateLeadMutation.mutate({ id: activeLead.id, data })}
          />
        )}
      </div>

      {/* INFO */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-900">
            <strong>💡 Wie es funktioniert:</strong> System sendet Follow-ups nach 2 Tagen, bereitet Angebote vor (zur Freigabe), 
            und erinnert nach 3 Tagen. Du behältst die Kontrolle – nichts wird ohne deine Freigabe gesendet.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}