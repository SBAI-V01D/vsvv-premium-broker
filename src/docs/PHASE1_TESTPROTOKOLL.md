# VSVV CRM - Phase 1 Testprotokoll

**Version:** 1.0  
**Datum:** 2026-06-09  
**Status:** Zur Testdurchührung freigegeben  
**Tester:** Peter Adam  
**Umgebung:** Supabase Testumgebung (eu-central-1)

---

## Testübersicht

| Test-ID | Testname | Status | Datum | Ergebnis |
|---|---|---|---|---|
| T-01 | BAG-Testimport | ⏳ Ausstehend | - | - |
| T-02 | Tarifmodell-Test | ⏳ Ausstehend | - | - |
| T-03 | Altersklassen-Test | ⏳ Ausstehend | - | - |
| T-04 | Franchise-Test | ⏳ Ausstehend | - | - |
| T-05 | Versicherer-Test | ⏳ Ausstehend | - | - |
| T-06 | Performance-Test | ⏳ Ausstehend | - | - |
| T-07 | Sicherheits-Test | ⏳ Ausstehend | - | - |
| T-08 | Restore-Test | ⏳ Ausstehend | - | - |

---

## T-01: BAG-Testimport

### Testdaten

| Eigenschaft | Wert |
|---|---|
| **Testdatei** | BAG_Praemien_2026.xlsx |
| **Quelle** | Bundesamt für Gesundheit (BAG) |
| **Veröffentlichung** | September 2025 |
| **Geschäftsjahr** | 2026 |

### Import-Statistik

| Metrik | Erwartet | Tatsächlich | Abweichung |
|---|---|---|---|
| **Gesamtzeilen Datei** | 217'472 | - | - |
| **Gesamtzeilen importiert** | 217'472 | - | - |
| **Fehlerhafte Zeilen** | 0 | - | - |
| **Verworfene Zeilen** | 0 | - | - |
| **Importdauer** | < 10 Min. | - | - |

### Akzeptanzkriterien

