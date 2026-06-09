# VSVV CRM - Phase 1 Testdurchführungs-Protokoll

**Version:** 1.0  
**Datum:** 2026-06-09  
**Tester:** Peter Adam  
**Status:** Zur Durchführung bereit

---

## Anleitung zur Testdurchführung

### Vorbereitung

**1. Supabase-Projekt erstellen:**
```
URL: https://supabase.com/dashboard
→ New Project
→ Name: "vsvv-crm-production"
→ Region: "Europe Central (Frankfurt)"
→ Plan: "Pro" ($25/Monat)
→ Warten bis Projekt bereit (~5 Min.)
```

**2. SQL-Schema ausführen:**
```
Supabase Dashboard → SQL Editor
→ Datei: docs/SUPABASE_SQL_SCHEMA.sql
→ Komplettes SQL kopieren und einfügen
→ "Run" klicken
→ Erfolgsmeldung prüfen
```

**3. Secrets in Base44 eintragen:**
```
Base44 Dashboard → Settings → Secrets

SUPABASE_URL: https://[PROJECT_REF].supabase.co
SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

⚠️ SERVICE_ROLE_KEY ist geheim - nur für Backend-Functions!
```

**4. Test-Import durchführen:**
```
Browser: /admin/bag-daten öffnen
→ BAG-Excel-Datei 2026 auswählen
→ "Analysieren" klicken
→ "Importieren" klicken (Alle 26 Kantone)
→ Importdauer notieren
→ Ergebnis dokumentieren
```

---

## T-01: BAG-Daten Import

### Test-Setup

**Testdatei:**
- Name: BAG_Praemien_2026.xlsx
- Quelle: https://www.bag.admin.ch/bag/de/home/versicherungen/krankenversicherung/krankenversicherung-praemien/preisvergleich.html
- Stand: September 2025
- Geschäftsjahr: 2026

### Durchführung

**Schritt 1: Quelldaten dokumentieren**

Excel-Datei öffnen und zählen:
```
Gesamtzeilen (ohne Header): _______________
Davon TAR-STD (Standard): _______________
Davon TAR-TEL (Telmed): _______________
Davon TAR-HAM (Hausarzt): _______________
Davon TAR-HMO (HMO): _______________
```

**Schritt 2: Import durchführen**

```
Import gestartet um: _______________ Uhr
Import abgeschlossen um: _______________ Uhr
Dauer: _______________ Minuten

Ergebnis aus UI:
- Gesamt: _______________
- Erfolgreich: _______________
- Fehler: _______________
- Verworfen: _______________
```

**Schritt 3: Validierung in Supabase**

Im Supabase SQL Editor ausführen:

```sql
-- Total Records prüfen
SELECT COUNT(*) AS total_records 
FROM bag_praemien 
WHERE geschaeftsjahr = 2026;
```

**Ergebnis:** _______________ Datensätze

```sql
-- Nach Kantonen aufschlüsseln
SELECT 
  kanton, 
  COUNT(*) AS anzahl
FROM bag_praemien 
WHERE geschaeftsjahr = 2026
GROUP BY kanton
ORDER BY kanton;
```

**Ergebnis:** Alle 26 Kantone vorhanden? ☐ Ja ☐ Nein

```sql
-- Nach Altersklassen prüfen
SELECT 
  altersklasse, 
  COUNT(*) AS anzahl
FROM bag_praemien 
WHERE geschaeftsjahr = 2026
GROUP BY altersklasse;
```

**Ergebnis:** Alle 3 Altersklassen vorhanden? ☐ Ja ☐ Nein

```sql
-- Nach Tarifmodellen prüfen
SELECT 
  modell, 
  COUNT(*) AS anzahl
FROM bag_praemien 
WHERE geschaeftsjahr = 2026
GROUP BY modell
ORDER BY modell;
```

**Ergebnis:** Alle 4 Modelle vorhanden? ☐ Ja ☐ Nein

```sql
-- Nach Franchisen prüfen
SELECT 
  franchise, 
  COUNT(*) AS anzahl
FROM bag_praemien 
WHERE geschaeftsjahr = 2026
GROUP BY franchise
ORDER BY franchise;
```

