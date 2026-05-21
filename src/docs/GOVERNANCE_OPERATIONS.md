# Governance Operations Manual
## Enterprise Advisory & Compliance Platform

**Version:** 1.0 | **Datum:** 2026-05-21 | **Status:** Enterprise Live System

---

## KERNPRINZIP

> **Technik → Auto-Fix erlaubt**
> **Governance / Business → immer Human Review**

Dieses Prinzip ist nicht verhandelbar. Kein System darf stillschweigend:
- Freigaben ändern
- Verträge korrigieren
- Provisionen anpassen
- Audit-Daten manipulieren
- PDFs neu generieren oder überschreiben

---

## 1. INCIDENT MANAGEMENT

### 1.1 Schweregrade

| Severity | Definition                                          | Reaktionszeit | Eskalation      |
|----------|-----------------------------------------------------|---------------|-----------------|
| BLOCKING | System-/Compliance-kritisch, Betrieb blockiert       | < 1 Stunde    | CEO/CCO sofort  |
| CRITICAL | Datenverlust, Sicherheits-/Governance-Verletzung    | < 4 Stunden   | CTO + Management|
| WARNING  | Dateninkonsistenz, Audit-Lücke, Vollständigkeit      | < 24 Stunden  | Admin-Review    |
| INFO     | Hinweis, keine unmittelbare Aktion nötig            | < 1 Woche     | Dokumentation   |

### 1.2 Incident-Lifecycle

```
Erkennung (auto/manuell)
    ↓
EnterpriseIncident erstellt (status: open)
    ↓
Triage: Admin klassifiziert Severity
    ↓
  ┌─────────────────┬──────────────────┐
  │   TECHNISCH     │   GOVERNANCE     │
  │   Auto-Fix OK   │   Human Review   │
  │   (status:      │   Pflicht        │
  │   auto_fixed)   │   (status:       │
  └─────────────────┤   resolved /     │
                    │   accepted_risk) │
                    └──────────────────┘
    ↓
Resolution Notes dokumentieren
    ↓
Post-Incident Review (bei CRITICAL/BLOCKING)
```

### 1.3 Auto-Fix erlaubt für:
- Fehlende System-Metadaten (nicht geschäftskritisch)
- Sync-Probleme bei Kunden-/Vertragsbeziehungen
- Konsistenzprüfungen (Datenstruktur, nicht Inhalt)
- Performance-Cache-Invalidierung
- Query-Optimierungen

### 1.4 Human Review PFLICHT für:
- Approval-States und Approval-History
- PDF-Versionen und PDF-Hashes
- Vertragsdaten, Policen, Prämien
- Provisions-/Courtage-Beträge
- Kundendaten (AHV, Finanzinfos)
- Rollenzuweisungen
- Cross-Tenant-Isolationsverletzungen
- Audit-Log-Korrekturen

---

## 2. RACI — VERANTWORTLICHKEITEN

### 2.1 Incident Management

| Aktivität                    | Responsible | Accountable | Consulted   | Informed       |
|------------------------------|-------------|-------------|-------------|----------------|
| Incident erkennen (auto)     | System      | Admin       | —           | Admin          |
| Incident triage              | Admin       | Admin       | Supervisor  | —              |
| Auto-Fix ausführen           | Admin       | Admin       | —           | Supervisor     |
| Governance-Entscheid         | Supervisor  | Admin       | Berater     | Management     |
| Eskalation CRITICAL          | Admin       | CTO         | Legal       | CEO/CCO        |
| Resolution dokumentieren     | Reviewer    | Admin       | —           | Audit          |
| Post-Incident Review         | Admin       | CTO         | Team        | Management     |

### 2.2 Freigabe-Prozesse (Advisory Dossier)

| Schritt                      | Responsible | Accountable | Consulted   | Informed    |
|------------------------------|-------------|-------------|-------------|-------------|
| Dossier erstellen            | Berater     | Berater     | —           | Teamleiter  |
| KI-Extraktion prüfen         | Berater     | Berater     | Reviewer    | —           |
| Beraterentscheid (Empfehlung)| Berater     | Berater     | Supervisor  | Admin       |
| Dossier freigeben            | Supervisor  | Admin       | Berater     | —           |
| PDF exportieren              | Berater     | Admin       | —           | —           |
| Reapproval bei Änderung      | Supervisor  | Admin       | Berater     | Management  |

### 2.3 Datenpflege & Governance

| Aktivität                    | Responsible | Accountable | Consulted   | Informed    |
|------------------------------|-------------|-------------|-------------|-------------|
| Kundendaten pflegen          | Broker      | Broker      | Assistenz   | Admin       |
| Sensitive Daten (AHV etc.)   | Broker      | Admin       | Compliance  | CCO         |
| Kunden archivieren           | Admin       | Admin       | Broker      | Management  |
| Kunden löschen               | Admin       | Admin       | Legal       | CCO         |
| Audit-Log-Review             | Admin       | Admin       | Compliance  | CCO         |
| Backup-Validierung           | Admin       | Admin       | —           | CTO         |

---

## 3. OPERATIVE GOVERNANCE-REVIEWS

