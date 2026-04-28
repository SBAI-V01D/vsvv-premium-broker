import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function PolicyUploadDialog({ open, onOpenChange, contractId, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [formData, setFormData] = useState({});

  const insuranceTypes = ['KVG', 'VVG', 'Leben', 'Haftpflicht', 'Hausrat', 'Rechtsschutz', 'Motorfahrzeug', 'Gebäude', 'Unfall', 'Krankentaggeld', 'BVG', 'Säule 3a', 'Sonstige'];

  const handleFileSelect = async (f) => {
    if (!f?.type === 'application/pdf') return;
    setFile(f);
    setExtractedData(null);
    setFormData({});
    
    // Auto-extract data
    setExtracting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      const response = await base44.functions.invoke('extractPolicyData', { file_url });
      setExtractedData(response.data || {});
      setFormData(response.data || {});
    } catch (error) {
      console.error('Extraktion fehlgeschlagen:', error);
      setExtractedData(null);
    } finally {
      setExtracting(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const updateData = { policy_document_url: file_url };
      
      // Nur nicht-null Felder hinzufügen
      if (formData.policy_number) updateData.policy_number = formData.policy_number;
      if (formData.provider) updateData.provider = formData.provider;
      if (formData.insurance_type) updateData.insurance_type = formData.insurance_type;
      if (formData.start_date) updateData.start_date = formData.start_date;
      if (formData.end_date) updateData.end_date = formData.end_date;
      if (formData.premium_monthly) updateData.premium_monthly = formData.premium_monthly;
      if (formData.premium_yearly) updateData.premium_yearly = formData.premium_yearly;

      await base44.entities.Contract.update(contractId, updateData);
      setFile(null);
      setExtractedData(null);
      setFormData({});
      onOpenChange(false);
      onUploadSuccess();
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') handleFileSelect(f);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Police hochladen & extrahieren</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleUpload} className="space-y-4">
          {!extractedData ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              {file && extracting ? (
                <div className="space-y-2">
                  <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
                  <p className="text-sm font-medium">Daten werden extrahiert...</p>
                </div>
              ) : file ? (
                <div className="space-y-2">
                  <FileText className="w-8 h-8 text-primary mx-auto" />
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm font-medium">PDF hierher ziehen</p>
                  <p className="text-xs text-muted-foreground">oder klicken zum Auswählen</p>
                </div>
              )}
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                className="hidden"
                id="policy-file"
              />
              <label htmlFor="policy-file" className="block cursor-pointer" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">Daten erfolgreich extrahiert</p>
                  <p className="text-xs text-emerald-700 mt-0.5">Bitte überprüfen und bestätigen Sie die Informationen:</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Policennummer</Label>
                  <Input
                    type="text"
                    value={formData.policy_number || ''}
                    onChange={(e) => setFormData(p => ({ ...p, policy_number: e.target.value }))}
                    placeholder="–"
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Versicherungsgesellschaft</Label>
                  <Input
                    type="text"
                    value={formData.provider || ''}
                    onChange={(e) => setFormData(p => ({ ...p, provider: e.target.value }))}
                    placeholder="–"
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Versicherungsart</Label>
                  <Select value={formData.insurance_type || ''} onValueChange={(v) => setFormData(p => ({ ...p, insurance_type: v }))}>
                    <SelectTrigger className="mt-1 text-sm"><SelectValue placeholder="–" /></SelectTrigger>
                    <SelectContent>
                      {insuranceTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Startdatum</Label>
                  <Input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => setFormData(p => ({ ...p, start_date: e.target.value }))}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Enddatum</Label>
                  <Input
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData(p => ({ ...p, end_date: e.target.value }))}
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Monatsprämie (CHF)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.premium_monthly || ''}
                    onChange={(e) => setFormData(p => ({ ...p, premium_monthly: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="–"
                    className="mt-1 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Jahresprämie (CHF)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.premium_yearly || ''}
                    onChange={(e) => setFormData(p => ({ ...p, premium_yearly: e.target.value ? parseFloat(e.target.value) : null }))}
                    placeholder="–"
                    className="mt-1 text-sm"
                  />
                </div>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={() => { setFile(null); setExtractedData(null); }}>
                Andere Datei wählen
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { onOpenChange(false); setFile(null); setExtractedData(null); }} disabled={uploading}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={!file || uploading || extracting}>
              {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {uploading ? 'Speichern...' : 'Speichern & hochladen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}