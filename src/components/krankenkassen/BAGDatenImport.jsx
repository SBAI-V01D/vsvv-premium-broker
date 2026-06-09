import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Info, Search } from 'lucide-react';

const ALLE_KANTONE = ['ZH','BE','LU','UR','SZ','OW','NW','GL','ZG','FR','SO','BS','BL','SH','AR','AI','SG','GR','AG','TG','TI','VD','VS','NE','GE','JU'];

const MODELL_MAP = {
  'TAR-STD': 'standard', 'TAR-TEL': 'telmed', 'TAR-HAM': 'hausarzt', 'TAR-HMO': 'hmo'
};

// BAG Franchise-Akronym → CHF Betrag (neues Format: FRA-0, FRA-100, ...)
const FRANCHISE_AKRO_MAP = {
  'FRA-0': 300, 'FRA-100': 300,   // Kinder haben FRA-0/100, für Erwachsene nicht relevant
  'FRA-300': 300, 'FRA-500': 500,
  'FRA-1000': 1000, 'FRA-1500': 1500,
  'FRA-2000': 2000, 'FRA-2500': 2500,
};

// BAG Franchise-Index → CHF Betrag (altes Format)
const FRANCHISE_MAP = { 3: 300, 4: 500, 5: 1000, 6: 1500, 7: 2000, 8: 2500 };

// BAG Versicherer-ID → Name (vollständige offizielle BAG-Liste)
const VERSICHERER_NAMEN = {
  // CSS Gruppe
  8: 'CSS', 1068: 'CSS', 1535: 'CSS', 1090: 'CSS', 1091: 'CSS',
  // Helsana Gruppe
  1064: 'Helsana', 1509: 'Helsana', 1086: 'Helsana', 1087: 'Helsana', 1088: 'Helsana',
  // Sanitas
  1109: 'Sanitas', 1384: 'Swica',
  // Swica
  1113: 'Swica',
  // Visana Gruppe
  1066: 'Visana', 1040: 'Visana', 1041: 'Visana', 1555: 'Visana',
  // KPT
  1065: 'KPT', 1053: 'KPT', 376: 'KPT',
  // Concordia
  1118: 'Concordia', 1100: 'Concordia', 290: 'Concordia',
  // Groupe Mutuel (alle Marken: Mutuel, Sanatel, Philos, Avenir, Easy Sana)
  1562: 'Groupe Mutuel', 1563: 'Groupe Mutuel', 1564: 'Groupe Mutuel',
  1077: 'Groupe Mutuel', 1078: 'Groupe Mutuel', 1079: 'Groupe Mutuel',
  1080: 'Groupe Mutuel', 1081: 'Groupe Mutuel',
  343: 'Groupe Mutuel', 1479: 'Groupe Mutuel', // Avenir + Mutuel
  // Atupri
  1021: 'Atupri', 312: 'Atupri',
  // Assura
  1019: 'Assura',
  // ÖKK
  1024: 'ÖKK', 455: 'ÖKK',
  // Agrisano
  1016: 'Agrisano',
  // Sympany / Vivao
  1097: 'Sympany', 1126: 'Vivao Sympany', 509: 'Vivao Sympany', 57: 'Sympany',
  // EGK
  1048: 'EGK', 881: 'EGK',
  // Sana24
  1096: 'Sana24',
  // bkk mobilise
  1017: 'bkk mobilise',
  // Galenus / GALENOS
  1025: 'Galenus',
  // Aquilana
  1007: 'Aquilana', 32: 'Aquilana',
  // SUPRA
  1111: 'SUPRA', 62: 'SUPRA',
  // Sumiswalder
  1112: 'Sumiswalder', 194: 'Sumiswalder',
  // Steffisburg
  1110: 'Steffisburg', 246: 'Steffisburg',
  // Easy Sana / Avenir (Groupe Mutuel)
  1082: 'Groupe Mutuel', 1083: 'Groupe Mutuel',
  // Kleinere/regionale Kassen mit eigenen alten IDs
  1322: 'Birchmeier', // Krankenkasse Birchmeier, Künten
  1384: 'Swica',     // SWICA (ältere ID)
  1479: 'Groupe Mutuel', // Mutuel Assurance
  1507: 'AMB Assurances',
  923: 'SLKK',       // Krankenkasse SLKK Zürich
  941: 'sodalis',    // sodalis Krankenkasse, Visp
  780: 'Glarner',    // Glarner Krankenversicherung
};

