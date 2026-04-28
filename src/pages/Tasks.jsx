import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Tasks() {
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-due_date'),
  })

  const openTasks = tasks.filter(t => t.status === 'open')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Aufgaben</h1>
        <p className="text-muted-foreground mt-1">{tasks.length} Aufgaben insgesamt</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Offen ({openTasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine offenen Aufgaben</p>
            ) : (
              openTasks.map(t => (
                <div key={t.id} className="p-3 bg-slate-50 rounded border border-border">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.due_date && <p className="text-xs text-muted-foreground mt-1">Fällig: {t.due_date}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">In Bearbeitung ({inProgressTasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inProgressTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Aufgaben in Bearbeitung</p>
            ) : (
              inProgressTasks.map(t => (
                <div key={t.id} className="p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.due_date && <p className="text-xs text-muted-foreground mt-1">Fällig: {t.due_date}</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Erledigt ({completedTasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine erledigten Aufgaben</p>
            ) : (
              completedTasks.slice(0, 5).map(t => (
                <div key={t.id} className="p-3 bg-green-50 rounded border border-green-200 line-through opacity-75">
                  <p className="text-sm font-medium">{t.title}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}