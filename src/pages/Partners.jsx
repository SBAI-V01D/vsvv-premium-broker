import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Search, MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePostalCodeLookup } from '@/hooks/usePostalCodeLookup'

const CATEGORY_LABELS = {
  versicherung: '🏢 Versicherung',
  bank: '🏦 Bank',
  finanzierungspartner: '💰 Finanzierungspartner',
  vorsorgepartner: '📊 Vorsorgepartner',
  rechtsschutz: '⚖️ Rechtsschutz',
  krankenkasse: '🏥 Krankenkasse',
  sonstige: '📋 Sonstige'
}

const STATUS_COLOR = {
  aktiv: 'bg-green-100 text-green-700',
  inaktiv: 'bg-gray-100 text-gray-700'
}

const PartnerForm = ({ partner, onSave, onCancel, saving }) => {
  const [data, setData] = React.useState(partner || {
    name: '',
    category: '',
    contact_person: '',
    phone: '',
    email: '',
    street: '',
    zip_code: '',
    city: '',
    website: '',
    notes: '',
    status: 'aktiv'
  })

  const { plzError, handlePostalCodeChange, selectSuggestion } = usePostalCodeLookup()

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase text-muted-foreground">Name *</label>
        <Input value={data.name} onChange={e => setData({...data, name: e.target.value})} className="mt-1" />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-muted-foreground">Kategorie *</label>
        <Select value={data.category} onValueChange={v => setData({...data, category: v})}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="versicherung">Versicherung</SelectItem>
            <SelectItem value="bank">Bank</SelectItem>
            <SelectItem value="finanzierungspartner">Finanzierungspartner</SelectItem>
            <SelectItem value="vorsorgepartner">Vorsorgepartner</SelectItem>
            <SelectItem value="rechtsschutz">Rechtsschutz</SelectItem>
            <SelectItem value="krankenkasse">Krankenkasse</SelectItem>
            <SelectItem value="sonstige">Sonstige</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Ansprechpartner</label>
          <Input value={data.contact_person} onChange={e => setData({...data, contact_person: e.target.value})} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Status</label>
          <Select value={data.status} onValueChange={v => setData({...data, status: v})}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aktiv">Aktiv</SelectItem>
              <SelectItem value="inaktiv">Inaktiv</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Telefon</label>
          <Input value={data.phone} onChange={e => setData({...data, phone: e.target.value})} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Email</label>
          <Input type="email" value={data.email} onChange={e => setData({...data, email: e.target.value})} className="mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">Strasse</label>
          <Input value={data.street} onChange={e => setData({...data, street: e.target.value})} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-muted-foreground">PLZ / Stadt</label>
          <div className="flex gap-2 mt-1">
            <Input 
              placeholder="PLZ" 
              value={data.zip_code} 
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '');
                setData({...data, zip_code: val});
                handlePostalCodeChange(val, (updates) => {
                  setData(prev => ({...prev, ...updates}));
                });
              }} 
              className={`w-20 ${plzError ? 'border-red-500' : ''}`}
              maxLength="4"
            />
            <Input 
              placeholder="Stadt (automatisch)" 
              value={data.city} 
              onChange={e => setData({...data, city: e.target.value})} 
              className="flex-1" 
            />
          </div>
          {plzError && <p className="text-xs text-red-600 mt-1">{plzError}</p>}
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-muted-foreground">Website</label>
        <Input type="url" value={data.website} onChange={e => setData({...data, website: e.target.value})} className="mt-1" />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase text-muted-foreground">Bemerkungen</label>
        <Input value={data.notes} onChange={e => setData({...data, notes: e.target.value})} className="mt-1" />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button onClick={() => onSave(data)} disabled={saving || !data.name || !data.category}>Speichern</Button>
      </div>
    </div>
  )
}

export default function Partners() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const queryClient = useQueryClient()

  const { data: partners = [] } = useQuery({
    queryKey: ['partners'],
    queryFn: () => base44.entities.Partner.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Partner.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['partners'] }); setShowForm(false); setEditing(null) }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Partner.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['partners'] }); setShowForm(false); setEditing(null) }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Partner.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partners'] })
  })

  const filtered = partners.filter(p => {
    const matchSearch = !search.trim() || `${p.name} ${p.contact_person}`.toLowerCase().includes(search.toLowerCase())
    const matchCategory = filterCategory === 'all' || p.category === filterCategory
    return matchSearch && matchCategory
  })

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Partner</h1>
          <p className="text-muted-foreground mt-1">Zentrale Verwaltung aller Versicherungen, Produktpartner und externen Gesellschaften</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="w-4 h-4 mr-2" /> Neuer Partner
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{partners.length}</p>
            <p className="text-xs text-muted-foreground">Total Partner</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{partners.filter(p => p.status === 'aktiv').length}</p>
            <p className="text-xs text-muted-foreground">Aktiv</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{partners.filter(p => p.category === 'versicherung').length}</p>
            <p className="text-xs text-muted-foreground">Versicherungen</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{partners.filter(p => p.category === 'bank').length}</p>
            <p className="text-xs text-muted-foreground">Banken</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Nach Name oder Kontakt suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Kategorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Kategorien</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Partner List */}
      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Keine Partner gefunden
            </CardContent>
          </Card>
        ) : (
          filtered.map(partner => (
            <Card key={partner.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{partner.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[partner.status]}`}>
                        {partner.status}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {CATEGORY_LABELS[partner.category] || partner.category}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-muted-foreground">
                      {partner.contact_person && <div>👤 {partner.contact_person}</div>}
                      {partner.email && <div>📧 {partner.email}</div>}
                      {partner.phone && <div>☎️ {partner.phone}</div>}
                      {partner.website && <div>🌐 <a href={partner.website} target="_blank" rel="noopener" className="text-primary hover:underline">{partner.website}</a></div>}
                    </div>
                    {partner.notes && <p className="text-xs text-muted-foreground mt-2 italic">{partner.notes}</p>}
                  </div>
                  <div className="flex gap-2 ml-4 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/partner/${partner.id}`)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(partner); setShowForm(true) }}>
                          <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Partner löschen?')) deleteMutation.mutate(partner.id) }}>
                          <Trash2 className="w-4 h-4 mr-2" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Partner bearbeiten' : 'Neuer Partner'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto pr-4">
            <PartnerForm
              partner={editing}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null) }}
              saving={createMutation.isPending || updateMutation.isPending}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}