- [ ] Importierte Datensätze = Quelldatensätze (217'472)
- [ ] Keine verworfenen Datensätze aufgrund von:
  - [ ] Tariftyp
  - [ ] Altersklasse
  - [ ] Franchise
- [ ] Alle 26 Kantone importiert
- [ ] Alle Versicherer importiert (41+)

### Import-Protokoll

```
Import gestartet: _______________
Import abgeschlossen: _______________
Dauer: _______________ Minuten

Ergebnis:
- Gesamt: _______________
- Erfolgreich: _______________
- Fehler: _______________
- Verworfen: _______________

Fehlerdetails (falls vorhanden):
_________________________________________________
_________________________________________________
_________________________________________________
```

### Validierung

```sql
-- Total Records prüfen
SELECT COUNT(*) FROM bag_praemien WHERE geschaeftsjahr = 2026;
-- Erwartet: 217'472

-- Alle Kantone prüfen
SELECT COUNT(DISTINCT kanton) FROM bag_praemien WHERE geschaeftsjahr = 2026;
-- Erwartet: 26

-- Alle Versicherer prüfen
SELECT COUNT(DISTINCT krankenkasse) FROM bag_praemien WHERE geschaeftsjahr = 2026;
-- Erwartet: 41+
```

**Ergebnis:** ☐ Bestanden ☐ Nicht bestanden

**Unterschrift Tester:** _______________  
**Datum:** _______________

---

## T-02: Tarifmodell-Test

### Nachweis für alle Tarifmodelle

| Tarifmodell | Erwartet | Gefunden | Status |
|---|---|---|---|
| **Standardmodell** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **Hausarztmodell** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **HMO-Modell** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **Telmed-Modell** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **Alternative Modelle** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |

### SQL-Validierung

```sql
-- Alle Modell-Typen anzeigen
SELECT 
  modell, 
  COUNT(*) AS anzahl
FROM bag_praemien 
WHERE geschaeftsjahr = 2026
GROUP BY modell
ORDER BY anzahl DESC;
```

**Erwartetes Ergebnis:**

| modell | anzahl |
|---|---|
| standard | ~54'368 |
| telmed | ~54'368 |
| hausarzt | ~54'368 |
| hmo | ~54'368 |

### Vergleichstest

**Testfall:** Vergleich für alle Modell-Typen erstellen

```
Test-Person:
- Alter: 30 Jahre
- Kanton: ZH
- PLZ: 8001

Ergebnisse:
- Standardmodell: CHF _______ / Monat
- Telmed-Modell: CHF _______ / Monat
- Hausarztmodell: CHF _______ / Monat
- HMO-Modell: CHF _______ / Monat

Alle Modelle im Vergleich erschienen? ☐ Ja ☐ Nein
```

**Ergebnis:** ☐ Bestanden ☐ Nicht bestanden

**Unterschrift Tester:** _______________  
**Datum:** _______________

---

## T-03: Altersklassen-Test

### Nachweis für alle Altersklassen

| Altersklasse | Erwartet | Gefunden | Status |
|---|---|---|---|
| **Kind (0-18)** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **Jugend (19-25)** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **Erwachsen (26+)** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |

### SQL-Validierung

```sql
-- Alle Altersklassen anzeigen
SELECT 
  altersklasse,
  alter_von,
  alter_bis,
  COUNT(*) AS anzahl
FROM bag_praemien 
WHERE geschaeftsjahr = 2026
GROUP BY altersklasse, alter_von, alter_bis
ORDER BY alter_von;
```

**Erwartetes Ergebnis:**

| altersklasse | alter_von | alter_bis | anzahl |
|---|---|---|---|
| kind | 0 | 18 | ~72'490 |
| jugend | 19 | 25 | ~72'490 |
| erwachsen | 26 | 99 | ~72'492 |

### Vergleichstest

**Testfälle:**

```
Test 1 - Kind (5 Jahre):
- Kanton: ZH
- Prämie gefunden? ☐ Ja ☐ Nein
- Prämie: CHF _______

Test 2 - Jugend (20 Jahre):
- Kanton: ZH
- Prämie gefunden? ☐ Ja ☐ Nein
- Prämie: CHF _______

Test 3 - Erwachsen (35 Jahre):
- Kanton: ZH
- Prämie gefunden? ☐ Ja ☐ Nein
- Prämie: CHF _______

Alle Altersgruppen vergleichbar? ☐ Ja ☐ Nein
```

**Ergebnis:** ☐ Bestanden ☐ Nicht bestanden

**Unterschrift Tester:** _______________  
**Datum:** _______________

---

## T-04: Franchise-Test

### Nachweis für alle Franchisen-Stufen

| Franchise (CHF) | Erwartet | Gefunden | Status |
|---|---|---|---|
| **0** (nur Kinder) | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **300** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **500** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **1000** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **1500** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **2000** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **2500** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |

### SQL-Validierung

```sql
-- Alle Franchisen anzeigen
SELECT 
  franchise,
  COUNT(*) AS anzahl
FROM bag_praemien 
WHERE geschaeftsjahr = 2026
GROUP BY franchise
ORDER BY franchise;
```

**Erwartetes Ergebnis:**

| franchise | anzahl |
|---|---|
| 0 | ~30'000 |
| 300 | ~35'000 |
| 500 | ~35'000 |
| 1000 | ~30'000 |
| 1500 | ~30'000 |
| 2000 | ~30'000 |
| 2500 | ~27'472 |

### Vergleichstest

**Testfall:** Alle Franchisen für gleiche Person

```
Test-Person:
- Alter: 30 Jahre
- Kanton: ZH
- Kasse: CSS
- Modell: Standard

Franchise 300: CHF _______ / Monat ☐ Gefunden
Franchise 500: CHF _______ / Monat ☐ Gefunden
Franchise 1000: CHF _______ / Monat ☐ Gefunden
Franchise 1500: CHF _______ / Monat ☐ Gefunden
Franchise 2000: CHF _______ / Monat ☐ Gefunden
Franchise 2500: CHF _______ / Monat ☐ Gefunden

Alle Franchisen gefunden? ☐ Ja ☐ Nein
```

**Ergebnis:** ☐ Bestanden ☐ Nicht bestanden

**Unterschrift Tester:** _______________  
**Datum:** _______________

---

## T-05: Versicherer-Test

### Stichproben-Test (10 Versicherer)

| # | Versicherer | Erwartet | Gefunden | Prämie (CHF) | Abweichung | Status |
|---|---|---|---|---|---|---|
| 1 | CSS | ✅ Ja | ☐ Ja ☐ Nein | _______ | _______% | ☐ OK ☐ Fehler |
| 2 | Helsana | ✅ Ja | ☐ Ja ☐ Nein | _______ | _______% | ☐ OK ☐ Fehler |
| 3 | Sanitas | ✅ Ja | ☐ Ja ☐ Nein | _______ | _______% | ☐ OK ☐ Fehler |
| 4 | Concordia | ✅ Ja | ☐ Ja ☐ Nein | _______ | _______% | ☐ OK ☐ Fehler |
| 5 | KPT | ✅ Ja | ☐ Ja ☐ Nein | _______ | _______% | ☐ OK ☐ Fehler |
| 6 | SWICA | ✅ Ja | ☐ Ja ☐ Nein | _______ | _______% | ☐ OK ☐ Fehler |
| 7 | Visana | ✅ Ja | ☐ Ja ☐ Nein | _______ | _______% | ☐ OK ☐ Fehler |
| 8 | Assura | ✅ Ja | ☐ Ja ☐ Nein | _______ | _______% | ☐ OK ☐ Fehler |
| 9 | Groupe Mutuel | ✅ Ja | ☐ Ja ☐ Nein | _______ | _______% | ☐ OK ☐ Fehler |
| 10 | Atupri | ✅ Ja | ☐ Ja ☐ Nein | _______ | _______% | ☐ OK ☐ Fehler |

### Test-Parameter

```
Test-Person:
- Alter: 30 Jahre
- Kanton: ZH
- PLZ: 8001
- Franchise: 300
- Modell: Standard

BAG-Originaldaten (Quelle):
- CSS: CHF _______
- Helsana: CHF _______
- Sanitas: CHF _______
- etc.

System-Prämien (Vergleich):
- CSS: CHF _______
- Helsana: CHF _______
- Sanitas: CHF _______
- etc.

Abweichung berechnen:
- CSS: _______% (Ziel: 0%)
- Helsana: _______% (Ziel: 0%)
- etc.
```

### SQL-Validierung

```sql
-- Top 10 Versicherer anzeigen
SELECT 
  krankenkasse,
  COUNT(*) AS anzahl,
  AVG(praemie_erwachsene) AS durchschnittpaermie
FROM bag_praemien 
WHERE geschaeftsjahr = 2026
  AND kanton = 'ZH'
  AND modell = 'standard'
  AND franchise = 300
  AND altersklasse = 'erwachsen'
GROUP BY krankenkasse
ORDER BY anzahl DESC
LIMIT 10;
```

**Akzeptanzkriterium:**
- Alle 10 Versicherer gefunden
- Maximale Abweichung < 1% (Rundungsdifferenzen)

**Ergebnis:** ☐ Bestanden ☐ Nicht bestanden

**Unterschrift Tester:** _______________  
**Datum:** _______________

---

## T-06: Performance-Test

### Messwerte

| Metrik | Ziel | Tatsächlich | Status |
|---|---|---|---|
| **Query-Zeit (Vergleich)** | < 1 Sekunde | _______ ms | ☐ OK ☐ Fehler |
| **Query-Zeit (Versicherersuche)** | < 1 Sekunde | _______ ms | ☐ OK ☐ Fehler |
| **Import-Geschwindigkeit** | < 10 Minuten | _______ Min. | ☐ OK ☐ Fehler |
| **Datenbank-Grösse** | < 1 GB | _______ MB | ☐ OK ☐ Fehler |

### Test-Szenarien

**Szenario 1: Vergleichsabfrage**

```sql
EXPLAIN ANALYZE
SELECT * FROM bag_praemien
WHERE geschaeftsjahr = 2026
  AND kanton = 'ZH'
  AND altersklasse = 'erwachsen'
  AND modell = 'standard'
  AND franchise = 300;
```

**Ergebnis:**
- Ausführungszeit: _______ ms
- Index verwendet: ☐ Ja ☐ Nein
- Rows scanned: _______

**Szenario 2: Import-Geschwindigkeit**

```
Import-Start: _______________
Import-Ende: _______________
Dauer: _______________ Minuten
Records pro Sekunde: _______
```

**Szenario 3: Datenbank-Grösse**

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Ergebnis:**
- Total Grösse: _______ MB
- bag_praemien: _______ MB
- Indexes: _______ MB

**Ergebnis:** ☐ Bestanden ☐ Nicht bestanden

**Unterschrift Tester:** _______________  
**Datum:** _______________

---

## T-07: Sicherheits-Test

### RLS-Tests (Row Level Security)

| Test | Erwartet | Ergebnis | Status |
|---|---|---|---|
| **RLS aktiv auf bag_praemien** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **RLS aktiv auf kunden** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **RLS aktiv auf vertraege** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| **RLS aktiv auf audit_logs** | ✅ Ja | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |

### Benutzer-Isolation

**Test-Szenario:**

```
Benutzer A (Advisor: advisor_a@vsvv.ch):
- Erstellt Kunde: "Test Kunde A"
- Advisor_ID: [User A ID]

Benutzer B (Advisor: advisor_b@vsvv.ch):
- Versucht Kunde A zu sehen
- Erwartet: ❌ Kein Zugriff

Ergebnis:
- Benutzer A sieht Kunde A? ☐ Ja (erwartet)
- Benutzer B sieht Kunde A? ☐ Nein (erwartet)
```

### Audit-Logs Test

**Test-Szenario:**

```sql
-- Audit-Logs prüfen
SELECT 
  audit_id,
  timestamp,
  actor_name,
  entity_type,
  action,
  entity_id
FROM audit_logs
ORDER BY timestamp DESC
LIMIT 10;
```

**Erwartet:**
- [ ] Alle Änderungen geloggt
- [ ] User-ID korrekt erfasst
- [ ] Timestamp korrekt
- [ ] Action korrekt (INSERT/UPDATE/DELETE)

### Restore-Test

**Test-Szenario:**

```
1. Backup erstellen (Supabase Dashboard)
2. Test-Daten löschen
3. Restore durchführen
4. Datenintegrität prüfen

Ergebnis:
- Backup erfolgreich? ☐ Ja ☐ Nein
- Restore erfolgreich? ☐ Ja ☐ Nein
- Daten vollständig? ☐ Ja ☐ Nein
- Dauer: _______ Minuten
```

**Ergebnis:** ☐ Bestanden ☐ Nicht bestanden

**Unterschrift Tester:** _______________  
**Datum:** _______________

---

## T-08: Restore-Test

### Backup-Wiederherstellung

**Test-Durchführung:**

```
1. Vollständiges Backup erstellen
   Zeitpunkt: _______________
   Backup-ID: _______________
   Grösse: _______ MB

2. Test-Datenbank löschen (Staging)
   Zeitpunkt: _______________

3. Restore durchführen
   Start: _______________
   Ende: _______________
   Dauer: _______ Minuten

4. Datenintegrität prüfen
   - Tables: _______ (erwartet: 25)
   - Records bag_praemien: _______ (erwartet: 217'472)
   - Records kunden: _______
   - Records vertraege: _______
```

### Validierung nach Restore

```sql
-- Total Records prüfen
SELECT 
  'bag_praemien' AS table_name, COUNT(*) AS record_count
FROM bag_praemien
UNION ALL
SELECT 'kunden', COUNT(*) FROM kunden
UNION ALL
SELECT 'vertraege', COUNT(*) FROM vertraege
UNION ALL
SELECT 'versicherer', COUNT(*) FROM versicherer;
```

**Erwartete Werte:**

| Tabelle | Erwartet | Tatsächlich | Status |
|---|---|---|---|
| bag_praemien | 217'472 | _______ | ☐ OK ☐ Fehler |
| kunden | _______ | _______ | ☐ OK ☐ Fehler |
| vertraege | _______ | _______ | ☐ OK ☐ Fehler |
| versicherer | 18+ | _______ | ☐ OK ☐ Fehler |

**Akzeptanzkriterium:**
- Restore erfolgreich in < 30 Minuten
- Alle Daten vollständig wiederhergestellt
- Keine Datenkorruption

**Ergebnis:** ☐ Bestanden ☐ Nicht bestanden

**Unterschrift Tester:** _______________  
**Datum:** _______________

---

## Zusammenfassung

### Test-Ergebnisse

| Test-ID | Testname | Ergebnis | Bestanden |
|---|---|---|---|
| T-01 | BAG-Testimport | ☐ Bestanden ☐ Nicht bestanden | ☐ Ja ☐ Nein |
| T-02 | Tarifmodell-Test | ☐ Bestanden ☐ Nicht bestanden | ☐ Ja ☐ Nein |
| T-03 | Altersklassen-Test | ☐ Bestanden ☐ Nicht bestanden | ☐ Ja ☐ Nein |
| T-04 | Franchise-Test | ☐ Bestanden ☐ Nicht bestanden | ☐ Ja ☐ Nein |
| T-05 | Versicherer-Test | ☐ Bestanden ☐ Nicht bestanden | ☐ Ja ☐ Nein |
| T-06 | Performance-Test | ☐ Bestanden ☐ Nicht bestanden | ☐ Ja ☐ Nein |
| T-07 | Sicherheits-Test | ☐ Bestanden ☐ Nicht bestanden | ☐ Ja ☐ Nein |
| T-08 | Restore-Test | ☐ Bestanden ☐ Nicht bestanden | ☐ Ja ☐ Nein |

### Gesamt-Status

**Alle Tests bestanden?** ☐ Ja ☐ Nein

**Anzahl bestandene Tests:** _______ / 8

**Kritische Fehler:**
```
_________________________________________________
_________________________________________________
_________________________________________________
```

**Empfehlung:**
☐ Freigabe für Phase 2 (Produktivmigration)
☐ Nachbesserungen erforderlich
☐ Tests wiederholen

### Unterschriften

**Tester:** _______________  
**Datum:** _______________

**Projektleitung:** _______________  
**Datum:** _______________

**Freigabe erteilt:** ☐ Ja ☐ Nein  
**Datum:** _______________

---

## Anhang

### A. SQL-Queries für Tests

```sql
-- T-01: Total Records
SELECT COUNT(*) FROM bag_praemien WHERE geschaeftsjahr = 2026;

-- T-02: Alle Modell-Typen
SELECT modell, COUNT(*) FROM bag_praemien 
WHERE geschaeftsjahr = 2026 
GROUP BY modell;

-- T-03: Alle Altersklassen
SELECT altersklasse, COUNT(*) FROM bag_praemien 
WHERE geschaeftsjahr = 2026 
GROUP BY altersklasse;

-- T-04: Alle Franchisen
SELECT franchise, COUNT(*) FROM bag_praemien 
WHERE geschaeftsjahr = 2026 
GROUP BY franchise;

-- T-05: Top Versicherer
SELECT krankenkasse, COUNT(*) FROM bag_praemien 
WHERE geschaeftsjahr = 2026 
GROUP BY krankenkasse 
ORDER BY COUNT(*) DESC 
LIMIT 10;

-- T-06: Query Performance
EXPLAIN ANALYZE
SELECT * FROM bag_praemien
WHERE geschaeftsjahr = 2026
  AND kanton = 'ZH'
  AND altersklasse = 'erwachsen'
  AND modell = 'standard'
  AND franchise = 300;

-- T-07: RLS Status
SELECT 
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('bag_praemien', 'kunden', 'vertraege', 'audit_logs');

-- T-08: Database Size
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### B. Kontaktliste

| Rolle | Name | Email | Telefon |
|---|---|---|---|
| **Tester** | Peter Adam | admin@vsvv.ch | +41 XX XXX XX XX |
| **Support** | Supabase | support@supabase.com | - |
| **Support** | Base44 | support@base44.com | - |

### C. Versionierung

| Version | Datum | Änderungen |
|---|---|---|
| 1.0 | 2026-06-09 | Initiale Version für Phase 1 Tests |

---

**Ende des Testprotokolls**