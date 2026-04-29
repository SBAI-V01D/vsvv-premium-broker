import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Edit, Trash2, GripVertical } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const COLOR_OPTIONS = [
  { value: 'gray',   label: 'Grau' },
  { value: 'blue',   label: 'Blau' },
  { value: 'yellow', label: 'Gelb' },
  { value: 'orange', label: 'Orange' },
  { value: 'green',  label: 'Grün' },
  { value: 'red',    label: 'Rot' },
  { value: 'purple', label: 'Violett' },
  { value: 'teal',   label: 'Türkis' },
]

const COLOR_STYLES = {
  gray:   'bg-slate-100 text-slate-700 border-slate-200',
  blue:   'bg-blue-50 text-blue-700 border-blue-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  green:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  red:    'bg-red-50 text-red-700 border-red-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  teal:   'bg-teal-50 text-teal-700 border-teal-200',
}

const CATEGORY_OPTIONS = [
  { value: 'offen',        label: 'Offen' },
  { value: 'positiv',      label: 'Positiv' },
  { value: 'negativ',      label: 'Negativ' },
  { value: 'abgeschlossen', label: 'Abgeschlossen' },
]

const EMPTY_FORM = {
  type: 'application',
  key: '',
  label: '',
  color: 'gray',
  category: 'offen',
  is_active: true,
  sort_order: 0,
}

export default function StatusVerwaltung() {
  const [activeTab, setActiveTab] = useState('application')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const queryClient = useQueryClient()

  const { data: statusDefs = [] } = useQuery({
    queryKey: ['statusDefinitions'],
    queryFn: () => base44.entities.StatusDefinition.list('sort_order'),
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.StatusDefinition.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['statusDefinitions'] }); setShowForm(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.StatusDefinition.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['statusDefinitions'] }); setShowForm(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.StatusDefinition.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['statusDefinitions'] }),
  })

  const filtered = statusDefs
    .filter(s => s.type === activeTab)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, type: activeTab })
    setShowForm(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({ type: s.type, key: s.key, label: s.label, color: s.color || 'gray', category: s.category || 'offen', is_active: s.is_active !== false, sort_order: s.sort_order || 0 })
    setShowForm(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const toggleActive = (s) => {
    updateMutation.mutate({ id: s.id, data: { ...s, is_active: !s.is_active } })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Statusverwaltung</h1>
          <p className="text-muted-foreground mt-1">Statuswerte für Anträge und Verträge konfigurieren</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Neuer Status
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {[
          { key: 'application', label: 'Anträge' },
          { key: 'contract',    label: 'Verträge' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Noch keine Statuswerte definiert
            </div>
          ) : (
            <div>
              {filtered.map((s, idx) => (
                <div
                  key={s.id}
                  className="flex items-center gap-4 p-4 border-b border-border last:border-0 hover:bg-muted/50"
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', COLOR_STYLES[s.color] || COLOR_STYLES.gray)}>
                        {s.label}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{s.key}</span>
                      {!s.is_active && (
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">Inaktiv</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Kategorie: {CATEGORY_OPTIONS.find(c => c.value === s.category)?.label || s.category}
                      {' · '}Reihenfolge: {s.sort_order}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(s)}>
                      {s.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Status "${s.label}" wirklich löschen?`)) deleteMutation.mutate(s.id)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Status bearbeiten' : 'Neuer Status'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Bereich</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="application">Anträge</SelectItem>
                  <SelectItem value="contract">Verträge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Anzeigename *</Label>
              <Input value={form.label} onChange={e => set('label', e.target.value)} required className="mt-1" placeholder="z.B. Antrag eingereicht" />
            </div>
            <div>
              <Label>Interner Schlüssel *</Label>
              <Input
                value={form.key}
                onChange={e => set('key', e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                required
                className="mt-1 font-mono"
                placeholder="z.B. eingereicht"
              />
              <p className="text-xs text-muted-foreground mt-1">Nur Kleinbuchstaben, Zahlen und Unterstriche</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Farbe</Label>
                <Select value={form.color} onValueChange={v => set('color', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <span className={cn('inline-block w-2 h-2 rounded-full', {
                            'bg-slate-400': c.value === 'gray',
                            'bg-blue-500': c.value === 'blue',
                            'bg-yellow-500': c.value === 'yellow',
                            'bg-orange-500': c.value === 'orange',
                            'bg-emerald-500': c.value === 'green',
                            'bg-red-500': c.value === 'red',
                            'bg-purple-500': c.value === 'purple',
                            'bg-teal-500': c.value === 'teal',
                          })} />
                          {c.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kategorie</Label>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Reihenfolge</Label>
              <Input type="number" value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4" />
              <Label htmlFor="is_active">Status ist aktiv</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Abbrechen</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? 'Aktualisieren' : 'Erstellen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}