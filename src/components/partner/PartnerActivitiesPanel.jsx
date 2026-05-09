import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, Trash2, Edit3, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACTIVITY_ICONS = {
  document_uploaded: FileText,
  document_deleted: Trash2,
  document_modified: Edit3,
  partner_created: Plus,
  partner_updated: Edit3
}

const ACTIVITY_COLORS = {
  document_uploaded: 'bg-green-50 border-green-100',
  document_deleted: 'bg-red-50 border-red-100',
  document_modified: 'bg-blue-50 border-blue-100',
  partner_created: 'bg-purple-50 border-purple-100',
  partner_updated: 'bg-yellow-50 border-yellow-100'
}

const ACTIVITY_LABELS = {
  document_uploaded: 'Dokument hochgeladen',
  document_deleted: 'Dokument gelöscht',
  document_modified: 'Dokument geändert',
  partner_created: 'Partner erstellt',
  partner_updated: 'Partner aktualisiert'
}

export default function PartnerActivitiesPanel({ partnerId }) {
  const { data: activities = [] } = useQuery({
    queryKey: ['partner-activities', partnerId],
    queryFn: async () => {
      try {
        return await base44.entities.PartnerActivity.filter({ partner_id: partnerId }, '-created_date', 100)
      } catch {
        return []
      }
    },
    enabled: !!partnerId,
  })

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-CH', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Noch keine Aktivitäten
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, idx) => {
        const Icon = ACTIVITY_ICONS[activity.activity_type] || FileText
        return (
          <div key={activity.id} className={cn('rounded-lg border p-4 transition-colors', ACTIVITY_COLORS[activity.activity_type])}>
            <div className="flex gap-3">
              <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{ACTIVITY_LABELS[activity.activity_type]}</p>
                <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                <div className="flex gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                  {activity.performed_by_name && <span>👤 {activity.performed_by_name}</span>}
                  <span>📅 {formatDate(activity.created_date)}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}