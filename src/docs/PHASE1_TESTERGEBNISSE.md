# Phase 1 - Testergebnisse

**Datum:** _______________  
**Tester:** _______________  
**Status:** ☐ Zur Abnahme bereit ☐ In Durchführung ☐ Abgeschlossen

---

## 1. BAG-Import Test - Ursprüngliches Problem

### Voranalyse (Alt-System)

| Metrik | Wert |
|---|---|
| **Gesamtzeilen Quelle** | 217'472 |
| **Importiert** | 28'014 |
| **Übersprungen Alter** | 99'268 |
| **Übersprungen Tariftyp** | 31'088 |
| **Verworfen Total** | 189'458 |

**Problem:** 87% der Datensätze wurden verworfen aufgrund von:
- Falschem Altersklassen-Mapping
- Falschem Tariftyp-Mapping
- Falschem Franchise-Mapping

---

## 1. BAG-Import Test - Neues System (Supabase)

### Import-Statistik

| Metrik | Wert |
|---|---|
| **Gesamtzeilen Quelle** | _______________ |
| **Gesamtzeilen Ziel (importiert)** | _______________ |
| **Anzahl Fehler** | _______________ |
| **Anzahl verworfene Datensätze** | _______________ |
| **Importdauer** | _______________ Minuten |

### Verwerfungs-Analyse

| Verwerfungsgrund | Anzahl | Status |
|---|---|---|
| **Altersklasse** | _______ | ☐ 0 (Bestanden) ☐ >0 (Fehler) |
| **Tariftyp** | _______ | ☐ 0 (Bestanden) ☐ >0 (Fehler) |
| **Franchise-Mapping** | _______ | ☐ 0 (Bestanden) ☐ >0 (Fehler) |
| **Andere** | _______ | ☐ OK ☐ Fehler |

### Akzeptanzkriterium

| Kriterium | Erwartet | Tatsächlich | Status |
|---|---|---|---|
| Importierte Records = Quelle | 100% | _______% | ☐ Bestanden ☐ Fehler |
| Verworfene Records (Alter) | 0 | _______ | ☐ Bestanden ☐ Fehler |
| Verworfene Records (Tarif) | 0 | _______ | ☐ Bestanden ☐ Fehler |
| Verworfene Records (Franchise) | 0 | _______ | ☐ Bestanden ☐ Fehler |
| Importdauer | < 10 Min. | _______ Min. | ☐ Bestanden ☐ Fehler |

---

## 1b. Datenqualität

### Importierte Referenzdaten

| Kategorie | Erwartet | Tatsächlich | Status |
|---|---|---|---|
| **Versicherer** | 41+ | _______ | ☐ Bestanden ☐ Fehler |
| **Kantone** | 26 | _______ | ☐ Bestanden ☐ Fehler |
| **Regionen** | 3 | _______ | ☐ Bestanden ☐ Fehler |
| **Tarifmodelle** | 4 (standard, telmed, hausarzt, hmo) | _______ | ☐ Bestanden ☐ Fehler |
| **Altersklassen** | 3 (kind, jugend, erwachsen) | _______ | ☐ Bestanden ☐ Fehler |
| **Franchisen** | 7 (0, 300, 500, 1000, 1500, 2000, 2500) | _______ | ☐ Bestanden ☐ Fehler |

### SQL-Validierung

```sql
-- Versicherer
SELECT COUNT(DISTINCT krankenkasse) FROM bag_praemien WHERE geschaeftsjahr = 2026;

-- Kantone
SELECT COUNT(DISTINCT kanton) FROM bag_praemien WHERE geschaeftsjahr = 2026;

-- Regionen
SELECT COUNT(DISTINCT region) FROM bag_praemien WHERE geschaeftsjahr = 2026;

-- Tarifmodelle
SELECT modell, COUNT(*) FROM bag_praemien WHERE geschaeftsjahr = 2026 GROUP BY modell;

-- Altersklassen
SELECT altersklasse, COUNT(*) FROM bag_praemien WHERE geschaeftsjahr = 2026 GROUP BY altersklasse;

-- Franchisen
SELECT franchise, COUNT(*) FROM bag_praemien WHERE geschaeftsjahr = 2026 GROUP BY franchise ORDER BY franchise;
```

