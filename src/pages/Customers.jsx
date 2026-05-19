import React, { useState, useMemo } from 'react'
import CustomerMergeDialog from '@/components/customers/CustomerMergeDialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, User, Building2, ArrowRight, Upload, Download, Users, Clock } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

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
  const [showMerge, setShowMerge] = useState(false)
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
      // Zuletzt bearbeitet zuerst — operative Priorisierung statt alphabetische Liste
      const allCustomers = await base44.entities.Customer.filter({ archived: false }, '-updated_date', 500)
      
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

  const filteredByType = filterType === 'all'
    ? filteredBySearch
    : filteredBySearch.filter(c =>
        filterType === 'business'
          ? c.customer_type === 'business'
          : c.customer_type !== 'business'
      )

  // Cockpit-Modus: NUR 10 zuletzt aktive Kunden — weitere Kunden ausschliesslich via Suche/Filter
  const isSearching = !!search.trim()
  const filtered = isSearching ? filteredByType : filteredByType.slice(0, 10)

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
            <Button variant="outline" size="sm" onClick={() => setShowMerge(true)} className="text-amber-700 border-amber-300 hover:bg-amber-50">
              <Users className="w-4 h-4 mr-1.5" /> Kunden zusammenführen
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

      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={User}
            title="Keine Kunden gefunden"
            description={search ? 'Suche anpassen oder Filter zurücksetzen.' : 'Noch keine Kunden erfasst.'}
          />
        ) : (
          filtered.map((customer, idx) => {
            const familyMembers = getFamilyMembers(customer.id)
            const isExpanded = expandedFamily === customer.id || autoExpanded.has(customer.id)

            return (
              <div key={customer.id} className={idx > 0 ? 'border-t border-border/60' : ''}>
                  {/* HAUPTKUNDE */}
                  <div className="px-4 py-2.5 flex items-center justify-between gap-4 bg-card hover:bg-muted/20 transition-colors">
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
                          <p className="font-semibold text-[14px] group-hover:text-primary">
                            {customer.customer_type === 'business'
                              ? (customer.company_name || `${customer.last_name} ${customer.first_name}`)
                              : `${customer.last_name} ${customer.first_name}`}
                          </p>
                          {customer.customer_number && (
                            <span className="text-[11px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-mono font-medium">
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
                        <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200/70 px-2.5 py-0.5 rounded-full font-medium">
                          {familyMembers.length} Familienmitgl.
                        </span>
                      )}
                      {customer.customer_type === 'business' ? (
                        <span className="badge-purple text-[11px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> Unternehmen
                        </span>
                      ) : (
                        <span className="badge-info text-[11px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                          <User className="w-3 h-3" /> Privatkunde
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => navigate(`/kunden/${customer.id}/360`)}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/[0.03] transition-all"
                    >
                      <ArrowRight className="w-3 h-3" /> 360°
                    </button>

                     <ActionMenu items={[
                       { label: 'Bearbeiten', icon: Edit, onClick: () => { setEditing(customer); setShowForm(true) } },
                       { label: 'Löschen', icon: Trash2, variant: 'destructive', separator: true, onClick: () => { if (confirm('Kunde und alle Familienmitglieder löschen?')) deleteMutation.mutate(customer.id) } },
                     ]} />
                  </div>

                  {/* FAMILIENMITGLIEDER */}
                  {isExpanded && familyMembers.length > 0 && (
                    <div className="bg-muted/20 border-t border-border/40">
                      {familyMembers.map((member, memberIdx) => (
                        <div
                          key={member.id}
                          className={`px-4 py-2 pl-14 flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors ${
                            memberIdx < familyMembers.length - 1 ? 'border-b border-border/40' : ''
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

                          <span className="badge-warning text-[11px] px-2.5 py-0.5 rounded-full font-medium flex-shrink-0">
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
              </div>
            )
          })
        )}
      </div>

      {/* Cockpit Footer — kein "Alle anzeigen" — weitere Kunden nur via Suche */}
      {!isSearching && filteredByType.length > 10 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground px-1">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>10 zuletzt aktive Kunden. Weitere Kunden via Suche oder Filter oben finden.</span>
        </div>
      )}

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

      <CustomerMergeDialog
        open={showMerge}
        onOpenChange={setShowMerge}
      />
    </div>
  )
}