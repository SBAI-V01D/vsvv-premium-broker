# Enterprise Advisory & Compliance Platform
## Organisatorische Compliance-Dokumentation

**Version:** 1.0 | **Datum:** 2026-05-21 | **Status:** Enterprise Live System

---

## 1. PLATTFORMSTATUS

Diese Plattform ist klassifiziert als:

> **Governance-orientierte Enterprise Advisory & Compliance Platform mit kontrollierter KI-Architektur, revisionssicherer Dokumentation und vollständiger Enterprise-Live-Tauglichkeit.**

Nicht: CRM-Prototyp, MVP, Low-Code-Testsystem oder experimentelle KI-Anwendung.

---

## 2. ROLLEN- & BERECHTIGUNGSKONZEPT

### Rollen
| Rolle       | Beschreibung                                    | Kritische Berechtigungen                          |
|-------------|------------------------------------------------|--------------------------------------------------|
| `admin`     | Systemadministrator, vollständige Rechte        | Alle Entitäten lesen/schreiben, Benutzer verwalten, Exporte, Audit-Zugriff |
| `broker`    | Versicherungsbroker                             | Eigene Kunden, Verträge, Anträge, Provisionen    |
| `assistenz` | Backoffice-Assistenz                            | Eingeschränkte Schreibrechte, kein Delete        |
| `reviewer`  | Qualitätsprüfer / Compliance-Officer            | Freigabe-Workflows, Review-Queue                 |
| `supervisor`| Teamleiter                                      | Freigaben, Team-Übersicht, KPIs                  |
| `user`      | Standard-Benutzer / Kundenzugang               | Nur eigene Daten                                 |

### Min. Rechteprinzip
- Jeder Benutzer erhält nur die minimal notwendigen Rechte
- Admin-Konten auf max. 5 Personen begrenzen
- Regelmässige Rollenkontrolle (quartalsweise)

---

## 3. DATENSCHUTZERKLÄRUNG (Auszug)

### Verarbeitete Personendaten
- Kundenstammdaten (Name, Adresse, Geburtsdatum, AHV-Nummer)
- Versicherungsdaten (Police, Prämien, Verträge)
- Finanzdaten (Provisionen, Courtagen)
- Kommunikationsdaten (E-Mail, Telefon)

### Rechtsgrundlage (Schweiz)
- nDSG (Bundesgesetz über den Datenschutz, in Kraft 01.09.2023)
- FINMA-Rundschreiben 2023/1

### Aufbewahrungsfristen
| Datenkategorie          | Aufbewahrung | Grundlage        |
|-------------------------|-------------|------------------|
| Versicherungsdossiers   | 10 Jahre    | OR 962/FINMA     |
| Audit-Logs              | 10 Jahre    | FINMA            |
| PDF-Exporte (immutable) | 10 Jahre    | Revisionspflicht |
| Lead-Daten              | 2 Jahre     | nDSG             |
| System-Logs             | 2 Jahre     | Betriebspflicht  |

---

## 4. BEARBEITUNGSVERZEICHNIS

| Verarbeitungsaktivität              | Zweck                    | Beteiligte Stellen       |
|-------------------------------------|--------------------------|--------------------------|
| Kundenonboarding                    | Vertragsanbahnung        | Broker, Assistenz        |
| Beratungsdossier-Erstellung         | FINMA-konforme Beratung  | Berater, Reviewer        |
| KI-gestützte Dokumentenextraktion   | Effizienzsteigerung      | System (KI), Berater     |
| PDF-Archivierung                    | Revisionssicherheit      | System                   |
| Provisions-/Courtage-Abrechnung     | Vergütung                | Admin, Broker            |
| Audit-Logging                       | Compliance-Nachweis      | System                   |

---

## 5. KI-GOVERNANCE-RICHTLINIEN

### Erlaubte autonome KI-Prozesse
- Dokumentenklassifizierung (doc_type, category)
- Prämienextraktion aus PDFs
- Lead-Scoring-Berechnung
- Erkennung von Upsell-Potenzial

### Prozesse mit Pflicht-Review
- Beratungsdossier-Inhalte (bei confidence < 0.70)
- Empfehlungsausgabe in Kundendokumenten
- Abschluss von Dossiers mit KI-Extraktion
- Änderungen nach Freigabe

