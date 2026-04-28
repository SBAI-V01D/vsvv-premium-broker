import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, AlertCircle } from 'lucide-react';
import EmailTemplatePreview from './EmailTemplatePreview';
import { toast } from 'sonner';

const PLACEHOLDERS = {
  customer: [
    { key: 'customer_name', label: 'Kundename (Vor- und Nachname)' },
    { key: 'customer_firstname', label: 'Vorname' },
    { key: 'customer_email', label: 'E-Mail' },
    { key: 'customer_phone', label: 'Telefon' },
    { key: 'customer_city', label: 'Stadt' },
    { key: 'customer_zip', label: 'PLZ' },
  ],
  contract: [
    { key: 'contract_type', label: 'Versicherungstyp' },
    { key: 'contract_provider', label: 'Versicherungsgesellschaft' },
    { key: 'contract_policy', label: 'Policen-Nummer' },
    { key: 'contract_premium', label: 'Jahresprämie' },
    { key: 'contract_start', label: 'Vertragsbeginn' },
    { key: 'contract_end', label: 'Vertragsende' },
  ],
};

export default function EmailTemplateSender({ customerId, customer, contracts = [], onClose }) {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(customer?.email || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedContract, setSelectedContract] = useState('');
  const [sending, setSending] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => base44.entities.EmailTemplate.list(),
  });

  const currentTemplate = useMemo(() => 
    templates.find(t => t.id === selectedTemplate), 
    [selectedTemplate, templates]
  );

  const handleTemplateChange = (id) => {
    setSelectedTemplate(id);
    const template = templates.find(t => t.id === id);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  };

  const handleAddPlaceholder = (key) => {
    const placeholder = `{{ ${key} }}`;
    setBody(prev => prev + placeholder);
  };

  const handleSend = async () => {
    if (!recipientEmail || !subject || !body) {
      toast.error('Betreff und Nachricht erforderlich');
      return;
    }

    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: recipientEmail,
        subject: subject.replace(/{{\s*\w+\s*}}/g, (match) => {
          const key = match.replace(/{{\s*|\s*}}/g, '');
          if (customer) {
            if (key === 'customer_name') return `${customer.first_name} ${customer.last_name}`;
            if (key === 'customer_firstname') return customer.first_name;
            if (key === 'customer_email') return customer.email;
            if (key === 'customer_phone') return customer.phone || customer.mobile || '';
            if (key === 'customer_city') return customer.city || '';
            if (key === 'customer_zip') return customer.zip_code || '';
          }
          return match;
        }),
        body: body.replace(/{{\s*\w+\s*}}/g, (match) => {
          const key = match.replace(/{{\s*|\s*}}/g, '');
          if (customer) {
            if (key === 'customer_name') return `${customer.first_name} ${customer.last_name}`;
            if (key === 'customer_firstname') return customer.first_name;
            if (key === 'customer_email') return customer.email;
            if (key === 'customer_phone') return customer.phone || customer.mobile || '';
            if (key === 'customer_city') return customer.city || '';
            if (key === 'customer_zip') return customer.zip_code || '';
          }
          const contract = selectedContract ? contracts.find(c => c.id === selectedContract) : null;
          if (contract) {
            if (key === 'contract_type') return contract.insurance_type;
            if (key === 'contract_provider') return contract.provider;
            if (key === 'contract_policy') return contract.policy_number;
            if (key === 'contract_premium') return `CHF ${contract.premium_yearly?.toLocaleString('de-CH', { minimumFractionDigits: 2 }) || ''}`;
            if (key === 'contract_start') return contract.start_date ? new Date(contract.start_date).toLocaleDateString('de-CH') : '';
            if (key === 'contract_end') return contract.end_date ? new Date(contract.end_date).toLocaleDateString('de-CH') : '';
          }
          return match;
        }),
      });

      // Log notification
      await base44.entities.Notification.create({
        type: 'manual',
        recipient_email: recipientEmail,
        recipient_name: customer?.first_name || 'Kunde',
        subject,
        body,
        reference_id: customerId,
        reference_type: 'customer',
        status: 'sent',
      });

      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('E-Mail versendet');
      onClose?.();
    } catch (error) {
      toast.error(`Fehler: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Vorlage (optional)</Label>
          <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
            <SelectTrigger>
              <SelectValue placeholder="Vorlage wählen..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {contracts.length > 0 && (
          <div>
            <Label>Vertrag (für Platzhalter)</Label>
            <Select value={selectedContract} onValueChange={setSelectedContract}>
              <SelectTrigger>
                <SelectValue placeholder="Kein Vertrag" />
              </SelectTrigger>
              <SelectContent>
                {contracts.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.insurance_type} – {c.provider}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div>
        <Label>Empfänger E-Mail *</Label>
        <Input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} type="email" required />
      </div>

      <div>
        <Label>Betreff *</Label>
        <Input value={subject} onChange={e => setSubject(e.target.value)} required />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Nachricht *</Label>
          <div className="text-xs text-muted-foreground">Platzhalter:</div>
        </div>
        <Textarea value={body} onChange={e => setBody(e.target.value)} rows={6} className="font-mono text-xs" required />
        
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Kundendaten:</p>
            <div className="flex flex-wrap gap-1">
              {PLACEHOLDERS.customer.map(p => (
                <button
                  key={p.key}
                  onClick={() => handleAddPlaceholder(p.key)}
                  className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-2 py-0.5 rounded transition-colors"
                  type="button"
                  title={p.label}
                >
                  {p.key}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Vertragsdaten:</p>
            <div className="flex flex-wrap gap-1">
              {PLACEHOLDERS.contract.map(p => (
                <button
                  key={p.key}
                  onClick={() => handleAddPlaceholder(p.key)}
                  className="text-xs bg-accent/50 text-accent-foreground hover:bg-accent px-2 py-0.5 rounded transition-colors"
                  type="button"
                  title={p.label}
                >
                  {p.key}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <EmailTemplatePreview 
        subject={subject} 
        body={body} 
        customer={customer}
        contract={selectedContract ? contracts.find(c => c.id === selectedContract) : null}
      />

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>Abbrechen</Button>
        <Button onClick={handleSend} disabled={sending || !recipientEmail || !subject || !body}>
          <Send className="w-4 h-4 mr-1" />
          {sending ? 'Wird versendet...' : 'Versenden'}
        </Button>
      </div>
    </div>
  );
}