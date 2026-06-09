# VSVV CRM - Entity Relationship Diagram (ERD)

**Version:** 1.0  
**Datum:** 2026-06-09  
**Status:** Phase 1 - Zur Implementierung freigegeben

---

## Übersicht

Dieses ERD zeigt alle Tabellen des VSVV CRM-Systems mit ihren Beziehungen.

---

## ERD Diagramm

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REFERENZDATEN                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐       │
│  │ ref_kantone  │         │ref_bag_reg.  │         │   ref_plz    │       │
│  ├──────────────┤         ├──────────────┤         ├──────────────┤       │
│  │ id (PK)      │         │ id (PK)      │         │ id (PK)      │       │
│  │ kanton_kurz  │         │ region_code  │         │ plz          │       │
│  │ kanton_lang  │         │ region_name  │         │ ort          │       │
│  │ hauptort     │         │ beschreibung │         │ kanton (FK)  │       │
│  │ region       │         └──────────────┘         │ bag_region   │       │
│  └──────────────┘                  │                └──────────────┘       │
│         │                          │                        │              │
│         │ 1:N                      │ 1:N                    │              │
│         ▼                          ▼                        │              │
└─────────────────────────────────────────────────────────────┼──────────────┘
                                                              │
┌─────────────────────────────────────────────────────────────┼──────────────┐
│                         STAMMDATEN                                        │
├─────────────────────────────────────────────────────────────┼──────────────┤
│                                                             │              │
│  ┌──────────────┐                                          │              │
│  │ versicherer  │                                          │              │
│  ├──────────────┤                                          │              │
│  │ id (PK)      │                                          │              │
│  │ bag_id       │                                          │              │
│  │ name         │                                          │              │
│  │ kurzname     │                                          │              │
│  │ gruppe       │                                          │              │
│  │ logo_url     │                                          │              │
│  │ kontakt_*    │                                          │              │
│  │ aktiv        │                                          │              │
│  └──────────────┘                                          │              │
│         │                                                   │              │
│         │ 1:N                                               │              │
│         ▼                                                   │              │
│  ┌──────────────────┐                              ┌──────────────────┐   │
│  │  bag_praemien    │                              │bag_import_versions│  │
│  ├──────────────────┤                              ├──────────────────┤   │
│  │ id (PK)          │                              │ id (PK)          │   │
│  │ versicherer(FK)  │◀─────────────────────────────│ versionsnummer   │   │
│  │ kanton (FK)      │                              │ geschaeftsjahr   │   │
│  │ region (FK)      │                              │ import_datei_*   │   │
│  │ geschaeftsjahr   │                              │ anzahl_*         │   │
│  │ altersklasse     │                              │ aenderungen_*    │   │
│  │ modell           │                              │ status           │   │
│  │ franchise        │                              │ validiert        │   │
│  │ unfall           │                              └──────────────────┘   │
│  │ praemie          │                              │                      │
│  │ gueltig_ab/bis   │                              │ 1:N                  │
│  │ import_version_* │                              ▼                      │
│  └──────────────────┘                     ┌──────────────────┐            │
│         │                                  │bag_import_errors │            │
│         │                                  ├──────────────────┤            │
│         │                                  │ id (PK)          │            │
│         │                                  │ version_id (FK)  │            │
│         │                                  │ fehler_typ       │            │
│         │                                  │ row_number       │            │
│         │                                  │ raw_data         │            │
│         │                                  │ fehlermeldung    │            │
│         └──────────────────────────────────┘ manuell_korrig.  │            │
│                                            └──────────────────┘            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                              CRM - KUNDEN                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐      │
│  │    leads     │────────▶│   kunden     │────────▶│   mandate    │      │
│  ├──────────────┤         ├──────────────┤         ├──────────────┤      │
│  │ id (PK)      │         │ id (PK)      │         │ id (PK)      │      │
│  │ vorname      │         │ kundennummer │         │ kunde (FK)   │      │
│  │ nachname     │         │ vorname      │         │ mandat_typ   │      │
│  │ email        │         │ nachname     │         │ status       │      │
│  │ quelle       │         │ email        │         │ unterzeich.  │      │
│  │ status       │         │ telefon      │         │ gueltig_ab   │      │
│  │ lead_score   │         │ plz          │         │ gueltig_bis  │      │
│  │ converted_*  │         │ kanton (FK)  │         │ dokument_url │      │
│  └──────────────┘         │ geburtsdatum │         └──────────────┘      │
│                           │ primary_*    │                               │
│                           │ familien_*   │                               │
│                           │ organization │                               │
│                           │ advisor_id   │                               │
│                           └──────────────┘                               │
│                                    │                                     │
│                                    │ 1:N                                 │
│                                    ▼                                     │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐     │
│  │ aufgaben     │         │ vertraege    │────────▶│ provisionen  │     │
│  ├──────────────┤         ├──────────────┤         ├──────────────┤     │
│  │ id (PK)      │         │ id (PK)      │         │ id (PK)      │     │
│  │ titel        │         │ kunde (FK)   │         │ vertrag (FK) │     │
│  │ beschreibung │         │ versicherer  │         │ provisions-* │     │
│  │ aufgaben_typ │         │ sparte       │         │ abrechnung_* │     │
│  │ prioritaet   │         │ praemie_*    │         │ status       │     │
│  │ status       │         │ start_date   │         │ ausgezahlt_* │     │
│  │ faellig_am   │         │ end_date     │         └──────────────┘     │
│  │ kunde (FK)   │         │ status       │                              │
│  │ vertrag(FK)  │         │ bag_praemie  │                              │
│  │ assigned_to  │         └──────────────┘                              │
│  └──────────────┘               │                                       │
│                                 │ 1:N                                   │
│                                 ▼                                       │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐     │
│  │schadenfaelle │         │ beratungsprot│         │ dokumente    │     │
│  ├──────────────┤         ├──────────────┤         ├──────────────┤     │
│  │ id (PK)      │         │ id (PK)      │         │ id (PK)      │     │
│  │ schaden_nr   │         │ kunde (FK)   │         │ name         │     │
│  │ kunde (FK)   │         │ vertrag(FK)  │         │ dokument_typ │     │
│  │ vertrag(FK)  │         │ protokoll_*  │         │ kategorie    │     │
│  │ versicherer  │         │ zusammenfass │         │ speicher_*   │     │
│  │ schaden_datum│         │ empfehlung_* │         │ file_url     │     │
│  │ schaden_*    │         │ dokument_ids │         │ version      │     │
│  │ status       │         └──────────────┘         │ archiviert   │     │
│  └──────────────┘                                  └──────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                    VERGLEICHE & OFFERTEN                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                    ┌──────────────┐               │
│  │ kk_vergleiche    │                    │  offerten    │               │
│  ├──────────────────┤                    ├──────────────┤               │
│  │ id (PK)          │                    │ id (PK)      │               │
│  │ kunde_id (FK)    │                    │ kunde (FK)   │               │
│  │ advisor_id       │                    │ versicherer  │               │
│  │ vergleichsdatum  │                    │ sparte       │               │
│  │ persoenliche_*   │                    │ praemie_*    │               │
│  │ aktuelle_versich.│                    │ status       │               │
│  │ vergleichsoption.│                    │ dokument_url │               │
│  │ ergebnisse       │                    │ ki_score     │               │
│  │ ki_analyse       │                    │ ist_empfohlen│               │
│  │ status           │                    └──────────────┘               │
│  │ pdf_url          │                                                    │
│  └──────────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                  ZUSATZVERSICHERUNGEN (erweiterbar)                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────┐          ┌──────────────────────────┐     │
│  │zusatzversicherungen_prod.│          │zusatzversicherungen_präm.│     │
│  ├──────────────────────────┤          ├──────────────────────────┤     │
│  │ id (PK)                  │          │ id (PK)                  │     │
│  │ versicherer_id (FK)      │◀────────▶│ produkt_id (FK)          │     │
│  │ produkt_name             │          │ kanton (FK)              │     │
│  │ produkt_typ              │          │ geschaeftsjahr           │     │
│  │ sparte                   │          │ altersklasse             │     │
│  │ beschreibung             │          │ praemie_monatlich        │     │
│  │ deckung_summe_max        │          │ selbstbehalt             │     │
│  │ leistungen_json          │          │ aktiv                    │     │
│  │ praemie_ab               │          └──────────────────────────┘     │
│  │ wartefrist_monate        │                                           │
│  │ aktiv                    │                                           │
│  └──────────────────────────┘                                           │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                         AUDIT & LOGGING                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐     │
│  │  audit_logs  │         │ import_logs  │         │  system_logs │     │
│  ├──────────────┤         ├──────────────┤         ├──────────────┤     │
│  │ id (PK)      │         │ id (PK)      │         │ id (PK)      │     │
│  │ entity_type  │         │ import_typ   │         │ timestamp    │     │
│  │ entity_id    │         │ datei_name   │         │ level        │     │
│  │ action       │         │ anzahl_*     │         │ message      │     │
│  │ old/new_vals │         │ fehler_*     │         │ module       │     │
│  │ user_*       │         │ importiert_* │         │ user_*       │     │
│  │ created_at   │         │ status       │         │ created_at   │     │
│  └──────────────┘         └──────────────┘         └──────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Tabellen-Übersicht

