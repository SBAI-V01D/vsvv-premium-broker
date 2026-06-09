# VSVV CRM - Technische Architekturdokumentation

**Version:** 1.0  
**Datum:** 2026-06-09  
**Status:** Zur Freigabe vorgelegt  
**Klassifizierung:** Vertraulich - VSVV Intern

---

## Inhaltsverzeichnis

1. [Executive Summary](#1-executive-summary)
2. [Detailliertes Datenmodell (ERD)](#2-detailliertes-datenmodell-erd)
3. [SQL-Schema aller Tabellen](#3-sql-schema-aller-tabellen)
4. [API-Endpunkte & Backend Functions](#4-api-endpunkte--backend-functions)
5. [Importlogik für BAG-Daten](#5-importlogik-für-bag-daten)
6. [Performance-Analyse](#6-performance-analyse)
7. [Backup- & Rollback-Strategie](#7-backup--rollback-strategie)
8. [Sicherheitskonzept (DSG/FINMA)](#8-sicherheitskonzept-dsgfinma)
9. [Freigabe-Checkliste](#9-freigabe-checkliste)

---

## 1. Executive Summary

### 1.1 System-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                        VSVV CRM System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   Base44     │────▶│   Supabase   │────▶│   Externe    │   │
│  │   Frontend   │     │  Datenbank   │     │   Dienste    │   │
│  │              │     │              │     │              │   │
│  │ - UI/UX      │     │ - PostgreSQL │     │ - BAG API    │   │
│  │ - Auth       │     │ - RLS        │     │ - Excel      │   │
│  │ - Business   │     │ - Indizes    │     │ - PDF Gen    │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                    │                       │         │
│         └────────────────────┴───────────────────────┘         │
│                         OAuth 2.0                               │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Architektur-Prinzipien

| Prinzip | Umsetzung |
|---|---|
| **Separation of Concerns** | Base44 = UI/Logic, Supabase = Data |
| **Data Sovereignty** | Alle Daten in der Schweiz (Supabase EU/CH) |
| **Zero Trust** | RLS-Policies auf jeder Tabelle |
| **Audit-First** | Jede Änderung wird geloggt |
| **Performance by Design** | Indizes, Caching, Query-Optimierung |

### 1.3 Datenflüsse

```
User (Browser)
    ↓
Base44 Frontend (React)
    ↓
Base44 Backend Functions (Deno)
    ↓
Supabase Connector (OAuth)
    ↓
Supabase Database (PostgreSQL)
    ↓
Row Level Security (RLS)
    ↓
Return Data
```

---

## 2. Detailliertes Datenmodell (ERD)

### 2.1 Entity-Relationship-Diagramm

```
┌─────────────────────┐         ┌─────────────────────┐
│    versicherer      │         │      kunden         │
├─────────────────────┤         ├─────────────────────┤
│ id (PK)             │         │ id (PK)             │
│ bag_id (UNIQUE)     │         │ kundennummer (UNIQ) │
│ name                │         │ vorname             │
│ kurzname            │         │ nachname            │
│ gruppe              │         │ email               │
│ logo_url            │         │ telefon             │
│ aktiv               │         │ plz                 │
│ created_at          │         │ kanton              │
│ updated_at          │         │ geburtsdatum        │
└─────────────────────┘         │ organization_id     │
          │                     │ advisor_id          │
          │ 1:N                 │ primary_kunde_id    │
          ▼                     └─────────────────────┘
┌─────────────────────┐                   │
│   bag_praemien      │                   │ 1:N
├─────────────────────┤                   ▼
│ id (PK)             │         ┌─────────────────────┐
│ versicherer_id (FK) │         │     vertraege       │
│ kanton              │         ├─────────────────────┤
│ region              │         │ id (PK)             │
│ geschaeftsjahr      │         │ kunde_id (FK)       │
│ altersklasse        │         │ versicherer_id (FK) │
│ modell              │         │ sparte              │
│ franchise           │         │ praemie_monatlich   │
│ unfall              │         │ start_date          │
│ praemie             │         │ end_date            │
│ tarifbezeichnung    │         │ status              │
│ created_at          │         │ bag_praemie_id (FK) │
└─────────────────────┘         │ created_at          │
                                └─────────────────────┘
                                          │
                                          │ 1:1
                                          ▼
                                ┌─────────────────────┐
                                │    provisionen      │
                                ├─────────────────────┤
                                │ id (PK)             │
                                │ vertrag_id (FK)     │
                                │ provisions_betrag   │
                                │ abrechnungs_periode │
                                │ status              │
                                └─────────────────────┘


┌─────────────────────┐         ┌─────────────────────┐
│   kk_vergleiche     │         │     offerten        │
├─────────────────────┤         ├─────────────────────┤
│ id (PK)             │         │ id (PK)             │
│ kunde_id (FK)       │         │ kunde_id (FK)       │
│ advisor_id          │         │ versicherer_id (FK) │
│ vergleichsdatum     │         │ sparte              │
│ persoenliche_daten  │         │ praemie             │
│ aktuelle_versich.   │         │ status              │
│ vergleichsergebnisse│         │ dokument_url        │
│ ki_analyse          │         │ created_at          │
│ status              │         └─────────────────────┘
│ created_at          │
└─────────────────────┘

┌─────────────────────┐         ┌─────────────────────┐
│beratungsprotokolle  │         │    import_logs      │
├─────────────────────┤         ├─────────────────────┤
│ id (PK)             │         │ id (PK)             │
│ kunde_id (FK)       │         │ import_typ          │
│ protokoll_typ       │         │ datei_name          │
│ zusammenfassung     │         │ anzahl_gesamt       │
│ empfehlungen        │         │ anzahl_erfolgreich  │
│ dokument_urls       │         │ fehler_details      │
│ created_by          │         │ importiert_von      │
│ organization_id     │         │ importiert_am       │
│ created_at          │         │ status              │
└─────────────────────┘         └─────────────────────┘
```

### 2.2 Datenmodell-Tabellen

| Tabelle | Zweck | Records (geschätzt) | Kritikalität |
|---|---|---|---|
| `versicherer` | Versicherer-Stammdaten | 50 | Hoch |
| `bag_praemien` | BAG-Prämiendaten | 217'472+ | **Kritisch** |
| `kunden` | Kundenstammdaten | 1'000 - 10'000 | **Kritisch** |
| `vertraege` | Vertragsdaten | 5'000 - 50'000 | **Kritisch** |
| `kk_vergleiche` | Vergleichs-Historie | 10'000+ | Mittel |
| `offerten` | Offerten-Management | 5'000+ | Mittel |
| `provisionen` | Provisionsabrechnung | 10'000+ | Hoch |
| `beratungsprotokolle` | Beratungs-Doku | 20'000+ | Hoch |
| `import_logs` | Audit-Trail | 100+ | Mittel |

### 2.3 Datenbeziehungen

```
kunden (1) ──── (N) vertraege
kunden (1) ──── (N) kk_vergleiche
kunden (1) ──── (N) offerten
kunden (1) ──── (N) beratungsprotokolle

vertraege (1) ──── (1) provisionen

versicherer (1) ──── (N) bag_praemien
versicherer (1) ──── (N) vertraege
versicherer (1) ──── (N) offerten

bag_praemien (1) ──── (0..1) vertraege (via bag_praemie_id FK)
```

---

## 3. SQL-Schema aller Tabellen

### 3.1 Core-Tabellen (BAG-Daten)

```sql
-- ============================================================================
-- TABELLE: versicherer
-- ============================================================================
CREATE TABLE versicherer (
  id SERIAL PRIMARY KEY,
  bag_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  kurzname TEXT,
  gruppe TEXT,
  logo_url TEXT,
  aktiv BOOLEAN DEFAULT true,
  kontakt_email TEXT,
  kontakt_telefon TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE versicherer IS 'Versicherer-Stammdaten mit offiziellen BAG-IDs';
COMMENT ON COLUMN versicherer.bag_id IS 'Offizielle BAG-Versicherer-ID (z.B. 8=CSS, 1064=Helsana)';

-- ============================================================================
-- TABELLE: bag_praemien
-- ============================================================================
CREATE TABLE bag_praemien (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign Keys
  versicherer_id INTEGER NOT NULL REFERENCES versicherer(id),
  
  -- Geografie
  kanton TEXT NOT NULL,
  region TEXT,
  plz_bereich TEXT,
  
  -- Zeit
  geschaeftsjahr INTEGER NOT NULL,
  gueltig_ab DATE,
  gueltig_bis DATE,
  
  -- Personen
  altersklasse TEXT NOT NULL CHECK (altersklasse IN ('kind', 'jugend', 'erwachsen')),
  alter_von INTEGER,
  alter_bis INTEGER,
  geschlecht TEXT CHECK (geschlecht IN ('m', 'w', 'alle')),
  
  -- Versicherung
  modell TEXT NOT NULL CHECK (modell IN ('standard', 'telmed', 'hausarzt', 'hmo')),
  tarifbezeichnung TEXT,
  franchise INTEGER NOT NULL CHECK (franchise >= 0 AND franchise <= 2500),
  unfall BOOLEAN DEFAULT false,
  
  -- Prämie
  praemie DECIMAL(10,2) NOT NULL CHECK (praemie > 0),
  
  -- Metadaten
  datenquelle TEXT DEFAULT 'BAG',
  importiert_am TIMESTAMPTZ DEFAULT NOW(),
  importiert_von TEXT,
  aktiv BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE bag_praemien IS 'Offizielle BAG-Prämiendaten (217'472+ Records)';
COMMENT ON COLUMN bag_praemien.altersklasse IS 'kind (0-18), jugend (19-25), erwachsen (26+)';
COMMENT ON COLUMN bag_praemien.modell IS 'standard, telmed, hausarzt, hmo';
COMMENT ON COLUMN bag_praemien.franchise IS 'CHF-Betrag: 0, 100, 200, 300, 400, 500, 600, 1000, 1500, 2000, 2500';

-- ============================================================================
-- INDXES: bag_praemien (Performance-optimiert)
-- ============================================================================

-- Einzel-Indizes
CREATE INDEX idx_bag_versicherer ON bag_praemien(versicherer_id);
CREATE INDEX idx_bag_kanton ON bag_praemien(kanton);
CREATE INDEX idx_bag_region ON bag_praemien(region);
CREATE INDEX idx_bag_jahr ON bag_praemien(geschaeftsjahr);
CREATE INDEX idx_bag_altersklasse ON bag_praemien(altersklasse);
CREATE INDEX idx_bag_modell ON bag_praemien(modell);
CREATE INDEX idx_bag_franchise ON bag_praemien(franchise);
CREATE INDEX idx_bag_unfall ON bag_praemien(unfall);
CREATE INDEX idx_bag_aktiv ON bag_praemien(aktiv);

-- Composite-Indizes (Hauptabfragen)
CREATE INDEX idx_bag_query_kanton_jahr 
  ON bag_praemien(kanton, geschaeftsjahr, aktiv);

CREATE INDEX idx_bag_query_full 
  ON bag_praemien(kanton, geschaeftsjahr, altersklasse, modell, franchise, unfall);

CREATE INDEX idx_bag_praemie_lookup 
  ON bag_praemien(versicherer_id, modell, franchise, kanton, geschaeftsjahr);

-- Partial Index (nur aktuelle Daten)
CREATE INDEX idx_bag_current_year 
  ON bag_praemien(kanton, versicherer_id, modell, franchise)
  WHERE geschaeftsjahr = 2026 AND aktiv = true;
```

### 3.2 CRM-Tabellen (Kunden & Verträge)

```sql
-- ============================================================================
-- TABELLE: kunden
-- ============================================================================
CREATE TABLE kunden (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kundennummer TEXT UNIQUE NOT NULL,
  
  -- Stammdaten
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  email TEXT,
  telefon TEXT,
  mobil TEXT,
  
  -- Adresse
  strasse TEXT,
  plz TEXT,
  ort TEXT,
  kanton TEXT CHECK (kanton IN (
    'ZH','BE','LU','UR','SZ','OW','NW','GL','ZG','FR','SO','BS','BL','SH',
    'AR','AI','SG','GR','AG','TG','TI','VD','VS','NE','GE','JU'
  )),
  
  -- Demografie
  geburtsdatum DATE,
  geschlecht TEXT CHECK (geschlecht IN ('m', 'w')),
  zivilstand TEXT,
  
  -- Haushalt
  ist_haushaltsvorstand BOOLEAN DEFAULT true,
  primary_kunde_id UUID REFERENCES kunden(id),
  familien_role TEXT CHECK (familien_role IN ('primary', 'spouse', 'child', 'parent', 'other')),
  
  -- Organisation
  organization_id UUID NOT NULL,
  advisor_id UUID,
  
  -- Mandat
  mandats_status TEXT CHECK (mandats_status IN ('valid', 'invalid', 'pending', 'expired')),
  mandats_datum DATE,
  portal_enabled BOOLEAN DEFAULT false,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by TEXT
);

-- Indizes
CREATE INDEX idx_kunden_organization ON kunden(organization_id);
CREATE INDEX idx_kunden_advisor ON kunden(advisor_id);
CREATE INDEX idx_kunden_household ON kunden(primary_kunde_id);
CREATE INDEX idx_kunden_email ON kunden(email);
CREATE INDEX idx_kunden_plz ON kunden(plz);
CREATE INDEX idx_kunden_archived ON kunden(archived);

-- ============================================================================
-- TABELLE: vertraege
-- ============================================================================
CREATE TABLE vertraege (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Kunden-Bezug
  kunde_id UUID NOT NULL REFERENCES kunden(id),
  primary_kunde_id UUID REFERENCES kunden(id),
  ist_familienmitglied BOOLEAN DEFAULT false,
  
  -- Versicherung
  versicherer_id INTEGER REFERENCES versicherer(id),
  sparte TEXT NOT NULL,
  produkt_name TEXT,
  police_nummer TEXT,
  
  -- Prämien
  praemie_monatlich DECIMAL(10,2),
  praemie_jaehrlich DECIMAL(10,2),
  waehrung TEXT DEFAULT 'CHF',
  
  -- Laufzeit
  start_date DATE NOT NULL,
  end_date DATE,
  kuendigungsfrist_monate INTEGER,
  auto_verlaengerung BOOLEAN DEFAULT true,
  
  -- Status
  status TEXT DEFAULT 'active',
  kuendigungsdatum DATE,
  kuendigungsgrund TEXT,
  
  -- BAG-Bezug
  bag_praemie_id UUID REFERENCES bag_praemien(id),
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  archived BOOLEAN DEFAULT false
);

-- Indizes
CREATE INDEX idx_vertraege_kunde ON vertraege(kunde_id);
CREATE INDEX idx_vertraege_versicherer ON vertraege(versicherer_id);
CREATE INDEX idx_vertraege_sparte ON vertraege(sparte);
CREATE INDEX idx_vertraege_status ON vertraege(status);
CREATE INDEX idx_vertraege_start ON vertraege(start_date);
CREATE INDEX idx_vertraege_end ON vertraege(end_date);
```

### 3.3 Geschäfts-Tabellen (Vergleiche, Offerten, Provisionen)

```sql
-- ============================================================================
-- TABELLE: kk_vergleiche
-- ============================================================================
CREATE TABLE kk_vergleiche (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Kunden-Bezug
  kunde_id UUID REFERENCES kunden(id),
  customer_name TEXT NOT NULL,
  
  -- Berater
  advisor_id UUID NOT NULL,
  advisor_name TEXT,
  organization_id UUID NOT NULL,
  
  -- Datum
  vergleichsdatum TIMESTAMPTZ DEFAULT NOW(),
  
  -- Eingabe (Snapshot)
  persoenliche_daten JSONB NOT NULL,
  aktuelle_versicherung JSONB NOT NULL,
  vergleichsoptionen JSONB NOT NULL,
  
  -- Ergebnisse (Snapshot)
  vergleichsergebnisse JSONB NOT NULL,
  ki_analyse JSONB,
  
  -- Status
  status TEXT DEFAULT 'durchgefuehrt',
  pdf_url TEXT,
  wiedervorlage_datum DATE,
  notizen TEXT,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indizes
CREATE INDEX idx_kk_vergleiche_kunde ON kk_vergleiche(kunde_id);
CREATE INDEX idx_kk_vergleiche_advisor ON kk_vergleiche(advisor_id);
CREATE INDEX idx_kk_vergleiche_datum ON kk_vergleiche(vergleichsdatum);
CREATE INDEX idx_kk_vergleiche_status ON kk_vergleiche(status);

-- ============================================================================
-- TABELLE: provisionen
-- ============================================================================
CREATE TABLE provisionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vertrag
  vertrag_id UUID REFERENCES vertraege(id),
  
  -- Finanzdaten
  provisionsatz DECIMAL(5,2),
  provisions_betrag DECIMAL(10,2),
  waehrung TEXT DEFAULT 'CHF',
  
  -- Periode
  abrechnungs_monat INTEGER CHECK (abrechnungs_monat BETWEEN 1 AND 12),
  abrechnungsjahr INTEGER,
  
  -- Status
  status TEXT DEFAULT 'offen',
  storno_grund TEXT,
  
  -- Auszahlung
  ausgezahlt_am DATE,
  auszahlungs_referenz TEXT,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- Indizes
CREATE INDEX idx_provisionen_vertrag ON provisionen(vertrag_id);
CREATE INDEX idx_provisionen_status ON provisionen(status);
CREATE INDEX idx_provisionen_periode ON provisionen(abrechnungsjahr, abrechnungs_monat);
```

### 3.4 Audit-Tabellen

```sql
-- ============================================================================
-- TABELLE: import_logs
-- ============================================================================
CREATE TABLE import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Import-Info
  import_typ TEXT NOT NULL,
  datei_name TEXT,
  datei_groesse_bytes INTEGER,
  
  -- Statistik
  anzahl_gesamt INTEGER,
  anzahl_erfolgreich INTEGER,
  anzahl_fehler INTEGER,
  
  -- Fehler
  fehler_details JSONB,
  
  -- User
  importiert_von TEXT NOT NULL,
  importiert_am TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status
  status TEXT DEFAULT 'completed'
);

-- Indizes
CREATE INDEX idx_import_logs_typ ON import_logs(import_typ);
CREATE INDEX idx_import_logs_datum ON import_logs(importiert_am);

-- ============================================================================
-- TABELLE: beratungsprotokolle
-- ============================================================================
CREATE TABLE beratungsprotokolle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Kunde
  kunde_id UUID NOT NULL REFERENCES kunden(id),
  
  -- Typ
  protokoll_typ TEXT NOT NULL,
  thema TEXT,
  
  -- Inhalt
  zusammenfassung TEXT,
  empfehlungen TEXT,
  naechste_schritte TEXT,
  
  -- Dokumente
  dokument_urls JSONB,
  
  -- Metadaten
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  organization_id UUID NOT NULL
);

-- Indizes
CREATE INDEX idx_beratung_kunde ON beratungsprotokolle(kunde_id);
CREATE INDEX idx_beratung_typ ON beratungsprotokolle(protokoll_typ);
CREATE INDEX idx_beratung_datum ON beratungsprotokolle(created_at);
```

### 3.5 Row Level Security (RLS) Policies

```sql
-- ============================================================================
-- RLS: Aktivierung
-- ============================================================================

ALTER TABLE kunden ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertraege ENABLE ROW LEVEL SECURITY;
ALTER TABLE kk_vergleiche ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE beratungsprotokolle ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- bag_praemien und versicherer sind Referenzdaten (kein RLS benötigt)

-- ============================================================================
-- RLS: Organization Isolation
-- ============================================================================

-- Kunden: Nur eigene Organization
CREATE POLICY "org_isolation_kunden" ON kunden
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
    OR current_setting('app.user_role', true) = 'admin'
  );

-- Verträge: Nur eigene Organization
CREATE POLICY "org_isolation_vertraege" ON vertraege
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM kunden k 
      WHERE k.id = vertraege.kunde_id 
      AND k.organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
    )
    OR current_setting('app.user_role', true) = 'admin'
  );

-- Vergleiche: Nur eigene Organization
CREATE POLICY "org_isolation_vergleiche" ON kk_vergleiche
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
    OR current_setting('app.user_role', true) = 'admin'
  );

-- ============================================================================
-- RLS: Advisor Access
-- ============================================================================

-- Kunden: Advisor sieht eigene Kunden
CREATE POLICY "advisor_access_kunden" ON kunden
  FOR SELECT
  USING (
    advisor_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR created_by = current_setting('app.current_user_email', true)
  );

-- Verträge: Advisor sieht eigene Verträge
CREATE POLICY "advisor_access_vertraege" ON vertraege
  FOR SELECT
  USING (
    created_by = current_setting('app.current_user_email', true)
    OR EXISTS (
      SELECT 1 FROM kunden k 
      WHERE k.id = vertraege.kunde_id 
      AND k.advisor_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

-- ============================================================================
-- RLS: Admin Override
-- ============================================================================

CREATE POLICY "admin_override_all" ON kunden
  FOR ALL
  USING (current_setting('app.user_role', true) = 'admin');

CREATE POLICY "admin_override_vertraege" ON vertraege
  FOR ALL
  USING (current_setting('app.user_role', true) = 'admin');
```

---

## 4. API-Endpunkte & Backend Functions

### 4.1 Base44 Backend Functions

#### **Function 1: importBAGDatenToSupabase**

```javascript
// functions/importBAGDatenToSupabase.js
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { records, jahr, importModus } = await req.json();
    
    // Validierung
    if (!records || !Array.isArray(records)) {
      return Response.json({ error: 'Invalid records' }, { status: 400 });
    }

    // Supabase Connection via Connector
    const supabase = await base44.asServiceRole.connectors.getConnection('supabase');
    const serviceKey = supabase.connectionConfig.service_role_key;
    const projectUrl = supabase.connectionConfig.project_url;

    // Batch-Import (1000 Records pro Batch)
    const BATCH_SIZE = 1000;
    let erfolgreich = 0;
    let fehler = 0;
    const errors = [];

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      // Transformiere Records für Supabase
      const transformed = batch.map(r => ({
        versicherer_id: r.versicherer_id,
        kanton: r.kanton,
        region: r.region,
        geschaeftsjahr: jahr,
        altersklasse: r.altersklasse,
        modell: r.modell,
        franchise: r.franchise,
        unfall: r.unfall,
        praemie: r.praemie,
        tarifbezeichnung: r.tarifbezeichnung,
        importiert_von: user.email,
        aktiv: true
      }));

      // INSERT via Supabase REST API
      const response = await fetch(`${projectUrl}/rest/v1/bag_praemien`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(transformed)
      });

      if (response.ok) {
        erfolgreich += batch.length;
      } else {
        fehler += batch.length;
        errors.push(`Batch ${i}: ${response.statusText}`);
      }

      // Rate Limiting vermeiden
      await new Promise(r => setTimeout(r, 100));
    }

    // Import-Log schreiben
    await base44.entities.ImportLog.create({
      import_typ: 'bag_praemien',
      datei_name: `BAG_${jahr}.xlsx`,
      anzahl_gesamt: records.length,
      anzahl_erfolgreich: erfolgreich,
      anzahl_fehler: fehler,
      fehler_details: errors,
      importiert_von: user.email,
      status: fehler > 0 ? 'partial' : 'completed'
    });

    return Response.json({
      success: erfolgreich > 0,
      gesamt: records.length,
      erfolgreich,
      fehler,
      errors
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

**Payload:**
```json
{
  "records": [
    {
      "versicherer_id": 8,
      "kanton": "ZH",
      "region": "1",
      "altersklasse": "erwachsen",
      "modell": "standard",
      "franchise": 300,
      "unfall": false,
      "praemie": 456.70,
      "tarifbezeichnung": "TAR-BASE"
    }
  ],
  "jahr": 2026,
  "importModus": "alle_26"
}
```

**Response:**
```json
{
  "success": true,
  "gesamt": 217472,
  "erfolgreich": 217470,
  "fehler": 2,
  "errors": ["Batch 5000: timeout"]
}
```

---

#### **Function 2: queryBAGPraemien**

```javascript
// functions/queryBAGPraemien.js
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      kanton, 
      jahr, 
      altersklasse, 
      modell, 
      franchise, 
      unfall 
    } = await req.json();

    // Validierung
    if (!kanton || !jahr) {
      return Response.json({ error: 'Missing required params' }, { status: 400 });
    }

    // Supabase Connection
    const supabase = await base44.asServiceRole.connectors.getConnection('supabase');
    const serviceKey = supabase.connectionConfig.service_role_key;
    const projectUrl = supabase.connectionConfig.project_url;

    // Query-Parameter aufbauen
    const params = new URLSearchParams({
      select: '*,versicherer:versicherer_id(name,gruppe)',
      kanton: `eq.${kanton}`,
      geschaeftsjahr: `eq.${jahr}`,
      aktiv: `eq.true`,
      unfall: `eq.${unfall || false}`,
      order: 'praemie.asc'
    });

    if (altersklasse) params.append('altersklasse', `eq.${altersklasse}`);
    if (modell) params.append('modell', `eq.${modell}`);
    if (franchise) params.append('franchise', `eq.${franchise}`);

    // Query via Supabase REST API
    const response = await fetch(
      `${projectUrl}/rest/v1/bag_praemien?${params.toString()}`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase error: ${response.statusText}`);
    }

    const data = await response.json();
    const totalCount = response.headers.get('Content-Range')?.split('/')[1] || data.length;

    return Response.json({
      data,
      totalCount,
      performance: {
        query_time_ms: response.headers.get('Server-Timing'),
        cached: response.headers.get('X-Cache') === 'HIT'
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

**Payload:**
```json
{
  "kanton": "ZH",
  "jahr": 2026,
  "altersklasse": "erwachsen",
  "modell": "standard",
  "franchise": 300,
  "unfall": false
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
      "franchise": 300
    }
  ],
  "totalCount": 45,
  "performance": {
    "query_time_ms": 234,
    "cached": false
  }
}
```

**Performance-Ziel:** <1000ms (typisch: 200-500ms)

---

#### **Function 3: validateBAGImport**

```javascript
// functions/validateBAGImport.js
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { import_id } = await req.json();

    // Supabase Connection
    const supabase = await base44.asServiceRole.connectors.getConnection('supabase');
    const serviceKey = supabase.connectionConfig.service_role_key;
    const projectUrl = supabase.connectionConfig.project_url;

    // Qualitätskontrolle via Stored Procedure
    const response = await fetch(
      `${projectUrl}/rest/v1/rpc/get_import_stats`,
      {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ import_id })
      }
    );

    const stats = await response.json();

    // Validierung
    const errors = [];
    
    if (stats.anzahl_gesamt !== stats.anzahl_erfolgreich) {
      errors.push(`Fehlende Records: ${stats.anzahl_gesamt - stats.anzahl_erfolgreich}`);
    }

    // Erwarte alle Altersklassen
    if (!stats.altersklassen?.includes('kind')) {
      errors.push('Fehlende Altersklasse: kind');
    }
    if (!stats.altersklassen?.includes('jugend')) {
      errors.push('Fehlende Altersklasse: jugend');
    }
    if (!stats.altersklassen?.includes('erwachsen')) {
      errors.push('Fehlende Altersklasse: erwachsen');
    }

    // Erwarte alle Modell-Typen
    const erwartete_modelle = ['standard', 'telmed', 'hausarzt', 'hmo'];
    for (const modell of erwartete_modelle) {
      if (!stats.modelle?.includes(modell)) {
        errors.push(`Fehlendes Modell: ${modell}`);
      }
    }

    return Response.json({
      valid: errors.length === 0,
      errors,
      stats
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

---

#### **Function 4: getBAGStatistik**

```javascript
// functions/getBAGStatistik.js
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Supabase Connection
    const supabase = await base44.asServiceRole.connectors.getConnection('supabase');
    const serviceKey = supabase.connectionConfig.service_role_key;
    const projectUrl = supabase.connectionConfig.project_url;

    // Aggregations-Query
    const response = await fetch(
      `${projectUrl}/rest/v1/bag_praemien?select=kanton,geschaeftsjahr,altersklasse,modell&limit=0`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      }
    );

    // Count via Header
    const totalCount = response.headers.get('Content-Range')?.split('/')[1] || 0;

    // Zusätzliche Stats
    const statsResponse = await fetch(
      `${projectUrl}/rest/v1/rpc/get_bag_stats`,
      {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const detailedStats = await statsResponse.json();

    return Response.json({
      gesamtDatensätze: parseInt(totalCount),
      jahre: detailedStats.jahre || [],
      kantone: detailedStats.kantone || 0,
      versicherer: detailedStats.versicherer || 0,
      letzte_import: detailedStats.letzte_import
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

---

### 4.2 Supabase Stored Procedures

```sql
-- Function: Import-Statistik
CREATE OR REPLACE FUNCTION get_import_stats(p_import_id UUID DEFAULT NULL)
RETURNS TABLE (
  import_typ TEXT,
  anzahl_gesamt BIGINT,
  anzahl_erfolgreich BIGINT,
  anzahl_fehler BIGINT,
  altersklassen TEXT[],
  modelle TEXT[],
  versicherer_count BIGINT,
  kantone_count BIGINT,
  letzte_import TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    il.import_typ,
    il.anzahl_gesamt,
    il.anzahl_erfolgreich,
    il.anzahl_fehler,
    ARRAY_AGG(DISTINCT bp.altersklasse) FILTER (WHERE bp.altersklasse IS NOT NULL),
    ARRAY_AGG(DISTINCT bp.modell) FILTER (WHERE bp.modell IS NOT NULL),
    COUNT(DISTINCT bp.versicherer_id),
    COUNT(DISTINCT bp.kanton),
    MAX(il.importiert_am)
  FROM import_logs il
  LEFT JOIN bag_praemien bp ON bp.importiert_am >= il.importiert_am
  WHERE (p_import_id IS NULL OR il.id = p_import_id)
  GROUP BY il.id
  ORDER BY il.importiert_am DESC;
END;
$$;

-- Function: BAG-Statistik
CREATE OR REPLACE FUNCTION get_bag_stats()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'gesamt', COUNT(*),
    'jahre', ARRAY_AGG(DISTINCT geschaeftsjahr ORDER BY geschaeftsjahr DESC),
    'kantone', COUNT(DISTINCT kanton),
    'versicherer', COUNT(DISTINCT versicherer_id),
    'altersklassen', ARRAY_AGG(DISTINCT altersklasse),
    'modelle', ARRAY_AGG(DISTINCT modell),
    'franchisen', ARRAY_AGG(DISTINCT franchise ORDER BY franchise),
    'letzte_import', MAX(importiert_am)
  ) INTO result
  FROM bag_praemien
  WHERE aktiv = true;
  
  RETURN result;
END;
$$;
```

---

## 5. Importlogik für BAG-Daten

### 5.1 2-Schritt-Import-Prozess

```
┌─────────────────────────────────────────────────────────────────┐
│                    BAG-Import Workflow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Schritt 1: Analyse (Client-side)                               │
│  ────────────────────────────────────                           │
│  1. Excel-Datei hochladen (217'472+ Zeilen)                     │
│  2. Client-side Parsing (XLSX.js)                               │
│  3. Validierung:                                                │
│     - Alle Altersklassen (AKL-KIN, AKL-JUG, AKL-ERW) ✓         │
│     - Alle Tariftypen (TAR-BASE, TAR-HAM, TAR-TEL, TAR-HMO) ✓  │
│     - Alle Franchisen (FRA-0 bis FRA-2500) ✓                   │
│     - Alle Versicherer-IDs (41+ Kassen) ✓                      │
│  4. Diagnose-Anzeige (Vorschau)                                 │
│                                                                 │
│  Schritt 2: Bulk-Import (Server-side)                           │
│  ─────────────────────────────────────                          │
│  1. Records transformieren (Mapping)                            │
│  2. Batches à 1000 Records                                      │
│  3. INSERT via Supabase REST API                                │
│  4. Rate-Limit Protection (100ms Delay)                         │
│  5. Import-Log schreiben                                        │
│  6. Qualitätskontrolle                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Daten-Mapping

```javascript
// Mapping-Tabelle
const MAPPING = {
  // Altersklassen
  'AKL-KIN': 'kind',      // 0-18 Jahre
  'AKL-JUG': 'jugend',    // 19-25 Jahre
  'AKL-ERW': 'erwachsen', // 26+ Jahre
  
  // Tariftypen
  'TAR-BASE': 'standard',
  'TAR-STD': 'standard',
  'TAR-HAM': 'hausarzt',
  'TAR-TEL': 'telmed',
  'TAR-HMO': 'hmo',
  'TAR-DIV': 'div', // Alternative Modelle
  
  // Franchisen
  'FRA-0': 0,
  'FRA-100': 100,
  'FRA-200': 200,
  'FRA-300': 300,
  'FRA-400': 400,
  'FRA-500': 500,
  'FRA-600': 600,
  'FRA-1000': 1000,
  'FRA-1500': 1500,
  'FRA-2000': 2000,
  'FRA-2500': 2500,
  
  // Unfall
  'OHNE-UNF': false,
  'MIT-UNF': true
};
```

### 5.3 Validierungsregeln

```javascript
// Validierung vor Import
const validateRecord = (record) => {
  const errors = [];
  
  // Pflichtfelder
  if (!record.versicherer_id) errors.push('Missing versicherer_id');
  if (!record.kanton || record.kanton.length !== 2) errors.push('Invalid kanton');
  if (!record.geschaeftsjahr || record.geschaeftsjahr < 2020) errors.push('Invalid jahr');
  if (!record.altersklasse) errors.push('Missing altersklasse');
  if (!record.modell) errors.push('Missing modell');
  if (!record.franchise || record.franchise < 0) errors.push('Invalid franchise');
  if (!record.praemie || record.praemie <= 0) errors.push('Invalid praemie');
  
  // Plausibilität
  if (record.praemie > 2000) errors.push('Praemie > 2000 (unplausibel)');
  if (record.franchise > 2500) errors.push('Franchise > 2500');
  
  return {
    valid: errors.length === 0,
    errors
  };
};
```

### 5.4 Fehlerbehandlung

```javascript
// Fehler-Kategorien
const errorCategories = {
  // Kritisch (Import abbr