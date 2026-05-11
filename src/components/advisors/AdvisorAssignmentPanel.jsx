import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AdvisorAssignmentPanel({ customerId, onAssignmentsUpdated }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('primary');
  const queryClient = useQueryClient();

  // Fetch current assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ['customerAdvisors', customerId],
    queryFn: () => base44.entities.CustomerAdvisor.filter({ customer_id: customerId }),
  });

  // Fetch all advisors
  const { data: allAdvisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  });

  // Filter advisors not yet assigned
  const availableAdvisors = allAdvisors.filter(
    a => !assignments.some(as => as.advisor_id === a.id)
  );

  const filteredAdvisors = availableAdvisors.filter(a =>
    `${a.firstname} ${a.lastname}`.toLowerCase().includes(search.toLowerCase())
  );

  // Add advisor mutation
  const addAdvisorMutation = useMutation({
    mutationFn: (advisorId) =>
      base44.entities.CustomerAdvisor.create({
        customer_id: customerId,
        customer_name: 'temp',
        advisor_id: advisorId,
        advisor_name: allAdvisors.find(a => a.id === advisorId)?.firstname || '',
        advisor_email: allAdvisors.find(a => a.id === advisorId)?.email || '',
        role: selectedRole,
        is_primary: selectedRole === 'primary',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerAdvisors', customerId] });
      setOpen(false);
      setSearch('');
      onAssignmentsUpdated?.();
    },
  });

  // Remove advisor mutation
  const removeAdvisorMutation = useMutation({
    mutationFn: (assignmentId) => base44.entities.CustomerAdvisor.delete(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerAdvisors', customerId] });
      onAssignmentsUpdated?.();
    },
  });

  const roleLabels = {
    primary: '👤 Hauptberater',
    co_advisor: '👥 Co-Berater',
    assistant: '📋 Assistenz',
    specialist: '🔧 Spezialist',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Betreuungsteam</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Berater
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Keine Berater zugeordnet</p>
        ) : (
          <div className="space-y-2">
            {assignments.map(a => (
              <div key={a.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.advisor_name}</p>
                  <p className="text-xs text-muted-foreground">{a.advisor_email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {roleLabels[a.role]}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => removeAdvisorMutation.mutate(a.id)}
                    disabled={removeAdvisorMutation.isPending}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog für Berater hinzufügen */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Berater zuweisen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Rollenauswahl */}
            <div>
              <label className="text-sm font-medium mb-2 block">Rolle</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="primary">Hauptberater</option>
                <option value="co_advisor">Co-Berater</option>
                <option value="assistant">Assistenz</option>
                <option value="specialist">Spezialist</option>
              </select>
            </div>

            {/* Suchfeld */}
            <div>
              <label className="text-sm font-medium mb-2 block">Berater suchen</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Name eingeben..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Berater-Liste */}
            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
              {filteredAdvisors.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Keine Berater verfügbar
                </p>
              ) : (
                filteredAdvisors.map(advisor => (
                  <button
                    key={advisor.id}
                    onClick={() => addAdvisorMutation.mutate(advisor.id)}
                    disabled={addAdvisorMutation.isPending}
                    className="w-full text-left p-2 hover:bg-muted rounded text-sm transition-colors"
                  >
                    <p className="font-medium">{advisor.firstname} {advisor.lastname}</p>
                    <p className="text-xs text-muted-foreground">{advisor.email}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}