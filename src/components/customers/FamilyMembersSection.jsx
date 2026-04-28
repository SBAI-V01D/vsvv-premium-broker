import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Plus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

const RELATIONSHIPS = {
  ehepartner: 'Ehepartner/in',
  kind: 'Kind',
  parent: 'Eltern',
  sibling: 'Geschwister',
  sonstiges: 'Sonstiges',
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function FamilyMembersSection({ customerId, familyMembers = [] }) {
  const [members, setMembers] = useState(familyMembers || []);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    relationship: '',
    birthdate: '',
    email: '',
  });
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Customer.update(customerId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      relationship: '',
      birthdate: '',
      email: '',
    });
    setEditingId(null);
  };

  const handleSave = (e) => {
    e.preventDefault();

    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.relationship.trim()) {
      alert('Vorname, Nachname und Verwandtschaftsverhältnis sind erforderlich');
      return;
    }

    let updatedMembers;
    if (editingId) {
      updatedMembers = members.map(m =>
        m.id === editingId ? { id: editingId, ...formData } : m
      );
    } else {
      updatedMembers = [...members, { id: generateId(), ...formData }];
    }

    setMembers(updatedMembers);
    updateMutation.mutate({ family_members: updatedMembers });
    resetForm();
  };

  const handleDelete = (id) => {
    if (confirm('Familienmitglied löschen?')) {
      const updatedMembers = members.filter(m => m.id !== id);
      setMembers(updatedMembers);
      updateMutation.mutate({ family_members: updatedMembers });
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> Familienmitglieder
          </CardTitle>
          <Button size="sm" onClick={() => resetForm()} type="button" className="gap-1">
            <Plus className="w-4 h-4" /> Hinzufügen
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Form */}
        <form onSubmit={handleSave} className="p-4 bg-secondary/30 rounded-lg border border-border space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Vorname *</Label>
              <Input
                value={formData.first_name}
                onChange={(e) => setFormData(p => ({ ...p, first_name: e.target.value }))}
                className="mt-1 h-8"
                type="text"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Nachname *</Label>
              <Input
                value={formData.last_name}
                onChange={(e) => setFormData(p => ({ ...p, last_name: e.target.value }))}
                className="mt-1 h-8"
                type="text"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Verhältnis *</Label>
              <Select
                value={formData.relationship}
                onValueChange={(v) => setFormData(p => ({ ...p, relationship: v }))}
              >
                <SelectTrigger className="mt-1 h-8">
                  <SelectValue placeholder="Auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIPS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Geburtsdatum</Label>
              <Input
                type="date"
                value={formData.birthdate}
                onChange={(e) => setFormData(p => ({ ...p, birthdate: e.target.value }))}
                className="mt-1 h-8"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">E-Mail</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
              className="mt-1 h-8"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {editingId && (
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                Abbrechen
              </Button>
            )}
            <Button type="submit" size="sm" disabled={updateMutation.isPending}>
              {editingId ? 'Aktualisieren' : 'Hinzufügen'}
            </Button>
          </div>
        </form>

        {/* List */}
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Keine Familienmitglieder eingetragen</p>
        ) : (
          <div className="space-y-2">
            {members.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {member.first_name} {member.last_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {RELATIONSHIPS[member.relationship] || member.relationship}
                    </span>
                    {member.birthdate && (
                      <span>{format(new Date(member.birthdate), 'dd.MM.yyyy')}</span>
                    )}
                    {member.email && (
                      <span className="truncate">{member.email}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0 ml-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(member.id);
                      setFormData({
                        first_name: member.first_name || '',
                        last_name: member.last_name || '',
                        relationship: member.relationship || '',
                        birthdate: member.birthdate || '',
                        email: member.email || '',
                      });
                    }}
                    type="button"
                    className="w-8 h-8 p-0"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(member.id)}
                    type="button"
                    className="w-8 h-8 p-0 text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}