### Confidence-Schwellen
| Confidence  | Bewertung     | Massnahme                              |
|-------------|---------------|----------------------------------------|
| > 0.80      | OK (grün)     | Normalverarbeitung                     |
| 0.60 – 0.80 | Prüfen (amber)| Manuelle Sichtung empfohlen            |
| < 0.60      | Unsicher (rot)| Pflichtreview, kein automatisches PDF  |

### Reapproval-Regeln
- Jede Änderung an freigegebenen Dossierinhalten löst automatisch Reapproval aus
- KI-Fehler > Threshold → review_status = "needs_reapproval"
- advisor_approved wird beim Reapproval automatisch auf false gesetzt

### Finale Verantwortlichkeit
Der menschliche Berater/Reviewer trägt die finale Verantwortung für:
- Freigabe des Beratungsdossiers
- Inhalt des freigegebenen PDFs
- Empfehlung gegenüber dem Kunden

KI ist Unterstützungswerkzeug, nicht Entscheidungsträger.

---

## 6. LÖSCHKONZEPT

### Soft-Delete-Prinzip
Kritische Entitäten werden niemals physisch gelöscht:
- Kunden: archived=true, archived_at, archived_by, archived_reason
- Verträge: archived=true
- Dokumente: nie löschen (immutable)
- Audit-Logs: nie löschen

### Physische Löschung (nur admin)
- Nur über `softDeleteEntity`-Backend-Funktion
- Jede Löschung wird in AuditLog protokolliert
- Regulatorische Aufbewahrungsfristen beachten

---

## 7. BACKUP- & RECOVERY-KONZEPT

### Backup-Typen
| Typ            | Frequenz   | Aufbewahrung | Funktion                    |
|----------------|------------|-------------|------------------------------|
| Incremental    | Täglich    | 30 Tage     | createIncrementalBackup      |
| Full           | Wöchentlich| 6 Monate    | createFullBackup             |
| Long-Term      | Monatlich  | 10 Jahre    | createLongTermBackup         |

### Recovery-Prozess
1. BackupLog identifizieren (jüngster `completed` Eintrag)
2. `restoreFromBackup`-Funktion mit backup_id aufrufen
3. Hash-Konsistenz prüfen
4. Snapshot-Koppelung validieren
5. `runLiveSystemValidation` ausführen

### Recovery-Ziele
- RTO (Recovery Time Objective): < 4 Stunden
- RPO (Recovery Point Objective): < 24 Stunden

---

## 8. INCIDENT-RESPONSE-PROZESS

### Schweregrade
| Level    | Definition                              | Reaktionszeit |
|----------|-----------------------------------------|---------------|
| Critical | Datenverlust, Security-Breach           | < 1 Stunde    |
| High     | Systemausfall, Datenkorruption          | < 4 Stunden   |
| Medium   | Funktionsfehler, Audit-Lücken           | < 24 Stunden  |
| Low      | Performance, Warnungen                  | < 1 Woche     |

### Eskalationsweg
1. SystemLog / Enterprise Control Center → automatische Erkennung
2. Admin-Benachrichtigung
3. Incident-Ticket erstellen
4. Sofortmassnahme ergreifen
5. Root-Cause-Analyse
6. Post-Incident-Review

---

## 9. ZUGRIFFSKONZEPT

### Zugriffsprotokollierung (Pflicht)
Alle Zugriffe auf kritische Daten werden protokolliert:
- PDF-Downloads (PdfExportLog)
- Dokumentenzugriffe (Document.access_level)
- Approval-Aktionen (approval_history)
- Status-Änderungen (status_history, change_history)

### Zeitlich limitierte Zugriffe
- Signed URLs: max. 300 Sekunden (5 Minuten)
- Session-Tokens: Plattform-Standard
- API-Keys: regelmässige Rotation empfohlen

---

## 10. FINMA-ORIENTIERTE GOVERNANCE

### FINMA-relevante Anforderungen
- Lückenloser Beratungsnachweis (Dossier + PDF)
- Interessenkonflikt-Dokumentation
- Kundeninformation vor Abschluss
- Nachvollziehbarkeit des Beratungsprozesses

### Technische Umsetzung
- `advisor_approved`: Berater bestätigt Dossierinhalt
- `approval_history`: Lückenloser Audit-Trail
- `DossierSnapshot`: Zustand bei Freigabe eingefroren
- `PdfExportLog`: Immutable PDF-Archiv mit SHA-256

---

*Dieses Dokument ist Bestandteil der Enterprise-Compliance-Dokumentation. Letzte Überprüfung: 2026-05-21*