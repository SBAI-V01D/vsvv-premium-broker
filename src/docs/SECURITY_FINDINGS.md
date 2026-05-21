# Security Findings & Risk Register
## Enterprise Advisory & Compliance Platform

**Version:** 1.0 | **Datum:** 2026-05-21 | **Status:** Enterprise Live System
**Klassifizierung:** INTERN — Vertraulich

---

## EXECUTIVE SUMMARY

Die Plattform verfügt über eine mehrschichtige Sicherheitsarchitektur:
- Row-Level-Security (RLS) auf Datenbankebene
- Serverseitige Guards für alle kritischen Aktionen
- Private File Storage mit zeitlich limitierten Signed URLs
- Audit-Trail für alle kritischen Operationen
- Tenant-Isolation via organization_id

**Gesamtrisikobewertung: MITTEL — gut mitigiert**

---

## 1. IMPLEMENTIERTE SICHERHEITSMASSNAHMEN

### 1.1 Authentifizierung & Autorisierung
| Massnahme                         | Status    | Implementierung                              |
|-----------------------------------|-----------|----------------------------------------------|
| Role-based Access Control (RBAC)  | ✅ Aktiv   | User.role: admin/broker/assistenz/reviewer   |
| Row-Level Security                | ✅ Aktiv   | RLS auf Contract, Application, Customer      |
| Serverseitige Rollenprüfung       | ✅ Aktiv   | `base44.auth.me()` + role check in functions |
| Admin-only Functions              | ✅ Aktiv   | guardRoleAccess, guardDataAccess             |
| Session-Verwaltung                | ✅ Aktiv   | Plattform-Standard (Base44)                  |

### 1.2 Datenzugriffskontrolle
| Massnahme                         | Status    | Implementierung                              |
|-----------------------------------|-----------|----------------------------------------------|
| Tenant-Isolation                  | ✅ Aktiv   | organization_id auf allen kritischen Entities|
| Household-Isolation               | ✅ Aktiv   | primary_customer_id-Prüfung                  |
| Dokumentzugriff-Guards            | ✅ Aktiv   | guardDocumentAccess                          |
| Cross-Tenant-Schutz               | ✅ Aktiv   | RLS + organization_id-Filter                 |
| Minimalprinzip                    | ✅ Aktiv   | Advisor sieht nur eigene Kunden              |

### 1.3 Datenintegrität
| Massnahme                         | Status    | Implementierung                              |
|-----------------------------------|-----------|----------------------------------------------|
| SHA-256 PDF-Hashing               | ✅ Aktiv   | generateDossierPdf + PdfExportLog            |
| Dokument-Hashing                  | ✅ Schema  | Document.file_hash (bei Upload)              |
| Immutable-Flags                   | ✅ Aktiv   | PdfExportLog.immutable, Document.immutable   |
| Snapshot-Versionierung            | ✅ Aktiv   | DossierSnapshot mit JSON-Blob                |
| Approval-History (Audit)          | ✅ Aktiv   | AdvisoryDossier.approval_history             |

### 1.4 File Storage Security
| Massnahme                         | Status    | Implementierung                              |
|-----------------------------------|-----------|----------------------------------------------|
| Private File Storage              | ✅ Aktiv   | UploadPrivateFile (Base44 Private Storage)   |
| Signed URLs (zeitlimitiert)       | ✅ Aktiv   | CreateFileSignedUrl, expires_in=300s         |
| Keine direkten öffentlichen URLs  | ✅ Ziel    | Migration alter Dokumente ausstehend         |

### 1.5 Export-Governance
| Massnahme                         | Status    | Implementierung                              |
|-----------------------------------|-----------|----------------------------------------------|
| Export nur nach Freigabe          | ✅ Aktiv   | advisor_approved=true Pflicht                |
| Kein Export bei Reapproval        | ✅ Aktiv   | reapproval_required-Gate                     |
| Export-Audit-Trail                | ✅ Aktiv   | PdfExportLog (immutable)                     |
| Snapshot-Koppelung                | ✅ Aktiv   | approved_snapshot_id                         |

---

## 2. BEKANNTE RISIKEN & OFFENE PUNKTE

### 2.1 HIGH — Externe Validierung ausstehend
| Risiko                         | Severity | Mitigiert | Geplante Massnahme                    |
|--------------------------------|----------|-----------|---------------------------------------|
| Kein externer Penetration Test | HIGH     | Teilweise | Q3/2026: Externer Pentest beauftragen |
| Kein API Security Review       | HIGH     | Teilweise | Scope-Dokument vorbereiten            |
| Kein formeller Rollentest      | MEDIUM   | Ja (intern)| runLiveSystemValidation läuft täglich|

