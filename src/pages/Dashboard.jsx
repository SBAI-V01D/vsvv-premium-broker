import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { base44 } from '@/api/base44Client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, FileText, ClipboardList, CheckCircle2, Download } from 'lucide-react'

export default function Dashboard() {
  const navigate = useNavigate()
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
  const inactiveContracts = contracts.filter(c => c.status !== 'active')
  const openApplications = applications.filter(a => a.status !== 'approved' && a.status !== 'rejected')
  const openTasks = tasks.filter(t => t.status === 'open')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
  const pendingTasks = [...openTasks, ...inProgressTasks]

  // Geburtstage berechnen
  const today = new Date()
  const upcomingBirthdays = customers
    .filter(c => c.birthdate)
    .map(c => {
      const birthDate = new Date(c.birthdate)
      const thisYear = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())
      const nextYear = new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate())
      const nextBirthday = thisYear >= today ? thisYear : nextYear
      const daysUntil = Math.floor((nextBirthday - today) / (1000 * 60 * 60 * 24))
      return { customer: c, daysUntil, date: nextBirthday }
    })
    .filter(b => b.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5)

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

  const handleExportPDF = () => {
    const doc = new jsPDF()
    const pageHeight = doc.internal.pageSize.getHeight()
    const pageWidth = doc.internal.pageSize.getWidth()
    let yPos = 10

    // Header
    doc.setFontSize(16)
    doc.text('Export: Geburtstage & Kommende Aufgaben', pageWidth / 2, yPos, { align: 'center' })
    yPos += 15

    // Geburtstage
    doc.setFontSize(12)
    doc.text('🎂 Kommende Geburtstage', 10, yPos)
    yPos += 8
    doc.setFontSize(10)
    if (upcomingBirthdays.length === 0) {
      doc.text('Keine Geburtstage in den nächsten 30 Tagen', 10, yPos)
      yPos += 8
    } else {
      upcomingBirthdays.forEach(b => {
        const daysText = b.daysUntil === 0 ? 'Heute' : b.daysUntil === 1 ? 'Morgen' : `in ${b.daysUntil} Tagen`
        doc.text(`${b.customer.first_name} ${b.customer.last_name} - ${daysText}`, 10, yPos)
        yPos += 6
        if (yPos > pageHeight - 20) {
          doc.addPage()
          yPos = 10
        }
      })
    }

    yPos += 5
    // Aufgaben
    doc.setFontSize(12)
    doc.text('Kommende Aufgaben', 10, yPos)
    yPos += 8
    doc.setFontSize(10)
    if (pendingTasks.length === 0) {
      doc.text('Keine ausstehenden Aufgaben', 10, yPos)
    } else {
      pendingTasks.forEach(t => {
        const dueText = t.due_date ? ` (Fällig: ${formatDate(t.due_date)})` : ''
        const text = `${t.title}${dueText}`
        const splitText = doc.splitTextToSize(text, pageWidth - 20)
        splitText.forEach(line => {
          doc.text(line, 10, yPos)
          yPos += 6
          if (yPos > pageHeight - 10) {
            doc.addPage()
            yPos = 10
          }
        })
      })
    }

    doc.save('Geburtstage_Aufgaben.pdf')
  }

  const handleExportExcel = () => {
    const csvContent = [
      ['GEBURTSTAGE'],
      ['Name', 'Tage bis Geburtstag'],
      ...upcomingBirthdays.map(b => [
        `${b.customer.first_name} ${b.customer.last_name}`,
        b.daysUntil === 0 ? 'Heute' : b.daysUntil === 1 ? 'Morgen' : `in ${b.daysUntil} Tagen`
      ]),
      [],
      ['KOMMENDE AUFGABEN'],
      ['Aufgabentitel', 'Fälligkeitsdatum', 'Status'],
      ...pendingTasks.map(t => [
        t.title,
        t.due_date ? formatDate(t.due_date) : '-',
        t.status
      ])
    ]

    const csvString = csvContent.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'Geburtstage_Aufgaben.csv')
    link.click()
  }

  const stats = [
    { label: 'Kunden', value: customers.length, icon: Users, color: 'bg-blue-50 text-blue-600', path: '/kunden' },
    { label: 'Aktive Verträge', value: activeContracts.length, icon: FileText, color: 'bg-green-50 text-green-600', path: '/vertraege' },
    { label: 'Offene Anträge', value: openApplications.length, icon: ClipboardList, color: 'bg-amber-50 text-amber-600', path: '/antraege' },
    { label: 'Ausstehende Aufgaben', value: pendingTasks.length, icon: CheckCircle2, color: 'bg-purple-50 text-purple-600', path: '/aufgaben' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Willkommen in deinem CRM</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportPDF} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button onClick={handleExportExcel} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, path }) => (
          <Card key={label} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(path)}>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/vertraege')}>
          <CardHeader>
            <CardTitle>Verträge - Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between p-2 bg-green-50 rounded">
              <span className="text-sm font-medium">Aktive Verträge</span>
              <span className="text-lg font-bold text-green-600">{activeContracts.length}</span>
            </div>
            <div className="flex justify-between p-2 bg-red-50 rounded">
              <span className="text-sm font-medium">Inaktive Verträge</span>
              <span className="text-lg font-bold text-red-600">{inactiveContracts.length}</span>
            </div>
            <div className="text-sm text-muted-foreground border-t pt-2 mt-2">
              Total: {contracts.length} Verträge
            </div>
          </CardContent>
        </Card>

        <Card onClick={() => navigate('/aufgaben')} className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Kommende Aufgaben</CardTitle>
            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleNewTask() }}>+ Neue Aufgabe</Button>
          </CardHeader>
          <CardContent>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine ausstehenden Aufgaben</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {pendingTasks.map(t => (
                  <button
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); handleTaskClick(t) }}
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

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/kunden')}>
          <CardHeader>
            <CardTitle>🎂 Kommende Geburtstage</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingBirthdays.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Geburtstage in den nächsten 30 Tagen</p>
            ) : (
              <div className="space-y-3">
                {upcomingBirthdays.map(b => (
                  <div key={b.customer.id} className="flex items-center justify-between p-2 bg-pink-50 rounded">
                    <div>
                      <p className="text-sm font-medium">{b.customer.first_name} {b.customer.last_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.daysUntil === 0 ? 'Heute' : b.daysUntil === 1 ? 'Morgen' : `in ${b.daysUntil} Tagen`}
                      </p>
                    </div>
                    <span className="text-lg">🎉</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/kunden')}>
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