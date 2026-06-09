# VSVV CRM - Importprozess BAG-Daten

**Version:** 1.0  
**Datum:** 2026-06-09  
**Status:** Phase 1 - Zur Implementierung

---

## Übersicht

Dieses Dokument beschreibt den vollständigen Importprozess für BAG-Prämiendaten (217'472+ Records).

---

## Import-Phasen

```
┌─────────────────────────────────────────────────────────────────┐
│                    BAG-Import Phasen                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: Vorbereitung                                          │
│  ─────────────────────────                                      │
│  ✓ Supabase-Connector autorisieren                              │
│  ✓ Secrets konfigurieren                                        │
│  ✓ SQL-Schema erstellen                                         │
│  ✓ Referenzdaten laden (Kantone, Versicherer, PLZ)              │
│                                                                 │
│  Phase 2: Test-Import                                           │
│  ───────────────────                                            │
│  ✓ Excel-Datei parsen (Client-side)                             │
│  ✓ Validierung (Mapping, Plausibilität)                         │
│  ✓ Test-Import (1 Kanton, ~8'000 Records)                       │
│  ✓ Qualitätskontrolle                                           │
│                                                                 │
│  Phase 3: Voll-Import                                           │
│  ──────────────────                                             │
│  ✓ Bulk-Import (alle 26 Kantone, 217'472 Records)               │
│  ✓ Versionskontrolle                                            │
│  ✓ Fehlerjournal                                                │
│  ✓ Abschlussbericht                                             │
│                                                                 │
│  Phase 4: Validierung                                           │
│  ───────────────────                                            │
│  ✓ Datenintegrität prüfen                                       │
│  ✓ Plausibilitätstests                                          │
│  ✓ Vergleich mit BAG-Original                                   │
│  ✓ Freigabe für Produktivbetrieb                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detaillierter Ablauf

### Phase 1: Vorbereitung

**Dauer:** 1-2 Stunden

#### 1.1 Supabase-Connector autorisieren

```javascript
// Base44 Dashboard → Integrations → Supabase
// OAuth-Flow durchführen

Scopes:
- projects:read
- database:read
- secrets:read
```

#### 1.2 Secrets konfigurieren

```bash
# Base44 Dashboard → Settings → Secrets

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

#### 1.3 SQL-Schema erstellen

```bash
# Supabase Dashboard → SQL Editor

-- Alle Tabellen erstellen
-- Siehe: docs/SQL_SCHEMA_COMPLETE.sql

CREATE TABLE ref_kantone ...;
CREATE TABLE versicherer ...;
CREATE TABLE bag_praemien ...;
-- etc.
```

#### 1.4 Referenzdaten laden

```sql
-- Kantone (26)
INSERT INTO ref_kantone VALUES ...;

-- BAG-Regionen (3)
INSERT INTO ref_bag_regionen VALUES ...;

-- Versicherer (41+)
INSERT INTO versicherer VALUES ...;

-- PLZ (optional, 3'100+)
-- Siehe: docs/SQL_SEED_DATA.sql
```

---

### Phase 2: Test-Import

**Dauer:** 10-15 Minuten

#### 2.1 Excel-Datei parsen

**Component:** `BAGDatenImport.jsx`

```javascript
// 1. Datei auswählen
const file = fileInput.files[0];

// 2. Parsing (XLSX.js)
const workbook = XLSX.read(file, { type: 'array' });
const ws = workbook.Sheets[workbook.SheetNames[0]];
const allRows = XLSX.utils.sheet_to_json(ws, { raw: true, header: 1 });

// 3. Analyse
const { byKanton, diagnose } = await analyzeAndParseBAGExcel(file, jahr);

// 4. Diagnose anzeigen
console.log(diagnose);
// {
//   totalRows: 217472,
//   totalParsed: 217470,
//   skippedAlter: 0,
//   skippedTarif: 2,
//   unbekannteIds: []
// }
```

#### 2.2 Validierung

**Validierungsregeln:**

```javascript
const validationRules = {
  // Altersklassen
  altersklassen: ['kind', 'jugend', 'erwachsen'],
  
  // Tariftypen
  modelle: ['standard', 'telmed', 'hausarzt', 'hmo', 'div'],
  
  // Franchisen
  franchisen: [0, 100, 200, 300, 400, 500, 600, 1000, 1500, 2000, 2500],
  
  // Kanton
  kantone: ['ZH', 'BE', 'LU', ...], // Alle 26
  
  // Prämie
  praemie_min: 50,
  praemie_max: 2000
};
```

#### 2.3 Test-Import (1 Kanton)

**Request:**

```javascript
const testImport = await base44.functions.invoke('importBAGDatenToSupabase', {
  records: parsedData['ZH'], // Nur Kanton ZH
  jahr: 2026,
  importModus: 'auswahl',
  selectedKantone: ['ZH']
});
```

**Response:**

```json
{
  "success": true,
  "gesamt": 8364,
  "erfolgreich": 8364,
  "fehler": 0,
  "importVersionId": "uuid-1234",
  "duration_ms": 45230
}
```

#### 2.4 Qualitätskontrolle

**Function:** `validateBAGImport`

```javascript
const validation = await base44.functions.invoke('validateBAGImport', {
  importVersionId: 'uuid-1234'
});

console.log(validation);
// {
//   valid: true,
//   errors: [],
//   stats: {
//     anzahl_gesamt: 8364,
//     altersklassen: ['kind', 'jugend', 'erwachsen'],
//     modelle: ['standard', 'telmed', 'hausarzt', 'hmo'],
//     versicherer_count: 41,
//     kantone_count: 1
//   }
// }
```

---

### Phase 3: Voll-Import

**Dauer:** 5-10 Minuten

#### 3.1 Bulk-Import

**Request:**

```javascript
const fullImport = await base44.functions.invoke('importBAGDatenToSupabase', {
  records: allRecords, // Alle 217'472 Records
  jahr: 2026,
  importModus: 'alle_26'
});
```

**Response:**

```json
{
  "success": true,
  "gesamt": 217472,
  "erfolgreich": 217470,
  "fehler": 2,
  "importVersionId": "uuid-5678",
  "duration_ms": 543210,
  "errors": [
    "Row 12345: Unbekannte Versicherer-ID 9999",
    "Row 67890: Ungültige Prämie -50.00"
  ]
}
```

#### 3.2 Versionskontrolle

**Database:** `bag_import_versions`

```sql
INSERT INTO bag_import_versions (
  versionsnummer,
  geschaeftsjahr,
  import_datei_name,
  anzahl_records_gesamt,
  anzahl_records_erfolgreich,
  status,
  validiert
) VALUES (
  1,
  2026,
  'BAG_Praemien_2026.xlsx',
  217472,
  217470,
  'completed',
  false
);
```

#### 3.3 Fehlerjournal

**Database:** `bag_import_errors`

```sql
INSERT INTO bag_import_errors (
  import_version_id,
  fehler_typ,
  fehler_schwere,
  row_number,
  fehlermeldung,
  feld_name,
  feld_wert
) VALUES (
  'uuid-5678',
  'mapping_error',
  'error',
  12345,
  'Unbekannte Versicherer-ID 9999',
  'versicherer_id',
  '9999'
);
```

#### 3.4 Abschlussbericht

**Component:** `BAGDatenAdmin.jsx`

```javascript
const report = {
  importiert_am: new Date().toISOString(),
  importiert_von: 'admin@vsvv.ch',
  datei: 'BAG_Praemien_2026.xlsx',
  jahr: 2026,
  gesamt: 217472,
  erfolgreich: 217470,
  fehler: 2,
  dauer_ms: 543210,
  dauer_formatted: '9:03 Min.',
  version: 1
};
```

---

### Phase 4: Validierung

**Dauer:** 30-60 Minuten

#### 4.1 Datenintegrität

**SQL-Checks:**

```sql
-- 1. Total Records
SELECT COUNT(*) FROM bag_praemien WHERE geschaeftsjahr = 2026;
-- Erwartet: 217'470

-- 2. Alle Altersklassen
SELECT DISTINCT altersklasse FROM bag_praemien;
-- Erwartet: kind, jugend, erwachsen

-- 3. Alle Modell-Typen
SELECT DISTINCT modell FROM bag_praemien;
-- Erwartet: standard, telmed, hausarzt, hmo, div

-- 4. Alle Kantone
SELECT DISTINCT kanton FROM bag_praemien;
-- Erwartet: 26 Kantone

-- 5. Alle Versicherer
SELECT COUNT(DISTINCT versicherer_id) FROM bag_praemien;
-- Erwartet: 41+

-- 6. Plausibilität Prämiendaten
SELECT MIN(praemie), MAX(praemie), AVG(praemie) 
FROM bag_praemien 
WHERE geschaeftsjahr = 2026;
-- Erwartet: Min > 50, Max < 2000
```

#### 4.2 Plausibilitätstests

**Test-Cases:**

```javascript
const tests = [
  {
    name: 'Alle Altersklassen vorhanden',
    test: () => {
      const klassen = getDistinctValues('altersklasse');
      return klassen.includes('kind') && 
             klassen.includes('jugend') && 
             klassen.includes('erwachsen');
    }
  },
  {
    name: 'Alle Tariftypen vorhanden',
    test: () => {
      const modelle = getDistinctValues('modell');
      return modelle.includes('standard') && 
             modelle.includes('telmed') && 
             modelle.includes('hausarzt') && 
             modelle.includes('hmo');
    }
  },
  {
    name: 'Prämien plausibel',
    test: () => {
      const stats = getPraemieStats();
      return stats.min > 50 && stats.max < 2000 && stats.avg > 0;
    }
  },
  {
    name: 'Keine doppelten Records',
    test: () => {
      const duplicates = getDuplicates();
      return duplicates.length === 0;
    }
  }
];

// Alle Tests ausführen
tests.forEach(test => {
  const result = test.test();
  console.log(`${test.name}: ${result ? '✅' : '❌'}`);
});
```

#### 4.3 Vergleich mit BAG-Original

**Stichproben-Test:**

```javascript
// 10 zufällige Records aus BAG-Excel
const sampleRecords = getRandomRecords(10);

// Mit Supabase-Daten vergleichen
for (const record of sampleRecords) {
  const dbRecord = await queryDatabase(record);
  
  console.assert(
    dbRecord.praemie === record.praemie,
    `Prämie mismatch für ${record.versicherer}`
  );
  
  console.assert(
    dbRecord.modell === record.modell,
    `Modell mismatch für ${record.versicherer}`
  );
}
```

#### 4.4 Freigabe

**Checkliste:**

- [ ] Total Records korrekt (217'470)
- [ ] Alle Altersklassen vorhanden (kind, jugend, erwachsen)
- [ ] Alle Tariftypen vorhanden (standard, telmed, hausarzt, hmo, div)
- [ ] Alle 26 Kantone vorhanden
- [ ] 41+ Versicherer vorhanden
- [ ] Prämien plausibel (Min > 50, Max < 2000)
- [ ] Keine doppelten Records
- [ ] Fehlerjournal geprüft (< 0.01% Fehler)
- [ ] Stichproben-Test bestanden

**Freigabe:**

```markdown
# Import-Freigabe

**Datum:** 2026-06-09
**Import-Version:** 1
**Durchgeführt von:** admin@vsvv.ch

## Ergebnis

✅ Import erfolgreich abgeschlossen
✅ Alle Validierungen bestanden
✅ Fehlerquote: 0.0009% (2 von 217'472)
✅ Freigegeben für Produktivbetrieb

## Unterschriften

Admin: ✍️ Peter Adam
Datum: 2026-06-09
```

---

## Import-Statistiken

### Erwartete Werte

| Metrik | Wert |
|---|---|
| **Total Records** | 217'472 |
| **Pro Kanton** | ~8'364 |
| **Pro Versicherer** | ~5'304 |
| **Pro Altersklasse** | ~72'490 |
| **Pro Modell** | ~54'368 |
| **Fehlerquote** | < 0.01% |

### Performance

| Metrik | Ziel | Erwartet |
|---|---|---|
| **Import-Dauer** | < 10 Min. | 9:03 Min. |
| **Records/Sekunde** | > 400 | ~400 |
| **Query-Zeit** | < 1s | 234ms |

---

## Fehlerbehandlung

### Fehler-Kategorien

| Typ | Beschreibung | Aktion |
|---|---|---|
| `mapping_error` | Unbekannte ID | Mapping-Tabelle erweitern |
| `validation_error` | Ungültiger Wert | Datensatz korrigieren |
| `duplicate` | Doppelte | Skip oder Update |
| `invalid_data` | Plausibilität | Verwerfen |

### Retry-Logik

```javascript
const importWithRetry = async (records, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await importBAGDatenToSupabase(records);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(Math.pow(2, attempt) * 1000); // Exponential Backoff
    }
  }
};
```

---

## Monitoring

### Live-Status

```javascript
// Während Import
const [progress, setProgress] = useState({
  current: 0,
  total: 217472,
  percent: 0,
  kanton: 'ZH',
  records: 8364
});

// Fortschrittsanzeige
<ProgressBar 
  current={progress.current} 
  total={progress.total} 
/>
```

### Alerts

```javascript
// Bei Fehlern > 1%
if (errorRate > 0.01) {
  sendAlert({
    type: 'error',
    message: 'Fehlerquote > 1%',
    details: `${errorRate * 100}% Fehler`
  });
}

// Bei Timeout > 15 Min.
if (duration > 15 * 60 * 1000) {
  sendAlert({
    type: 'warning',
    message: 'Import dauert länger als erwartet',
    details: `${duration / 60000} Min.`
  });
}
```

---

## Dokumentation

### Import-Logs

**Speicherort:** `docs/imports/`

```
docs/imports/
├── import_2026_06_09_1030.md
├── import_2026_06_09_1100.md
├── validation_report_2026_06_09.md
└── error_log_2026_06_09.json
```

### Import-Report

**Vorlage:**

```markdown
# BAG-Import Report

**Datum:** 2026-06-09
**Uhrzeit:** 10:30:00
**Importiert von:** admin@vsvv.ch

## Datei

- Name: BAG_Praemien_2026.xlsx
- Grösse: 45.2 MB
- Quelle: BAG-Verzeichnis September 2025

## Statistik

- Total Records: 217'472
- Erfolgreich: 217'470
- Fehler: 2
- Fehlerquote: 0.0009%

## Dauer

- Start: 10:30:00
- Ende: 10:39:03
- Gesamt: 9:03 Min.

## Validierung

✅ Alle Altersklassen vorhanden
✅ Alle Tariftypen vorhanden
✅ Alle 26 Kantone
✅ 41+ Versicherer
✅ Prämien plausibel

## Fehler

1. Row 12345: Unbekannte Versicherer-ID 9999
2. Row 67890: Ungültige Prämie -50.00

## Freigabe

✅ Import erfolgreich
✅ Validierung bestanden
✅ Freigegeben für Produktivbetrieb

**Unterschrift:** ✍️ Peter Adam
```

---

## Versionierung

| Version | Datum | Änderungen |
|---|---|---|
| 1.0 | 2026-06-09 | Initiale Version für Phase 1 |

---

**Nächste Schritte:**

1. ✅ Importprozess dokumentiert
2. ⏳ Phase 1: Vorbereitung (Supabase Setup)
3. ⏳ Phase 2: Test-Import (1 Kanton)
4. ⏳ Phase 3: Voll-Import (alle 26 Kantone)
5. ⏳ Phase 4: Validierung & Freigabe