### 3.1 Tägliche Checks (automatisch)
- `runLiveSystemValidation` läuft täglich (via Automation)
- SystemLog auf ERROR/CRITICAL prüfen
- Enterprise Incidents auf BLOCKING prüfen
- Backup-Status prüfen

### 3.2 Wöchentliche Reviews (manuell, Admin)
- Alle offenen Incidents reviewen und triagieren
- Pending Approvals und Reapprovals klären
- Audit-Log-Auffälligkeiten prüfen
- Performance-Warnungen auswerten
- Backup-Prüfsummen kontrollieren

### 3.3 Monatliche Governance-Reviews (Admin + Supervisor)
- Rollen- und Berechtigungsüberprüfung
- Admin-Konten-Review (max. 5)
- Export-Archiv-Stichprobe (PDF-Hash-Verifikation)
- Offene Incidents auswerten
- Recovery-Readiness prüfen
- Compliance-Dokumentation aktualisieren

### 3.4 Quartalsweise Reviews (Management)
- SECURITY_FINDINGS.md aktualisieren
- Pentest-Planung
- KI-Governance-Review
- Datenschutz-Compliance-Check
- Carrier-/Partner-Integration bewerten

---

## 4. AUTO-FIX-GOVERNANCE

### 4.1 Wer darf Auto-Fix ausführen?
- **Admin**: alle technischen Auto-Fixes
- **Supervisor**: Sync-Fixes nach Genehmigung
- **Berater**: keine Auto-Fix-Berechtigung

### 4.2 Auto-Fix-Protokoll (Pflicht)
Jeder Auto-Fix wird dokumentiert:
1. Incident-Status auf `auto_fixed` setzen
2. Resolution Notes: Was wurde geändert? Warum sicher?
3. Zeitstempel und ausführende Person
4. Post-Fix-Validierung via `runLiveSystemValidation`

### 4.3 Auto-Fix verboten für (absolut):
Keine Ausnahmen:
- Approval-History
- Freigabe-Status (advisor_approved)
- PDF-Hash-Werte
- Snapshot-Inhalte
- Provisions-/Courtage-Beträge
- AHV-Nummern oder Finanzdaten
- Audit-Log-Einträge

---

## 5. ESKALATIONSMATRIX

| Ereignis                              | Erstreaktion        | Eskalation 1       | Eskalation 2    |
|---------------------------------------|---------------------|--------------------|-----------------|
| Tenant-Isolation-Verletzung           | Admin: sofort sperren| CTO < 1h           | CEO/CCO < 4h    |
| Unberechtigter PDF-Export             | Admin: Export sperren| CTO < 2h           | CCO < 4h        |
| Approval ohne Berechtigung            | Admin: sofort widerrufen| Supervisor < 1h | CCO < 2h        |
| Datenverlust/Korruption               | Admin: Backup einleiten| CTO < 1h         | CEO < 2h        |
| Security Breach (Pentest-Finding)     | Admin: Incident öffnen| CTO < 30min       | CEO sofort      |
| Backup-Failure > 24h                  | Admin: manuelles Backup| CTO < 4h         | —               |
| Performance-Ausfall                   | Admin: Diagnose     | CTO < 8h           | —               |

---

## 6. KI-GOVERNANCE

### 6.1 Erlaubte autonome KI-Prozesse
Darf ohne Review laufen:
- Dokumentklassifizierung (niedrig-sensitiv)
- Lead-Scoring
- Upsell-Potential-Erkennung
- Pricing-Benchmark-Berechnung

### 6.2 KI mit Pflicht-Review
Muss manuell bestätigt werden:
- Extraktion aus sensitiven Dokumenten (confidence < 0.80)
- Beratungsdossier-Inhalte
- Produktempfehlungen für Kunden
- Alle KI-Outputs die in Kundendokumenten erscheinen

### 6.3 KI immer verboten für:
- Finale Freigabe von Dossiers
- Approval-Entscheide
- Vertragserstellung/-änderung
- Provisionsberechnungen (final)
- Löschungen jeglicher Art

### 6.4 Confidence-Thresholds
| Confidence | Bewertung | Massnahme              | Verantwortlich |
|------------|-----------|------------------------|----------------|
| > 0.80     | OK        | Normal-Verarbeitung    | System         |
| 0.60-0.80  | Prüfen    | Berater-Review nötig   | Berater        |
| < 0.60     | Kritisch  | Pflichtreview, kein PDF| Supervisor     |

---

## 7. CHANGE MANAGEMENT

### 7.1 Kritische Feldänderungen
Jede Änderung an folgenden Feldern erzeugt automatisch Reapproval:
- `advisor_final_recommendation`
- `advisor_recommendation_reason`
- `advisor_recommendation_label`

### 7.2 Datenmutationen
Alle Änderungen an sensitiven Daten werden protokolliert:
- `Customer.change_history`
- `Contract.change_history`
- `Application.status_history`
- `AdvisoryDossier.approval_history`

---

*Letzte Überprüfung: 2026-05-21 | Verantwortlich: Admin/CTO*
*Verbindlich für alle Benutzer der Enterprise Advisory & Compliance Platform*