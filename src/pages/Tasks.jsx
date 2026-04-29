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
import { Upload, FileText, ExternalLink } from 'lucide-react'

export default function Tasks() {
  const queryClient = useQueryClient()
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({ status: '', notes: '', file: null, due_date: '', completion_date: '' })
  const [uploading, setUploading] = useState(false)

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-due_date'),
  })

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const updateData = {
        status: data.status || selectedTask.status,
        notes: data.notes || selectedTask.notes,
        due_date: data.due_date || selectedTask.due_date,
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
      setFormData({ status: '', notes: '', file: null })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setSelectedTask(null)
    },
  })

  const isOverdue = (dueDate) => new Date(dueDate) < new Date()
  const formatDate = (dateStr) => {
    if (!dateStr) return '–'
    const date = new Date(dateStr + 'T00:00:00Z')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const year = date.getUTCFullYear()
    return `${day}.${month}.${year}`
  }

  const openTasks = tasks.filter(t => t.status === 'open')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  const handleTaskClick = (task) => {
    setSelectedTask(task)
    setFormData({ status: task.status, notes: task.notes || '', file: null, due_date: task.due_date || '', completion_date: task.completion_date || '' })
  }

  const handleSave = () => {
    updateMutation.mutate(formData)
  }

  const openTasksCount = openTasks.length
  const inProgressTasksCount = inProgressTasks.length
  const completedTasksCount = completedTasks.length

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
                <button
                  key={t.id}
                  onClick={() => handleTaskClick(t)}
                  className={`p-3 rounded border text-left transition-colors w-full ${
                    t.due_date && isOverdue(t.due_date)
                      ? 'bg-red-50 border-red-300 hover:bg-red-100 hover:border-red-400'
                      : 'bg-slate-50 border-border hover:border-primary hover:bg-slate-100'
                  }`}
                >
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.due_date && (
                    <p className={`text-xs mt-1 ${isOverdue(t.due_date) ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                      Fällig: {formatDate(t.due_date)}
                    </p>
                  )}
                </button>
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
                <button
                  key={t.id}
                  onClick={() => handleTaskClick(t)}
                  className={`p-3 rounded border text-left transition-colors w-full ${
                    t.due_date && isOverdue(t.due_date)
                      ? 'bg-red-50 border-red-300 hover:bg-red-100 hover:border-red-400'
                      : 'bg-blue-50 border-blue-200 hover:border-blue-400 hover:bg-blue-100'
                  }`}
                >
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.due_date && (
                    <p className={`text-xs mt-1 ${isOverdue(t.due_date) ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                      Fällig: {formatDate(t.due_date)}
                    </p>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Erledigt ({completedTasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {completedTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine erledigten Aufgaben</p>
            ) : (
              completedTasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTaskClick(t)}
                  className="p-3 bg-green-50 rounded border border-green-200 hover:border-green-400 hover:bg-green-100 text-left transition-colors w-full line-through opacity-75"
                >
                  <p className="text-sm font-medium">{t.title}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={(open) => { if (!open) setSelectedTask(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
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
                <Label>Notizen</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Prozessnotizen und Angaben..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div>
                <Label>Dokument hochladen</Label>
                <Input
                  type="file"
                  onChange={(e) => setFormData(p => ({ ...p, file: e.target.files?.[0] || null }))}
                  className="mt-1"
                />
                {selectedTask.document_url && (
                  <a href={selectedTask.document_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="mt-2 w-full">
                      <FileText className="w-4 h-4 mr-1" /> Dokument öffnen
                    </Button>
                  </a>
                )}
              </div>

              {selectedTask.due_date && (
                <p className="text-xs text-muted-foreground">Fällig: {formatDate(selectedTask.due_date)}</p>
              )}
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
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}