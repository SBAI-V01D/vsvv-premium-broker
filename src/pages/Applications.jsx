import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Search, MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import ApplicationForm from '../components/applications/ApplicationForm'
import { INSURANCE_TYPE_LABELS, label } from '@/lib/labels'
import StatusBadge from '@/components/status/StatusBadge'
import StatusChangeDialog from '@/components/status/StatusChangeDialog'

export default function Applications() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [statusChanging, setStatusChanging] = useState(null)
  const queryClient = useQueryClient()

  const { data: statusDefs = [] } = useQuery({
    queryKey: ['statusDefinitions'],
    queryFn: () => base44.entities.StatusDefinition.filter({ type: 'application' }),
  })

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => base44.entities.Application.list('-created_date'),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Application.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setShowForm(false)
      setEditing(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Application.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setShowForm(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Application.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  })

  const filtered = applications.filter(a =>
    `${a.customer_name} ${a.insurer} ${a.insurance_type}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleStatusChange = async ({ status, statusDef, note, metadata }) => {
    const app = statusChanging
    await base44.entities.StatusHistory.create({
      entity_type: 'application',
      entity_id: app.id,
      customer_id: app.customer_id,
      from_status: app.custom_status || app.status,
      to_status: status,
      to_status_label: statusDef?.label || status,
      note,
      metadata: JSON.stringify(metadata),
    })
    await base44.entities.Application.update(app.id, { ...app, custom_status: status })
    queryClient.invalidateQueries({ queryKey: ['applications'] })
    setStatusChanging(null)
  }

  const getStatusDef = (app) => {
    const key = app.custom_status || app.status
    return statusDefs.find(s => s.key === key)
  }
  const getStatusLabel = (app) => {
    const def = getStatusDef(app)
    return def?.label || app.status
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Versicherungsanträge</h1>
          <p className="text-muted-foreground mt-1">{applications.length} Anträge insgesamt</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Neuer Antrag
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Anträge suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead className="hidden md:table-cell">Versicherer</TableHead>
                <TableHead className="hidden lg:table-cell">Typ</TableHead>
                <TableHead>Prämie/J.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Keine Anträge gefunden
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(app => (
                  <TableRow key={app.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{app.customer_name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{app.insurer}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{label(INSURANCE_TYPE_LABELS, app.insurance_type)}</TableCell>
                    <TableCell className="font-medium">
                      CHF {app.estimated_premium_yearly?.toLocaleString('de-CH', { minimumFractionDigits: 0 }) || '–'}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => setStatusChanging(app)} className="hover:opacity-80 transition-opacity">
                        <StatusBadge statusDef={getStatusDef(app)} label={getStatusLabel(app)} />
                      </button>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setStatusChanging(app)}>
                            Status ändern
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(app); setShowForm(true); }}>
                            <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm('Antrag wirklich löschen?')) {
                                deleteMutation.mutate(app.id)
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <StatusChangeDialog
        open={!!statusChanging}
        onOpenChange={(open) => { if (!open) setStatusChanging(null) }}
        statusDefinitions={statusDefs}
        currentStatus={statusChanging?.custom_status || statusChanging?.status}
        onSave={handleStatusChange}
        title="Antragsstatus ändern"
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Antrag bearbeiten' : 'Neuer Antrag'}</DialogTitle>
          </DialogHeader>
          <ApplicationForm
            application={editing}
            customers={customers}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            saving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}