### 2.2 MEDIUM — Technische Restrisiken
| Risiko                                    | Severity | Mitigiert | Hinweis                               |
|-------------------------------------------|----------|-----------|---------------------------------------|
| Ältere Dokumente in Public Storage        | MEDIUM   | Nein      | Migration zu Private Storage nötig    |
| Signed URLs ohne IP-Bindung               | MEDIUM   | Teilweise | Zeitlimit 300s als Kompensation       |
| Frontend-seitige Rollentrennung           | LOW      | Ja        | Serverseitige Guards als Hauptschutz  |
| Audit-Logs löschbar (aktuell kein Lock)   | MEDIUM   | Teilweise | RLS-Regel "delete=admin-only" nötig   |
| Keine 2FA / MFA                           | MEDIUM   | Nein      | Plattform-Feature (Base44)            |

### 2.3 LOW — Monitoring & Observability
| Risiko                              | Severity | Mitigiert | Hinweis                         |
|-------------------------------------|----------|-----------|---------------------------------|
| Keine automatische Alert-Eskalation | LOW      | Teilweise | SystemLog vorhanden, kein Push  |
| Kein SIEM-Integration               | LOW      | Nein      | Späteres Feature                |

---

## 3. MITIGIERTE RISIKEN

### 3.1 Cross-Tenant-Zugriff
**Risiko:** Benutzer Org A sieht Daten von Org B
**Mitigation:** organization_id auf allen kritischen Entitäten + RLS-Filter + `runLiveSystemValidation` prüft täglich
**Status: MITIGIERT**

### 3.2 Unberechtigte PDF-Exporte
**Risiko:** Nicht freigegebene PDFs werden exportiert/geteilt
**Mitigation:** advisor_approved-Gate + Reapproval-Prüfung + Export-Audit-Log + SHA-256-Hash
**Status: MITIGIERT**

### 3.3 Datenmanipulation nach Freigabe
**Risiko:** Freigegebene Dossierinhalte werden nachträglich geändert ohne Nachweis
**Mitigation:** Reapproval-Trigger bei Änderung + approval_history + DossierSnapshot eingefroren
**Status: MITIGIERT**

### 3.4 Rollenmissbrauch
**Risiko:** Benutzer erhält Admin-Rechte unberechtigt
**Mitigation:** Rollenprüfung serverseitig + `runLiveSystemValidation` prüft Admin-Anzahl + AuditLog
**Status: MITIGIERT**

---

## 4. PENTEST-SCOPE (VORBEREITUNG)

Für externen Penetration Test vorbereiten:

### In-Scope
- Alle Backend-Functions (Deno/API)
- RLS-Bypass-Tests (Cross-Tenant, Cross-Role)
- Signed-URL-Missbrauch
- Approval-Bypass
- Export-Gate-Bypass
- PDF-Hash-Manipulation
- Session-Hijacking
- IDOR (Insecure Direct Object Reference) via Entity-IDs
- API-Rate-Limiting

### Out-of-Scope
- Base44 Plattform-Infrastruktur (Verantwortung Base44)
- DNS/DDoS
- Social Engineering

### Empfohlene Anbieter (Schweiz)
- Oneconsult AG (Bern/Zürich)
- Scip AG (Zürich)
- SySS GmbH (Schweizer Niederlassung)

---

## 5. GEPLANTE HARDENING-MASSNAHMEN

| Massnahme                        | Priorität | Zeitplan  |
|----------------------------------|-----------|-----------|
| Externer Penetration Test        | HIGH      | Q3/2026   |
| MFA/2FA Enforcement              | HIGH      | Q3/2026   |
| AuditLog delete=blocked (RLS)    | MEDIUM    | Sprint N+1|
| Public→Private Storage Migration | MEDIUM    | Sprint N+1|
| SIEM-Integration                 | LOW       | Q4/2026   |
| IP-gebundene Signed URLs         | LOW       | Q4/2026   |

---

## 6. VERANTWORTLICHKEITEN

| Bereich                    | Verantwortlich     | Eskalation        |
|----------------------------|--------------------|-------------------|
| Security Monitoring        | Admin              | CTO/CCO           |
| Incident Response          | Admin              | Management        |
| Pentest-Beauftragung       | CTO                | CEO               |
| Compliance-Dokumentation   | Reviewer/Admin     | CCO               |
| Audit-Log-Kontrolle        | Admin              | Management        |

---

*Letzte Überprüfung: 2026-05-21 | Nächste Überprüfung: 2026-08-21*
*Dieses Dokument ist vertraulich und für interne/Partner-Nutzung bestimmt.*