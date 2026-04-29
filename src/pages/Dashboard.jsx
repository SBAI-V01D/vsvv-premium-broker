import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, FileText, ClipboardList, CheckCircle2 } from 'lucide-react'

export default function Dashboard() {
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({ status: '', notes: '', due_date: '' })
  const queryClient = useQueryClient()
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list(),
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => base44.entities.Application.list(),
  })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list(),
  })

  const activeContracts = contracts.filter(c => c.status === 'active')
  const openApplications = applications.filter(a => a.status !== 'approved' && a.status !== 'rejected')
  const openTasks = tasks.filter(t => t.status !== 'completed')

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const updateData = {
        status: data.status !== undefined ? data.status : selectedTask.status,
        notes: data.notes !== undefined ? data.notes : selectedTask.notes,
        due_date: data.due_date !== undefined ? data.due_date : selectedTask.due_date,
        completion_date: data.completion_date !== undefined ? data.completion_date : selectedTask.completion_date,
      }
      
      if (data.file) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: data.file })
        updateData.document_url = file_url
      }
      
      return base44.entities.Task.update(selectedTask.id, updateData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setSelectedTask(null)
      setFormData({ status: '', notes: '', due_date: '', completion_date: '', file: null })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setSelectedTask(null)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setSelectedTask(null)
      setFormData({ status: 'open', notes: '', due_date: '', completion_date: '', file: null })
    },
  })

  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    const date = new Date(dateStr + 'T00:00:00Z')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const year = date.getUTCFullYear()
    return `${day}.${month}.${year}`
  }

  const handleTaskClick = (task) => {
    setSelectedTask(task)
    setFormData({ status: task.status, notes: task.notes || '', due_date: task.due_date || '', completion_date: task.completion_date || '', file: null })
  }

  const handleSave = () => {
    if (selectedTask?.id) {
      updateMutation.mutate(formData)
    } else {
      createMutation.mutate({
        title: formData.title || 'Neue Aufgabe',
        status: formData.status || 'open',
        notes: formData.notes,
        due_date: formData.due_date,
        completion_date: formData.completion_date,
      })
    }
  }

  const handleNewTask = () => {
    setSelectedTask({ id: null, title: '', status: 'open' })
    setFormData({ title: '', status: 'open', notes: '', due_date: '', completion_date: '', file: null })
  }

  const stats = [
    { label: 'Kunden', value: customers.length, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Aktive Verträge', value: activeContracts.length, icon: FileText, color: 'bg-green-50 text-green-600' },
    { label: 'Offene Anträge', value: openApplications.length, icon: ClipboardList, color: 'bg-amber-50 text-amber-600' },
    { label: 'Offene Aufgaben', value: openTasks.length, icon: CheckCircle2, color: 'bg-purple-50 text-purple-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Willkommen in deinem CRM</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Kürzlich hinzugefügte Kunden</CardTitle>
          </CardHeader>
          <CardContent>
            {customers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Kunden vorhanden</p>
            ) : (
              <div className="space-y-3">
                {customers.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div>
                      <p className="text-sm font-medium">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Ausstehende Aufgaben</CardTitle>
            <Button size="sm" onClick={handleNewTask}>+ Neue Aufgabe</Button>
          </CardHeader>
          <CardContent>
            {openTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine ausstehenden Aufgaben</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {openTasks.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTaskClick(t)}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      {t.due_date && <p className="text-xs text-muted-foreground">Fällig: {formatDate(t.due_date)}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTask?.id ? selectedTask?.title : 'Neue Aufgabe erstellen'}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              {!selectedTask.id && (
                <div>
                  <Label>Aufgabentitel *</Label>
                  <Input
                    value={formData.title || ''}
                    onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                    placeholder="Aufgabentitel eingeben"
                    className="mt-1"
                  />
                </div>
              )}
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Pendent</SelectItem>
                    <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                    <SelectItem value="completed">Erledigt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Fälligkeitsdatum</Label>
                <Input
                  type="date"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData(p => ({ ...p, due_date: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Erledigungsdatum</Label>
                <Input
                  type="date"
                  value={formData.completion_date || ''}
                  onChange={(e) => setFormData(p => ({ ...p, completion_date: e.target.value }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Dokument hochladen</Label>
                <Input
                  type="file"
                  onChange={(e) => setFormData(p => ({ ...p, file: e.target.files?.[0] || null }))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Notizen</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Prozessnotizen..."
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm('Aufgabe wirklich löschen?')) {
                  deleteMutation.mutate(selectedTask.id)
                }
              }}
              disabled={deleteMutation.isPending}
            >
              Löschen
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedTask(null)}>Schliessen</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending || createMutation.isPending}>
                {updateMutation.isPending || createMutation.isPending ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}