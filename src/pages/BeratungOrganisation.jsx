import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Edit, Trash2, Building2, Users, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'

const ORG_TYPE_LABELS = {
  strukturvertrieb: 'Strukturvertrieb',
  broker: 'Broker',
  partner: 'Partner',
  sonstiges: 'Sonstiges',
}

const ROLE_LABELS = {
  advisor: 'Berater',
  team_lead: 'Teamleiter',
  address_broker: 'Adressvermittler',
}

function OrgForm({ org, onSave, onCancel, saving }) {
  const [form, setForm] = useState(org || { name: '', type: 'broker', status: 'active', notes: '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div>
        <Label>Name *</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} required className="mt-1" placeholder="Muster Broker AG" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Typ</Label>
          <Select value={form.type} onValueChange={v => set('type', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ORG_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="inactive">Inaktiv</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Notizen</Label>
        <Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} className="mt-1" rows={2} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Abbrechen</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Speichern...' : (org?.id ? 'Aktualisieren' : 'Erstellen')}</Button>
      </div>
    </form>
  )
}

function AdvisorForm({ advisor, organizations, onSave, onCancel, saving }) {
  const [form, setForm] = useState(advisor || { firstname: '', lastname: '', email: '', phone: '', organization_id: '', role: 'advisor', status: 'active' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <form onSubmit={e => {
      e.preventDefault()
      const org = organizations.find(o => o.id === form.organization_id)
      onSave({ ...form, organization_name: org?.name || '' })
    }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Vorname *</Label>
          <Input value={form.firstname} onChange={e => set('firstname', e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label>Nachname *</Label>
          <Input value={form.lastname} onChange={e => set('lastname', e.target.value)} required className="mt-1" />
        </div>
      </div>
      <div>
        <Label>E-Mail *</Label>
        <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required className="mt-1" />
      </div>
      <div>
        <Label>Telefon</Label>
        <Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label>Organisation *</Label>
        <Select value={form.organization_id} onValueChange={v => set('organization_id', v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Organisation wählen..." /></SelectTrigger>
          <SelectContent>
            {organizations.filter(o => o.status === 'active').map(o => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!form.organization_id && <p className="text-xs text-destructive mt-1">Jeder Berater muss einer Organisation zugewiesen sein.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Rolle</Label>
          <Select value={form.role} onValueChange={v => set('role', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="advisor">Berater</SelectItem>
              <SelectItem value="team_lead">Teamleiter</SelectItem>
              <SelectItem value="address_broker">Adressvermittler</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="inactive">Inaktiv</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Abbrechen</Button>
        <Button type="submit" disabled={saving || !form.organization_id}>{saving ? 'Speichern...' : (advisor?.id ? 'Aktualisieren' : 'Erstellen')}</Button>
      </div>
    </form>
  )
}

export default function BeratungOrganisation() {
  const [tab, setTab] = useState('orgs') // 'orgs' | 'advisors'
  const [filterOrg, setFilterOrg] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [expandedOrg, setExpandedOrg] = useState(null)
  const [editingOrg, setEditingOrg] = useState(null)
  const [editingAdvisor, setEditingAdvisor] = useState(null)
  const [showOrgForm, setShowOrgForm] = useState(false)
  const [showAdvisorForm, setShowAdvisorForm] = useState(false)
  const qc = useQueryClient()

  const { data: orgs = [] } = useQuery({ queryKey: ['organizations'], queryFn: () => base44.entities.Organization.list('-created_date') })
  const { data: advisors = [] } = useQuery({ queryKey: ['advisors'], queryFn: () => base44.entities.Advisor.list('-created_date') })

  const createOrg = useMutation({ mutationFn: d => base44.entities.Organization.create(d), onSuccess: () => { qc.invalidateQueries(['organizations']); setShowOrgForm(false) } })
  const updateOrg = useMutation({ mutationFn: ({ id, data }) => base44.entities.Organization.update(id, data), onSuccess: () => { qc.invalidateQueries(['organizations']); setShowOrgForm(false); setEditingOrg(null) } })
  const deleteOrg = useMutation({ mutationFn: id => base44.entities.Organization.delete(id), onSuccess: () => qc.invalidateQueries(['organizations']) })

  const createAdvisor = useMutation({ mutationFn: d => base44.entities.Advisor.create(d), onSuccess: () => { qc.invalidateQueries(['advisors']); setShowAdvisorForm(false) } })
  const updateAdvisor = useMutation({ mutationFn: ({ id, data }) => base44.entities.Advisor.update(id, data), onSuccess: () => { qc.invalidateQueries(['advisors']); setShowAdvisorForm(false); setEditingAdvisor(null) } })
  const deleteAdvisor = useMutation({ mutationFn: id => base44.entities.Advisor.delete(id), onSuccess: () => qc.invalidateQueries(['advisors']) })

  const filteredAdvisors = advisors.filter(a => {
    if (filterOrg !== 'all' && a.organization_id !== filterOrg) return false
    if (filterRole !== 'all' && a.role !== filterRole) return false
    return true
  })

  const getAdvisorsForOrg = (orgId) => advisors.filter(a => a.organization_id === orgId)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Building2 className="w-7 h-7 text-primary" /> Berater & Organisation</h1>
          <p className="text-muted-foreground mt-1">{orgs.length} Organisationen · {advisors.length} Berater</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setEditingOrg(null); setShowOrgForm(true) }}>
            <Plus className="w-4 h-4 mr-2" /> Organisation
          </Button>
          <Button onClick={() => { setEditingAdvisor(null); setShowAdvisorForm(true) }}>
            <Plus className="w-4 h-4 mr-2" /> Berater
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        {[{ key: 'orgs', label: 'Organisationen', icon: Building2 }, { key: 'advisors', label: 'Berater', icon: Users }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ORGANISATIONEN TAB */}
      {tab === 'orgs' && (
        <div className="space-y-3">
          {orgs.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Keine Organisationen vorhanden</CardContent></Card>
          ) : orgs.map(org => {
            const orgAdvisors = getAdvisorsForOrg(org.id)
            const isExpanded = expandedOrg === org.id
            return (
              <Card key={org.id} className="overflow-hidden">
                <div className={`p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors ${isExpanded ? 'border-b' : ''}`}
                  onClick={() => setExpandedOrg(isExpanded ? null : org.id)}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    <div>
                      <p className="font-semibold">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{ORG_TYPE_LABELS[org.type] || org.type} · {orgAdvisors.length} Berater</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${org.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {org.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={e => { e.stopPropagation(); setEditingOrg(org); setShowOrgForm(true) }}>
                          <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); if (confirm('Organisation löschen?')) deleteOrg.mutate(org.id) }}>
                          <Trash2 className="w-4 h-4 mr-2" /> Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {isExpanded && (
                  <div className="bg-slate-50/50 divide-y">
                    {orgAdvisors.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground pl-11">Keine Berater in dieser Organisation</p>
                    ) : orgAdvisors.map(a => (
                      <div key={a.id} className="p-3 pl-11 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium">{a.firstname} {a.lastname}</p>
                          <p className="text-xs text-muted-foreground">{a.email} · {ROLE_LABELS[a.role]}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.role === 'team_lead' ? 'bg-purple-100 text-purple-700' : a.role === 'address_broker' ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                            {ROLE_LABELS[a.role]}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3 h-3" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingAdvisor(a); setShowAdvisorForm(true) }}><Edit className="w-4 h-4 mr-2" /> Bearbeiten</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Berater löschen?')) deleteAdvisor.mutate(a.id) }}><Trash2 className="w-4 h-4 mr-2" /> Löschen</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* BERATER TAB */}
      {tab === 'advisors' && (
        <div>
          {/* Filter */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <Select value={filterOrg} onValueChange={setFilterOrg}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Alle Organisationen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Organisationen</SelectItem>
                {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              {[{ key: 'all', label: 'Alle Rollen' }, { key: 'team_lead', label: 'Teamleiter' }, { key: 'advisor', label: 'Berater' }, { key: 'address_broker', label: 'Adressvermittler' }].map(f => (
                <button key={f.key} onClick={() => setFilterRole(f.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterRole === f.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredAdvisors.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Keine Berater gefunden</CardContent></Card>
            ) : filteredAdvisors.map(a => {
              const org = orgs.find(o => o.id === a.organization_id)
              return (
                <Card key={a.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{a.firstname} {a.lastname}</p>
                      <p className="text-xs text-muted-foreground">{a.email}{a.phone ? ` · ${a.phone}` : ''}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{org?.name || '–'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${a.role === 'team_lead' ? 'bg-purple-100 text-purple-700' : a.role === 'address_broker' ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                        {ROLE_LABELS[a.role]}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {a.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingAdvisor(a); setShowAdvisorForm(true) }}><Edit className="w-4 h-4 mr-2" /> Bearbeiten</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Berater löschen?')) deleteAdvisor.mutate(a.id) }}><Trash2 className="w-4 h-4 mr-2" /> Löschen</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ORGANISATION FORM DIALOG */}
      <Dialog open={showOrgForm} onOpenChange={v => { setShowOrgForm(v); if (!v) setEditingOrg(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingOrg ? 'Organisation bearbeiten' : 'Neue Organisation'}</DialogTitle></DialogHeader>
          <OrgForm
            org={editingOrg}
            saving={createOrg.isPending || updateOrg.isPending}
            onCancel={() => { setShowOrgForm(false); setEditingOrg(null) }}
            onSave={data => editingOrg ? updateOrg.mutate({ id: editingOrg.id, data }) : createOrg.mutate(data)}
          />
        </DialogContent>
      </Dialog>

      {/* BERATER FORM DIALOG */}
      <Dialog open={showAdvisorForm} onOpenChange={v => { setShowAdvisorForm(v); if (!v) setEditingAdvisor(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingAdvisor ? 'Berater bearbeiten' : 'Neuer Berater'}</DialogTitle></DialogHeader>
          <AdvisorForm
            advisor={editingAdvisor}
            organizations={orgs}
            saving={createAdvisor.isPending || updateAdvisor.isPending}
            onCancel={() => { setShowAdvisorForm(false); setEditingAdvisor(null) }}
            onSave={data => editingAdvisor ? updateAdvisor.mutate({ id: editingAdvisor.id, data }) : createAdvisor.mutate(data)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}