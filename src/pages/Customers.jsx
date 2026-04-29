import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Search, MoreHorizontal, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CustomerForm from '../components/customers/CustomerForm'
import { STATUS_LABELS, FAMILY_ROLE_LABELS, label } from '@/lib/labels'
import { searchCustomers } from '@/lib/customerSearch'

export default function Customers() {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [expandedFamily, setExpandedFamily] = useState(null)
  const queryClient = useQueryClient()

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date'),
  })

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setShowForm(false)
      setEditing(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setShowForm(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })

  const primaryCustomers = customers.filter(c => !c.is_family_member)

  // Search also checks family members and bubbles up matched primary customers
  const familyMatchIds = search.trim()
    ? new Set(
        searchCustomers(customers.filter(c => c.is_family_member), search)
          .map(m => m.primary_customer_id)
      )
    : new Set()

  const matchedPrimary = searchCustomers(primaryCustomers, search)
  const filteredIds = new Set(matchedPrimary.map(c => c.id))
  familyMatchIds.forEach(id => filteredIds.add(id))

  const filtered = search.trim()
    ? primaryCustomers.filter(c => filteredIds.has(c.id))
    : primaryCustomers

  const getFamilyMembers = (primaryId) => customers.filter(c => c.primary_customer_id === primaryId)

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
          <h1 className="text-3xl font-bold">Kunden</h1>
          <p className="text-muted-foreground mt-1">{primaryCustomers.length} Hauptkunden</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Neuer Kunde
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Name, E-Mail, Stadt, Beruf... (Fuzzy-Suche)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Keine Kunden gefunden
              </div>
            ) : (
              filtered.map(customer => {
                const familyMembers = getFamilyMembers(customer.id)
                const isExpanded = expandedFamily === customer.id

                return (
                  <div key={customer.id}>
                    <div className="border-b border-border last:border-0 hover:bg-muted/50">
                      <div className="p-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          {familyMembers.length > 0 && (
                            <button
                              onClick={() => setExpandedFamily(isExpanded ? null : customer.id)}
                              className="flex-shrink-0 p-1"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                          <Link to={`/kunden/${customer.id}`} className="flex-1 min-w-0 hover:text-primary">
                            <p className="font-medium">{customer.first_name} {customer.last_name}</p>
                            <p className="text-xs text-muted-foreground">{customer.email}</p>
                          </Link>
                        </div>

                        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
                          <span>{customer.city}</span>
                        </div>

                        {familyMembers.length > 0 && (
                          <div className="hidden lg:flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded flex-shrink-0">
                            {familyMembers.length} Familienmitglieder
                          </div>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditing(customer); setShowForm(true); }}>
                              <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (confirm('Kunde und alle Familienmitglieder löschen?')) {
                                  deleteMutation.mutate(customer.id)
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Family Members */}
                      {isExpanded && familyMembers.length > 0 && (
                        <div className="bg-slate-50 border-t border-border">
                          {familyMembers.map(member => (
                            <div key={member.id} className="p-4 pl-12 border-b border-border last:border-0 flex items-center justify-between gap-4 hover:bg-slate-100">
                              <Link to={`/kunden/${member.id}`} className="flex-1 min-w-0 hover:text-primary">
                                <p className="font-medium text-sm">{member.first_name} {member.last_name}</p>
                                <p className="text-xs text-muted-foreground">{label(FAMILY_ROLE_LABELS, member.family_role)}</p>
                              </Link>

                              <div className="hidden md:flex text-sm text-muted-foreground flex-shrink-0">
                                {member.city}
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setEditing(member); setShowForm(true); }}>
                                    <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => {
                                      if (confirm('Familienmitglied löschen?')) {
                                        deleteMutation.mutate(member.id)
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Löschen
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? (editing.is_family_member ? 'Familienmitglied bearbeiten' : 'Kunde bearbeiten') : 'Neuer Kunde'}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={editing}
            primaryCustomers={primaryCustomers}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            saving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}