import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function PipelineSection({ metrics }) {
  const pipelineStages = [
    { key: 'new', label: 'Neue Leads', color: 'bg-blue-100 text-blue-700' },
    { key: 'contacted', label: 'Kontaktiert', color: 'bg-cyan-100 text-cyan-700' },
    { key: 'qualified', label: 'Qualifiziert', color: 'bg-amber-100 text-amber-700' },
    { key: 'converted', label: 'Konvertiert', color: 'bg-green-100 text-green-700' },
  ]

  const leadsByStatus = {}
  metrics.leads.forEach(lead => {
    const status = lead.status || 'new'
    leadsByStatus[status] = (leadsByStatus[status] || 0) + 1
  })

  const appsByStatus = {}
  metrics.applications.forEach(app => {
    const status = app.status || 'draft'
    appsByStatus[status] = (appsByStatus[status] || 0) + 1
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEAD PIPELINE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📊 Lead Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pipelineStages.map(stage => {
              const count = leadsByStatus[stage.key] || 0
              const percentage = metrics.leads.length > 0 ? (count / metrics.leads.length * 100).toFixed(0) : 0
              return (
                <div key={stage.key}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{stage.label}</span>
                    <Badge className={stage.color}>{count}</Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* APPLICATION PIPELINE */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📋 Antrags-Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-blue-50">
              <p className="text-xs text-muted-foreground">Neu / Entwurf</p>
              <p className="text-2xl font-bold text-blue-600">{appsByStatus['draft'] || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50">
              <p className="text-xs text-muted-foreground">In Bearbeitung</p>
              <p className="text-2xl font-bold text-amber-600">
                {(appsByStatus['submitted'] || 0) + (appsByStatus['under_review'] || 0)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <p className="text-xs text-muted-foreground">Genehmigt</p>
              <p className="text-2xl font-bold text-green-600">{appsByStatus['approved'] || 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50">
              <p className="text-xs text-muted-foreground">Abgelehnt</p>
              <p className="text-2xl font-bold text-red-600">{appsByStatus['rejected'] || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}