function findCol(headers, ...candidates) {
  for (const c of candidates) {
    const idx = headers.findIndex(h => String(h || '').toLowerCase().includes(c.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

// Analysiert die Datei und gibt Diagnose + geparste Records zurück
function analyzeAndParseBAGExcel(file, jahr) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(ws, { raw: true, header: 1 });

        if (allRows.length < 2) {
          reject(new Error('Datei ist leer'));
          return;
        }

        const headers = allRows[0].map(h => String(h || ''));
        const sampleRow = allRows[1];

        // Spalten finden — Tariftyp vor Tarif suchen (wichtig: Tariftyp enthält TAR-STD etc.)
        const colKanton      = findCol(headers, 'kanton', 'canton');
        const colVersicherer = findCol(headers, 'versich', 'insurer', 'kasse');
        const colJahr        = findCol(headers, 'gesch', 'jahr', 'year');
        const colRegion      = findCol(headers, 'region', 'praemienregion');
        const colAlter       = findCol(headers, 'altersklasse', 'alters', 'age');
        const colUnfall      = findCol(headers, 'unfall', 'accident');
        const colTarif       = findCol(headers, 'tariftyp', 'tariftype', 'modell');  // Tariftyp zuerst!
        const colFranchise   = findCol(headers, 'franchise', 'selbstbeh');
        const colPraemie     = findCol(headers, 'prämie', 'praemie', 'premium', 'betrag');

        const useFixed = colKanton === -1 || colPraemie === -1;

        // Diagnosedaten sammeln
        const uniqueAlter = new Set();
        const uniqueTarif = new Set();
        const uniqueUnfall = new Set();
        const uniqueVersicherer = new Set();
        const uniqueFranchise = new Set();

        // Stichprobe über die ganze Datei verteilt (nicht nur erste 500)
        const sampleIndices = new Set();
        const sampleStep = Math.max(1, Math.floor(allRows.length / 200));
        for (let i = 1; i < allRows.length; i += sampleStep) sampleIndices.add(i);

        for (const i of sampleIndices) {
          const row = allRows[i];
          if (!row?.length) continue;
          if (useFixed) {
            uniqueVersicherer.add(String(row[0] || ''));
            uniqueAlter.add(String(row[5] || ''));
            uniqueUnfall.add(String(row[6] || ''));
            uniqueTarif.add(String(row[8] || ''));
            uniqueFranchise.add(String(row[11] || ''));
          } else {
            if (colAlter >= 0) uniqueAlter.add(String(row[colAlter] || ''));
            if (colTarif >= 0) uniqueTarif.add(String(row[colTarif] || ''));
            if (colUnfall >= 0) uniqueUnfall.add(String(row[colUnfall] || ''));
            if (colVersicherer >= 0) uniqueVersicherer.add(String(row[colVersicherer] || ''));
            if (colFranchise >= 0) uniqueFranchise.add(String(row[colFranchise] || ''));
          }
        }

        const diagnose = {
          sheets: workbook.SheetNames,
          totalRows: allRows.length - 1,
          headers: headers.slice(0, 20),
          sampleRow: sampleRow?.slice(0, 20),
          useFixed,
          cols: { colKanton, colVersicherer, colAlter, colUnfall, colTarif, colFranchise, colPraemie },
          uniqueAlter: [...uniqueAlter].slice(0, 20),
          uniqueTarif: [...uniqueTarif].slice(0, 15),
          uniqueUnfall: [...uniqueUnfall].slice(0, 10),
          uniqueVersicherer: [...uniqueVersicherer].slice(0, 15),
          uniqueFranchise: [...uniqueFranchise].slice(0, 10),
        };

        // Nun parsen — aber mit ALLEN Altersklassen die nicht explizit Kinder/Jugendliche sind
        const byKanton = {};
        let skippedAlter = 0, skippedTarif = 0, skippedPraemie = 0, skippedUnbekanntId = 0;
        const unbekannteIds = new Set();

        for (let i = 1; i < allRows.length; i++) {
          const row = allRows[i];
          if (!row?.length) continue;

          let versichererId, kantonCode, geschaeftsjahr, regionCode, altersklasse, unfalleinschluss, tarifTyp, franchiseCode, praemie;

          if (useFixed) {
            [versichererId, kantonCode, geschaeftsjahr, , regionCode, altersklasse, unfalleinschluss, , tarifTyp, , , franchiseCode, , praemie] = row;
          } else {
            versichererId    = row[colVersicherer];
            kantonCode       = row[colKanton];
            geschaeftsjahr   = colJahr >= 0 ? row[colJahr] : jahr;
            regionCode       = colRegion >= 0 ? row[colRegion] : '';
            altersklasse     = colAlter >= 0 ? row[colAlter] : '';
            unfalleinschluss = colUnfall >= 0 ? row[colUnfall] : '';
            tarifTyp         = row[colTarif];
            franchiseCode    = row[colFranchise];
            praemie          = row[colPraemie];
          }

          // Altersfilter: NUR Erwachsene (AKL-ERW) und Jugendliche (AKL-JUG) — Kinder (AKL-KIN) überspringen
          const alterStr = String(altersklasse || '').toUpperCase();
          if (alterStr === 'AKL-KIN' || alterStr.includes('KIN') || alterStr.includes('KIND')) {
            skippedAlter++;
            continue;
          }
          // Altersgruppe bestimmen
          const istJugendlich = alterStr === 'AKL-JUG' || alterStr.includes('JUG');

          // Unfall: MIT-UNF überspringen (wir wollen OHNE-UNF = günstiger)
          const unfallStr = String(unfalleinschluss || '').toUpperCase();
          if (unfallStr === 'MIT-UNF' || unfallStr === 'MIT' || unfallStr === 'WITH' || unfallStr === '1' || unfallStr === 'JA') continue;

          if (!praemie || parseFloat(praemie) <= 0) { skippedPraemie++; continue; }

          const tarifStr = String(tarifTyp || '').toUpperCase();
          const modell = MODELL_MAP[tarifStr] ||
            (tarifStr.includes('STD') || tarifStr.includes('STANDARD') ? 'standard' :
             tarifStr.includes('TEL') ? 'telmed' :
             tarifStr.includes('HAM') || tarifStr.includes('HAUS') ? 'hausarzt' :
             tarifStr.includes('HMO') ? 'hmo' : null);
          if (!modell) { skippedTarif++; continue; } // DIV-Tarife, Komplementär etc. → ignorieren

          const kanton = String(kantonCode || '').trim().toUpperCase();
          if (!kanton || kanton.length > 3) continue;

          // Franchise — neues Format: FRA-300, FRA-500, etc. / altes Format: Index 3-8
          let franchise = 300;
          const franchiseStr = String(franchiseCode || '').trim().toUpperCase();
          if (FRANCHISE_AKRO_MAP[franchiseStr] !== undefined) {
            franchise = FRANCHISE_AKRO_MAP[franchiseStr];
          } else {
            const franchiseInt = parseInt(franchiseStr.match(/(\d+)/)?.[1] || '0');
            if (FRANCHISE_MAP[franchiseInt]) franchise = FRANCHISE_MAP[franchiseInt];
            else if (franchiseInt >= 300) franchise = franchiseInt;
          }
          // Für Erwachsene: nur Standard-Franchisen 300-2500 importieren
          if (!istJugendlich && ![300,500,1000,1500,2000,2500].includes(franchise)) continue;

          // Kassenname — unbekannte IDs überspringen
          const kassieId = parseInt(versichererId);
          const kassenName = VERSICHERER_NAMEN[kassieId];
          if (!kassenName) {
            unbekannteIds.add(String(versichererId || '').trim());
            skippedUnbekanntId++;
            continue;
          }

          if (!byKanton[kanton]) byKanton[kanton] = [];
          byKanton[kanton].push({
            jahr: parseInt(String(geschaeftsjahr || jahr).match(/\d{4}/)?.[0] || jahr),
            krankenkasse: kassenName,
            kanton,
            region: String(regionCode || ''),
            modell,
            franchise,
            unfall: false,
            praemie_erwachsene: istJugendlich ? 0 : parseFloat(praemie),
            praemie_kinder: istJugendlich ? parseFloat(praemie) : 0,
            geschlecht: 'm',
            alter_von: istJugendlich ? 19 : 26,
            alter_bis: istJugendlich ? 25 : 99,
            datenquelle: 'BAG',
            gueltig_ab: `${jahr}-01-01`,
            gueltig_bis: `${jahr}-12-31`,
          });
        }

        const totalParsed = Object.values(byKanton).reduce((s, v) => s + v.length, 0);
        diagnose.skippedAlter = skippedAlter;
        diagnose.skippedTarif = skippedTarif;
        diagnose.skippedPraemie = skippedPraemie;
        diagnose.skippedUnbekanntId = skippedUnbekanntId;
        diagnose.unbekannteIds = [...unbekannteIds].sort();
        diagnose.totalParsed = totalParsed;
        diagnose.kantone = Object.keys(byKanton);

        resolve({ byKanton, diagnose });
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
  const [progress, setProgress] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [diagnose, setDiagnose] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [parsedData, setParsedData] = useState(null);

  const toggleKanton = (kanton) => {
    setSelectedKantone(prev =>
      prev.includes(kanton) ? prev.filter(k => k !== kanton) : [...prev, kanton]
    );
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
      setDiagnose(null);
      setParsedData(null);
    }
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const bulkCreateWithRetry = async (batch) => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await base44.entities.BAGPraemienDaten.bulkCreate(batch);
        return;
      } catch (err) {
        const isRateLimit = err?.response?.status === 429
          || String(err?.message || '').toLowerCase().includes('rate limit')
          || String(err?.message || '').includes('429');
        if (isRateLimit && attempt < 5) {
          await sleep(attempt * 10000);
        } else {
          throw err;
        }
      }
    }
  };

  // Schritt 1: Datei analysieren
  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setProgress({ phase: 'parsing' });
    setDiagnose(null);
    setParsedData(null);
    try {
      const result = await analyzeAndParseBAGExcel(selectedFile, parseInt(jahr));
      setDiagnose(result.diagnose);
      setParsedData(result.byKanton);
    } catch (err) {
      setDiagnose({ error: err.message });
    }
    setProgress(null);
  };

  // Schritt 2: Importieren
  const handleUpload = async () => {
    if (!parsedData) return;
    setUploading(true);
    setUploadResult(null);

    let erfolgreich = 0;
    let fehler = 0;
    const errors = [];

    const kantoneInDatei = Object.keys(parsedData);
    const kantoneToImport = importModus === 'auswahl'
      ? selectedKantone.filter(k => kantoneInDatei.includes(k))
      : kantoneInDatei;

    const BATCH = 10;

    for (let i = 0; i < kantoneToImport.length; i++) {
      const kanton = kantoneToImport[i];
      const records = parsedData[kanton] || [];
      if (records.length === 0) continue;

      const now = new Date().toISOString();
      const enriched = records.map(r => ({ ...r, importiert_am: now, aktiv: true }));
      let kantOk = 0;

      try {
        for (let b = 0; b < enriched.length; b += BATCH) {
          await bulkCreateWithRetry(enriched.slice(b, b + BATCH));
          kantOk += Math.min(BATCH, enriched.length - b);
          setProgress({ phase: 'importing', current: i + 1, total: kantoneToImport.length, kanton, records: kantOk, total_records: enriched.length });
          if (b + BATCH < enriched.length) await sleep(1500);
        }
        erfolgreich += kantOk;
      } catch (err) {
        fehler++;
        errors.push(`${kanton}: ${err.message}`);
      }

      if (i < kantoneToImport.length - 1) await sleep(2000);
    }

    setUploadResult({
      success: erfolgreich > 0,
      results: { gesamt: erfolgreich + fehler, erfolgreich, fehler },
      message: erfolgreich > 0 ? `${erfolgreich} Datensätze erfolgreich importiert` : 'Import fehlgeschlagen',
      errors: errors.length > 0 ? errors : null
    });

    if (erfolgreich > 0) queryClient.invalidateQueries({ queryKey: ['bag-praemien-stats'] });

    setUploading(false);
    setProgress(null);
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-3.5 h-3.5 mr-2" />
          BAG-Daten importieren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <strong>2-Schritt-Import:</strong> Zuerst "Analysieren" klicken um die Datei zu prüfen, dann "Importieren".
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
              <p className="text-sm font-medium">{selectedFile ? selectedFile.name : 'Datei auswählen'}</p>
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-1">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
              )}
            </div>
          </div>

          {/* Analyse-Button */}
          {selectedFile && !diagnose && (
            <Button variant="outline" onClick={handleAnalyze} disabled={!!progress} className="w-full">
              {progress ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Analysiere...</> : <><Search className="w-3.5 h-3.5 mr-2" />Datei analysieren (Schritt 1)</>}
            </Button>
          )}

          {/* Diagnose-Ergebnis */}
          {diagnose && !diagnose.error && (
            <div className="border rounded-lg p-4 bg-slate-50 space-y-3 text-xs">
              <p className="font-semibold text-sm text-slate-700">📊 Datei-Analyse</p>

              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Zeilen gesamt:</span> <strong>{diagnose.totalRows?.toLocaleString()}</strong></div>
                <div><span className="text-muted-foreground">Geparste Records:</span> <strong className={diagnose.totalParsed > 0 ? 'text-emerald-700' : 'text-red-700'}>{diagnose.totalParsed?.toLocaleString()}</strong></div>
                <div><span className="text-muted-foreground">Übersprungen (Alter):</span> <strong>{diagnose.skippedAlter}</strong></div>
                <div><span className="text-muted-foreground">Übersprungen (Tarif):</span> <strong>{diagnose.skippedTarif}</strong></div>
                <div><span className="text-muted-foreground">Übersprungen (Unbekannte ID):</span> <strong className={diagnose.skippedUnbekanntId > 0 ? 'text-amber-700' : ''}>{diagnose.skippedUnbekanntId}</strong></div>
                <div><span className="text-muted-foreground">Spalten-Modus:</span> <strong>{diagnose.useFixed ? 'Fest (kein Header)' : 'Dynamisch'}</strong></div>
                <div><span className="text-muted-foreground">Kantone:</span> <strong>{diagnose.kantone?.length}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Spalten-Indizes (Tariftyp/Alter/Franchise/Prämie):</span> <strong className="font-mono">{diagnose.cols?.colTarif} / {diagnose.cols?.colAlter} / {diagnose.cols?.colFranchise} / {diagnose.cols?.colPraemie}</strong></div>
              </div>

              <div>
                <p className="text-muted-foreground mb-1">Header:</p>
                <p className="font-mono bg-white border rounded p-1 break-all">{diagnose.headers?.join(' | ')}</p>
              </div>

              <div>
                <p className="text-muted-foreground mb-1">Zeile 1 (Rohdaten):</p>
                <p className="font-mono bg-white border rounded p-1 break-all">{diagnose.sampleRow?.join(' | ')}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground mb-1">Altersklassen (Stichprobe):</p>
                  <p className="font-mono bg-white border rounded p-1">{diagnose.uniqueAlter?.join(', ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Tarife:</p>
                  <p className="font-mono bg-white border rounded p-1">{diagnose.uniqueTarif?.join(', ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Franchise-Werte:</p>
                  <p className="font-mono bg-white border rounded p-1">{diagnose.uniqueFranchise?.join(', ')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Versicherer (Stichprobe):</p>
                  <p className="font-mono bg-white border rounded p-1">{diagnose.uniqueVersicherer?.join(', ')}</p>
                </div>
              </div>

              {diagnose.unbekannteIds?.length > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800">
                  <p className="font-semibold mb-1">⚠️ {diagnose.unbekannteIds.length} unbekannte Versicherer-IDs übersprungen ({diagnose.skippedUnbekanntId} Zeilen):</p>
                  <p className="font-mono text-xs">{diagnose.unbekannteIds.join(', ')}</p>
                  <p className="text-xs mt-1 text-amber-700">Diese IDs fehlen im Mapping — bitte dem Entwickler mitteilen.</p>
                </div>
              )}

              {diagnose.totalParsed === 0 && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700">
                  ⚠️ Keine Records geparst! Bitte Rohdaten oben prüfen und an den Support melden.
                </div>
              )}

              {diagnose.totalParsed > 0 && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-700">
                  ✅ {diagnose.totalParsed?.toLocaleString()} Records bereit für Import
                </div>
              )}
            </div>
          )}

          {diagnose?.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Analysefehler: {diagnose.error}
            </div>
          )}

          {/* Progress */}
          {uploading && progress && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 text-sm">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Kanton <strong>{progress.kanton}</strong> ({progress.current}/{progress.total}) — {progress.records}/{progress.total_records} Records</span>
              </div>
              <div className="mt-2 h-1.5 bg-blue-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }} />
              </div>
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowDialog(false)}>Schliessen</Button>
          {diagnose && !diagnose.error && diagnose.totalParsed > 0 && !uploadResult && (
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading
                ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Importiere...</>
                : <><Upload className="w-3.5 h-3.5 mr-2" />Importieren ({diagnose.totalParsed?.toLocaleString()} Records)</>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}