**Ergebnis:** Alle 7 Franchisen vorhanden? ☐ Ja ☐ Nein

### Akzeptanzkriterien

| Kriterium | Erwartet | Tatsächlich | Status |
|---|---|---|---|
| Importierte Records = Quelle | 217'472 | _______ | ☐ Bestanden ☐ Fehler |
| Verworfene Records | 0 | _______ | ☐ Bestanden ☐ Fehler |
| Alle 26 Kantone | Ja | ☐ Ja ☐ Nein | ☐ Bestanden ☐ Fehler |
| Alle 3 Altersklassen | Ja | ☐ Ja ☐ Nein | ☐ Bestanden ☐ Fehler |
| Alle 4 Tarifmodelle | Ja | ☐ Ja ☐ Nein | ☐ Bestanden ☐ Fehler |
| Alle 7 Franchisen | Ja | ☐ Ja ☐ Nein | ☐ Bestanden ☐ Fehler |
| Importdauer | < 10 Min. | _______ Min. | ☐ Bestanden ☐ Fehler |

**Test bestanden?** ☐ Ja ☐ Nein

---

## T-02: Fachlicher Test - Stichprobenvergleich

### Test-Setup

**Test-Personen:**

| Person | Alter | Altersklasse | Franchise |
|---|---|---|---|
| **Kind** | 5 Jahre | kind | 0 |
| **Jugend** | 22 Jahre | jugend | 300 |
| **Erwachsen** | 35 Jahre | erwachsen | 300 |

**Parameter:**
- Kanton: ZH
- PLZ: 8001
- Unfall: OHNE
- Geschäftsjahr: 2026

### Durchführung

**Schritt 1: Offizielle BAG-Prämien ermitteln**

Quelle: https://www.priminfo.admin.ch/de/preise/praemienvergleich

Für jede Krankenkasse und jede Test-Person die Prämie notieren:

**Test-Person: Kind (5 Jahre, Franchise 0)**

| Kasse | BAG-Prämie (CHF) | System-Prämie (CHF) | Abweichung | Status |
|---|---|---|---|---|
| CSS | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Helsana | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Sanitas | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Concordia | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| KPT | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| SWICA | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Visana | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Assura | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Groupe Mutuel | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Atupri | _______ | _______ | _______% | ☐ OK ☐ Fehler |

**Test-Person: Jugend (22 Jahre, Franchise 300)**

| Kasse | BAG-Prämie (CHF) | System-Prämie (CHF) | Abweichung | Status |
|---|---|---|---|---|
| CSS | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Helsana | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Sanitas | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Concordia | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| KPT | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| SWICA | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Visana | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Assura | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Groupe Mutuel | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Atupri | _______ | _______ | _______% | ☐ OK ☐ Fehler |

**Test-Person: Erwachsen (35 Jahre, Franchise 300)**

| Kasse | BAG-Prämie (CHF) | System-Prämie (CHF) | Abweichung | Status |
|---|---|---|---|---|
| CSS | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Helsana | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Sanitas | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Concordia | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| KPT | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| SWICA | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Visana | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Assura | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Groupe Mutuel | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Atupri | _______ | _______ | _______% | ☐ OK ☐ Fehler |

**Zusätzliche Tests: Franchise 2500 (Erwachsen, 35 Jahre)**

| Kasse | BAG-Prämie (CHF) | System-Prämie (CHF) | Abweichung | Status |
|---|---|---|---|---|
| CSS | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Helsana | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Sanitas | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| Concordia | _______ | _______ | _______% | ☐ OK ☐ Fehler |
| KPT | _______ | _______ | _______% | ☐ OK ☐ Fehler |

### System-Prämien ermitteln

**Methode A: Über UI**
```
1. /krankenkassen-vergleich öffnen
2. Test-Person eingeben (Alter, Kanton, PLZ)
3. Franchise auswählen
4. Prämien aus Tabelle ablesen
```

