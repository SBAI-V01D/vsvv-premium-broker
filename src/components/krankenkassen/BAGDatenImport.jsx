import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Info, Search } from 'lucide-react';
import BAGImportResult from './BAGImportResult';

const ALLE_KANTONE = ['ZH','BE','LU','UR','SZ','OW','NW','GL','ZG','FR','SO','BS','BL','SH','AR','AI','SG','GR','AG','TG','TI','VD','VS','NE','GE','JU'];

// Fehlende IDs aus dem BAG-Verzeichnis September 2025
// 1542=Assura-Basis, 1568=sana24, 1386=Galenos(Visana), 1560=Agrisano, 1401=rhenusana, 966=vita surselva, 360=Luzerner Hinterland, 1318=Wädenswil, 820=Lumneziana

const MODELL_MAP = {
  'TAR-STD':  'standard',
  'TAR-BASE': 'standard',  // BAG 2026: Standard-Tarif als TAR-BASE codiert
  'TAR-TEL':  'telmed',
  'TAR-HAM':  'hausarzt',
  'TAR-HMO':  'hmo',
  'TAR-DIV':  'other',     // Diverse/spezial Modelle (importieren, nicht ausschliessen)
};

// BAG Franchise-Akronym → CHF Betrag
// Kinder: FRA-0 (0), FRA-100 (100), FRA-200 (200), FRA-400 (400), FRA-600 (600)
// Jugendliche/Erwachsene: FRA-300 (300), FRA-500 (500), FRA-1000 (1000), etc.
const FRANCHISE_AKRO_MAP = {
  'FRA-0':    0,
  'FRA-100':  100,
  'FRA-200':  200,
  'FRA-300':  300,
  'FRA-400':  400,
  'FRA-500':  500,
  'FRA-600':  600,
  'FRA-1000': 1000,
  'FRA-1500': 1500,
  'FRA-2000': 2000,
  'FRA-2500': 2500,
};

// BAG Franchise-Index → CHF Betrag (altes Format)
const FRANCHISE_MAP = { 3: 300, 4: 500, 5: 1000, 6: 1500, 7: 2000, 8: 2500 };

