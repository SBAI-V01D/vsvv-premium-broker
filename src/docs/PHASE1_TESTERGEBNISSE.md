# Phase 1 - Testergebnisse

**Datum:** _______________  
**Tester:** _______________  
**Status:** ☐ Zur Abnahme bereit ☐ In Durchführung ☐ Abgeschlossen

---

## 1. BAG-Import Test

### Import-Statistik

| Metrik | Wert |
|---|---|
| **Gesamtzeilen Quelle** | _______________ |
| **Gesamtzeilen Ziel** | _______________ |
| **Anzahl Fehler** | _______________ |
| **Anzahl verworfene Datensätze** | _______________ |
| **Importdauer** | _______________ Minuten |

### Akzeptanzkriterium

| Kriterium | Erwartet | Tatsächlich | Status |
|---|---|---|---|
| Importierte Records = Quelle | 100% | _______% | ☐ Bestanden ☐ Fehler |
| Verworfene Records | 0 | _______ | ☐ Bestanden ☐ Fehler |
| Importdauer | < 10 Min. | _______ Min. | ☐ Bestanden ☐ Fehler |

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