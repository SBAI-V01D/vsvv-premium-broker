# 🎯 Übergang: Softwareprojekt → Operatives Geschäftssystem

**Datum:** 2026-05-16  
**Phase:** Transition from Development to Production Operations  
**Gültigkeit:** 3 Wochen intensives Monitoring + stabilization

---

## 🔄 Paradigmenwechsel

### Bis vor 1 Woche: FEATURE-MODUS
```
Priorität 1: Neue Funktionen bauen
Priorität 2: Architektur erweitern
Priorität 3: Edge Cases dokumentieren
Priorität 4: Betriebsprozesse

Takt: Schnell, iterativ, experimentell
Erfolg: Features fertig?
```

### AB JETZT: OPERATIONS-MODUS
```
Priorität 1: Stabilität, Konsistenz, Nachvollziehbarkeit
Priorität 2: KPI-Integrität
Priorität 3: Fehler-Monitoring
Priorität 4: Kleine präzise Fixes

Takt: Steady, beobachtend, reaktiv
Erfolg: System läuft ohne Überraschungen?
```

---

## 📊 Die 3-Wochen-Roadmap: Stabilisierung

### WOCHE 1: Go-Live Validation
**Motto:** "Does it work in real conditions?"

**Aktivitäten:**
```
□ Szenario 1-5 manuell durchspielen (2 Tage, 1 Tester)
□ KPI-Konsistenz validieren (Szenario 5 fokussiert)
□ Reale Testdaten eingeben:
  - 10 Verträge
  - Aktivierung → Provision
  - 2× Storno + Reaktivierung
  - Family Members
□ Dashboard prüfen: Alle KPIs korrekt?
□ Audit-Trail prüfen: Alle Aktionen geloggt?
□ Rollback-Test: Automation off → Daten OK?
```

**Erfolgskriterium:** 
- Alle 5 Szenarien GRÜN
- Keine Datenverluste
- KPI-Summen nachvollziehbar
- Stakeholder unterschreiben Go-Live Checklist

**Nächster Schritt:** Go-Live freigeben oder Blockers dokumentieren

---

### WOCHE 2: Live Monitoring (Erste echte Daten)
**Motto:** "What breaks in production?"

**Aktivitäten:**
```
Täglich (30 min):
□ Error-Log prüfen auf neue Auto-Provision Fehler
□ KPI-Werte spot-check (Summen vs. Erwartung)
□ Audit-Log auf Unregelmäßigkeiten prüfen
□ User-Feedback sammeln (Tickets, Slack, Email)
□ Dashboard aktualisieren oder KPI-Neuberechnung nötig?

Wöchentlich (1.5h):
□ Storno-Ratio analysieren (Expected vs. Actual)
□ Duplikate prüfen (sollten 0 sein)
□ Performance-Impact messen (Query-Zeiten)
□ Support-Tickets nach Muster analysieren
  → "Welche Frage kommt 3× vor?"
□ Incident-Review wenn vorhanden
```

**Metriken zu tracken:**
```
Auto-Provisionen: __/Woche (Trend?)
Fehlerrate: __%
Storno-Abdeckung: __%
Support-Tickets: __
Kritische Issues: __
```

**Erfolgskriterium:**
- <1% Fehlerrate Automationen
- Keine neuen kritischen Bugs
- KPI-Konsistenz bestätigt
- User verstehen Auto-Badges

---

### WOCHE 3: Hardening + Training
**Motto:** "Make it bulletproof and teachable"

**Aktivitäten:**
```
□ Support-Team schulen:
  - 5 häufigste User-Fragen
  - 3 häufigste Probleme + Lösungen
  - Wann eskalieren zu Dev?

□ Runbook aktualisieren basierend auf echten Cases:
  - Was hat überrascht?
  - Welche Workarounds sind nötig?
  - Fehlen Edge Cases?

□ KPI-Validierung intern:
  - Finance-Team: Netto-Auszahlungen korrekt?
  - Admin: Audit-Trail vollständig?
  - Brokers: Auto-Badges verstanden?

□ Dokumentation updaten:
  - Best Practices aus Woche 1–2
  - Bekannte Limitations
  - Workarounds

□ Finale Stakeholder-Review:
  - Alle KPIs stabil?
  - Keine unerwarteten Probleme?
  - Bereit für normalen Betrieb?
```

**Erfolgskriterium:**
- Support kann selbstständig helfen
- Keine offenen kritischen Issues
- Team versteht das System vollständig
- Grünes Licht für "steady state"

---

## 🎯 STRICT: Was NICHT ändern in den nächsten 3 Wochen

### ❌ NICHT tun
```
✗ Neue Funktionen bauen (auch wenn gute Ideen kommen)
✗ Massive Refactors (Code-Struktur umbauen)
✗ Neue Automationen hinzufügen
✗ KPI-Formeln ändern (nur wenn KRITISCHER Bug)
✗ UI überdesignen
✗ Performance-Optimierungen (nur wenn Notfall)
```

