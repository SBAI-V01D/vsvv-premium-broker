import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

export default function ContractOCRUploader({ customerId, onExtractedData, onClose }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Nur PDF-Dateien werden unterstützt');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile?.type === 'application/pdf') {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Nur PDF-Dateien werden unterstützt');
    }
  };

  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      // Upload PDF
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extract data
      const response = await base44.functions.invoke('extractContractDataFromPDF', {
        file_url,
        customer_id: customerId
      });

      if (response.data.success) {
        setExtractedData(response.data.extractedData);
      } else {
        setError(response.data.message || 'Fehler bei der Datenextraktion');
      }
    } catch (err) {
      setError('Fehler beim Hochladen oder Verarbeiten: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (extractedData) {
      onExtractedData(extractedData);
      onClose();
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vertrag aus PDF auslesen</DialogTitle>
        </DialogHeader>

        {!extractedData ? (
          <div className="space-y-4">
            {/* File Upload */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <Upload className="w-7 h-7 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground text-center">
                PDF hierher ziehen oder klicken
              </p>
              <Input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="pdf-input"
              />
              <label htmlFor="pdf-input" className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>Datei wählen</span>
                </Button>
              </label>
            </div>

            {file && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm truncate">{file.name}</span>
                <button onClick={() => setFile(null)} className="ml-auto">
                  <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Abbrechen
              </Button>
              <Button onClick={handleExtract} disabled={!file || loading}>
                {loading && <Loader className="w-4 h-4 mr-1 animate-spin" />}
                {loading ? 'Analysiere...' : 'PDF analysieren'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Extracted Data Preview */}
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Daten erfolgreich extrahiert</p>
                    <p className="text-xs text-emerald-700 mt-0.5">Überprüfen Sie die Angaben und bestätigen Sie.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Versicherungsart</p>
                  <p className="font-medium">{extractedData.insurance_type || '–'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Versicherer</p>
                  <p className="font-medium">{extractedData.provider || '–'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground font-semibold">Policennummer</p>
                <p className="font-medium">{extractedData.policy_number || '–'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Monatsprämie</p>
                  <p className="font-medium">CHF {extractedData.premium_monthly?.toFixed(2) || '–'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Jahresprämie</p>
                  <p className="font-medium">CHF {extractedData.premium_yearly?.toFixed(2) || '–'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Vertragsbeginn</p>
                  <p className="font-medium">{extractedData.start_date || '–'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold">Vertragsende</p>
                  <p className="font-medium">{extractedData.end_date || '–'}</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setExtractedData(null)}>
                Zurück
              </Button>
              <Button onClick={handleConfirm}>
                Bestätigen & verwenden
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}