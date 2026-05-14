/**
 * Dashboard — Fokussiertes Tages-Cockpit
 * Nur: Was bringt heute Umsatz?
 */
import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { base44 } from '@/api/base44Client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import TodayDashboard from '@/components/dashboard/TodayDashboard'
import MoneyDashboard from '@/components/dashboard/MoneyDashboard'

export default function Dashboard() {
  const navigate = useNavigate()
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({ title: '', status: '', notes: '', due_date: '' })
  const queryClient = useQueryClient()

  // ── Daten laden ───────────────────────────────────────────────────────────
  const { data: tasks = [] }            = useQuery({ queryKey: ['tasks'],            queryFn: () => base44.entities.Task.list() })
  const { data: contracts = [] }        = useQuery({ queryKey: ['contracts'],        queryFn: () => base44.entities.Contract.list() })
  const { data: leads = [] }            = useQuery({ queryKey: ['leads'],            queryFn: () => base44.entities.Lead.list() })
  const { data: verkaufschancen = [] }  = useQuery({ queryKey: ['verkaufschancen'],  queryFn: () => base44.entities.Verkaufschance.list('-created_date') })

  // ── Abgeleitete Daten ─────────────────────────────────────────────────────
  const openTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'completed' && !t.deleted && !t.archived),
    [tasks]
  )

  const today = new Date()
  const in90 = new Date(today); in90.setDate(today.getDate() + 90)

  // expiringContracts: NUR für KPI-Chip im Header — Verträge die in den nächsten 90 Tagen ablaufen ODER in letzten 30 Tagen abgelaufen sind
  const expiringContracts = useMemo(() =>
    contracts.filter(c => {
      if (!c.end_date || ['cancelled', 'archived'].includes(c.status)) return false
      const d = new Date(c.end_date + 'T00:00:00')
      return d >= new Date(today.getTime() - 30 * 86400000) && d <= in90
    }),
    [contracts]
  )

  const activeLeads = useMemo(() =>
    leads.filter(l => ['new', 'contacted', 'qualified'].includes(l.status)),
    [leads]
  )

  const openVerkaufschancen = useMemo(() =>
    verkaufschancen.filter(v => !['gewonnen', 'verloren'].includes(v.status)),
    [verkaufschancen]
  )

  // ── Task Mutations ────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.update(selectedTask.id, {
      status: data.status ?? selectedTask.status,
      notes: data.notes ?? selectedTask.notes,
      due_date: data.due_date ?? selectedTask.due_date,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); setSelectedTask(null) },
  })

  const handleTaskClick = (task) => {
    setSelectedTask(task)
    setFormData({ title: task.title || '', status: task.status, notes: task.notes || '', due_date: task.due_date || '' })
  }

  const handleTaskComplete = async (taskId) => {
    await base44.entities.Task.update(taskId, { status: 'completed', completion_date: new Date().toISOString().split('T')[0] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const handleSave = () => {
    if (selectedTask?.id) updateMutation.mutate(formData)
    setSelectedTask(null)
  }

  // Begrüssung
  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend'
  }

  const urgentCount =
    openTasks.filter(t => t.due_date && new Date(t.due_date) <= today).length +
    openVerkaufschancen.filter(v => v.status === 'kunde_entscheidet').length +
    expiringContracts.filter(c => {
      const d = Math.ceil((new Date(c.end_date) - today) / 86400000)
      return d <= 7
    }).length

  return (
    <div className="space-y-0">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="pb-4 border-b border-border space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{greeting()} 👋</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })}
              {urgentCount > 0 && (
                <span className="ml-2 text-red-600 font-semibold">· {urgentCount} dringende Aktion(en)</span>
              )}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-1.5 flex-wrap justify-end">
            {[
              { label: '+ Lead',    path: '/leads' },
              { label: '+ Chance',  path: '/verkaufschancen' },
              { label: '+ Aufgabe', path: '/aufgaben' },
            ].map(a => (
              <button
                key={a.label}
                onClick={() => navigate(a.path)}
                className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-xs font-medium"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {urgentCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
            <span className="text-xs font-bold text-red-700">⚡ {urgentCount} dringende Aktion(en) — sofort handeln</span>
          </div>
        )}
      </div>

      {/* ── Dashboard Content ────────────────────────────────────────────── */}
      <div className="pt-5 space-y-6">
        {/* 💰 MONEY DASHBOARD – Geld & Vertrieb im Fokus */}
        <MoneyDashboard />
        
        {/* Klassisches Tages-Dashboard */}
        <TodayDashboard
          openTasks={openTasks}
          expiringContracts={expiringContracts}
          contracts={contracts}
          activeLeads={activeLeads}
          verkaufschancen={openVerkaufschancen}
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onTaskComplete={handleTaskComplete}
        />
      </div>

      {/* ── Task Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title || 'Aufgabe'}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Pendent</SelectItem>
                    <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                    <SelectItem value="completed">Erledigt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fälligkeitsdatum</Label>
                <Input type="date" value={formData.due_date || ''} onChange={e => setFormData(p => ({ ...p, due_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Notizen</Label>
                <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} className="mt-1" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            {selectedTask?.id && (
              <Button variant="destructive" size="sm" onClick={() => { if (confirm('Aufgabe löschen?')) deleteMutation.mutate(selectedTask.id) }}>
                Löschen
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setSelectedTask(null)}>Abbrechen</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>Speichern</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}