import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { base44 } from '@/api/base44Client'
import { Plus, Search, MoreHorizontal, Edit, Trash2, ChevronDown, ChevronUp, User, Building2, ArrowRight, Upload, Download } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import CustomerForm from '../components/customers/CustomerForm'
import CompanyForm from '../components/customers/CompanyForm'
import EmailLink from '../components/common/EmailLink'
import { STATUS_LABELS, FAMILY_ROLE_LABELS, label } from '@/lib/labels'
import { searchCustomers } from '@/lib/customerSearch'

export default function Customers() {
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [newCustomerType, setNewCustomerType] = useState('private')
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedFamily, setExpandedFamily] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importProgress, setImportProgress] = useState(null)
  const queryClient = useQueryClient()

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const allCustomers = await base44.entities.Customer.list('-created_date')
      
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

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    
    setImportProgress('Funktion wird in Kürze aktiviert...')
    setTimeout(() => {
      setShowImport(false)
      setImportFile(null)
      setImportProgress(null)
    }, 2000)
  }

  const handleExport = () => {
    if (filtered.length === 0) return
    const headers = ['ID', 'Vorname', 'Nachname', 'Email', 'Telefon', 'Stadt', 'Kanton', 'Status']
    const rows = filtered.map(c => [
      c.id,
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Kunden</h1>
          <p className="text-muted-foreground mt-1">{primaryCustomers.length} Hauptkunden</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Exportieren
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" /> Importieren
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Neuer Kunde
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
        </div>
      </div>

      {/* Kundentyp Filter */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: 'Alle' },
          { key: 'private', label: 'Privatkunden' },
          { key: 'business', label: 'Unternehmen' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterType(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filterType === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
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

      <div className="space-y-6">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Keine Kunden gefunden
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
                        <p className="font-bold text-base group-hover:text-primary">
                          {customer.customer_type === 'business'
                            ? (customer.company_name || `${customer.first_name} ${customer.last_name}`)
                            : `${customer.first_name} ${customer.last_name}`}
                        </p>
                        {customer.customer_type === 'business' && (customer.contact_person_firstname || customer.contact_person_lastname) && (
                          <p className="text-xs text-muted-foreground">
                            Kontakt: {customer.contact_person_firstname} {customer.contact_person_lastname}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground"><EmailLink email={customer.email} /> • {customer.city || '–'}</p>
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
                       <ArrowRight className="w-4 h-4" /> 360
                     </Button>

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
                            <p className="font-medium text-sm group-hover:text-primary">{member.first_name} {member.last_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {label(FAMILY_ROLE_LABELS, member.family_role)} • <EmailLink email={member.email} />
                            </p>
                          </Link>

                          <div className="hidden md:flex text-sm text-muted-foreground flex-shrink-0">
                            {member.city || '–'}
                          </div>

                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-medium flex-shrink-0">
                            Familienmitglied
                          </span>

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

      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kunden importieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">CSV- oder Excel-Datei</label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0])}
                className="mt-2 w-full p-2 border rounded"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Unterstützte Formate: CSV, Excel | Spalten: first_name, last_name, email, phone (optional), city (optional)
              </p>
            </div>
            {importProgress && (
              <div className="p-3 bg-muted rounded text-sm text-center">
                {importProgress}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowImport(false); setImportFile(null); setImportProgress(null); }}>
                Abbrechen
              </Button>
              <Button onClick={handleImport} disabled={!importFile || !!importProgress}>
                Importieren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}