import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Edit, Trash2, CheckCircle2, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import ApplicationForm from '../components/applications/ApplicationForm';

const STATUS_MAP = {
  neu: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  bewilligung_erteilt: 'Bewilligung erteilt',
  abgelehnt: 'Abgelehnt',
};

const STATUS_COLORS = {
  neu: 'bg-blue-50 text-blue-700 border-blue-200',
  in_bearbeitung: 'bg-amber-50 text-amber-700 border-amber-200',
  bewilligung_erteilt: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  abgelehnt: 'bg-red-50 text-red-700 border-red-200',
};

export default function Applications() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(null);
  const [approvalData, setApprovalData] = useState({ premium_monthly: '', premium_yearly: '', start_date: '', notes: '' });

  const { data: applications = [] } = useQuery({
    queryKey: ['applications'],
    queryFn: () => base44.entities.Application.list('-created_date'),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
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
          isFamilyMember: true,
          parentId: c.id,
          parentName: `${c.first_name} ${c.last_name}`,
        });
      });
    }
    return entries;
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Application.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['applications'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Application.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['applications'] }); setEditingApp(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Application.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  const approveMutation = useMutation({
    mutationFn: async (appId) => {
      const app = applications.find(a => a.id === appId);
      const newContract = {
        customer_id: app.customer_id,
        family_member_id: app.family_member_id || undefined,
        customer_name: app.customer_name,
        insurance_type: app.insurance_type,
        provider: app.provider,
        premium_monthly: parseFloat(approvalData.premium_monthly) || app.estimated_premium_monthly,
        premium_yearly: parseFloat(approvalData.premium_yearly) || app.estimated_premium_yearly,
        start_date: approvalData.start_date || app.requested_start_date,
        status: 'aktiv',
        notes: approvalData.notes || app.notes,
      };
      const contract = await base44.entities.Contract.create(newContract);
      await base44.entities.Application.update(appId, {
        status: 'bewilligung_erteilt',
        linked_contract_id: contract.id,
      });
      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setShowApprovalDialog(null);
      setApprovalData({ premium_monthly: '', premium_yearly: '', start_date: '', notes: '' });
    },
  });

  const filteredApps = applications.filter(app => {
    const matchesSearch = app.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
                         app.insurance_type?.toLowerCase().includes(search.toLowerCase()) ||
                         app.provider?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Only show open applications (not bewilligung_erteilt or abgelehnt)
  const openApps = filteredApps.filter(a => a.status !== 'bewilligung_erteilt' && a.status !== 'abgelehnt');

  return (
    <div>
      <PageHeader
        title="Anträge"
        subtitle={`${openApps.length} offene Anträge`}
      >
        <Button onClick={() => { setEditingApp(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Neuer Antrag
        </Button>
      </PageHeader>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Kunde, Versicherungsart, Gesellschaft..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="neu">Neu</SelectItem>
            <SelectItem value="in_bearbeitung">In Bearbeitung</SelectItem>
            <SelectItem value="bewilligung_erteilt">Bewilligung erteilt</SelectItem>
            <SelectItem value="abgelehnt">Abgelehnt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Applications Table */}
      {openApps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {applications.length === 0 ? 'Keine Anträge vorhanden' : 'Keine offenen Anträge'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {openApps.map(app => (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{app.customer_name}</h3>
                      <StatusBadge status={app.status} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground mb-2">
                      <div>
                        <p className="font-medium">{app.insurance_type}</p>
                      </div>
                      <div>
                        <p className="font-medium">{app.provider}</p>
                      </div>
                      {app.estimated_premium_yearly && (
                        <div>
                          <p>CHF {app.estimated_premium_yearly.toLocaleString('de-CH', { maximumFractionDigits: 0 })}/J.</p>
                        </div>
                      )}
                      {app.requested_start_date && (
                        <div>
                          <p>ab {format(new Date(app.requested_start_date), 'dd.MM.yyyy')}</p>
                        </div>
                      )}
                    </div>
                    {app.notes && <p className="text-xs text-muted-foreground italic">{app.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowApprovalDialog(app.id);
                        setApprovalData({
                          premium_monthly: app.estimated_premium_monthly || '',
                          premium_yearly: app.estimated_premium_yearly || '',
                          start_date: app.requested_start_date || format(new Date(), 'yyyy-MM-dd'),
                          notes: app.notes || '',
                        });
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Annehmen
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingApp(app)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(app.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Application Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingApp ? 'Antrag bearbeiten' : 'Neuer Antrag'}</DialogTitle></DialogHeader>
          <ApplicationForm
           application={editingApp}
           customers={expandedCustomers}
           onSave={(data) => {
             if (editingApp) {
               updateMutation.mutate({ id: editingApp.id, data });
             } else {
               createMutation.mutate(data);
             }
           }}
           onCancel={() => { setShowForm(false); setEditingApp(null); }}
           saving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      {showApprovalDialog && (
        <Dialog open={!!showApprovalDialog} onOpenChange={(o) => !o && setShowApprovalDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Antrag annehmen & Vertrag erstellen</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                approveMutation.mutate(showApprovalDialog);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Monatsprämie (CHF)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={approvalData.premium_monthly}
                    onChange={(e) => setApprovalData(p => ({ ...p, premium_monthly: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Jahresprämie (CHF)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={approvalData.premium_yearly}
                    onChange={(e) => setApprovalData(p => ({ ...p, premium_yearly: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Vertragsbeginn</Label>
                <Input
                  type="date"
                  value={approvalData.start_date}
                  onChange={(e) => setApprovalData(p => ({ ...p, start_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Bemerkungen</Label>
                <Textarea
                  value={approvalData.notes}
                  onChange={(e) => setApprovalData(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowApprovalDialog(null)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={approveMutation.isPending}>
                  {approveMutation.isPending ? 'Wird erstellt...' : 'Vertrag erstellen'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}