---

## 2. Stichprobenvergleich

### Test-Parameter

- **Kanton:** ZH
- **PLZ:** 8001
- **Geschäftsjahr:** 2026
- **Unfall:** OHNE

### Kind (5 Jahre, Franchise 0)

| Versicherer | BAG-Prämie | System-Prämie | Abweichung | Status |
|---|---|---|---|---|
| CSS | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Helsana | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Sanitas | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Concordia | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| SWICA | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |

### Junge Erwachsene (22 Jahre, Franchise 300)

| Versicherer | BAG-Prämie | System-Prämie | Abweichung | Status |
|---|---|---|---|---|
| CSS | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Helsana | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Sanitas | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Concordia | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| SWICA | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |

### Erwachsene (35 Jahre)

**Franchise 300:**

| Versicherer | BAG-Prämie | System-Prämie | Abweichung | Status |
|---|---|---|---|---|
| CSS | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Helsana | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Sanitas | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Concordia | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| SWICA | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |

**Franchise 2500:**

| Versicherer | BAG-Prämie | System-Prämie | Abweichung | Status |
|---|---|---|---|---|
| CSS | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Helsana | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Sanitas | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Concordia | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| SWICA | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |

### Tarifmodelle (Erwachsen, 35 Jahre, Franchise 300)

| Modell | BAG-Prämie | System-Prämie | Abweichung | Status |
|---|---|---|---|---|
| Standard | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Hausarzt | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| HMO | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |
| Telmed | CHF _______ | CHF _______ | _______% | ☐ OK ☐ Fehler |

### Zusammenfassung Stichproben

| Kriterium | Erwartet | Tatsächlich | Status |
|---|---|---|---|
| Alle 5 Versicherer gefunden | Ja | ☐ Ja ☐ Nein | ☐ Bestanden ☐ Fehler |
| Alle 3 Altersklassen | Ja | ☐ Ja ☐ Nein | ☐ Bestanden ☐ Fehler |
| Alle 2 Franchisen | Ja | ☐ Ja ☐ Nein | ☐ Bestanden ☐ Fehler |
| Alle 4 Modelle | Ja | ☐ Ja ☐ Nein | ☐ Bestanden ☐ Fehler |
| Maximale Abweichung | < 1% | _______% | ☐ Bestanden ☐ Fehler |

---

## 2b. Vergleichsrechner-Nachweis

### Test-Setup

- **Kanton:** ZH
- **PLZ:** 8001
- **Geschäftsjahr:** 2026
- **Unfall:** OHNE

### 20 Stichproben-Vergleich

| # | Kasse | Alter | Franchise | Modell | BAG-Prämie | System-Prämie | Abweichung | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | CSS | Kind (5) | 0 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 2 | CSS | Jugend (22) | 300 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 3 | CSS | Erwachsen (35) | 300 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 4 | CSS | Erwachsen (35) | 2500 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 5 | Helsana | Kind (5) | 0 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 6 | Helsana | Jugend (22) | 300 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 7 | Helsana | Erwachsen (35) | 300 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 8 | Helsana | Erwachsen (35) | 2500 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 9 | Sanitas | Kind (5) | 0 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 10 | Sanitas | Jugend (22) | 300 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 11 | Sanitas | Erwachsen (35) | 300 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 12 | Sanitas | Erwachsen (35) | 2500 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 13 | Concordia | Kind (5) | 0 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 14 | Concordia | Jugend (22) | 300 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 15 | Concordia | Erwachsen (35) | 300 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 16 | Concordia | Erwachsen (35) | 2500 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 17 | SWICA | Kind (5) | 0 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 18 | SWICA | Jugend (22) | 300 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 19 | SWICA | Erwachsen (35) | 300 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 20 | SWICA | Erwachsen (35) | 2500 | Standard | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |

### Tarifmodell-Vergleich (Zusätzlich)

| # | Kasse | Alter | Franchise | Modell | BAG-Prämie | System-Prämie | Abweichung | Status |
|---|---|---|---|---|---|---|---|---|
| 21 | CSS | Erwachsen (35) | 300 | Hausarzt | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 22 | CSS | Erwachsen (35) | 300 | HMO | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 23 | CSS | Erwachsen (35) | 300 | Telmed | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 24 | Helsana | Erwachsen (35) | 300 | Hausarzt | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |
| 25 | Helsana | Erwachsen (35) | 300 | HMO | CHF ___ | CHF ___ | ___% | ☐ OK ☐ Fehler |

