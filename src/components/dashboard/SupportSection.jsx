import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckSquare, Cake, Activity } from 'lucide-react'

export default function SupportSection({ tasks = [], customers = [], activities = [] }) {
  const openTasks = useMemo(() => tasks.filter(t => t.status === 'open').slice(0, 5), [tasks])

  const birthdays = useMemo(() => {
    const today = new Date()
    return customers
      .filter(c => c.birthdate)
      .map(c => {
        const bd = new Date(c.birthdate)
        const this_year = new Date(today.getFullYear(), bd.getMonth(), bd.getDate())
        const next = this_year >= today ? this_year : new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate())
        const days = Math.floor((next - today) / (1000 * 60 * 60 * 24))
        return { customer: c, days }
      })
      .filter(b => b.days <= 30)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5)
  }, [customers])

  const recentActivities = useMemo(() => activities.slice(0, 5), [activities])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* TASKS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckSquare className="w-4 h-4" /> Aufgaben
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {openTasks.length === 0 ? (
            <p className="text-xs text-green-600">✓ Keine offenen Aufgaben</p>
          ) : (
            openTasks.map(t => (
              <div key={t.id} className="flex justify-between items-start text-xs">
                <span className="truncate">{t.title}</span>
                <Badge variant="outline" className="flex-shrink-0 ml-1">offen</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* BIRTHDAYS */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cake className="w-4 h-4" /> 🎂 Geburtstage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {birthdays.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine bald</p>
          ) : (
            birthdays.map(b => (
              <div key={b.customer.id} className="flex justify-between items-start text-xs">
                <span>{b.customer.first_name}</span>
                <Badge variant="secondary" className="text-xs">{b.days}d</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ACTIVITIES */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" /> Aktivitäten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {recentActivities.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine</p>
          ) : (
            recentActivities.map((a, i) => (
              <p key={i} className="text-xs text-muted-foreground truncate">{a}</p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}