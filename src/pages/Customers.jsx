import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Plus, Search, Filter, MoreHorizontal, Trash2, Edit, Eye, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import CustomerForm from '../components/customers/CustomerForm';
import FamilyMembersSection from '../components/customers/FamilyMembersSection';

export default function Customers() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showFamilyMembers, setShowFamilyMembers] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('deleteCustomerWithContracts', { customer_id: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });

  // Erweitere Kundenliste um Familienmitglieder als separate Einträge
  const expandedCustomers = customers.flatMap(c => {
    const entries = [{ ...c, isMainCustomer: true, parentId: null }];
    if (c.family_members && c.family_members.length > 0) {
      c.family_members.forEach(fm => {
        entries.push({
          id: `${c.id}-${fm.id}`,
          customer_id: c.id,
          family_member_id: fm.id,
          first_name: fm.first_name,
          last_name: fm.last_name,
          email: fm.email || c.email,
          phone: c.phone,
          mobile: c.mobile,
          street: c.street,
          zip_code: c.zip_code,
          city: c.city,
          canton: c.canton,
          status: c.status,
          customer_type: c.customer_type,
          company_name: null,
          isFamilyMember: true,
          parentId: c.id,
          parentName: `${c.first_name} ${c.last_name}`,
          relationship: fm.relationship,
        });
      });
    }
    return entries;
  });

  const filtered = expandedCustomers.filter(c => {
    const matchSearch = `${c.first_name} ${c.last_name} ${c.email} ${c.parentName || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleSave = (data) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div>
      <PageHeader title="Kunden" subtitle={`${customers.length} Kunden insgesamt`}>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Neuer Kunde
        </Button>
      </PageHeader>

      {/* Family Members Dialog */}
      <Dialog open={showFamilyMembers} onOpenChange={setShowFamilyMembers}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Familienmitglieder verwalten</DialogTitle>
          </DialogHeader>
          {editingCustomerId && (
            <FamilyMembersSection
              customerId={editingCustomerId}
              familyMembers={customers.find(c => c.id === editingCustomerId)?.family_members || []}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="aktiv">Aktiv</SelectItem>
            <SelectItem value="inaktiv">Inaktiv</SelectItem>
            <SelectItem value="interessent">Interessent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">E-Mail</TableHead>
                <TableHead className="hidden md:table-cell">Ort</TableHead>
                <TableHead className="hidden lg:table-cell">Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Keine Kunden gefunden</TableCell></TableRow>
              ) : filtered.map(customer => (
                <TableRow key={customer.id} className={`cursor-pointer hover:bg-muted/50 ${customer.isFamilyMember ? 'bg-slate-50' : ''}`}>
                  <TableCell>
                    <div className={customer.isFamilyMember ? 'pl-4' : ''}>
                      {customer.isMainCustomer ? (
                        <Link to={`/kunden/${customer.id}`} className="font-medium text-foreground hover:text-primary">
                          {customer.first_name} {customer.last_name}
                        </Link>
                      ) : (
                        <Link to={`/kunden/${customer.customer_id}`} className="font-medium text-foreground hover:text-primary">
                          {customer.first_name} {customer.last_name}
                        </Link>
                      )}
                      {customer.company_name && <p className="text-xs text-muted-foreground">{customer.company_name}</p>}
                      {customer.isFamilyMember && (
                        <p className="text-xs text-muted-foreground">→ {customer.parentName}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{customer.email}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{customer.zip_code} {customer.city}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {customer.customer_type === 'geschaeft' ? 'Geschäft' : 'Privat'}
                  </TableCell>
                  <TableCell><StatusBadge status={customer.status} /></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/kunden/${customer.isMainCustomer ? customer.id : customer.customer_id}`}><Eye className="w-4 h-4 mr-2" /> Anzeigen</Link>
                        </DropdownMenuItem>
                        {customer.isMainCustomer && (
                          <>
                            <DropdownMenuItem onClick={() => { setEditing(customer); setShowForm(true); }}>
                              <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                            </DropdownMenuItem>
                            {customer.customer_type === 'privat' && (
                              <DropdownMenuItem onClick={() => { setEditingCustomerId(customer.id); setShowFamilyMembers(true); }}>
                                <Users className="w-4 h-4 mr-2" /> Familie
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              className="text-destructive" 
                              onClick={() => {
                                if (confirm('Kunde und alle zugehörigen Verträge löschen?')) {
                                  deleteMutation.mutate(customer.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Löschen
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Kunde bearbeiten' : 'Neuer Kunde'}</DialogTitle>
          </DialogHeader>
          <CustomerForm
            customer={editing}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            saving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}