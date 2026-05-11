import React, { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Star, StarOff, Trash2, Upload, ExternalLink, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const INSURERS = [
  'AXA', 'Zurich', 'Helvetia', 'Mobiliar', 'Allianz', 'CSS', 'Helsana',
  'Swica', 'Sanitas', 'KPT', 'Groupe Mutuel', 'Sympany', 'Visana',
  'Assura', 'Concordia', 'Atupri', 'Sonstige'
]

const GES_STATUS = [
  { value: 'angefragt',        label: 'Angefragt',        color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'offerte_erhalten', label: 'Offerte erhalten', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'abgelehnt',        label: 'Abgelehnt',        color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'ausgewaehlt',      label: 'Ausgewählt ✓',     color: 'bg-green-50 text-green-700 border-green-200' },
]

function StatusPill({ status }) {
  const cfg = GES_STATUS.find(s => s.value === status)
  if (!cfg) return <span className="text-xs text-muted-foreground">{status}</span>
  return <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', cfg.color)}>{cfg.label}</span>
}

export default function GesellschaftenTabelle({ verkaufschance, onUpdate }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({ gesellschaft: '', status: 'angefragt', praemie_yearly: '', deckung: '', antwort_datum: '', bemerkung: '' })
  const [uploading, setUploading] = useState(null) // id of row being uploaded

  const gesellschaften = verkaufschance.gesellschaften || []

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Verkaufschance.update(verkaufschance.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verkaufschancen'] })
      queryClient.invalidateQueries({ queryKey: ['verkaufschancen', verkaufschance.customer_id] })
      onUpdate?.()
    },
  })

  const saveGesellschaften = (updated) => {
    updateMutation.mutate({ gesellschaften: updated })
  }

  const handleAddRow = () => {
    if (!newRow.gesellschaft) return
    const row = {
      id: `ges_${Date.now()}`,
      gesellschaft: newRow.gesellschaft,
      status: newRow.status || 'angefragt',
      praemie_yearly: parseFloat(newRow.praemie_yearly) || null,
      deckung: newRow.deckung || '',
      antwort_datum: newRow.antwort_datum || null,
      ist_favorit: false,
      bemerkung: newRow.bemerkung || '',
      dokument_url: null,
      dokument_name: null,
    }
    saveGesellschaften([...gesellschaften, row])
    setNewRow({ gesellschaft: '', status: 'angefragt', praemie_yearly: '', deckung: '', antwort_datum: '', bemerkung: '' })
    setAdding(false)
  }

  const handleDeleteRow = (id) => {
    saveGesellschaften(gesellschaften.filter(g => g.id !== id))
  }

  const handleToggleFavorit = (id) => {
    saveGesellschaften(gesellschaften.map(g => ({ ...g, ist_favorit: g.id === id ? !g.ist_favorit : g.ist_favorit })))
  }

  const handleFieldChange = (id, field, value) => {
    saveGesellschaften(gesellschaften.map(g => g.id === id ? { ...g, [field]: value } : g))
  }

  const handleUpload = async (id, file) => {
    setUploading(id)
    const { file_url } = await base44.integrations.Core.UploadFile({ file })
    saveGesellschaften(gesellschaften.map(g => g.id === id ? { ...g, dokument_url: file_url, dokument_name: file.name } : g))
    setUploading(null)
  }

  const handleSelectWinner = (id) => {
    const ges = gesellschaften.find(g => g.id === id)
    if (!ges) return
    saveGesellschaften(gesellschaften.map(g => ({ ...g, status: g.id === id ? 'ausgewaehlt' : g.status })))
    updateMutation.mutate({ selected_insurer: ges.gesellschaft, status: 'kunde_entscheidet' })
  }

  // Beste Offerte (günstigste mit Offerte)
  const bestPraemie = gesellschaften
    .filter(g => g.praemie_yearly && g.status !== 'abgelehnt')
    .sort((a, b) => a.praemie_yearly - b.praemie_yearly)[0]

  return (
    <div className="space-y-3">
      {/* Vergleichstabelle */}
      {gesellschaften.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Gesellschaft</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Prämie/J.</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Deckung</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Antwort</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Dokument</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Bemerkung</th>
                <th className="px-2 py-2 text-xs font-semibold text-muted-foreground w-24">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {gesellschaften.map(g => {
                const isBest = bestPraemie?.id === g.id
                const isSelected = g.status === 'ausgewaehlt'
                return (
                  <tr key={g.id} className={cn(
                    'border-b border-border/50 transition-colors',
                    isSelected ? 'bg-green-50' : isBest ? 'bg-blue-50/40' : 'hover:bg-muted/30'
                  )}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {g.ist_favorit && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 flex-shrink-0" />}
                        <span className="font-medium">{g.gesellschaft}</span>
                        {isBest && !isSelected && <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded font-bold ml-1">GÜNSTIGSTE</span>}
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Select value={g.status} onValueChange={v => handleFieldChange(g.id, 'status', v)}>
                        <SelectTrigger className="h-6 text-xs border-0 bg-transparent p-0 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GES_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        className="w-24 text-right text-sm bg-transparent border-b border-dashed border-border/60 focus:outline-none focus:border-primary"
                        value={g.praemie_yearly || ''}
                        onChange={e => handleFieldChange(g.id, 'praemie_yearly', parseFloat(e.target.value) || null)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-28 text-xs bg-transparent border-b border-dashed border-border/60 focus:outline-none focus:border-primary"
                        value={g.deckung || ''}
                        onChange={e => handleFieldChange(g.id, 'deckung', e.target.value)}
                        placeholder="–"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        className="text-xs bg-transparent border-b border-dashed border-border/60 focus:outline-none focus:border-primary w-28"
                        value={g.antwort_datum || ''}
                        onChange={e => handleFieldChange(g.id, 'antwort_datum', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {g.dokument_url ? (
                        <a href={g.dokument_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate max-w-[80px]">{g.dokument_name || 'Offerte'}</span>
                        </a>
                      ) : (
                        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-primary">
                          <Upload className="w-3 h-3" />
                          {uploading === g.id ? 'Lädt...' : 'Hochladen'}
                          <input type="file" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(g.id, e.target.files[0])} />
                        </label>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-28 text-xs bg-transparent border-b border-dashed border-border/60 focus:outline-none focus:border-primary"
                        value={g.bemerkung || ''}
                        onChange={e => handleFieldChange(g.id, 'bemerkung', e.target.value)}
                        placeholder="–"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleFavorit(g.id)}
                          className={cn('p-1 rounded hover:bg-muted', g.ist_favorit ? 'text-amber-500' : 'text-muted-foreground')}
                          title="Favorit"
                        >
                          {g.ist_favorit ? <Star className="w-3.5 h-3.5 fill-amber-400" /> : <StarOff className="w-3.5 h-3.5" />}
                        </button>
                        {!isSelected && (
                          <button
                            onClick={() => handleSelectWinner(g.id)}
                            className="p-1 rounded hover:bg-green-100 text-muted-foreground hover:text-green-700"
                            title="Als gewählt markieren"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRow(g.id)}
                          className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Zusammenfassung wenn Offerten vorhanden */}
      {gesellschaften.filter(g => g.praemie_yearly).length > 1 && (
        <div className="flex items-center gap-4 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs">
          <span className="font-semibold text-blue-900">Vergleich:</span>
          {gesellschaften
            .filter(g => g.praemie_yearly && g.status !== 'abgelehnt')
            .sort((a, b) => a.praemie_yearly - b.praemie_yearly)
            .slice(0, 4)
            .map(g => (
              <span key={g.id} className="flex items-center gap-1">
                <span className="font-medium text-blue-800">{g.gesellschaft}</span>
                <span className="text-blue-600">CHF {g.praemie_yearly.toLocaleString('de-CH')}</span>
              </span>
            ))}
        </div>
      )}

      {/* Neue Gesellschaft hinzufügen */}
      {adding ? (
        <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Gesellschaft *</label>
              <Select value={newRow.gesellschaft} onValueChange={v => setNewRow(p => ({ ...p, gesellschaft: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {INSURERS.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={newRow.status} onValueChange={v => setNewRow(p => ({ ...p, status: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GES_STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Prämie/J. (CHF)</label>
              <Input type="number" className="h-8 text-xs" placeholder="0.00"
                value={newRow.praemie_yearly} onChange={e => setNewRow(p => ({ ...p, praemie_yearly: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Antwortdatum</label>
              <Input type="date" className="h-8 text-xs"
                value={newRow.antwort_datum} onChange={e => setNewRow(p => ({ ...p, antwort_datum: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Deckung</label>
              <Input className="h-8 text-xs" placeholder="Deckungsinfos..."
                value={newRow.deckung} onChange={e => setNewRow(p => ({ ...p, deckung: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Bemerkung</label>
              <Input className="h-8 text-xs" placeholder="Optionale Bemerkung..."
                value={newRow.bemerkung} onChange={e => setNewRow(p => ({ ...p, bemerkung: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddRow} disabled={!newRow.gesellschaft}>Hinzufügen</Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Abbrechen</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Gesellschaft hinzufügen
        </Button>
      )}
    </div>
  )
}