// BAG Versicherer-ID → Name (vollständige offizielle BAG-Liste)
const VERSICHERER_NAMEN = {
  // CSS Gruppe
  8: 'CSS', 1068: 'CSS', 1535: 'CSS', 1090: 'CSS', 1091: 'CSS',
  // Helsana Gruppe
  1064: 'Helsana', 1562: 'Helsana', 1509: 'Sanitas', 1086: 'Helsana', 1087: 'Helsana', 1088: 'Helsana',
  // Sanitas
  1109: 'Sanitas',
  // Swica
  1384: 'Swica',
  // Visana Gruppe
  1066: 'Visana', 1040: 'Visana', 1041: 'Visana', 1555: 'Visana',
  1386: 'Galenos',   // Galenos AG (Visana-Gruppe) — BAG-ID 1386
  // KPT
  1065: 'KPT', 1053: 'KPT', 376: 'KPT',
  // Concordia
  1118: 'Concordia', 1100: 'Concordia', 290: 'Concordia',
  // Groupe Mutuel (alle Marken: Mutuel, Sanatel, Philos, Avenir, Easy Sana)
  1563: 'Groupe Mutuel', 1564: 'Groupe Mutuel',
  1077: 'Groupe Mutuel', 1078: 'Groupe Mutuel', 1079: 'Groupe Mutuel',
  1080: 'Groupe Mutuel', 1081: 'Groupe Mutuel', 1082: 'Groupe Mutuel', 1083: 'Groupe Mutuel',
  343: 'Groupe Mutuel', 1479: 'Groupe Mutuel', // Avenir + Mutuel
  1113: 'Groupe Mutuel', // Vallée d'Entremont (Groupe Mutuel-Zusammenarbeit)
  // Atupri
  1021: 'Atupri', 312: 'Atupri',
  // Assura
  1019: 'Assura',
  1542: 'Assura',    // Assura-Basis SA — BAG-ID 1542
  // ÖKK
  1024: 'ÖKK', 455: 'ÖKK',
  // Agrisano
  1016: 'Agrisano',
  1560: 'Agrisano',  // Agrisano (neue ID) — BAG-ID 1560
  // Sympany / Vivao
  1097: 'Sympany', 1126: 'Vivao Sympany', 509: 'Vivao Sympany', 57: 'Sympany',
  // EGK
  1048: 'EGK', 881: 'EGK',
  // Sana24
  1096: 'Sana24', 1568: 'Sana24',  // sana24 — BAG-ID 1568
  // bkk mobilise
  1017: 'bkk mobilise',
  // Aquilana
  1007: 'Aquilana', 32: 'Aquilana',
  // SUPRA
  1111: 'SUPRA', 62: 'SUPRA',
  // Sumiswalder
  1112: 'Sumiswalder', 194: 'Sumiswalder',
  // Steffisburg
  1110: 'Steffisburg', 246: 'Steffisburg',
  // Kleinere/regionale Kassen
  1322: 'Birchmeier',
  1507: 'AMB Assurances',
  923: 'SLKK',
  941: 'sodalis',
  780: 'Glarner',
  1401: 'rhenusana',      // rhenusana — BAG-ID 1401
  966: 'vita surselva',   // vita surselva — BAG-ID 966
  360: 'Luzerner Hinterland', // Krankenkasse Luzerner Hinterland — BAG-ID 360
  1318: 'Wädenswil',     // Krankenkasse Wädenswil — BAG-ID 1318
  820: 'Lumneziana',     // Cassa da malsauns Lumneziana — BAG-ID 820
  134: 'Einsiedler',     // Einsiedler Krankenkasse — BAG-ID 134
  829: 'KLuG',           // KLuG Krankenversicherung — BAG-ID 829
  901: 'sanavals',       // sanavals Gesundheitskasse — BAG-ID 901
  1040: 'Visperterminen', // Krankenkasse Visperterminen — BAG-ID 1040
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
        // "Franchise" (FRA-xxx Werte) bevorzugen, NICHT "Franchisestufe" (FRAST1-7)
        const colFranchise   = (() => {
          const exactIdx = headers.findIndex(h => String(h || '').toLowerCase() === 'franchise');
          if (exactIdx >= 0) return exactIdx;
          return findCol(headers, 'franchise', 'selbstbeh');
        })();
        const colPraemie     = findCol(headers, 'prämie', 'praemie', 'premium', 'betrag');

        const useFixed = colKanton === -1 || colPraemie === -1;

        // Diagnosedaten sammeln
        const uniqueAlter = new Set();
        const uniqueTarif = new Set();
        const uniqueUnfall = new Set();
        const uniqueVersicherer = new Set();
        const uniqueFranchise = new Set();

        // Stichprobe über die ganze Datei verteilt für Diagnose
        const sampleIndices = new Set();
        const sampleStep = Math.max(1, Math.floor(allRows.length / 500));
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

        // Nun parsen — mit detaillierter Statistik
        const byKanton = {};
        let skippedAlter = 0, skippedTarif = 0, skippedPraemie = 0, skippedUnbekanntId = 0;
        let skippedMitUnf = 0, skippedKanton = 0, skippedFranchise = 0;
        let totalMitUnf = 0, totalOhneUnf = 0;
        const unbekannteIds = new Set();
        const unbekannteIdCount = {};  // ID → Anzahl Zeilen
        const skippedTarifTypes = {};  // Tariftyp → Anzahl

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

          // Altersklasse bestimmen — alle 3 importieren
          const alterStr = String(altersklasse || '').toUpperCase();
          const istKind      = alterStr === 'AKL-KIN' || alterStr.includes('KIN');
          const istJugendlich = alterStr === 'AKL-JUG' || alterStr.includes('JUG');
          // Unbekannte Altersklasse überspringen
          if (!istKind && !istJugendlich && !alterStr.includes('ERW')) {
            skippedAlter++;
            continue;
          }

          // Unfall-Statistik erfassen — BEIDE importieren!
          const unfallStr = String(unfalleinschluss || '').toUpperCase();
          const istMitUnf = unfallStr === 'MIT-UNF' || unfallStr === 'MIT' || unfallStr === 'WITH' || unfallStr === '1' || unfallStr === 'JA';
          
          if (istMitUnf) {
            totalMitUnf++;
          } else {
            totalOhneUnf++;
          }

          if (!praemie || parseFloat(praemie) <= 0) { skippedPraemie++; continue; }

          const tarifStr = String(tarifTyp || '').toUpperCase();
          let modell = MODELL_MAP[tarifStr];
          
          // Fallback: Automatische Erkennung wenn nicht im MODELL_MAP
          if (!modell) {
            if (tarifStr.includes('STD') || tarifStr.includes('STANDARD')) modell = 'standard';
            else if (tarifStr.includes('TEL')) modell = 'telmed';
            else if (tarifStr.includes('HAM') || tarifStr.includes('HAUS')) modell = 'hausarzt';
            else if (tarifStr.includes('HMO')) modell = 'hmo';
            else if (tarifStr.includes('DIV')) modell = 'other';  // TAR-DIV explizit akzeptieren
          }
          
          // Unbekannte Tariftypen überspringen (aber TAR-DIV ist jetzt bekannt)
          if (!modell) {
            skippedTarif++;
            skippedTarifTypes[tarifStr] = (skippedTarifTypes[tarifStr] || 0) + 1;
            continue;
          }

          const kanton = String(kantonCode || '').trim().toUpperCase();
          if (!kanton || kanton.length > 3) {
            skippedKanton++;
            continue;
          }

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
          // Franchise-Filter je Altersklasse
          // Kinder: 0, 100, 200, 300, 400, 500, 600 | Jugend/Erwachsene: 300, 500, 1000, 1500, 2000, 2500
          const gueltigeFranchisen = istKind
            ? [0, 100, 200, 300, 400, 500, 600]
            : [300, 500, 1000, 1500, 2000, 2500];
          if (!gueltigeFranchisen.includes(franchise)) {
            skippedFranchise++;
            continue;
          }

          // Kassenname — unbekannte IDs überspringen
          const kassieId = parseInt(versichererId);
          const kassenName = VERSICHERER_NAMEN[kassieId];
          if (!kassenName) {
            const idStr = String(versichererId || '').trim();
            unbekannteIds.add(idStr);
            unbekannteIdCount[idStr] = (unbekannteIdCount[idStr] || 0) + 1;
            skippedUnbekanntId++;
            continue;
          }

          if (!byKanton[kanton]) byKanton[kanton] = [];
          const praemieVal = parseFloat(praemie);
          byKanton[kanton].push({
            jahr: parseInt(String(geschaeftsjahr || jahr).match(/\d{4}/)?.[0] || jahr),
            krankenkasse: kassenName,
            kanton,
            region: String(regionCode || ''),
            modell,
            franchise,
            unfall: istMitUnf,  // TRUE = MIT-UNF, FALSE = OHNE-UNF
            altersklasse: istKind ? 'kind' : istJugendlich ? 'jugend' : 'erwachsen',
            praemie_erwachsene: istKind ? 0 : praemieVal,
            praemie_kinder: istKind ? praemieVal : 0,
            geschlecht: 'm',
            alter_von: istKind ? 0 : istJugendlich ? 19 : 26,
            alter_bis: istKind ? 18 : istJugendlich ? 25 : 99,
            // Original BAG-Tarifbezeichnungen (für Analyse/Fehlersuche)
            tarif_original: String(tarifTyp || ''),
            tariftyp_original: String(tarifTyp || ''),
            tarifbezeichnung: String(tarifTyp || ''),
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
        diagnose.unbekannteIdCount = unbekannteIdCount;
        diagnose.skippedTarifTypes = skippedTarifTypes;
        diagnose.totalParsed = totalParsed;
        diagnose.kantone = Object.keys(byKanton);
        diagnose.skippedMitUnf = skippedMitUnf;
        diagnose.skippedKanton = skippedKanton;
        diagnose.skippedFranchise = skippedFranchise;
        diagnose.totalMitUnf = totalMitUnf;
        diagnose.totalOhneUnf = totalOhneUnf;

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
          // Exponentielles Backoff: 2s, 4s, 8s, 16s
          await sleep(Math.pow(2, attempt) * 1000);
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

    const BATCH = 25;
    const importStart = Date.now();

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
          // Pause zwischen Batches für Rate-Limit
          if (b + BATCH < enriched.length) await sleep(1000);
        }
        erfolgreich += kantOk;
      } catch (err) {
        fehler++;
        errors.push(`${kanton}: ${err.message}`);
      }
    }

    const importdauerMinuten = (Date.now() - importStart) / 60000;

    // Automatische Validierung auslösen
    let validierung = null;
    try {
      const validierungResponse = await base44.functions.invoke('validateBAGImport', {
        import_batch_id: 'manual-import-' + Date.now(),
        quelle_datei_gesamtzeilen: diagnose.totalParsed,
        importdauer_minuten: parseFloat(importdauerMinuten.toFixed(2)),
        skipped_alter: diagnose.skippedAlter || 0,
        skipped_tarif: diagnose.skippedTarif || 0,
        skipped_franchise: diagnose.skippedFranchise || 0,
        skipped_pflichtfelder: diagnose.skippedPraemie || 0,
        skipped_unbekannte_ids: diagnose.skippedUnbekanntId || 0,
      });
      validierung = validierungResponse.data;
    } catch (err) {
      console.error('Validierung fehlgeschlagen:', err);
    }

    setUploadResult({
      success: erfolgreich > 0,
      results: { gesamt: erfolgreich + fehler, erfolgreich, fehler },
      message: erfolgreich > 0 ? `${erfolgreich} Datensätze erfolgreich importiert` : 'Import fehlgeschlagen',
      errors: errors.length > 0 ? errors : null,
      importdauer_minuten: parseFloat(importdauerMinuten.toFixed(2)),
      validierung: validierung
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

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Zeilen gesamt:</span> <strong>{diagnose.totalRows?.toLocaleString()}</strong></div>
                  <div><span className="text-muted-foreground">Geparste Records:</span> <strong className={diagnose.totalParsed > 0 ? 'text-emerald-700' : 'text-red-700'}>{diagnose.totalParsed?.toLocaleString()}</strong></div>
                  <div><span className="text-muted-foreground">Spalten-Modus:</span> <strong>{diagnose.useFixed ? 'Fest (kein Header)' : 'Dynamisch'}</strong></div>
                  <div><span className="text-muted-foreground">Kantone:</span> <strong>{diagnose.kantone?.length}</strong></div>
                </div>

                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs">
                  <p className="font-semibold text-emerald-800 mb-2">✅ Vollständige Import-Strategie (BEIDE Unfall-Varianten)</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-emerald-700">MIT-UNF (importiert):</span> <strong className="text-emerald-900">{diagnose.totalMitUnf?.toLocaleString()}</strong></div>
                    <div><span className="text-emerald-700">OHNE-UNF (importiert):</span> <strong className="text-emerald-900">{diagnose.totalOhneUnf?.toLocaleString()}</strong></div>
                    <div><span className="text-muted-foreground">Übersprungen (Tarif):</span> <strong>{diagnose.skippedTarif}</strong></div>
                    <div><span className="text-muted-foreground">Übersprungen (Alter):</span> <strong>{diagnose.skippedAlter}</strong></div>
                    <div><span className="text-muted-foreground">Übersprungen (Franchise):</span> <strong>{diagnose.skippedFranchise || 0}</strong></div>
                    <div><span className="text-muted-foreground">Übersprungen (Kanton):</span> <strong>{diagnose.skippedKanton || 0}</strong></div>
                    <div><span className="text-muted-foreground">Übersprungen (Prämie ≤0):</span> <strong>{diagnose.skippedPraemie || 0}</strong></div>
                    <div><span className="text-muted-foreground">Übersprungen (Unbekannte ID):</span> <strong className={diagnose.skippedUnbekanntId > 0 ? 'text-amber-700' : ''}>{diagnose.skippedUnbekanntId}</strong></div>
                  </div>
                  <p className="text-xs text-emerald-700 mt-2">
                    <strong>Importiert gesamt:</strong> {(diagnose.totalMitUnf + diagnose.totalOhneUnf).toLocaleString()} von {diagnose.totalRows?.toLocaleString()} Zeilen
                  </p>
                  <p className="text-xs text-emerald-700">
                    <strong>Verworfen gesamt:</strong> {((diagnose.skippedTarif || 0) + (diagnose.skippedAlter || 0) + (diagnose.skippedFranchise || 0) + (diagnose.skippedKanton || 0) + (diagnose.skippedPraemie || 0) + (diagnose.skippedUnbekanntId || 0)).toLocaleString()}
                  </p>
                </div>

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
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 space-y-1">
                  <p className="font-semibold">⚠️ {diagnose.unbekannteIds.length} unbekannte Versicherer-IDs ({diagnose.skippedUnbekanntId} Zeilen übersprungen):</p>
                  <div className="font-mono text-xs space-y-0.5">
                    {Object.entries(diagnose.unbekannteIdCount || {}).sort((a,b) => b[1]-a[1]).map(([id, count]) => (
                      <span key={id} className="inline-block mr-2 bg-amber-100 px-1 rounded">{id} ({count}×)</span>
                    ))}
                  </div>
                  <p className="text-xs text-amber-700">→ Diese IDs müssen ins VERSICHERER_NAMEN-Mapping eingetragen werden.</p>
                </div>
              )}
              {diagnose.skippedTarifTypes && Object.keys(diagnose.skippedTarifTypes).length > 0 && (
                <div className="p-2 bg-slate-100 border border-slate-200 rounded text-slate-700 space-y-1">
                  <p className="font-semibold text-xs">ℹ️ Übersprungene Tariftypen ({diagnose.skippedTarif} Zeilen):</p>
                  <div className="font-mono text-xs">
                    {Object.entries(diagnose.skippedTarifTypes).sort((a,b) => b[1]-a[1]).map(([t, count]) => (
                      <span key={t} className="inline-block mr-2 bg-slate-200 px-1 rounded">{t} ({count}×)</span>
                    ))}
                  </div>
                </div>
              )}

              {diagnose.totalParsed === 0 && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700">
                  ⚠️ Keine Records geparst! Bitte Rohdaten oben prüfen und an den Support melden.
                </div>
              )}

              {diagnose.totalParsed > 0 && (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-700">
                  ✅ {diagnose.totalParsed?.toLocaleString()} Records bereit für Import (ohne Unfalldeckung)
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
          <BAGImportResult uploadResult={uploadResult} />
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