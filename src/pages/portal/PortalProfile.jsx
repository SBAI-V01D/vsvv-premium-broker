import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { User, MapPin, Phone, Mail, Calendar, Building2, CheckCircle2, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import PortalPageHeader from '../../components/portal/PortalPageHeader';

export default function PortalProfile() {
  const { user } = useOutletContext();
  const queryClient = useQueryClient();
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ street: '', zip_code: '', city: '', notes: '' });

  // Load full customer record
  const { data: customers = [] } = useQuery({
    queryKey: ['portal-customer', user?.id],
    queryFn: () => base44.entities.Customer.filter({ id: user?.id }),
    enabled: !!user?.id,
  });
  const customer = customers[0];

  const submitRequest = useMutation({
    mutationFn: () => base44.entities.Interaction.create({
      customer_id: user?.id,
      customer_name: user?.full_name,
      type: 'notiz',
      subject: 'Adressänderungsantrag',
      content: `Neue Adresse: ${form.street}, ${form.zip_code} ${form.city}${form.notes ? `\nBemerkungen: ${form.notes}` : ''}`,
      date: format(new Date(), 'yyyy-MM-dd'),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      setSubmitted(true);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    submitRequest.mutate();
  };

  const InfoRow = ({ icon: Icon, label, value }) => (
    value ? (
      <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
        </div>
      </div>
    ) : null
  );

  return (
    <div>
      <PortalPageHeader
        icon={<User className="w-5 h-5 text-primary" />}
        title="Mein Profil"
        subtitle="Ihre gespeicherten Stammdaten"
        action={
          <Button onClick={() => { setShowChangeRequest(true); setSubmitted(false); setForm({ street: '', zip_code: '', city: '', notes: '' }); }}>
            <MapPin className="w-4 h-4 mr-2" /> Adressänderung beantragen
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Persönliche Daten</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <InfoRow icon={User} label="Name" value={user?.full_name} />
            <InfoRow icon={Mail} label="E-Mail" value={user?.email} />
            {customer && (
              <>
                <InfoRow icon={Phone} label="Telefon" value={customer.phone} />
                <InfoRow icon={Phone} label="Mobile" value={customer.mobile} />
                <InfoRow icon={Calendar} label="Geburtsdatum"
                  value={customer.birthdate ? format(new Date(customer.birthdate), 'dd.MM.yyyy') : null} />
                <InfoRow icon={Building2} label="Arbeitgeber" value={customer.employer} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Adresse</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {customer ? (
              <>
                <InfoRow icon={MapPin} label="Strasse" value={customer.street} />
                <InfoRow icon={MapPin} label="PLZ / Ort"
                  value={customer.zip_code || customer.city ? `${customer.zip_code || ''} ${customer.city || ''}`.trim() : null} />
                <InfoRow icon={MapPin} label="Kanton" value={customer.canton ? `Kanton ${customer.canton}` : null} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4">Keine Adresse hinterlegt</p>
            )}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
              Um Ihre Adresse zu ändern, klicken Sie auf «Adressänderung beantragen». Ihr Broker wird die Änderung prüfen und aktualisieren.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Address Change Dialog */}
      <Dialog open={showChangeRequest} onOpenChange={setShowChangeRequest}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adressänderung beantragen</DialogTitle>
          </DialogHeader>
          {submitted ? (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              <h3 className="font-semibold text-foreground">Antrag gesendet</h3>
              <p className="text-sm text-muted-foreground">Ihr Broker wurde informiert und wird die Adresse in Kürze aktualisieren.</p>
              <Button className="mt-2" onClick={() => setShowChangeRequest(false)}>Schliessen</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Neue Strasse &amp; Hausnummer</Label>
                <Input className="mt-1" value={form.street} onChange={e => setForm(p => ({ ...p, street: e.target.value }))} required placeholder="Musterstrasse 12" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>PLZ</Label>
                  <Input className="mt-1" value={form.zip_code} onChange={e => setForm(p => ({ ...p, zip_code: e.target.value }))} required placeholder="8000" />
                </div>
                <div className="col-span-2">
                  <Label>Ort</Label>
                  <Input className="mt-1" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} required placeholder="Zürich" />
                </div>
              </div>
              <div>
                <Label>Bemerkungen (optional)</Label>
                <Textarea className="mt-1" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Einzugsdatum, etc." />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowChangeRequest(false)}>Abbrechen</Button>
                <Button type="submit" disabled={submitRequest.isPending}>
                  <Send className="w-4 h-4 mr-1" />
                  {submitRequest.isPending ? 'Senden...' : 'Antrag senden'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}