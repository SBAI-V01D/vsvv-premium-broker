import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, User, Building2, ArrowRight, Upload, Download } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
// DropdownMenu retained for "Neuer Kunde" type selector
import CustomerForm from '../components/customers/CustomerForm'
import CompanyForm from '../components/customers/CompanyForm'
import FastImportWizard from '../components/customers/FastImportWizard'
import { FAMILY_ROLE_LABELS, label } from '@/lib/labels'
import { searchCustomers } from '@/lib/customerSearch'
import PageHeader from '@/components/shared/PageHeader'
import FilterBar from '@/components/shared/FilterBar'
import EmptyState from '@/components/shared/EmptyState'
import ActionMenu from '@/components/shared/ActionMenu'

export default function Customers() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [newCustomerType, setNewCustomerType] = useState('private')
  const [filterType, setFilterType] = useState('private')
  const [search, setSearch] = useState('')
  const [expandedFamily, setExpandedFamily] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const queryClient = useQueryClient()

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  })

  const { data: organizations = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list('-created_date', 50),
    staleTime: 10 * 60 * 1000,
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const allCustomers = await base44.entities.Customer.filter({ archived: false }, '-created_date', 500)
      allCustomers.sort((a, b) => {
        const lastCmp = (a.last_name || '').localeCompare(b.last_name || '', 'de', { sensitivity: 'base' })
        if (lastCmp !== 0) return lastCmp
        return (a.first_name || '').localeCompare(b.first_name || '', 'de', { sensitivity: 'base' })
      })
      
      // Role-based filtering
      if (currentUser?.role === 'admin') {
        // Admin sees all
        return allCustomers
      } else if (currentUser?.role === 'advisor') {
        // Advisor sees only assigned customers
        return allCustomers.filter(c => c.advisor_id === currentUser.id)
      } else {
        // Customer (shouldn't normally access this page)
        return []
      }
    },
    enabled: !!currentUser,
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

  // IDs of family members that directly match the search
  const matchedFamilyMembers = search.trim()
    ? searchCustomers(customers.filter(c => c.is_family_member), search)
    : []
  const familyMatchParentIds = new Set(matchedFamilyMembers.map(m => m.primary_customer_id))

  // Primary customers that directly match
  const matchedPrimary = search.trim() ? searchCustomers(primaryCustomers, search) : primaryCustomers
  const matchedPrimaryIds = new Set(matchedPrimary.map(c => c.id))

  // All IDs to show (direct + via family)
  const filteredIds = new Set([...matchedPrimaryIds, ...familyMatchParentIds])

  // Sort: direct primary matches first, then family-only matches
  const filteredBySearch = search.trim()
    ? [
        ...matchedPrimary.filter(c => filteredIds.has(c.id)),
        ...primaryCustomers.filter(c => familyMatchParentIds.has(c.id) && !matchedPrimaryIds.has(c.id)),
      ]
    : primaryCustomers

  const filtered = filterType === 'all'
    ? filteredBySearch
    : filteredBySearch.filter(c =>
        filterType === 'business'
          ? c.customer_type === 'business'
          : c.customer_type !== 'business'
      )

  // When searching, auto-expand families that have a matched member
  const autoExpanded = search.trim() ? familyMatchParentIds : new Set()

  const getFamilyMembers = (primaryId) => customers.filter(c => c.primary_customer_id === primaryId)

  const handleSave = async (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      // Auto-assign organization_id if not set (required field)
      const orgId = data.organization_id || organizations[0]?.id || ''
      
      // Auto-generate customer_number if not set
      let customerData = { ...data, organization_id: orgId }
      if (!customerData.customer_number) {
        try {
          const result = await base44.functions.invoke('generateCustomerNumber', {})
          if (result?.data?.customer_number) {
            customerData.customer_number = result.data.customer_number
          }
        } catch (error) {
          console.error('Error generating customer number:', error)
          // Fallback: continue without auto-generated number
        }
      }
      
      createMutation.mutate(customerData)
    }
  }



  const handleExport = () => {
    if (filtered.length === 0) return
    const headers = ['Kundennummer', 'Vorname', 'Nachname', 'Email', 'Telefon', 'Stadt', 'Kanton', 'Status']
    const rows = filtered.map(c => [
      c.customer_number || '',
      c.first_name,
      c.last_name,
      c.email,
      c.phone || '',
      c.city || '',
      c.canton || '',
      c.status
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `kunden_export_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  const privateCount = primaryCustomers.filter(c => c.customer_type !== 'business').length
  const businessCount = primaryCustomers.filter(c => c.customer_type === 'business').length

  return (
    <div>
      <PageHeader
        title="Kunden"
        subtitle={`${primaryCustomers.length} Hauptkunden`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1.5" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4 mr-1.5" /> Import
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1.5" /> Neuer Kunde
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditing(null); setNewCustomerType('private'); setShowForm(true); }}>
                  <User className="w-4 h-4 mr-2 text-blue-600" /> Privatkunde
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setEditing(null); setNewCustomerType('business'); setShowForm(true); }}>
                  <Building2 className="w-4 h-4 mr-2 text-purple-600" /> Firmenkunde
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Name, E-Mail, Stadt, Kundennummer... (Fuzzy-Suche)"
        filters={[
          { key: 'all', label: 'Alle', count: primaryCustomers.length },
          { key: 'private', label: 'Privatkunden', count: privateCount },
          { key: 'business', label: 'Unternehmen', count: businessCount },
        ]}
        activeFilter={filterType}
        onFilterChange={setFilterType}
      />

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={User}
                title="Keine Kunden gefunden"
                description={search ? 'Suche anpassen oder Filter zurücksetzen.' : 'Noch keine Kunden erfasst.'}
              />
            </CardContent>
          </Card>
        ) : (
          filtered.map((customer, idx) => {
            const familyMembers = getFamilyMembers(customer.id)
            const isExpanded = expandedFamily === customer.id || autoExpanded.has(customer.id)

            return (
              <Card key={customer.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* HAUPTKUNDE */}
                  <div className="bg-gradient-to-r from-primary/5 to-transparent p-4 flex items-center justify-between gap-4 border-b-2 border-primary/20">
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      {familyMembers.length > 0 && (
                        <button
                          onClick={() => setExpandedFamily(isExpanded ? null : customer.id)}
                          className="flex-shrink-0 p-1 hover:bg-primary/10 rounded transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-primary" /> : <ChevronDown className="w-5 h-5 text-primary" />}
                        </button>
                      )}
                      <Link to={`/kunden/${customer.id}`} className="flex-1 min-w-0 hover:text-primary group">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-base group-hover:text-primary">
                            {customer.customer_type === 'business'
                              ? (customer.company_name || `${customer.last_name} ${customer.first_name}`)
                              : `${customer.last_name} ${customer.first_name}`}
                          </p>
                          {customer.customer_number && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-mono font-medium">
                              {customer.customer_number}
                            </span>
                          )}
                        </div>
                        {customer.customer_type === 'business' && (customer.contact_person_firstname || customer.contact_person_lastname) && (
                          <p className="text-xs text-muted-foreground">
                            Kontakt: {customer.contact_person_firstname} {customer.contact_person_lastname}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">{customer.email} • {customer.city || '–'}</p>
                      </Link>
                    </div>

                    <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
                      {familyMembers.length > 0 && (
                        <span className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-full font-medium">
                          {familyMembers.length} Familienmitglieder
                        </span>
                      )}
                      {customer.customer_type === 'business' ? (
                        <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> Unternehmen
                        </span>
                      ) : (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                          <User className="w-3 h-3" /> Privatkunde
                        </span>
                      )}
                    </div>

                    <Button
                       size="sm"
                       variant="outline"
                       onClick={() => navigate(`/kunden/${customer.id}/360`)}
                       className="flex-shrink-0"
                     >
                       <ArrowRight className="w-4 h-4 mr-1" /> 360
                     </Button>

                     <ActionMenu items={[
                       { label: 'Bearbeiten', icon: Edit, onClick: () => { setEditing(customer); setShowForm(true) } },
                       { label: 'Löschen', icon: Trash2, variant: 'destructive', separator: true, onClick: () => { if (confirm('Kunde und alle Familienmitglieder löschen?')) deleteMutation.mutate(customer.id) } },
                     ]} />
                  </div>

                  {/* FAMILIENMITGLIEDER */}
                  {isExpanded && familyMembers.length > 0 && (
                    <div className="bg-slate-50/50">
                      {familyMembers.map((member, memberIdx) => (
                        <div
                          key={member.id}
                          className={`p-4 pl-14 flex items-center justify-between gap-4 hover:bg-slate-100/80 transition-colors ${
                            memberIdx < familyMembers.length - 1 ? 'border-b border-border' : ''
                          }`}
                        >
                          <Link to={`/kunden/${member.id}`} className="flex-1 min-w-0 hover:text-primary group">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm group-hover:text-primary">{member.last_name} {member.first_name}</p>
                              {member.customer_number && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-mono font-medium">
                                  {member.customer_number}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {label(FAMILY_ROLE_LABELS, member.family_role)} • {member.email}
                            </p>
                          </Link>

                          <div className="hidden md:flex text-sm text-muted-foreground flex-shrink-0">
                            {member.city || '–'}
                          </div>

                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-medium flex-shrink-0">
                            Familienmitglied
                          </span>

                          <ActionMenu items={[
                            { label: 'Bearbeiten', icon: Edit, onClick: () => { setEditing(member); setShowForm(true) } },
                            { label: 'Löschen', icon: Trash2, variant: 'destructive', separator: true, onClick: () => { if (confirm('Familienmitglied löschen?')) deleteMutation.mutate(member.id) } },
                          ]} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? (editing.is_family_member ? 'Familienmitglied bearbeiten' : (editing.customer_type === 'business' ? 'Unternehmen bearbeiten' : 'Privatkunde bearbeiten'))
                : newCustomerType === 'business' ? 'Neuer Firmenkunde' : 'Neuer Privatkunde'}
            </DialogTitle>
          </DialogHeader>

          {/* Striktes Formular je nach Kundentyp – kein Mischen */}
          {(editing?.customer_type === 'business' || (!editing && newCustomerType === 'business')) ? (
            <CompanyForm
              customer={editing}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null); }}
              saving={createMutation.isPending || updateMutation.isPending}
            />
          ) : (
            <CustomerForm
              customer={editing || { customer_type: 'private' }}
              primaryCustomers={primaryCustomers}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditing(null); }}
              saving={createMutation.isPending || updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <FastImportWizard 
        open={showImport} 
        onOpenChange={setShowImport}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['customers'] })
          setSearch('')
          setFilterType('all')
        }}
      />
    </div>
  )
}