import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';

const ALLE_KANTONE = ['ZH','BE','LU','UR','SZ','OW','NW','GL','ZG','FR','SO','BS','BL','SH','AR','AI','SG','GR','AG','TG','TI','VD','VS','NE','GE','JU'];

const MODELL_MAP = {
  'TAR-STD': 'standard', 'TAR-TEL': 'telmed', 'TAR-HAM': 'hausarzt', 'TAR-HMO': 'hmo'
};

// Parst die BAG Excel-Datei komplett im Browser und gibt Records pro Kanton zurück
function parseBAGExcel(file, jahr) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(ws, { raw: true, header: 1 });

        // Records nach Kanton gruppieren
        const byKanton = {};

        for (let i = 1; i < allRows.length; i++) {
          const row = allRows[i];
          if (!row?.length) continue;

          const [versichererId, kantonCode, geschaeftsjahr, , regionCode, altersklasse, unfalleinschluss, , tarifTyp, , , franchiseCode, , praemie] = row;

          // Nur Erwachsene ohne Unfall
          if (altersklasse !== 'AKL-ERW') continue;
          if (unfalleinschluss !== 'OHNE-UNF') continue;
          if (!praemie || parseFloat(praemie) <= 0) continue;

          const modell = MODELL_MAP[tarifTyp];
          if (!modell) continue;

          const kanton = String(kantonCode || '').trim();
          if (!kanton) continue;

          let franchise = 300;
          const m = String(franchiseCode || '').match(/(\d+)/);
          if (m) franchise = parseInt(m[1]);

          const versichererNamen = {
            1:'CSS', 2:'Helsana', 3:'Sanitas', 4:'Swica', 5:'ÖKK',
            6:'Visana', 7:'KPT', 8:'Agrisano', 9:'Concordia', 10:'Atupri',
            11:'Assura', 12:'Intras', 13:'Sympany', 14:'bkk mobilise', 15:'Galenus', 16:'Groupe Mutuel'
          };

          if (!byKanton[kanton]) byKanton[kanton] = [];
          byKanton[kanton].push({
            jahr: parseInt(geschaeftsjahr || jahr),
            krankenkasse: versichererNamen[versichererId] || `VK-${versichererId}`,
            kanton,
            region: String(regionCode || ''),
            modell,
            franchise,
            unfall: false,
            praemie_erwachsene: parseFloat(praemie),
            praemie_kinder: 0,
            geschlecht: 'm',
            alter_von: 26,
            alter_bis: 99,
            datenquelle: 'BAG',
            gueltig_ab: `${jahr}-01-01`,
            gueltig_bis: `${jahr}-12-31`,
          });
        }

        resolve(byKanton);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    reader.readAsArrayBuffer(file);
  });
}