**Methode B: Über SQL (Supabase)**
```sql
-- Beispiel: Erwachsen, ZH, Standard, Franchise 300
SELECT 
  krankenkasse,
  praemie_erwachsene AS praemie
FROM bag_praemien
WHERE geschaeftsjahr = 2026
  AND kanton = 'ZH'
  AND altersklasse = 'erwachsen'
  AND modell = 'standard'
  AND franchise = 300
  AND unfall = false
ORDER BY praemie_erwachsene ASC;
```

### Akzeptanzkriterien

| Kriterium | Erwartet | Status |
|---|---|---|
| Alle 10 Kassen gefunden | Ja | ☐ Bestanden ☐ Fehler |
| Maximale Abweichung | < 1% | ☐ Bestanden ☐ Fehler |
| Durchschnittliche Abweichung | < 0.5% | ☐ Bestanden ☐ Fehler |

**Test bestanden?** ☐ Ja ☐ Nein

---

## T-03: Performance-Test

### Test-Setup

**Umgebung:**
- Supabase Projekt: vsvv-crm-production
- Region: eu-central-1
- Datenbestand: 217'472 BAG-Datensätze

### Durchführung

**Test 1: Vergleichsabfrage (< 1 Sekunde)**

Im Supabase SQL Editor:

```sql
EXPLAIN ANALYZE
SELECT * FROM bag_praemien
WHERE geschaeftsjahr = 2026
  AND kanton = 'ZH'
  AND altersklasse = 'erwachsen'
  AND modell = 'standard'
  AND franchise = 300
  AND unfall = false;
```

**Ergebnis:**
- Ausführungszeit: _______ ms
- Index verwendet: ☐ Ja ☐ Nein
- Rows scanned: _______
- Rows returned: _______

**Akzeptanz:** < 1000 ms ☐ Bestanden ☐ Fehler

**Test 2: Versicherersuche (< 1 Sekunde)**

```sql
EXPLAIN ANALYZE
SELECT 
  krankenkasse,
  AVG(praemie_erwachsene) AS avg_praemie
FROM bag_praemien
WHERE geschaeftsjahr = 2026
  AND kanton = 'ZH'
  AND altersklasse = 'erwachsen'
GROUP BY krankenkasse
ORDER BY avg_praemie ASC;
```

**Ergebnis:**
- Ausführungszeit: _______ ms
- Anzahl Versicherer: _______

**Akzeptanz:** < 1000 ms ☐ Bestanden ☐ Fehler

**Test 3: Vollimport (< 10 Minuten)**

```
Import gestartet: _______________
Import abgeschlossen: _______________
Dauer: _______________ Minuten
Records pro Sekunde: _______
```

**Akzeptanz:** < 10 Minuten ☐ Bestanden ☐ Fehler

**Test 4: Datenbank-Grösse**

```sql
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Ergebnis:**
- Total Grösse: _______ MB
- bag_praemien Tabelle: _______ MB
- Indexes: _______ MB

### Zusammenfassung

| Test | Ziel | Tatsächlich | Status |
|---|---|---|---|
| Vergleichsabfrage | < 1000 ms | _______ ms | ☐ Bestanden ☐ Fehler |
| Versicherersuche | < 1000 ms | _______ ms | ☐ Bestanden ☐ Fehler |
| Vollimport | < 10 Min. | _______ Min. | ☐ Bestanden ☐ Fehler |
| Datenbank-Grösse | < 1 GB | _______ MB | ☐ Bestanden ☐ Fehler |

**Test bestanden?** ☐ Ja ☐ Nein

---

## T-04: Sicherheits-Test

### Test-Setup

**Benutzer:**
- Admin: admin@vsvv.ch (Rolle: admin)
- Advisor A: advisor_a@vsvv.ch (Rolle: broker)
- Advisor B: advisor_b@vsvv.ch (Rolle: broker)

### Durchführung

**Test 1: RLS aktiv**

Im Supabase SQL Editor:

```sql
SELECT 
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('bag_praemien', 'kunden', 'vertraege', 'audit_logs');
```

**Ergebnis:**

| Tabelle | RLS aktiv? | Status |
|---|---|---|
| bag_praemien | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| kunden | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| vertraege | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| audit_logs | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |

**Test 2: Rollentrennung**

```sql
-- Als Advisor A einloggen (im Supabase Dashboard)
-- Test-Kunde erstellen
INSERT INTO kunden (vorname, nachname, email, advisor_id)
VALUES ('Test', 'Kunde A', 'test.kunde.a@example.com', [USER_ID_A]);

