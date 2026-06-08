import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle,
  Download,
  Loader2,
  Info
} from 'lucide-react';

const ALLE_KANTONE = [
  'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL', 'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU'
];

// Alle 26 Kantone für den Import
const ALLE_26_KANTONE = ['ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL', 'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU'];

export default function BAGDatenImport() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [jahr, setJahr] = useState('2026');
  const [importModus, setImportModus] = useState('alle_26');
  const [selectedKantone, setSelectedKantone] = useState(ALLE_26_KANTONE);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  const toggleKanton = (kanton) => {
    setSelectedKantone(prev => 
      prev.includes(kanton) 
        ? prev.filter(k => k !== kanton)
        : [...prev, kanton]
    );
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    
    try {
      const uploadResponse = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const fileUrl = uploadResponse.file_url;

      const response = await base44.functions.invoke('importBAGDatenFromURL', {
        file_url: fileUrl,
        jahr: parseInt(jahr),
        kantone: importModus === 'auswahl' ? selectedKantone : null
      });

      if (response.data?.success) {
        setUploadResult(response.data);
        queryClient.invalidateQueries({ queryKey: ['bag-praemien-stats'] });
      } else {
        setUploadResult({ error: response.data?.error || 'Import fehlgeschlagen' });
      }
    } catch (error) {
      setUploadResult({ error: error.message });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await base44.functions.invoke('generateBAGTemplate', {});
      if (response.data?.fileUrl) {
        window.open(response.data.fileUrl, '_blank');
      }
    } catch (error) {
      console.error('Template download failed:', error);
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-3.5 h-3.5 mr-2" />
          BAG-Daten importieren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            BAG-Prämiendaten importieren
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">Datenquelle</p>
                <p className="text-blue-700">
                  Offizielle Prämien-Daten vom Bundesamt für Gesundheit (BAG). 
                  Laden Sie die Excel-Datei von{' '}
                  <a href="https://www.bag.admin.ch/bag/de/home/versicherungen/krankenversicherung/krankenversicherung-praemien-und-oeffentliche-beitraege/pramiendaten.html" 
                     target="_blank" 
                     className="underline text-blue-900"
                     rel="noopener noreferrer">
                    bag.admin.ch
                  </a>{' '}
                  herunter.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <Label>Prämienjahr</Label>
              <Select value={jahr} onValueChange={setJahr}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Import-Modus</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={importModus === 'alle_26' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setImportModus('alle_26');
                    setSelectedKantone(ALLE_26_KANTONE);
                  }}
                  className="flex-1"
                >
                  Alle 26 Kantone
                </Button>
                <Button
                  type="button"
                  variant={importModus === 'auswahl' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setImportModus('auswahl');
                    setSelectedKantone([]);
                  }}
                  className="flex-1"
                >
                  Auswahl
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {importModus === 'alle_26' 
                  ? 'Alle Schweizer Kantone werden importiert'
                  : 'Wählen Sie spezifische Kantone aus'}
              </p>
            </div>

            {importModus === 'auswahl' && (
              <div>
                <Label>Kantone auswählen</Label>
                <div className="grid grid-cols-6 gap-2 mt-2 max-h-48 overflow-auto border rounded-lg p-3">
                  {ALLE_KANTONE.map(kanton => (
                    <Button
                      key={kanton}
                      type="button"
                      variant={selectedKantone.includes(kanton) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleKanton(kanton)}
                      className={`text-xs ${!selectedKantone.includes(kanton) && 'opacity-50'}`}
                    >
                      {kanton}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedKantone.length} Kantone ausgewählt
                </p>
              </div>
            )}

            <div>
              <Label>Excel-Datei</Label>
              <div 
                className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium mb-1">
                  {selectedFile ? selectedFile.name : 'Datei auswählen'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Excel-Datei (.xlsx, .xls)
                </p>
              </div>
            </div>
          </div>

          {uploadResult && (
            <div className={`p-4 rounded-lg border ${
              uploadResult.error 
                ? 'bg-red-50 border-red-200' 
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              {uploadResult.error ? (
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  <p className="font-medium">{uploadResult.error}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <p className="font-medium">{uploadResult.message}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Gesamt</p>
                      <p className="font-semibold">{uploadResult.results?.gesamt}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Erfolgreich</p>
                      <p className="font-semibold text-emerald-700">{uploadResult.results?.erfolgreich}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fehler</p>
                      <p className="font-semibold text-red-700">{uploadResult.results?.fehler}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-3.5 h-3.5 mr-2" />
            Template herunterladen
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Importiere...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 mr-2" />
                Importieren
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}