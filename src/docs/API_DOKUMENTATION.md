# VSVV CRM - API-Dokumentation

**Version:** 1.0  
**Datum:** 2026-06-09  
**Status:** Phase 1 - Zur Implementierung

---

## Übersicht

Diese Dokumentation beschreibt alle Backend-Endpunkte für die Supabase-Integration.

---

## Backend-Functions (Base44)

### 1. importBAGDatenToSupabase

**Zweck:** Bulk-Import von BAG-Prämiendaten nach Supabase

**Endpunkt:** `POST /functions/v1/importBAGDatenToSupabase`

**Auth:** Admin-only

**Request:**
```json
{
  "records": [
    {
      "versicherer_id": 8,
      "kanton": "ZH",
      "region": "1",
      "geschaeftsjahr": 2026,
      "altersklasse": "erwachsen",
      "modell": "standard",
      "franchise": 300,
      "unfall": false,
      "praemie": 456.70,
      "tarifbezeichnung": "TAR-BASE"
    }
  ],
  "jahr": 2026,
  "importModus": "alle_26",
  "selectedKantone": ["ZH", "BE", "LU"]
}
```

**Response:**
```json
{
  "success": true,
  "gesamt": 217472,
  "erfolgreich": 217470,
  "fehler": 2,
  "importVersionId": "uuid",
  "errors": ["Batch 5000: timeout"],
  "duration_ms": 543210
}
```

**Fehlercodes:**
- `403`: Nicht autorisiert (kein Admin)
- `400`: Ungültige Records
- `500`: Supabase Connection Error

---

### 2. queryBAGPraemien

**Zweck:** Abfrage von BAG-Prämiendaten für Vergleiche

**Endpunkt:** `POST /functions/v1/queryBAGPraemien`

**Auth:** Alle authentifizierten User

**Request:**
```json
{
  "kanton": "ZH",
  "jahr": 2026,
  "altersklasse": "erwachsen",
  "modell": "standard",
  "franchise": 300,
  "unfall": false,
  "limit": 100
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "versicherer_id": 8,
      "versicherer": { "name": "CSS", "gruppe": "CSS Gruppe" },
      "kanton": "ZH",
      "praemie": 456.70,
      "modell": "standard",
      "franchise": 300,
      "altersklasse": "erwachsen"
    }
  ],
  "totalCount": 45,
  "performance": {
    "query_time_ms": 234,
    "cached": false
  }
}
```

**Performance-Ziel:** < 1000ms

---

### 3. validateBAGImport

**Zweck:** Qualitätskontrolle nach Import

**Endpunkt:** `POST /functions/v1/validateBAGImport`

**Auth:** Admin-only

