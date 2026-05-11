import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function ContractAdvisorAssignment({ contractId, contractName }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('primary');
  const queryClient = useQueryClient();

  const { data: assignments = [] } = useQuery({
    queryKey: ['contractAdvisors', contractId],
    queryFn: () => base44.entities.ContractAdvisor.filter({ contract_id: contractId }),
  });

  const { data: allAdvisors = [] } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => base44.entities.Advisor.list(),
  });

  const availableAdvisors = allAdvisors.filter(
    a => !assignments.some(ca => ca.advisor_id === a.id)
  );

  const filteredAdvisors = availableAdvisors.filter(a =>
    `${a.firstname} ${a.lastname}`.toLowerCase().includes(search.toLowerCase())
  );

  const addMutation = useMutation({
    mutationFn: (advisorId) =>
      base44.entities.ContractAdvisor.create({
        contract_id: contractId,
        contract_policy_number: contractName,
        advisor_id: advisorId,
        advisor_name: allAdvisors.find(a => a.id === advisorId)?.firstname || '',
        advisor_email: allAdvisors.find(a => a.id === advisorId)?.email || '',
        role: selectedRole,
        is_primary: selectedRole === 'primary',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractAdvisors', contractId] });
      setOpen(false);
      setSearch('');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id) => base44.entities.ContractAdvisor.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contractAdvisors', contractId] });
    },
  });

  const roleLabels = {
    primary: 'Hauptberater',
    co_advisor: 'Co-Berater',
    assistant: 'Assistenz',
    specialist: 'Spezialist',
  };

  return (
    <Card className="bg-muted/20">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Zuständiger Berater</p>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {assignments.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nicht zugeordnet</p>
        ) : (
          <div className="space-y-1">
            {assignments.map(ca => (
              <div key={ca.id} className="flex items-center justify-between text-xs p-1.5 bg-white rounded">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{ca.advisor_name}</p>
                  <p className="text-muted-foreground truncate">{ca.advisor_email}</p>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    {roleLabels[ca.role]}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={() => removeMutation.mutate(ca.id)}
                  >
                    <X className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Berater zuweisen</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium block mb-1.5">Rolle</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm"
              >
                <option value="primary">Hauptberater</option>
                <option value="co_advisor">Co-Berater</option>
                <option value="assistant">Assistenz</option>
                <option value="specialist">Spezialist</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1.5">Berater</label>
              <input
                type="text"
                placeholder="Suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-2 py-1.5 border rounded text-sm mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-0.5 border rounded p-1">
                {filteredAdvisors.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Keine Berater</p>
                ) : (
                  filteredAdvisors.map(a => (
                    <button
                      key={a.id}
                      onClick={() => addMutation.mutate(a.id)}
                      className="w-full text-left p-1.5 hover:bg-muted rounded text-xs transition-colors"
                    >
                      <p className="font-medium">{a.firstname} {a.lastname}</p>
                      <p className="text-muted-foreground">{a.email}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}