import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FileText, AlertCircle, ListTodo, FileWarning, ExternalLink, Shield, ClipboardList, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import PriorityBadge, { taskPriorityToLevel } from '@/components/shared/PriorityBadge'

// Contract workflow task types
const CONTRACT_TASK_TYPES = ['renewal', 'health_declaration']

export default function Tasks() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedTask, setSelectedTask] = useState(null)
  const [formData, setFormData] = useState({ status: '', notes: '', file: null, due_date: '', completion_date: '', assigned_to: '' })
  const [currentUser, setCurrentUser] = useState(null)
  const [categoryTab, setCategoryTab] = useState('admin')

  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const user = await base44.auth.me()
      setCurrentUser(user)
    }
    fetchUser()
  }, [])

  // Fetch all tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-due_date'),
  })

  const { data: brokers = [] } = useQuery({
    queryKey: ['brokers'],
    queryFn: () => base44.entities.Broker.filter({ is_active: true }),
  })

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const updateData = {
        status: data.status || selectedTask.status,
        notes: data.notes || selectedTask.notes,
        due_date: data.due_date || selectedTask.due_date,
        assigned_to: data.assigned_to || selectedTask.assigned_to,
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
      setFormData({ status: '', notes: '', file: null, due_date: '', completion_date: '', assigned_to: '' })
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

  // Filter: nur echte, aktive Tasks (keine Zombie-Tasks)
  // assigned_to ist optional — viele auto-erstellte Tasks haben keinen Broker gesetzt
  const isValidTask = (t) => {
    return t.status !== 'completed'
      && !t.deleted
      && !t.archived
      && !t.is_test_data
      && t.customer_id  // muss einen Kundenbezug haben
  }

  // Split by category
  const adminTasks = tasks.filter(t => !CONTRACT_TASK_TYPES.includes(t.task_type) && isValidTask(t))
  const contractTasks = tasks.filter(t => CONTRACT_TASK_TYPES.includes(t.task_type) && isValidTask(t))
  const activeCategoryTasks = categoryTab === 'admin' ? adminTasks : contractTasks

  const openTasks = activeCategoryTasks.filter(t => t.status === 'open')
  const inProgressTasks = activeCategoryTasks.filter(t => t.status === 'in_progress')
  const completedTasks = activeCategoryTasks.filter(t => t.status === 'completed')

  const handleTaskClick = (task) => {
    setSelectedTask(task)
    setFormData({ status: task.status, notes: task.notes || '', file: null, due_date: task.due_date || '', completion_date: task.completion_date || '', assigned_to: task.assigned_to || '' })
  }

  const handleRowClick = (e, task) => {
    e.stopPropagation()
    if (task.customer_id) navigate(`/kunden/${task.customer_id}`)
  }

  const handleSave = () => {
    updateMutation.mutate(formData)
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center gap-2 p-6 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
        <AlertCircle className="w-4 h-4" />
        <p className="text-sm">Authentifizierung wird überprüft...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
         <h1 className="text-3xl font-bold">Aufgaben</h1>
         <p className="text-muted-foreground mt-1">{tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length} offene & in Bearbeitung</p>
       </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        <button
          onClick={() => setCategoryTab('admin')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            categoryTab === 'admin'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <ListTodo className="w-4 h-4" />
          Administrative Aufgaben
          <span className={cn('ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full font-semibold',
            categoryTab === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            {adminTasks.filter(t => t.status === 'open' || t.status === 'in_progress').length}
          </span>
        </button>
        <button
          onClick={() => setCategoryTab('contract')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            categoryTab === 'contract'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          <FileWarning className="w-4 h-4" />
          Vertrags-Workflows
          <span className={cn('ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full font-semibold',
            categoryTab === 'contract' ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'
          )}>
            {contractTasks.filter(t => t.status === 'open' || t.status === 'in_progress').length}
          </span>
        </button>
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
                <div
                  key={t.id}
                  onClick={() => handleTaskClick(t)}
                  className={`p-3 rounded border text-left transition-colors w-full group cursor-pointer ${
                    t.due_date && isOverdue(t.due_date)
                      ? 'bg-red-50 border-red-300 hover:bg-red-100 hover:border-red-400'
                      : 'bg-slate-50 border-border hover:border-primary hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{t.title}</p>
                      {t.customer_name && (
                        <button 
                          onClick={(e) => handleRowClick(e, t)}
                          className="text-xs text-blue-600 font-medium mt-0.5 hover:underline"
                        >
                          {t.customer_name}
                        </button>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {t.due_date && (
                          <p className={`text-xs ${isOverdue(t.due_date) ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                            {isOverdue(t.due_date) ? '⚠ ' : ''}Fällig: {formatDate(t.due_date)}
                          </p>
                        )}
                        <PriorityBadge level={isOverdue(t.due_date) ? 'critical' : taskPriorityToLevel(t.priority)} />
                      </div>
                    </div>
                    </div>
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
                    <div
                    key={t.id}
                    onClick={() => handleTaskClick(t)}
                    className={`p-3 rounded border text-left transition-colors w-full group cursor-pointer ${
                    t.due_date && isOverdue(t.due_date)
                      ? 'bg-red-50 border-red-300 hover:bg-red-100 hover:border-red-400'
                      : 'bg-blue-50 border-blue-200 hover:border-blue-400 hover:bg-blue-100'
                    }`}
                    >
                    <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{t.title}</p>
                      {t.customer_name && (
                        <button 
                          onClick={(e) => handleRowClick(e, t)}
                          className="text-xs text-blue-600 font-medium mt-0.5 hover:underline"
                        >
                          {t.customer_name}
                        </button>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {t.due_date && (
                          <p className={`text-xs ${isOverdue(t.due_date) ? 'text-red-600 font-bold' : 'text-muted-foreground'}`}>
                            {isOverdue(t.due_date) ? '⚠ ' : ''}Fällig: {formatDate(t.due_date)}
                          </p>
                        )}
                        <PriorityBadge level={isOverdue(t.due_date) ? 'critical' : taskPriorityToLevel(t.priority)} />
                      </div>
                    </div>
                    </div>
                    </div>
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
                    <div
                    key={t.id}
                    onClick={() => handleTaskClick(t)}
                    className="p-3 bg-green-50 rounded border border-green-200 hover:border-green-400 hover:bg-green-100 text-left transition-colors w-full line-through opacity-75 group flex items-start justify-between gap-2 cursor-pointer"
                    >
                    <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.customer_name && (
                      <button 
                        onClick={(e) => handleRowClick(e, t)}
                        className="text-xs text-blue-600 font-medium mt-0.5 hover:underline"
                      >
                        {t.customer_name}
                      </button>
                    )}
                    </div>
                    </div>
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
               <Label>Zugewiesen an</Label>
               <Select value={formData.assigned_to} onValueChange={(v) => setFormData(p => ({ ...p, assigned_to: v }))}>
                 <SelectTrigger className="mt-1">
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {brokers.map(b => (
                     <SelectItem key={b.id} value={b.email || b.name}>{b.name}</SelectItem>
                   ))}
                 </SelectContent>
               </Select>
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

              {/* Verknüpfungen */}
              {(selectedTask.customer_id || selectedTask.contract_id || selectedTask.application_id) && (
                <div className="pt-2 border-t border-border space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Verknüpfungen</p>
                  {selectedTask.customer_id && (
                    <button
                      onClick={() => { navigate(`/kunden/${selectedTask.customer_id}/360`); setSelectedTask(null) }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <span className="text-xs font-medium text-blue-700 truncate">
                        Kunde: {selectedTask.customer_name || selectedTask.customer_id}
                      </span>
                    </button>
                  )}
                  {selectedTask.contract_id && (
                    <button
                      onClick={() => { navigate('/vertragsablaeufe'); setSelectedTask(null) }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-orange-50 border border-orange-100 hover:bg-orange-100 transition-colors"
                    >
                      <Shield className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                      <span className="text-xs font-medium text-orange-700">
                        → Vertragsabläufe öffnen
                      </span>
                    </button>
                  )}
                  {selectedTask.application_id && (
                    <button
                      onClick={() => { navigate('/antraege'); setSelectedTask(null) }}
                      className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-colors"
                    >
                      <ClipboardList className="w-3.5 h-3.5 text-violet-600 flex-shrink-0" />
                      <span className="text-xs font-medium text-violet-700 truncate">
                        Antrag: {selectedTask.application_name || selectedTask.application_id}
                      </span>
                    </button>
                  )}
                </div>
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