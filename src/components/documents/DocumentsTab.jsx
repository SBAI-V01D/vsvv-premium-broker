import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, Trash2, ExternalLink, Tag, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = [
  { value: 'police', label: 'Police', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'rechnung', label: 'Rechnung', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'schadenfall', label: 'Schadenfall', color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'vertrag', label: 'Vertrag', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'schaden', label: 'Schaden', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'ausweis', label: 'Ausweis', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'korrespondenz', label: 'Korrespondenz', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'sonstiges', label: 'Sonstiges', color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

function CategoryBadge({ category }) {
  const cat = CATEGORIES.find(c => c.value === category) || CATEGORIES[4];
  return (
    <span className={`text-xs font-medium border px-2 py-0.5 rounded-full ${cat.color}`}>
      {cat.label}
    </span>
  );
}

export default function DocumentsTab({ customerId, customerName, contracts = [], claims = [] }) {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'police', linked_contract_id: '', linked_claim_id: '', notes: '', visible_in_portal: true });
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', customerId],
    queryFn: () => base44.entities.Document.filter({ customer_id: customerId }, '-created_date'),
    enabled: !!customerId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents', customerId] }),
  });

  const applyFile = (f) => {
    if (!f) return;
    setFile(f);
    setForm(p => ({ ...p, name: p.name || f.name.replace(/\.[^.]+$/, '') }));
  };

  const handleFileChange = (e) => applyFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    applyFile(e.dataTransfer.files[0]);
    setShowUpload(true);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Document.create({
      customer_id: customerId,
      customer_name: customerName,
      name: form.name,
      file_url,
      category: form.category,
      linked_contract_id: form.linked_contract_id || undefined,
      linked_claim_id: form.linked_claim_id || undefined,
      notes: form.notes || undefined,
      uploaded_by_role: 'broker',
      visible_in_portal: form.visible_in_portal,
    });
    queryClient.invalidateQueries({ queryKey: ['documents', customerId] });
    setUploading(false);
    setShowUpload(false);
    setFile(null);
    setForm({ name: '', category: 'police', linked_contract_id: '', linked_claim_id: '', notes: '', visible_in_portal: true });
  };

  const linkedContractName = (id) => {
    const c = contracts.find(c => c.id === id);
    return c ? `${c.insurance_type} – ${c.provider}` : id;
  };
  const linkedClaimName = (id) => {
    const c = claims.find(c => c.id === id);
    return c ? c.title : id;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Dokumente ({documents.length})</h3>
        <Button size="sm" onClick={() => setShowUpload(true)}>
          <Upload className="w-4 h-4 mr-1" /> Hochladen
        </Button>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => setShowUpload(true)}
        className={`mb-4 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'}`}
      >
        <Upload className={`w-7 h-7 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
        <p className="text-sm font-medium text-muted-foreground">PDF hierher ziehen oder klicken zum Hochladen</p>
        <div className="flex gap-1.5 flex-wrap justify-center">
          {['Police', 'Rechnung', 'Schadenfall'].map(cat => (
            <span key={cat} className="text-xs bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">{cat}</span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Laden...</p>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <FileText className="w-10 h-10 opacity-20" />
          <p className="text-sm">Keine Dokumente vorhanden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <Card key={doc.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{doc.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                      <CategoryBadge category={doc.category} />
                      {doc.linked_contract_id && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Tag className="w-3 h-3" /> {linkedContractName(doc.linked_contract_id)}
                        </span>
                      )}
                      {doc.linked_claim_id && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Tag className="w-3 h-3" /> {linkedClaimName(doc.linked_claim_id)}
                        </span>
                      )}
                    </div>
                    {doc.notes && <p className="text-xs text-muted-foreground mt-1">{doc.notes}</p>}
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <span>{doc.uploaded_by_role === 'customer' ? 'Vom Kunden' : 'Vom Broker'} · {doc.created_date ? new Date(doc.created_date).toLocaleDateString('de-CH') : ''}</span>
                      {doc.visible_in_portal === false
                        ? <span className="flex items-center gap-0.5 text-muted-foreground"><EyeOff className="w-3 h-3" /> nicht im Portal</span>
                        : <span className="flex items-center gap-0.5 text-primary"><Eye className="w-3 h-3" /> im Portal</span>
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(doc.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Dokument hochladen</DialogTitle></DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Label>Datei (PDF / Bild)</Label>
              <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={handleFileChange} required className="mt-1" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="Dokumentname" className="mt-1" />
            </div>
            <div>
              <Label>Kategorie</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {contracts.length > 0 && (
              <div>
                <Label>Vertrag verknüpfen (optional)</Label>
                <Select value={form.linked_contract_id} onValueChange={v => setForm(p => ({ ...p, linked_contract_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Kein Vertrag" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">– Kein Vertrag –</SelectItem>
                    {contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.insurance_type} – {c.provider}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {claims.length > 0 && (
              <div>
                <Label>Schadensfall verknüpfen (optional)</Label>
                <Select value={form.linked_claim_id} onValueChange={v => setForm(p => ({ ...p, linked_claim_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Kein Schaden" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">– Kein Schadensfall –</SelectItem>
                    {claims.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Bemerkungen (optional)</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <input
                type="checkbox"
                id="visible_in_portal"
                checked={form.visible_in_portal}
                onChange={e => setForm(p => ({ ...p, visible_in_portal: e.target.checked }))}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="visible_in_portal" className="text-sm cursor-pointer flex items-center gap-1.5">
                {form.visible_in_portal ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                Im Kundenportal sichtbar
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowUpload(false)}>Abbrechen</Button>
              <Button type="submit" disabled={uploading}>{uploading ? 'Hochladen...' : 'Hochladen'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}