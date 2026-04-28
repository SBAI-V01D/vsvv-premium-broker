import React, { useState } from 'react';
import { Users, Plus, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'crypto';

const RELATIONSHIPS = {
  ehepartner: 'Ehepartner/in',
  kind: 'Kind',
  parent: 'Eltern',
  sibling: 'Geschwister',
  sonstiges: 'Sonstiges',
};

export default function FamilyMembersSection({ familyMembers = [], onUpdate }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    relationship: '',
    birthdate: '',
    email: '',
  });

  const handleOpen = (member = null) => {
    if (member) {
      setEditingMember(member);
      setForm({
        first_name: member.first_name,
        last_name: member.last_name,
        relationship: member.relationship,
        birthdate: member.birthdate || '',
        email: member.email || '',
      });
    } else {
      setEditingMember(null);
      setForm({ first_name: '', last_name: '', relationship: '', birthdate: '', email: '' });
    }
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.first_name || !form.last_name || !form.relationship) {
      alert('Vorname, Nachname und Verwandtschaftsverhältnis sind erforderlich');
      return;
    }

    let updated;
    if (editingMember) {
      updated = familyMembers.map(m =>
        m.id === editingMember.id
          ? { ...m, ...form }
          : m
      );
    } else {
      updated = [
        ...familyMembers,
        { id: uuidv4(), ...form },
      ];
    }

    onUpdate(updated);
    setShowDialog(false);
  };

  const handleDelete = (id) => {
    if (confirm('Familienmitglied löschen?')) {
      onUpdate(familyMembers.filter(m => m.id !== id));
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" /> Familienmitglieder
          </CardTitle>
          <Button size="sm" onClick={() => handleOpen()} className="gap-1">
            <Plus className="w-4 h-4" /> Hinzufügen
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {familyMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Familienmitglieder eingetragen</p>
        ) : (
          <div className="space-y-2">
            {familyMembers.map(member => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {member.first_name} {member.last_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
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
                    onClick={() => handleOpen(member)}
                    className="w-9 h-9 p-0"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(member.id)}
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMember ? 'Familienmitglied bearbeiten' : 'Familienmitglied hinzufügen'}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Vorname *</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm(p => ({ ...p, first_name: e.target.value }))}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label className="text-xs">Nachname *</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm(p => ({ ...p, last_name: e.target.value }))}
                  className="mt-1"
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Verwandtschaftsverhältnis *</Label>
              <Select
                value={form.relationship}
                onValueChange={(v) => setForm(p => ({ ...p, relationship: v }))}
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
                value={form.birthdate}
                onChange={(e) => setForm(p => ({ ...p, birthdate: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">E-Mail (optional)</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
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