### ✅ NUR tun
```
✓ Bugs in Auto-Provision + Storno fixen
✓ Duplikate aufräumen
✓ Audit-Logs prüfen und dokumentieren
✓ KPI-Bugs fixen
✓ Support-Prozesse entwickeln
✓ Monitoring-Dashboard aufbauen
✓ Dokumentation updaten
✓ User-Training vorbereiten
```

---

## 🔍 Monitoring-Checkliste: Täglich 30 min

### Error Logs
```
SELECT * FROM error_logs 
WHERE occurred_at > now() - 1 day 
  AND entity_type IN ('commission', 'contract')
  AND status = 'new'
```
**Fragen:**
- Neue Error-Patterns?
- Automation-Fehler?
- User-Fehler oder System-Fehler?

### KPI Sanity Check
```
Dashboard → Provisionen Tab:
- Offene Courtagen: ______ CHF (vs. Vortag: ______?)
- Verdiente Courtagen: ______ CHF (Trend?)
- Ausbezahlte Courtagen: ______ CHF (Trend?)

Sollten langsam WACHSEN, nicht sprunghaft ändern.
Falls Sprung: Was hat sich geändert?
```

### Audit Trail
```
AdminLogs → Commission Filter:
- Letzte 10 Einträge zeigen normale Operationen?
- Unerwartete Änderungen?
- Duplikate erkannt in logs?
```

### User Feedback
```
- Neue Tickets in Support-Queue?
- User-Fragen in Slack?
- Unerwartete Feedback zur Auto-Badge?
```

---

## 🚨 Incident Response im Operations-Modus

### Level 1: Beobachten (kein Action)
**Beispiele:**
- 1× Duplikat gefunden (einzeln)
- 1 User-Question nicht beantwortet
- Kleine Audit-Lücke

**Action:** Notizen machen, muster analysieren, wenn pattern: Level 2

---

### Level 2: Isolieren (User informieren, nicht ändern)
**Beispiele:**
- 3× gleiche User-Frage
- Automation-Fehler in 2 Fällen
- KPI-Abweichung <5%

**Action:**
```
1. User informieren: "Das ist ein bekanntes Issue, wir arbeiten daran"
2. Issue dokumentieren
3. Workaround bereitstellen (falls möglich)
4. Development prioritieren für nächste Woche
```

---

### Level 3: Fix (Code-Änderung)
**Beispiele:**
- Kritischer Bug (Datenverlust, Security)
- Storno wird nicht erstellt (Automation-Fehler)
- KPI falsch um >10%
- Duplikate entstehen systematisch

**Action:**
```
1. Sofort fixen
2. Tight Review
3. Testen mit 1 Fall
4. Deploy
5. Monitoring verstärken
6. Post-Mortem nach 1 Woche
```

---

## 📊 Success Metrics: Tracking Sheet

**Füllen Sie wöchentlich aus:**

| Metrik | Woche 1 | Woche 2 | Woche 3 | Ziel |
|--------|---------|---------|---------|------|
| Auto-Provisionen/Woche | __ | __ | __ | 5–15 |
| Fehlerrate (%) | __ | __ | __ | <1% |
| Duplikate (Anzahl) | __ | __ | __ | 0 |
| Support-Tickets | __ | __ | __ | ↓ trend |
| KPI-Abweichung (%) | __ | __ | __ | <2% |
| Audit-Log Vollständigkeit (%) | __ | __ | __ | 100% |
| User-Verständnis (%) | __ | __ | __ | >80% |

---

## 📋 Go/No-Go Decision Points

### Nach Woche 1: Go für Live?
```
GRÜN wenn:
□ Alle 5 Szenarien bestanden
□ KPI-Konsistenz validiert
□ Keine CRITICAL Bugs
□ Stakeholder unterschreiben

GELb wenn:
□ 1–2 HIGH Priority Issues
→ Fixen + Woche 2 nochmal testen

ROT wenn:
□ >2 CRITICAL Issues
→ Rollback, Bugfixes, 1 Woche Delay
```

### Nach Woche 2: Steady State?
```
GRÜN wenn:
□ <1% Error Rate
□ Keine systematischen Duplikate
□ KPI nachvollziehbar
□ User-Feedback positiv
→ Normaler Betriebsmodus

GELB wenn:
□ Einzelne Issues, aber Patterns erkannt
□ Fixes in Woche 3 geplant

ROT wenn:
□ Systemische Probleme
→ Automation ausschalten, manuell arbeiten, 2 Wochen Stabilisierung
```

### Nach Woche 3: Bereit für Skalierung?
```
GRÜN wenn:
□ Alles stabil läuft
□ Support kann selbstständig helfen
□ Team versteht System vollständig
□ Neue Features können wieder priorisiert werden
→ Normaler Produktionsbetrieb

Weitere Features möglich (Limited Release 2x/Monat)
```

