import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone } from 'lucide-react'

export default function ContactTodaySection({ leads, lastActivityDays = 2 }) {
  const toContact = useMemo(() => {
    const today = new Date()
    return leads
      .filter(l => (l.status === 'contacted' || l.status === 'qualified'))
      .filter(l => {
        if (!l.last_contact_date) return true
        const lastContact = new Date(l.last_contact_date)
        const daysSince = Math.floor((today - lastContact) / (1000 * 60 * 60 * 24))
        return daysSince >= lastActivityDays
      })
      .sort((a, b) => new Date(b.last_contact_date || 0) - new Date(a.last_contact_date || 0))
      .slice(0, 10)
  }, [leads, lastActivityDays])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Phone className="w-4 h-4" /> 📞 HEUTE KONTAKTIEREN
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {toContact.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Follow-ups erforderlich</p>
        ) : (
          toContact.map(lead => (
            <div key={lead.id} className="flex justify-between items-center p-2 rounded bg-muted/30 border border-slate-200">
              <div className="flex-1">
                <p className="font-medium text-sm">{lead.name}</p>
                <p className="text-xs text-muted-foreground">{lead.email}</p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{lead.status}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}