### Referenzdaten (4 Tabellen)

| Tabelle | Zweck | Records |
|---|---|---|
| `ref_kantone` | 26 Schweizer Kantone | 26 |
| `ref_bag_regionen` | 3 BAG-Prämienregionen | 3 |
| `ref_plz` | Alle Schweizer PLZ | 3'100+ |
| `ref_alterklassen` | Altersklassen-Definition | 3 |

### Stammdaten (2 Tabellen)

| Tabelle | Zweck | Records |
|---|---|---|
| `versicherer` | 41+ BAG-Versicherer | 50 |
| `bag_praemien` | Offizielle BAG-Prämien | 217'472+ |

### Import-Management (2 Tabellen)

| Tabelle | Zweck | Records |
|---|---|---|
| `bag_import_versions` | Versionskontrolle | 10+ |
| `bag_import_errors` | Fehlerjournal | 100+ |

### CRM-Kunden (4 Tabellen)

| Tabelle | Zweck | Records |
|---|---|---|
| `leads` | Interessenten | 500+ |
| `kunden` | Kundenstammdaten | 5'000+ |
| `mandate` | Mandatsverwaltung | 5'000+ |
| `kunden_advisor` | Berater-Zuordnung | 10'000+ |

### CRM-Verträge (2 Tabellen)