**Request:**
```json
{
  "importVersionId": "uuid"
}
```

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "stats": {
    "anzahl_gesamt": 217472,
    "anzahl_erfolgreich": 217470,
    "altersklassen": ["kind", "jugend", "erwachsen"],
    "modelle": ["standard", "telmed", "hausarzt", "hmo"],
    "versicherer_count": 41,
    "kantone_count": 26
  }
}
```

**Validierungsregeln:**
- Alle Altersklassen vorhanden (kind, jugend, erwachsen)
- Alle Modell-Typen vorhanden (standard, telmed, hausarzt, hmo)
- Keine kritischen Fehler im Fehlerjournal
- Plausibilität der Prämiendaten

---

### 4. getBAGStatistik

**Zweck:** Dashboard-Statistiken für BAG-Daten

**Endpunkt:** `POST /functions/v1/getBAGStatistik`

**Auth:** Alle authentifizierten User

**Request:**
```json
{}
```

**Response:**
```json
{
  "gesamtDatensätze": 217472,
  "jahre": [2026, 2025, 2024],
  "kantone": 26,
  "versicherer": 41,
  "letzte_import": "2026-06-09T10:30:00Z",
  "import_version": 3
}
```

---

### 5. getKantonRegionForPLZ

**Zweck:** PLZ zu Kanton/Region Lookup

**Endpunkt:** `POST /functions/v1/getKantonRegionForPLZ`

**Auth:** Alle authentifizierten User

**Request:**
```json
{
  "plz": 8001
}
```

**Response:**
```json
{
  "kanton_kurz": "ZH",
  "kanton_lang": "Zürich",
  "bag_region_code": "1",
  "region_name": "Stadtzentren"
}
```

---

### 6. getVersichererList

**Zweck:** Liste aller Versicherer

**Endpunkt:** `POST /functions/v1/getVersichererList`

**Auth:** Alle authentifizierten User

**Request:**
```json
{
  "aktiv": true
}
```

**Response:**
```json
{
  "data": [
    {
      "id": 8,
      "bag_id": 8,
      "name": "CSS Versicherung AG",
      "kurzname": "CSS",
      "gruppe": "CSS Gruppe",
      "logo_url": "/logos/css.png",
      "website": "https://www.css.ch",
      "aktiv": true
    }
  ],
  "totalCount": 41
}
```

---

### 7. getBAGPraemienHistorie

**Zweck:** Prämien-Entwicklung über Jahre

**Endpunkt:** `POST /functions/v1/getBAGPraemienHistorie`

**Auth:** Alle authentifizierten User

**Request:**
```json
{
  "versicherer_id": 8,
  "kanton": "ZH",
  "modell": "standard",
  "franchise": 300,
  "altersklasse": "erwachsen"
}
```

**Response:**
```json
{
  "historie": [
    {
      "jahr": 2024,
      "praemie": 423.50,
      "gueltig_ab": "2024-01-01"
    },
    {
      "jahr": 2025,
      "praemie": 438.20,
      "gueltig_ab": "2025-01-01"
    },
    {
      "jahr": 2026,
      "praemie": 456.70,
      "gueltig_ab": "2026-01-01"
    }
  ],
  "aenderung_vorjahr": {
    "differenz": 18.50,
    "differenz_prozent": 4.22
  }
}
```

---

### 8. getImportErrorReport

**Zweck:** Fehlerbericht für Import

**Endpunkt:** `POST /functions/v1/getImportErrorReport`

**Auth:** Admin-only

**Request:**
```json
{
  "importVersionId": "uuid",
  "fehlerTyp": "mapping_error",
  "limit": 100
}
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "fehler_typ": "mapping_error",
      "fehler_schwere": "error",
      "row_number": 12345,
      "fehlermeldung": "Unbekannte Versicherer-ID: 9999",
      "feld_name": "versicherer_id",
      "feld_wert": "9999"
    }
  ],
  "totalCount": 45,
  "summary": {
    "mapping_error": 30,
    "validation_error": 10,
    "warning": 5
  }
}
```

---

## Supabase REST API (Direct)

### Authentication

Alle Requests benötigen:
```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
```

### Query Examples

**BAG-Prämien abfragen:**
```bash
GET https://xxxxx.supabase.co/rest/v1/bag_praemien?select=*,versicherer:versicherer_id(name)&kanton=eq.ZH&geschaeftsjahr=eq.2026&modell=eq.standard&franchise=eq.300&order=praemie.asc
```

**Versicherer laden:**
```bash
GET https://xxxxx.supabase.co/rest/v1/versicherer?select=*&aktiv=eq.true&order=name.asc
```

**Import-Stats:**
```bash
POST https://xxxxx.supabase.co/rest/v1/rpc/get_import_stats
Content-Type: application/json

{"p_import_id": "uuid"}
```

---

## Error Handling

### Standard-Error-Response

```json
{
  "error": {
    "code": "IMPORT_FAILED",
    "message": "Import fehlgeschlagen",
    "details": "Supabase connection timeout",
    "retryable": true
  }
}
```

### Error-Codes

| Code | HTTP | Beschreibung |
|---|---|---|
| `UNAUTHORIZED` | 401 | Nicht authentifiziert |
| `FORBIDDEN` | 403 | Keine Berechtigung |
| `INVALID_INPUT` | 400 | Ungültige Eingabe |
| `NOT_FOUND` | 404 | Ressource nicht gefunden |
| `SUPABASE_ERROR` | 500 | Supabase Connection Error |
| `RATE_LIMIT` | 429 | Rate Limit exceeded |

---

## Rate Limiting

| Endpunkt | Limit |
|---|---|
| `queryBAGPraemien` | 100/min |
| `importBAGDatenToSupabase` | 10/h (Admin) |
| `validateBAGImport` | 20/h (Admin) |
| `getBAGStatistik` | 60/min |

---

## Caching

**Empfohlene Cache-Strategie:**

```javascript
// React Query Configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 Minuten
      cacheTime: 10 * 60 * 1000, // 10 Minuten
      refetchOnWindowFocus: false
    }
  }
});
```

---

## Testing

### Test-Cases

**1. BAG-Import Test:**
```javascript
const testImport = async () => {
  const response = await base44.functions.invoke('importBAGDatenToSupabase', {
    records: testRecords,
    jahr: 2026,
    importModus: 'auswahl',
    selectedKantone: ['ZH']
  });
  
  expect(response.success).toBe(true);
  expect(response.erfolgreich).toBeGreaterThan(0);
};
```

**2. Query Performance Test:**
```javascript
const testQueryPerformance = async () => {
  const start = Date.now();
  const response = await base44.functions.invoke('queryBAGPraemien', {
    kanton: 'ZH',
    jahr: 2026
  });
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(1000); // < 1 Sekunde
  expect(response.data.length).toBeGreaterThan(0);
};
```

---

## Versionierung

| Version | Datum | Änderungen |
|---|---|---|
| 1.0 | 2026-06-09 | Initiale Version für Phase 1 |

---

**Nächste Schritte:**

1. ✅ API-Dokumentation erstellt
2. ⏳ Backend-Functions implementieren
3. ⏳ Unit-Tests schreiben
4. ⏳ Integration-Tests durchführen