export default function BAGDatenImport() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [jahr, setJahr] = useState('2026');
  const [importModus, setImportModus] = useState('alle_26');
  const [selectedKantone, setSelectedKantone] = useState(ALLE_KANTONE);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null); // { current, total, kanton }
  const [uploadResult, setUploadResult] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  const toggleKanton = (kanton) => {
    setSelectedKantone(prev =>
      prev.includes(kanton) ? prev.filter(k => k !== kanton) : [...prev, kanton]
    );
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setUploadResult(null); }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setProgress(null);
    setUploadResult(null);

    try {
      // 1. Excel lokal im Browser parsen
      setProgress({ phase: 'parsing', current: 0, total: 0, kanton: '' });
      const byKanton = await parseBAGExcel(selectedFile, parseInt(jahr));

      const kantoneInDatei = Object.keys(byKanton);
      const kantoneToImport = importModus === 'auswahl'
        ? selectedKantone.filter(k => kantoneInDatei.includes(k))
        : kantoneInDatei;

      const totalRecords = kantoneToImport.reduce((s, k) => s + (byKanton[k]?.length || 0), 0);
      console.log(`[BAG] Parsed: ${kantoneInDatei.length} Kantone, ${totalRecords} Records total`);

      if (kantoneToImport.length === 0) {
        setUploadResult({ error: 'Keine passenden Kantone in der Datei gefunden.' });
        return;
      }

      // 2. Pro Kanton Records senden (kein File-Upload, nur JSON)
      let erfolgreich = 0;
      let fehler = 0;
      const errors = [];

      for (let i = 0; i < kantoneToImport.length; i++) {
        const kanton = kantoneToImport[i];
        const records = byKanton[kanton] || [];
        setProgress({ phase: 'importing', current: i + 1, total: kantoneToImport.length, kanton, records: records.length });

        if (records.length === 0) continue;

        try {
          const res = await base44.functions.invoke('importBAGDatenFromURL', {
            records,
            kanton,
            jahr: parseInt(jahr)
          });

          if (res.data?.success) {
            erfolgreich += res.data.results?.erfolgreich || 0;
          } else {
            fehler++;
            errors.push(`${kanton}: ${res.data?.error || 'Fehler'}`);
          }
        } catch (err) {
          fehler++;
          errors.push(`${kanton}: ${err.message}`);
          console.error(`[BAG] ${kanton} failed:`, err.message);
        }
      }

      setUploadResult({
        success: erfolgreich > 0,
        results: { gesamt: erfolgreich + fehler, erfolgreich, fehler },
        message: `${erfolgreich} Datensätze aus ${kantoneToImport.length} Kantonen importiert`,
        errors: errors.length > 0 ? errors : null
      });

      if (erfolgreich > 0) {
        queryClient.invalidateQueries({ queryKey: ['bag-praemien-stats'] });
      }

    } catch (error) {
      setUploadResult({ error: error.message });
    } finally {
      setUploading(false);
      setProgress(null);
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            BAG-Prämiendaten importieren
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-blue-700">
                Excel-Datei von{' '}
                <a href="https://www.bag.admin.ch/bag/de/home/versicherungen/krankenversicherung/krankenversicherung-praemien-und-oeffentliche-beitraege/pramiendaten.html"
                  target="_blank" className="underline font-medium" rel="noopener noreferrer">
                  bag.admin.ch
                </a>{' '}
                herunterladen und hier hochladen. Die Datei wird lokal geparst — kein Timeout.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prämienjahr</Label>
              <Select value={jahr} onValueChange={setJahr}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Import-Modus</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" variant={importModus === 'alle_26' ? 'default' : 'outline'} size="sm"
                  onClick={() => { setImportModus('alle_26'); setSelectedKantone(ALLE_KANTONE); }} className="flex-1 text-xs">
                  Alle 26
                </Button>
                <Button type="button" variant={importModus === 'auswahl' ? 'default' : 'outline'} size="sm"
                  onClick={() => { setImportModus('auswahl'); setSelectedKantone([]); }} className="flex-1 text-xs">
                  Auswahl
                </Button>
              </div>
            </div>
          </div>

          {importModus === 'auswahl' && (
            <div>
              <Label>Kantone ({selectedKantone.length} gewählt)</Label>
              <div className="grid grid-cols-7 gap-1.5 mt-2 border rounded-lg p-3">
                {ALLE_KANTONE.map(k => (
                  <Button key={k} type="button" size="sm"
                    variant={selectedKantone.includes(k) ? 'default' : 'outline'}
                    onClick={() => toggleKanton(k)}
                    className="text-xs h-7 px-1">
                    {k}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>Excel-Datei (.xlsx)</Label>
            <div
              className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer mt-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
              <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium">{selectedFile ? selectedFile.name : 'Datei auswählen oder hierher ziehen'}</p>
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-1">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
              )}
            </div>
          </div>

          {/* Progress */}
          {uploading && progress && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 text-sm">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                {progress.phase === 'parsing' ? (
                  <span>Excel wird lokal geparst...</span>
                ) : (
                  <span>
                    Kanton <strong>{progress.kanton}</strong> ({progress.current}/{progress.total}) — {progress.records} Records
                  </span>
                )}
              </div>
              {progress.phase === 'importing' && (
                <div className="mt-2 h-1.5 bg-blue-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {uploadResult && (
            <div className={`p-4 rounded-lg border ${uploadResult.error ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
              {uploadResult.error ? (
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-4 h-4" />
                  <p className="font-medium text-sm">{uploadResult.error}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <p className="font-medium text-sm">{uploadResult.message}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mt-2">
                    <div><p className="text-muted-foreground text-xs">Gesamt</p><p className="font-bold">{uploadResult.results?.gesamt}</p></div>
                    <div><p className="text-muted-foreground text-xs">Erfolgreich</p><p className="font-bold text-emerald-700">{uploadResult.results?.erfolgreich}</p></div>
                    <div><p className="text-muted-foreground text-xs">Fehler</p><p className="font-bold text-red-700">{uploadResult.results?.fehler}</p></div>
                  </div>
                  {uploadResult.errors && (
                    <div className="mt-2 text-xs text-red-600 space-y-0.5">
                      {uploadResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDialog(false)}>Schliessen</Button>
          <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
            {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Importiere...</> : <><Upload className="w-3.5 h-3.5 mr-2" />Importieren</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}