| Tabelle | Zweck | Records |
|---|---|---|
| `vertraege` | Policen/Verträge | 20'000+ |
| `provisionen` | Courtagen | 20'000+ |

### CRM-Operationen (4 Tabellen)

| Tabelle | Zweck | Records |
|---|---|---|
| `aufgaben` | Tasks/Aufgaben | 10'000+ |
| `schadenfaelle` | Schadenfälle | 1'000+ |
| `beratungsprotokolle` | Beratungs-Doku | 15'000+ |
| `dokumente` | Dokumentenmanagement | 50'000+ |

### Vergleiche & Offerten (2 Tabellen)

| Tabelle | Zweck | Records |
|---|---|---|
| `kk_vergleiche` | Krankenkassen-Vergleiche | 10'000+ |
| `offerten` | Offerten-Management | 5'000+ |

### Zusatzversicherungen (2 Tabellen)

| Tabelle | Zweck | Records |
|---|---|---|
| `zusatzversicherungen_produkte` | Produktkatalog | 200+ |
| `zusatzversicherungen_praemien` | Prämien-Daten | 10'000+ |

### Audit & Logging (3 Tabellen)

| Tabelle | Zweck | Records |
|---|---|---|
| `audit_logs` | Änderungs-Protokoll | 100'000+ |
| `import_logs` | Import-Protokoll | 500+ |
| `system_logs` | System-Events | 10'000+ |

**Gesamt: 25 Tabellen**

---

## Beziehungen

### 1:N Beziehungen