### Akzeptanzkriterien

| Kriterium | Erwartet | Tatsächlich | Status |
|---|---|---|---|
| Alle 20 Stichproben verglichen | Ja | ☐ Ja ☐ Nein | ☐ Bestanden ☐ Fehler |
| Alle 5 Tarifmodelle verglichen | Ja | ☐ Ja ☐ Nein | ☐ Bestanden ☐ Fehler |
| Maximale Abweichung | < 1% | _______% | ☐ Bestanden ☐ Fehler |
| Durchschnittliche Abweichung | < 0.5% | _______% | ☐ Bestanden ☐ Fehler |

---

## 3. Performance-Messungen

### Vergleichsabfrage

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
- Ausführungszeit: _______________ ms
- Index verwendet: ☐ Ja ☐ Nein

**Akzeptanz:** < 1000 ms ☐ Bestanden ☐ Fehler

### Versicherersuche

```sql
EXPLAIN ANALYZE
SELECT krankenkasse, AVG(praemie_erwachsene) 
FROM bag_praemien
WHERE geschaeftsjahr = 2026 AND kanton = 'ZH'
GROUP BY krankenkasse;
```

**Ergebnis:**
- Ausführungszeit: _______________ ms

**Akzeptanz:** < 1000 ms ☐ Bestanden ☐ Fehler

### Importdauer

| Metrik | Wert |
|---|---|
| **Import gestartet** | _______________ |
| **Import abgeschlossen** | _______________ |
| **Dauer** | _______________ Minuten |
| **Records pro Sekunde** | _______________ |

**Akzeptanz:** < 10 Minuten ☐ Bestanden ☐ Fehler

---

## 4. Sicherheitsnachweis

### RLS-Test

```sql
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('bag_praemien', 'kunden', 'vertraege', 'audit_logs');
```

| Tabelle | RLS aktiv? | Status |
|---|---|---|
| bag_praemien | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| kunden | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| vertraege | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |
| audit_logs | ☐ Ja ☐ Nein | ☐ OK ☐ Fehler |

**Akzeptanz:** Alle RLS aktiv ☐ Bestanden ☐ Fehler

### Audit-Log-Test

```sql
SELECT audit_id, timestamp, actor_name, entity_type, action
FROM audit_logs
ORDER BY timestamp DESC
LIMIT 10;
```

| Kriterium | Status |
|---|---|
| Audit-Logs vorhanden | ☐ Ja ☐ Nein |
| User-ID korrekt | ☐ Ja ☐ Nein |
| Timestamp korrekt | ☐ Ja ☐ Nein |
| Action korrekt | ☐ Ja ☐ Nein |

**Akzeptanz:** Alle Kriterien erfüllt ☐ Bestanden ☐ Fehler

### Backup-Restore-Test

| Schritt | Status | Dauer |
|---|---|---|
| Backup erstellt | ☐ Ja ☐ Nein | _______ Min. |
| Restore durchgeführt | ☐ Ja ☐ Nein | _______ Min. |
| Daten vollständig | ☐ Ja ☐ Nein | - |

**Akzeptanz:** Restore erfolgreich ☐ Bestanden ☐ Fehler

---

## Gesamtergebnis

| Testbereich | Status |
|---|---|
| 1. BAG-Import | ☐ Bestanden ☐ Fehler |
| 2. Stichprobenvergleich | ☐ Bestanden ☐ Fehler |
| 3. Performance | ☐ Bestanden ☐ Fehler |
| 4. Sicherheit | ☐ Bestanden ☐ Fehler |

### Entscheidung

**Alle Tests bestanden?** ☐ Ja ☐ Nein

**Freigabe für Phase 2:**
☐ Erteilt  
☐ Abgelehnt (Nachbesserungen erforderlich)  
☐ Zurückgestellt (weitere Tests erforderlich)

**Unterschrift Tester:** _______________  
**Datum:** _______________

**Unterschrift Projektleitung:** _______________  
**Datum:** _______________

---

**Ende Testergebnisse**