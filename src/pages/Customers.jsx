import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Filter, MoreHorizontal, Trash2, Edit, Download } from 'lucide-react';
import jsPDF from 'jspdf';
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

export default function Customers() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Customer.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });

  const filtered = customers.filter(c => {
    const matchSearch = `${c.first_name} ${c.last_name} ${c.email} ${c.company_name || ''}`.toLowerCase().includes(search.toLowerCase());
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

  const exportPDF = (customer) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Titel
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Kundenübersicht', margin, yPos);
    yPos += 12;

    // Hauptdaten
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Hauptkontakt', margin, yPos);
    yPos += 8;

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    const mainData = [
      [`Name:`, `${customer.first_name} ${customer.last_name}`],
      [`E-Mail:`, customer.email],
      [`Telefon:`, customer.phone || '–'],
      [`Mobil:`, customer.mobile || '–'],
      [`Adresse:`, `${customer.street || '–'}, ${customer.zip_code || '–'} ${customer.city || '–'}`],
      [`Kanton:`, customer.canton || '–'],
      [`Geburtsdatum:`, customer.birthdate || '–'],
      [`AHV-Nummer:`, customer.ahv_number || '–'],
      [`Typ:`, customer.customer_type === 'geschaeft' ? 'Geschäft' : 'Privat'],
      [`Status:`, customer.status],
      [`Tags:`, customer.tags || '–'],
    ];

    mainData.forEach(([label, value]) => {
      doc.text(`${label} ${value}`, margin + 2, yPos);
      yPos += 6;
    });

    // Familienmitglieder
    if (customer.family_members && customer.family_members.length > 0) {
      yPos += 8;
      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = margin;
      }

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Familienmitglieder', margin, yPos);
      yPos += 8;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);

      customer.family_members.forEach((fm, idx) => {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFont(undefined, 'bold');
        doc.text(`${idx + 1}. ${fm.first_name} ${fm.last_name}`, margin, yPos);
        yPos += 6;

        doc.setFont(undefined, 'normal');
        const fmData = [
          [`Verhältnis:`, fm.relationship || '–'],
          [`Geburtsdatum:`, fm.birthdate || '–'],
          [`E-Mail:`, fm.email || '–'],
        ];

        fmData.forEach(([label, value]) => {
          doc.text(`${label} ${value}`, margin + 5, yPos);
          yPos += 5;
        });

        yPos += 4;
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`Erstellt: ${new Date().toLocaleDateString('de-CH')}`, margin, pageHeight - 10);

    doc.save(`Kunde_${customer.first_name}_${customer.last_name}.pdf`);
  };

  return (
    <div>
      <PageHeader title="Kunden" subtitle={`${customers.length} Kunden insgesamt`}>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Neuer Kunde
        </Button>
      </PageHeader>

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
                <TableHead className="hidden lg:table-cell">Familie</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Kunden gefunden</TableCell></TableRow>
              ) : filtered.map(customer => (
                <TableRow key={customer.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {customer.first_name} {customer.last_name}
                    {customer.company_name && <p className="text-xs text-muted-foreground">{customer.company_name}</p>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{customer.email}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {customer.zip_code} {customer.city}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {customer.customer_type === 'geschaeft' ? 'Geschäft' : 'Privat'}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm">
                    {customer.family_members?.length || 0}
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
                        <DropdownMenuItem onClick={() => { setEditing(customer); setShowForm(true); }}>
                          <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportPDF(customer)}>
                          <Download className="w-4 h-4 mr-2" /> PDF Export
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive" 
                          onClick={() => {
                            if (confirm('Kunde löschen?')) {
                              deleteMutation.mutate(customer.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Löschen
                        </DropdownMenuItem>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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