```
ref_kantone (1) ──── (N) kunden
ref_kantone (1) ──── (N) bag_praemien
ref_kantone (1) ──── (N) vertraege
ref_kantone (1) ──── (N) zusatz_praemien

ref_bag_regionen (1) ──── (N) bag_praemien
ref_bag_regionen (1) ──── (N) ref_plz

versicherer (1) ──── (N) bag_praemien
versicherer (1) ──── (N) vertraege
versicherer (1) ──── (N) offerten
versicherer (1) ──── (N) zusatz_produkte

kunden (1) ──── (N) vertraege
kunden (1) ──── (N) mandate
kunden (1) ──── (N) aufgaben
kunden (1) ──── (N) schadenfaelle
kunden (1) ──── (N) beratungsprotokolle
kunden (1) ──── (N) dokumente
kunden (1) ──── (N) kk_vergleiche

vertraege (1) ──── (1) provisionen
vertraege (1) ──── (N) aufgaben
vertraege (1) ──── (N) schadenfaelle

bag_import_versions (1) ──── (N) bag_import_errors

leads (1) ──── (0..1) kunden (bei Konvertierung)
```

### 0..1 Beziehungen

```
bag_praemien (0..1) ──── (0..1) vertraege (via bag_praemie_id)
```

---

## Datenfluss-Diagramm

```
┌──────────────┐
│ Excel (BAG)  │
└──────────────┘
       │
       ▼
┌──────────────┐
│   Parsing    │ (Client-side XLSX.js)
└──────────────┘
       │
       ▼
┌──────────────┐
│ Validierung  │ (Mapping, Plausibilität)
└──────────────┘
       │
       ▼
┌──────────────┐
│   Version    │ (bag_import_versions)
└──────────────┘
       │
       ▼
┌──────────────┐
│ Bulk Import  │ (bag_praemien)
└──────────────┘
       │
       ▼
┌──────────────┐
│  Qualitäts-  │
│  kontrolle   │ (get_import_stats)
└──────────────┘
       │
       ▼
┌──────────────┐
│  Vergleich   │ (kk_vergleiche)
└──────────────┘
```

---

## Row Level Security (RLS) Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                    RLS-Policies                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  kunden:                                                    │
│  - Admin: Full Access                                       │
│  - Advisor: Eigene Kunden (advisor_id = user_id)            │
│  - Organization: Isolation (organization_id = current)      │
│                                                             │
│  vertraege:                                                 │
│  - Admin: Full Access                                       │
│  - Advisor: Eigene Verträge (via kunde.advisor_id)          │
│  - Customer: Eigene Verträge (kunde_id = current_user)      │
│                                                             │
│  kk_vergleiche:                                             │
│  - Admin: Full Access                                       │
│  - Advisor: Eigene Vergleiche (advisor_id = user_id)        │
│                                                             │
│  bag_praemien:                                              │
│  - Read-Only für alle authentifizierten User                │
│  - Write: Nur Admin                                         │
│                                                             │
│  dokumente:                                                 │
│  - Admin: Full Access                                       │
│  - Advisor: Eigene Kunden-Dokumente                         │
│  - Customer: Eigene Dokumente                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Index-Strategie

### Performance-kritische Indizes

```sql
-- BAG-Abfragen (Haupt-Use-Case)
idx_bag_query_full ON bag_praemien(kanton, geschaeftsjahr, altersklasse, modell, franchise, unfall)

-- Kunden-Suche
idx_kunden_email ON kunden(email)
idx_kunden_name ON kunden(nachname, vorname)
idx_kunden_plz ON kunden(plz)

-- Vertrags-Abfragen
idx_vertraege_kunde ON vertraege(kunde_id)
idx_vertraege_status ON vertraege(status)
idx_vertraege_renewal ON vertraege(end_date)

-- Audit-Trail
idx_audit_entity ON audit_logs(entity_type, entity_id)
idx_audit_user ON audit_logs(user_email, created_at)
```

---

## ERD Versionierung

| Version | Datum | Änderungen |
|---|---|---|
| 1.0 | 2026-06-09 | Initiale Version für Phase 1 |

---

**Nächste Schritte:**

1. ✅ ERD erstellt
2. ⏳ SQL-Schema implementieren
3. ⏳ Backend-Functions erstellen
4. ⏳ Test-Import durchführen