import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CANTONS = ["AG","AI","AR","BE","BL","BS","FR","GE","GL","GR","JU","LU","NE","NW","OW","SG","SH","SO","SZ","TG","TI","UR","VD","VS","ZG","ZH"];
const RELATIONSHIPS = {
  ehepartner: 'Ehepartner/in',
  kind: 'Kind',
  parent: 'Eltern',
  sibling: 'Geschwister',
  sonstiges: 'Sonstiges',
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export default function CustomerForm({ customer, onSave, onCancel, saving }) {
  const isFamilyMember = customer?.isFamilyMember;
  
  const [form, setForm] = useState(customer || {
    customer_type: 'privat',
    salutation: 'Herr',
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    phone: '',
    mobile: '',
    street: '',
    zip_code: '',
    city: '',
    canton: '',
    birthdate: '',
    ahv_number: '',
    employer: '',
    income: '',
    tags: '',
    status: 'aktiv',
    notes: '',
    family_members: [],
  });

  const [familyForm, setFamilyForm] = useState({ first_name: '', last_name: '', relationship: '', birthdate: '', email: '' });
  const [editingFamilyId, setEditingFamilyId] = useState(null);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleAddFamily = () => {
    if (!familyForm.first_name.trim() || !familyForm.last_name.trim() || !familyForm.relationship.trim()) {
      alert('Vorname, Nachname und Verhältnis erforderlich');
      return;
    }

    if (editingFamilyId) {
      setForm(prev => ({
        ...prev,
        family_members: prev.family_members.map(m => m.id === editingFamilyId ? { ...familyForm, id: editingFamilyId } : m)
      }));
      setEditingFamilyId(null);
    } else {
      setForm(prev => ({
        ...prev,
        family_members: [...prev.family_members, { ...familyForm, id: generateId() }]
      }));
    }
    setFamilyForm({ first_name: '', last_name: '', relationship: '', birthdate: '', email: '' });
  };

  const handleEditFamily = (fm) => {
    setFamilyForm({ first_name: fm.first_name, last_name: fm.last_name, relationship: fm.relationship, birthdate: fm.birthdate, email: fm.email });
    setEditingFamilyId(fm.id);
  };

  const handleDeleteFamily = (id) => {
    if (confirm('Familienmitglied löschen?')) {
      setForm(prev => ({ ...prev, family_members: prev.family_members.filter(m => m.id !== id) }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ 
      ...form, 
      income: form.income ? Number(form.income) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Hauptkontakt / Familienmitglied */}
      <div className="space-y-4">
        <h3 className="font-semibold text-sm text-foreground">
          {isFamilyMember ? `Familienmitglied: ${customer.parentName}` : 'Hauptkontakt'}
        </h3>
        
        {!isFamilyMember && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Kundentyp</Label>
              <Select value={form.customer_type} onValueChange={v => set('customer_type', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="privat">Privat</SelectItem>
                  <SelectItem value="geschaeft">Geschäft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Anrede</Label>
              <Select value={form.salutation} onValueChange={v => set('salutation', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Herr">Herr</SelectItem>
                  <SelectItem value="Frau">Frau</SelectItem>
                  <SelectItem value="Firma">Firma</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vorname *</Label>
            <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} className="mt-1" required />
          </div>
          <div>
            <Label>Nachname *</Label>
            <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} className="mt-1" required />
          </div>
        </div>

        {!isFamilyMember && form.customer_type === 'geschaeft' && (
          <div>
            <Label>Firmenname</Label>
            <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} className="mt-1" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>E-Mail *</Label>
            <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="mt-1" required />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={form.phone} onChange={e => set('phone', e.target.value)} className="mt-1" />
          </div>
        </div>

        <div>
          <Label>Mobilnummer</Label>
          <Input value={form.mobile} onChange={e => set('mobile', e.target.value)} className="mt-1" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label>Strasse</Label>
            <Input value={form.street} onChange={e => set('street', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>PLZ</Label>
            <Input value={form.zip_code} onChange={e => set('zip_code', e.target.value)} className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ort</Label>
            <Input value={form.city} onChange={e => set('city', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Kanton</Label>
            <Select value={form.canton} onValueChange={v => set('canton', v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Wählen..." /></SelectTrigger>
              <SelectContent>
                {CANTONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Geburtsdatum</Label>
            <Input type="date" value={form.birthdate} onChange={e => set('birthdate', e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>AHV-Nummer</Label>
            <Input value={form.ahv_number} onChange={e => set('ahv_number', e.target.value)} className="mt-1" placeholder="z.B. 756.1234.5678.90" />
          </div>
        </div>

        {!isFamilyMember && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktiv">Aktiv</SelectItem>
                    <SelectItem value="inaktiv">Inaktiv</SelectItem>
                    <SelectItem value="interessent">Interessent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tags (kommagetrennt)</Label>
                <Input value={form.tags} onChange={e => set('tags', e.target.value)} className="mt-1" placeholder="z.B. VIP, Familie" />
              </div>
            </div>

            <div>
              <Label>Notizen</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="mt-1" rows={2} />
            </div>
          </>
        )}
      </div>

      {/* Familienmitglieder - nur für Hauptkontakt */}
      {!isFamilyMember && (
      <Card className="bg-secondary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Familienmitglieder
            <Button type="button" size="sm" variant="outline" onClick={() => { setFamilyForm({ first_name: '', last_name: '', relationship: '', birthdate: '', email: '' }); setEditingFamilyId(null); }} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Hinzufügen
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Vorname</Label>
              <Input value={familyForm.first_name} onChange={e => setFamilyForm(p => ({ ...p, first_name: e.target.value }))} className="mt-1 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Nachname</Label>
              <Input value={familyForm.last_name} onChange={e => setFamilyForm(p => ({ ...p, last_name: e.target.value }))} className="mt-1 h-8 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Verhältnis *</Label>
              <Select value={familyForm.relationship} onValueChange={v => setFamilyForm(p => ({ ...p, relationship: v }))}>
                <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIPS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Geburtsdatum</Label>
              <Input type="date" value={familyForm.birthdate} onChange={e => setFamilyForm(p => ({ ...p, birthdate: e.target.value }))} className="mt-1 h-8 text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-xs">E-Mail</Label>
            <Input type="email" value={familyForm.email} onChange={e => setFamilyForm(p => ({ ...p, email: e.target.value }))} className="mt-1 h-8 text-sm" />
          </div>

          <div className="flex justify-end gap-2">
            {editingFamilyId && (
              <Button type="button" size="sm" variant="outline" onClick={() => { setFamilyForm({ first_name: '', last_name: '', relationship: '', birthdate: '', email: '' }); setEditingFamilyId(null); }}>
                Abbrechen
              </Button>
            )}
            <Button type="button" size="sm" onClick={handleAddFamily}>
              {editingFamilyId ? 'Aktualisieren' : 'Hinzufügen'}
            </Button>
          </div>

          {form.family_members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Keine Familienmitglieder eingetragen</p>
          ) : (
            <div className="space-y-2 pt-2">
              {form.family_members.map(fm => (
                <div key={fm.id} className="flex items-center justify-between p-2 bg-white rounded border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{fm.first_name} {fm.last_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                      <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">{RELATIONSHIPS[fm.relationship] || fm.relationship}</span>
                      {fm.birthdate && <span>{fm.birthdate}</span>}
                      {fm.email && <span className="truncate">{fm.email}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button size="sm" variant="outline" onClick={() => handleEditFamily(fm)} type="button" className="w-8 h-8 p-0">
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteFamily(fm.id)} type="button" className="w-8 h-8 p-0 text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Speichern...' : (customer ? 'Aktualisieren' : 'Erstellen')}
        </Button>
      </DialogFooter>
    </form>
  );
}