-- Als Advisor B einloggen
-- Versuchen Kunde A zu sehen
SELECT * FROM kunden WHERE email = 'test.kunde.a@example.com';
```

**Ergebnis:**
- Advisor A sieht Kunde A? ☐ Ja (erwartet)
- Advisor B sieht Kunde A? ☐ Nein (erwartet)

**Test 3: Audit-Logs**

```sql
-- Letzte 10 Audit-Logs prüfen
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

**Ergebnis:**
- Audit-Logs vorhanden? ☐ Ja ☐ Nein
- User-ID korrekt erfasst? ☐ Ja ☐ Nein
- Timestamp korrekt? ☐ Ja ☐ Nein
- Action korrekt? ☐ Ja ☐ Nein

**Test 4: Restore-Test**

```
1. Supabase Dashboard → Database → Backups
2. "Create backup" klicken
3. Backup-ID notieren: _______________
4. Test-Daten löschen (z.B. Test-Kunde von oben)
5. Restore durchführen
6. Datenintegrität prüfen

Ergebnis:
- Backup erfolgreich? ☐ Ja ☐ Nein
- Restore erfolgreich? ☐ Ja ☐ Nein
- Daten vollständig? ☐ Ja ☐ Nein
- Dauer: _______ Minuten
```

### Zusammenfassung

| Test | Erwartet | Status |
|---|---|---|
| RLS auf allen Tabellen | Aktiv | ☐ Bestanden ☐ Fehler |
| Rollentrennung funktioniert | Ja | ☐ Bestanden ☐ Fehler |
| Audit-Logs aktiv | Ja | ☐ Bestanden ☐ Fehler |
| Restore erfolgreich | Ja | ☐ Bestanden ☐ Fehler |

**Test bestanden?** ☐ Ja ☐ Nein

---

## Gesamtergebnis

### Test-Übersicht

| Test-ID | Testname | Bestanden? | Datum |
|---|---|---|---|
| T-01 | BAG-Daten Import | ☐ Ja ☐ Nein | _______________ |
| T-02 | Fachlicher Test | ☐ Ja ☐ Nein | _______________ |
| T-03 | Performance-Test | ☐ Ja ☐ Nein | _______________ |
| T-04 | Sicherheits-Test | ☐ Ja ☐ Nein | _______________ |

### Gesamtbewertung

**Alle Tests bestanden?** ☐ Ja ☐ Nein

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

## Anhang: SQL-Queries für Tests

### A.1: Total Records BAG

```sql
SELECT COUNT(*) FROM bag_praemien WHERE geschaeftsjahr = 2026;
```

### A.2: Alle Modell-Typen

```sql
SELECT modell, COUNT(*) FROM bag_praemien 
WHERE geschaeftsjahr = 2026 
GROUP BY modell;
```

### A.3: Alle Altersklassen

```sql
SELECT altersklasse, COUNT(*) FROM bag_praemien 
WHERE geschaeftsjahr = 2026 
GROUP BY altersklasse;
```

### A.4: Alle Franchisen

```sql
SELECT franchise, COUNT(*) FROM bag_praemien 
WHERE geschaeftsjahr = 2026 
GROUP BY franchise;
```

### A.5: Top Versicherer

```sql
SELECT krankenkasse, COUNT(*) FROM bag_praemien 
WHERE geschaeftsjahr = 2026 
GROUP BY krankenkasse 
ORDER BY COUNT(*) DESC 
LIMIT 10;
```

### A.6: Query Performance

```sql
EXPLAIN ANALYZE
SELECT * FROM bag_praemien
WHERE geschaeftsjahr = 2026
  AND kanton = 'ZH'
  AND altersklasse = 'erwachsen'
  AND modell = 'standard'
  AND franchise = 300;
```

### A.7: RLS Status

```sql
SELECT 
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('bag_praemien', 'kunden', 'vertraege', 'audit_logs');
```

### A.8: Database Size

```sql
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

**Ende des Testdurchführungs-Protokolls**