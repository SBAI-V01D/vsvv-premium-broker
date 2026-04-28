import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

export default function FamilyMembersSection({ familyMembers = [], onUpdate }) {
  const [members, setMembers] = useState(familyMembers || []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    relationship: '',
    birthdate: '',
    email: '',
  });

  useEffect(() => {
    setMembers(familyMembers || []);
  }, [familyMembers]);

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

  const openDialog = (member = null) => {
    if (member) {
      setEditingId(member.id);
      setFormData({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        relationship: member.relationship || '',
        birthdate: member.birthdate || '',
        email: member.email || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setTimeout(resetForm, 100);
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
    onUpdate(updatedMembers);
    closeDialog();
  };

  const handleDelete = (id) => {
    if (confirm('Familienmitglied löschen?')) {
      const updatedMembers = members.filter(m => m.id !== id);
      setMembers(updatedMembers);
      onUpdate(updatedMembers);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> Familienmitglieder
          </CardTitle>
          <Button size="sm" onClick={() => openDialog()} type="button" className="gap-1">
            <Plus className="w-4 h-4" /> Hinzufügen
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Familienmitglieder eingetragen</p>
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
                    onClick={() => openDialog(member)}
                    type="button"
                    className="w-9 h-9 p-0"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(member.id)}
                    type="button"
                    className="w-9 h-9 p-0 text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md" onPointerDown={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Familienmitglied bearbeiten' : 'Familienmitglied hinzufügen'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Vorname *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData(p => ({ ...p, first_name: e.target.value }))}
                  className="mt-1"
                  type="text"
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Nachname *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData(p => ({ ...p, last_name: e.target.value }))}
                  className="mt-1"
                  type="text"
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Verwandtschaftsverhältnis *</Label>
              <Select
                value={formData.relationship}
                onValueChange={(v) => setFormData(p => ({ ...p, relationship: v }))}
              >
                <SelectTrigger className="mt-1">
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
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">E-Mail (optional)</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Abbrechen
              </Button>
              <Button type="submit">Speichern</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}