---

## 🛑 Fallback-Plan bei Problemen

### Szenario: Automation schlägt fehl

**Sofort-Aktion:**
```
1. Automation ausschalten (Toggle, 2 Minuten)
2. Bestehende Provisionen sind sicher
3. Neue Provisionen: manuell erfassen
4. Root Cause analysieren
5. Fix entwickeln + testen
6. Deploy + beobachten
```

**Auswirkung:** 1–2 Tage manuelle Arbeit, aber Datensicherheit gewährleistet

---

### Szenario: KPI-Fehler erkannt

**Sofort-Aktion:**
```
1. KPI-Widget von Dashboard entfernen
2. CSV-Export nutzen für manuelle Validierung
3. Bug dokumentieren
4. Tracking: "KPI sind aktuell nicht zuverlässig"
5. Fix + Revalidierung
6. Dashboard wieder aktivieren
```

**Auswirkung:** Vorübergehend weniger Dashboards, aber Transparenz bleibt

---

### Szenario: Duplikate gefunden

**Sofort-Aktion:**
```
1. Betroffene Provisionen dokumentieren
2. Jüngere Duplikate archivieren (Keep Audit)
3. KPI manuell korrigieren
4. Root Cause: ist der Duplikatschutz-Filter aktiv?
5. Fix wenn nötig
6. Systemic Test auf weitere Duplikate
```

**Auswirkung:** Einmalige Bereinigung, dann sauber

---

## 📞 Support & Escalation Matrix

| Issue | Tier 1 (Broker) | Tier 2 (Admin) | Tier 3 (Dev) |
|-------|---|---|---|
| Auto-Badge Erklärung | ✓ | – | – |
| Provision bearbeiten | ✓ | – | – |
| Duplikat gefunden | – | ✓ (archivieren) | – |
| KPI-Frage | – | ✓ | – |
| Bug in Automation | – | – | ✓ |
| Performance-Problem | – | ✓ | ✓ |
| Security-Issue | – | – | ✓ |

---

## 🎓 Team Rollen für nächste 3 Wochen

| Rolle | Verantwortung | Zeit/Woche |
|-------|---|---|
| **Tester** | Szenarien durchspielen, Bugs dokumentieren | 10h |
| **Admin** | Daily Monitoring, Errors analysieren, Support | 5h |
| **Developer** | Bugs fixen (max 1–2 pro Woche), Dokumentation | 5h |
| **Broker-Lead** | Reale Cases durcharbeiten, User-Feedback sammeln | 3h |
| **Finance** | KPI Validierung, Audit-Trail prüfen | 2h |

---

## 🏁 Definition: "End of Transition Phase"

Nach Woche 3 verlassen Sie den Transition Mode, wenn:

```
✓ Szenario 1–5 alle grün (5 Wochen stabil)
✓ Fehlerrate <1% über mindestens 1 Woche
✓ KPI-Konsistenz verifiziert und dokumentiert
✓ Zero kritische Bugs für 2 Wochen
✓ Support-Team selbstständig
✓ Alle Dokumentation aktuell
✓ Team verstieht System vollständig
✓ Wöchentliche Monitoring-Routine etabliert
```

**Dann:** Transition = Abgeschlossen  
**Betrieb:** Normal-Modus, Features können wieder priorisiert werden

---

## 🎯 Langfristige Grundregeln im Operations-Modus

### Prinzip 1: Stabilität > Features
```
Neue Features nur wenn:
- 2 Wochen ohne Fehler
- Kein offenes Backlog
- Monitoring grün
```

### Prinzip 2: Additive Changes Only
```
Kein Löschen, Überschreiben, Umbauen.
Nur erweitern oder neue Funktionen hinzufügen.
Alte Logik bleibt erhalten.
```

### Prinzip 3: Audit-First
```
Wenn nicht im Audit-Log, dann nicht produziert.
Jede Automatisierung muss 100% traceable sein.
```

### Prinzip 4: KPI-Vertrauen bewahren
```
KPI-Fehler = höchste Priorität
KPI-Validierung vor jedem Release
Bei Unsicherheit: KPI von Dashboard nehmen
```

### Prinzip 5: Monitoring Always
```
Täglich checken, was sich verändert hat.
Anomalien sofort dokumentieren.
Patterns erkennen bevor Probleme entstehen.
```

---

## 📝 Sign-Off

Dies ist der offizielle Übergang von Development zu Operations.

**Verantwortlichkeiten verstanden:**

- [ ] Tester: Szenario-Validierung
- [ ] Admin: Täglich Monitoring
- [ ] Developer: Nur Bugs, keine Features
- [ ] Broker-Lead: Real-Life Feedback
- [ ] Finance: KPI-Integrität

**Transition Start:** 2026-05-16  
**Transition Ende geplant:** 2026-06-06

**Projekt-Freigabe für Normalarbeit:** ___________ (Datum nach Woche 3 + Signoff)