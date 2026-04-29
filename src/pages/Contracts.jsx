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
import ContractForm from '../components/contracts/ContractForm'
import ContractDocumentsPanel from '../components/contracts/ContractDocumentsPanel'
import { INSURANCE_TYPE_LABELS, label } from '@/lib/labels'
import StatusBadge from '@/components/status/StatusBadge'
import StatusChangeDialog from '@/components/status/StatusChangeDialog'

export default function Contracts() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [statusChanging, setStatusChanging] = useState(null)
  const queryClient = useQueryClient()

  const { data: statusDefs = [] } = useQuery({
    queryKey: ['statusDefinitions'],
    queryFn: () => base44.entities.StatusDefinition.filter({ type: 'contract' }),
  })

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => base44.entities.Contract.list('-created_date'),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contract.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      setShowForm(false)
      setEditing(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      setShowForm(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contract.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  })

  const filtered = contracts.filter(c =>
    `${c.customer_name} ${c.insurer} ${c.policy_number}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleStatusChange = async ({ status, statusDef, note, metadata }) => {
    const contract = statusChanging
    await base44.entities.StatusHistory.create({
      entity_type: 'contract',
      entity_id: contract.id,
      customer_id: contract.customer_id,
      from_status: contract.custom_status || contract.status,
      to_status: status,
      to_status_label: statusDef?.label || status,
      note,
      metadata: JSON.stringify(metadata),
    })
    await base44.entities.Contract.update(contract.id, { custom_status: status })
    queryClient.invalidateQueries({ queryKey: ['contracts'] })
    setStatusChanging(null)
  }

  const getStatusDef = (contract) => {
    const key = contract.custom_status || contract.status
    return statusDefs.find(s => s.key === key)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Verträge</h1>
          <p className="text-muted-foreground mt-1">{contracts.length} Verträge insgesamt</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Neuer Vertrag
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Verträge suchen..."
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
                <TableHead className="hidden lg:table-cell">Policen-Nr</TableHead>
                <TableHead className="hidden lg:table-cell">Beginn</TableHead>
                <TableHead className="hidden lg:table-cell">Ende</TableHead>
                <TableHead>Prämie/J.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Keine Verträge gefunden
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(contract => (
                  <TableRow key={contract.id} className="hover:bg-muted/50 align-top">
                    <TableCell className="font-medium">
                      <div>{contract.customer_name}</div>
                      <ContractDocumentsPanel contract={contract} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{contract.insurer}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{contract.policy_number || '–'}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {contract.start_date ? new Date(contract.start_date).toLocaleDateString('de-CH') : '–'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {contract.end_date ? new Date(contract.end_date).toLocaleDateString('de-CH') : '–'}
                    </TableCell>
                    <TableCell className="font-medium">
                      CHF {contract.premium_yearly?.toLocaleString('de-CH', { minimumFractionDigits: 0 }) || '–'}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => setStatusChanging(contract)} className="hover:opacity-80 transition-opacity">
                        <StatusBadge statusDef={getStatusDef(contract)} label={getStatusDef(contract)?.label || contract.status} />
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
                          <DropdownMenuItem onClick={() => setStatusChanging(contract)}>
                            Status ändern
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(contract); setShowForm(true); }}>
                            <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm('Vertrag wirklich löschen?')) {
                                deleteMutation.mutate(contract.id)
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
        title="Vertragsstatus ändern"
      />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Vertrag bearbeiten' : 'Neuer Vertrag'}</DialogTitle>
          </DialogHeader>
          <ContractForm
            contract={editing}
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