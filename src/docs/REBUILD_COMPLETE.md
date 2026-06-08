# KrankenkassenVergleich CRM — Complete Rebuild Documentation
> Version: 1.0 · Stand: 2026-06-08 · Base44 Platform (React + Deno)

---

## 1. TECH STACK

| Layer | Technologie |
|-------|-------------|
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| State | TanStack Query v5 |
| Routing | react-router-dom v6 |
| Charts | Recharts |
| PDF | jsPDF, html2pdf.js |
| Excel | xlsx (Browser + Deno) |
| Animation | Framer Motion |
| Backend | Deno Deploy (Base44 Functions) |
| Database | Base44 Entities (NoSQL JSON) |
| AI | Base44 InvokeLLM (Gemini/Claude) |
| Email | Base44 SendEmail (Resend) |
| Auth | Base44 AuthProvider |

---

## 2. ENTITY SCHEMAS (Datenbank)

### 2.1 Customer
```json
{
  "name": "Customer",
  "properties": {
    "customer_number": "string",
    "first_name": "string (required)",
    "last_name": "string (required)",
    "email": "string (required)",
    "phone": "string",
    "mobile": "string",
    "street": "string",
    "zip_code": "string",
    "city": "string",
    "canton": "enum[AG,AI,AR,BE,BL,BS,FR,GE,GL,GR,JU,LU,NE,NW,OW,SG,SH,SO,SZ,TG,TI,UR,VD,VS,ZG,ZH]",
    "birthdate": "date",
    "civil_status": "enum[single,married,divorced,widowed]",
    "customer_type": "enum[private,business] default=private",
    "status": "enum[active,inactive,prospect] default=active",
    "mandate_status": "enum[valid,invalid,pending,expired] default=pending",
    "is_family_member": "boolean default=false",
    "primary_customer_id": "string",
    "family_role": "enum[primary,spouse,child,parent,other] default=primary",
    "organization_id": "string (required)",
    "primary_advisor_id": "string",
    "assigned_advisors": "string[]",
    "assigned_assistants": "string[]",
    "access_level": "enum[public_admin_only,assigned_advisors_only,team_visible,all_internal] default=assigned_advisors_only",
    "total_premium": "number default=0",
    "portal_enabled": "boolean default=false",
    "archived": "boolean default=false",
    "change_history": "object[]"
  }
}
```

### 2.2 Contract
```json
{
  "name": "Contract",
  "properties": {
    "customer_id": "string (required)",
    "customer_name": "string",
    "organization_id": "string (required)",
    "advisor_id": "string",
    "insurer": "string (required)",
    "insurance_type": "enum[life,health,property,liability,motor,other] (required)",
    "policy_number": "string",
    "product": "string",
    "premium_monthly": "number",
    "premium_yearly": "number",
    "start_date": "date",
    "end_date": "date",
    "renewal_date": "date",
    "auto_renew": "boolean default=true",
    "cancellation_deadline": "date",
    "status": "enum[active,pending,cancelled,expired,archived] default=active",
    "renewal_stage": "enum[early,contact,offer,negotiation,renewed,lost] default=early",
    "renewal_status": "enum[none,notified,in_progress,completed] default=none",
    "renewal_priority": "enum[low,medium,high] default=low",
    "upsell_stage": "enum[identified,contact,offer,negotiation,won,lost] default=identified",
    "cancellation_status": "enum[none,submitted,confirmed,rejected,completed,switch_planned] default=none",
    "cancellation_type": "enum[customer_initiated,insurer_initiated,mutual,legal,death,internal_switch]",
    "primary_broker_id": "string",
    "assigned_brokers": "string[]",
    "access_level": "enum[public_admin_only,assigned_brokers_only,team_visible,all_internal] default=assigned_brokers_only",
    "sparte": "string",
    "sparte_data": "object",
    "commission_rate": "number",
    "commission_amount": "number",
    "archived": "boolean default=false",
    "change_history": "object[]"
  },
  "rls": {
    "read": "admin OR assigned_broker OR primary_broker OR customer",
    "create": "admin OR broker OR assistenz",
    "update": "admin OR primary_broker OR assigned_broker",
    "delete": "admin only"
  }
}
```

### 2.3 Application
```json
{
  "name": "Application",
  "properties": {
    "customer_id": "string (required)",
    "organization_id": "string (required)",
    "advisor_id": "string",
    "insurer": "string (required)",
    "sparte": "string",
    "sparte_data": "object",
    "status": "enum[new,in_progress,waiting,approved,rejected,archived] default=new",
    "estimated_premium_monthly": "number",
    "requested_start_date": "date",
    "linked_contract_id": "string",
    "abloese_contract_id": "string",
    "status_history": "object[]",
    "archived": "boolean default=false"
  }
}
```

### 2.4 Task
```json
{
  "name": "Task",
  "properties": {
    "title": "string (required)",
    "description": "string",
    "customer_id": "string",
    "contract_id": "string",
    "application_id": "string",
    "assigned_to": "string (email)",
    "priority": "enum[low,medium,high,urgent] default=medium",
    "status": "enum[open,in_progress,completed] default=open",
    "due_date": "date",
    "completion_date": "date",
    "task_type": "enum[onboarding,renewal,follow_up,consultation,general,health_declaration] default=general"
  }
}
```

### 2.5 Document
```json
{
  "name": "Document",
  "properties": {
    "name": "string (required)",
    "file_url": "string (required)",
    "customer_id": "string",
    "category": "enum[contract,application,identification,correspondence,other]",
    "processing_stage": "enum[uploaded,parsed,entities_detected,customer_mapped,application_created,policy_created] default=uploaded",
    "classification_status": "enum[ausstehend,klassifiziert,pruefung_erforderlich,manuell] default=ausstehend",
    "linked_contract_id": "string",
    "linked_application_id": "string",
    "uploaded_by": "string",
    "uploaded_at": "datetime",
    "file_hash": "string",
    "version": "number default=1",
    "immutable": "boolean default=false",
    "access_level": "enum[public_admin_only,assigned_advisors_only,team_visible,all_internal] default=assigned_advisors_only"
  }
}
```

### 2.6 BAGPraemienDaten
```json
{
  "name": "BAGPraemienDaten",
  "properties": {
    "jahr": "number (required)",
    "krankenkasse": "string (required)",
    "kanton": "string (required)",
    "region": "string",
    "modell": "enum[standard,telmed,hausarzt,hmo] (required)",
    "franchise": "enum[300,500,1000,1500,2000,2500] (required)",
    "unfall": "boolean default=true",
    "praemie_erwachsene": "number (required)",
    "praemie_kinder": "number",
    "geschlecht": "enum[m,w]",
    "alter_von": "number",
    "alter_bis": "number",
    "datenquelle": "string default=BAG",
    "importiert_am": "datetime",
    "gueltig_ab": "date",
    "gueltig_bis": "date",
    "aktiv": "boolean default=true"
  }
}
```

### 2.7 KrankenkassenVergleich
```json
{
  "name": "KrankenkassenVergleich",
  "properties": {
    "customer_id": "string (required)",
    "advisor_id": "string",
    "organization_id": "string (required)",
    "vergleichsdatum": "datetime (required)",
    "persoenliche_daten": {
      "vorname": "string", "nachname": "string",
      "geburtsdatum": "date", "kanton": "string", "geschlecht": "enum[m,w]"
    },
    "aktuelle_versicherung": {
      "krankenkasse": "string", "modell": "string",
      "franchise": "number", "unfall": "boolean"
    },
    "vergleichsergebnisse": "object[] (rang, krankenkasse, modell, praemie_monatlich, ersparnis_jaehrlich, ist_empfohlen)",
    "ki_analyse": {
      "sparpotenzial": "number", "wechsel_empfohlen": "boolean",
      "empfehlung_text": "string", "empfohlene_krankenkasse": "string"
    },
    "status": "enum[entwurf,durchgefuehrt,gespeichert,praesentiert] default=durchgefuehrt",
    "pdf_url": "string"
  }
}
```

### 2.8 Organization
```json
{
  "name": "Organization",
  "properties": {
    "name": "string (required)",
    "type": "enum[strukturvertrieb,broker,partner,sonstiges] default=broker",
    "status": "enum[active,inactive] default=active",
    "finma_number": "string",
    "street": "string", "zip_code": "string", "city": "string",
    "phone": "string", "email": "string", "website": "string",
    "works_with_address_brokers": "boolean default=false"
  }
}
```

### 2.9 Ausschreibung
```json
{
  "name": "Ausschreibung",
  "properties": {
    "titel": "string (required)",
    "customer_id": "string (required)",
    "organization_id": "string (required)",
    "broker_id": "string",
    "versicherungsbereich": "enum[privat,gewerbe,industrie,landwirtschaft]",
    "sparten": "string[]",
    "status": "enum[entwurf,vorbereitung,versendet,offerten_ausstehend,teilweise_erhalten,vollstaendig_erhalten,in_analyse,praesentation_erstellt,praesentiert,entscheidung_ausstehend,gewonnen,verloren,abgeschlossen] default=entwurf",
    "prioritaet": "enum[niedrig,mittel,hoch,dringend] default=mittel",
    "ausschreibungsdatum": "date",
    "fristdatum": "date",
    "ausgewaehlte_versicherer": "object[] (versicherer_id, name, email, status)",
    "offerten_count": "number default=0",
    "laufende_praemie": "number",
    "ki_analyse": "object",
    "ki_empfehlung_text": "string"
  }
}
```

### 2.10 Offerte
```json
{
  "name": "Offerte",
  "properties": {
    "ausschreibung_id": "string (required)",
    "versicherer_name": "string (required)",
    "organization_id": "string (required)",
    "customer_id": "string",
    "praemie_jaehrlich": "number",
    "praemie_monatlich": "number",
    "status": "enum[ausstehend,erhalten,analysiert,empfohlen,abgelehnt,angenommen] default=ausstehend",
    "ki_score": "number (0-100)",
    "ki_preis_score": "number",
    "ki_deckungs_score": "number",
    "ki_analyse_text": "string",
    "ist_empfohlen": "boolean default=false",
    "ist_guenstigste": "boolean default=false"
  }
}
```

### 2.11 CommissionEntry
```json
{
  "name": "CommissionEntry",
  "properties": {
    "contract_id": "string",
    "customer_id": "string",
    "advisor_id": "string",
    "organization_id": "string",
    "amount": "number",
    "status": "enum[pending,approved,paid,storniert]",
    "type": "enum[courtage,provision,storno]",
    "period_start": "date",
    "period_end": "date",
    "paid_at": "datetime"
  }
}
```

### 2.12 AuditLog
```json
{
  "name": "AuditLog",
  "properties": {
    "audit_id": "string (required)",
    "audit_level": "number enum[1,2,3,4] — 1=Critical,2=Lifecycle,3=Guard,4=Debug",
    "timestamp": "datetime (required)",
    "trigger_type": "enum[entity_create,entity_update,entity_delete,scheduled,manual,api]",
    "actor_type": "enum[user,automation,scheduler,system]",
    "actor_id": "string",
    "actor_name": "string",
    "entity_type": "enum[customer,application,contract,commission,task,document]",
    "entity_id": "string (required)",
    "action": "enum[create,update,delete,archive,restore,block,skip,allow,reject]",
    "previous_state_summary": "object",
    "new_state_summary": "object",
    "side_effects": "object[]",
    "business_impact_financial_chf": "number",
    "correlation_id": "string"
  }
}
```

### 2.13 GovernanceRule
```json
{
  "name": "GovernanceRule",
  "properties": {
    "name": "string (required)",
    "description": "string (required)",
    "rule_version": "string default=1.0",
    "effective_from": "datetime (required)",
    "entity_type": "string (required)",
    "event_types": "enum[create,update,delete,read][]",
    "layer": "enum[WARNING,VALIDATION,GOVERNANCE_BLOCK,SECURITY_BLOCK]",
    "business_criticality": "enum[LOW,MEDIUM,HIGH,CRITICAL] default=MEDIUM",
    "enforcement_mode": "enum[monitor,enforce,strict] default=monitor",
    "simulate_only": "boolean default=true",
    "error_message": "string (required)",
    "rule_status": "enum[draft,testing,active,deprecated,archived] default=draft",
    "violation_count": "number default=0"
  }
}
```

### 2.14 EnterpriseIncident
```json
{
  "name": "EnterpriseIncident",
  "properties": {
    "severity": "enum[info,warning,critical,blocking] (required)",
    "category": "enum[export_gate,approval,tenant_isolation,data_integrity,audit_trail,security,...]",
    "title": "string (required)",
    "description": "string (required)",
    "status": "enum[open,investigating,root_cause_identified,mitigation_active,resolved,closed]",
    "impact_governance": "number 0-100",
    "impact_financial": "number 0-100",
    "strategic_impact_score": "number 0-100",
    "root_cause_cluster": "string",
    "assigned_to": "string",
    "sla_due_at": "datetime",
    "resolved_at": "datetime"
  }
}
```

### 2.15 AdvisoryDossier
```json
{
  "name": "AdvisoryDossier",
  "properties": {
    "customer_id": "string (required)",
    "advisor_id": "string",
    "organization_id": "string (required)",
    "status": "string",
    "ki_analyse": "object",
    "pdf_url": "string",
    "snapshot": "object"
  }
}
```

### 2.16 VersichererDB
```json
{
  "name": "VersichererDB",
  "properties": {
    "name": "string (required)",
    "kurzname": "string",
    "kontaktperson": "string",
    "email": "string",
    "telefon": "string",
    "adresse": "string",
    "aktiv": "boolean default=true",
    "bewertung": "number 1-5",
    "spezialisierungen": "string[]",
    "bevorzugter_kanal": "enum[email,portal,telefon,post]",
    "bearbeitungszeit_tage": "number"
  }
}
```

### 2.17 Lead
```json
{
  "name": "Lead",
  "properties": {
    "first_name": "string", "last_name": "string",
    "email": "string", "phone": "string",
    "source": "string",
    "status": "enum[new,contacted,qualified,converted,lost]",
    "score": "number 0-100",
    "organization_id": "string",
    "assigned_to": "string",
    "converted_customer_id": "string"
  }
}
```

### 2.18 Verkaufschance
```json
{
  "name": "Verkaufschance",
  "properties": {
    "customer_id": "string",
    "organization_id": "string",
    "title": "string (required)",
    "stage": "enum[identified,contact,offer,negotiation,won,lost]",
    "probability": "number 0-100",
    "expected_value": "number",
    "score": "number",
    "assigned_to": "string"
  }
}
```

### 2.19 GovernanceScoreSnapshot
```json
{
  "name": "GovernanceScoreSnapshot",
  "properties": {
    "snapshot_date": "date",
    "overall": "number 0-100 (required)",
    "risk_level": "enum[low,medium,high,critical]",
    "domains": "object (compliance, tenant_integrity, audit_trail, ai_reliability, incident_health, data_quality)",
    "computed_at": "datetime (required)",
    "trend": "enum[up,down,stable]",
    "trend_delta": "number"
  }
}
```

---

## 3. BACKEND FUNCTIONS (Deno Deploy)

Alle Functions sind unter `functions/` als JS-Dateien.
Aufruf: `base44.functions.invoke('functionName', payload)`
Auth: `createClientFromRequest(req)` + `base44.auth.me()`

### 3.1 BAG Import
| Function | Zweck |
|----------|-------|
| `importBAGDatenFromURL` | BAG Excel URL → filtert nach Kanton → bulkCreate BAGPraemienDaten |
| `importBAGDatenChunk` | Chunk-basierter Import (alternativ) |
| `generateBAGTemplate` | Erstellt Excel-Template für BAG-Format |

**importBAGDatenFromURL — Kernlogik:**
```javascript
// Input: { file_url, jahr, kanton }
// 1. fetch(file_url) → ArrayBuffer
// 2. XLSX.read(buffer) → worksheet
// 3. sheet_to_json() → allRows
// 4. Filter: kantonCode === kanton && altersklasse === 'AKL-ERW' && unfalleinschluss === 'OHNE-UNF'
// 5. Map: versichererId → krankenkasse, tarifTyp → modell, franchiseCode → number
// 6. bulkCreate in Batches von 25
// Admin-only
```

### 3.2 Krankenkassen-Vergleich
| Function | Zweck |
|----------|-------|
| `analyzeKrankenkassenVergleich` | BAGPraemienDaten abfragen → Ranking → InvokeLLM Empfehlung |

### 3.3 Contract Lifecycle
| Function | Zweck |
|----------|-------|
| `acceptApplicationAndCreateContract` | Application approved → Contract.create → Commission → Tasks |
| `guardContractLifecycle` | Entity-Trigger: prüft Business-Rules bei Contract-Änderungen |
| `guardDuplicatePolicy` | Verhindert doppelte Policen |
| `cancelPolicy` | Kündigung mit Fristen-Prüfung |
| `renewPolicy` | Verlängerung |
| `mutatePolicy` | Mutations-Antrag (Portal) |
| `syncCancellationDeadline` | Berechnet Kündigungsfristen automatisch |

### 3.4 Document AI
| Function | Zweck |
|----------|-------|
| `smartDocumentAnalysis` | PDF → InvokeLLM → extrahiert Felder → Document.update |
| `extractInsuranceDocument` | Spezialisierte Extraktion |
| `extractPolicyData` | Police-Daten extrahieren |
| `extractApplicationData` | Antrags-Daten extrahieren |
| `classifyDocument` | Police/Offerte/Anlage Klassifizierung |
| `classifySparteFromDocument` | Sparte erkennen |
| `learnFromExtractionCorrection` | Aus Korrekturen Muster lernen → InsuranceKnowledgePattern |
| `onDocumentUpload` | Entity-Trigger bei Upload |
| `processDocumentQueue` | Async Queue abarbeiten |

### 3.5 Commission / Finance
| Function | Zweck |
|----------|-------|
| `calculateCommissionAuto` | Provision automatisch bei Contract-Aktivierung |
| `calculateCommissions` | Batch-Berechnung |
| `handleStornoOfAutomaticProvision` | Storno wenn Vertrag storniert |
| `reverseStornoCommission` | Storno rückgängig machen |
| `approveAndPayoutCommissions` | Genehmigen + Auszahlen |
| `executePayoutTransfers` | Transfers ausführen |
| `closePeriod` | Periode abschliessen |
| `guardPeriodClosed` | Verhindert Änderungen in geschlossener Periode |
| `guardDoublePayment` | Verhindert Doppelzahlungen |
| `syncCommissionOnPolicyChange` | Sync bei Vertragsänderung |

### 3.6 Renewal & Sales Automation
| Function | Zweck |
|----------|-------|
| `checkPoliciesRenewal` | Scheduler: identifiziert ablaufende Verträge |
| `checkPoliciesExpiry` | Scheduler: abgelaufene Verträge |
| `calculateRenewalPriority` | Priorität berechnen |
| `autoUpdateRenewalStage` | Stage automatisch aktualisieren |
| `prepareRenewalOffer` | Angebot vorbereiten |
| `sendRenewalOffer` | Angebot versenden |
| `acceptRenewalOffer` | Angebot annehmen → neuer Vertrag |
| `sendRenewalReminders` | Erinnerungen senden |
| `autopilotPrepareOffer` | KI-gestütztes Angebot |
| `autopilotSendFollowup` | Follow-up automatisch |
| `autoDetectUpsellPotential` | Upsell-Chancen erkennen |
| `calculateChurnRisk` | Abwanderungs-Risiko |

### 3.7 Lead & Opportunity
| Function | Zweck |
|----------|-------|
| `calculateLeadScore` | Lead-Score 0-100 |
| `calculateOpportunityScore` | Opportunity-Score |
| `convertLeadToCustomer` | Lead → Customer |
| `automateLeadScoringOnCreation` | Entity-Trigger |
| `leadWorkflowAutomation` | Workflow-Automation |

### 3.8 Governance & Audit
| Function | Zweck |
|----------|-------|
| `enforceGovernance` | GovernanceRules evaluieren |
| `enforceGovernanceCheck` | Check ohne Enforcement |
| `auditLogWrite` | AuditLog schreiben (Level 1-4) |
| `createAuditLog` | AuditLog erstellen |
| `appendAuditEntry` | Eintrag anhängen |
| `runEnterpriseAudit` | Vollständiger Audit-Run |
| `snapshotGovernanceScore` | Score speichern (Scheduler) |
| `calculateGovernanceRiskScore` | Score berechnen |
| `validateGovernanceCompliance` | Compliance-Check |
| `validateTenantIntegrity` | Tenant-Isolation prüfen |
| `correlateIncidents` | Incidents korrelieren |
| `aiIncidentResolver` | KI-Incident-Lösung |

### 3.9 Customer Management
| Function | Zweck |
|----------|-------|
| `generateCustomerNumber` | Eindeutige KD-Nummer |
| `detectDuplicates` | Duplikate erkennen |
| `mergeCustomers` | Duplikate zusammenführen |
| `createFamilyMember` | Familienmitglied anlegen |
| `matchCustomerAndFamily` | Haushalt zuordnen |
| `deleteCustomerWithContracts` | Vollständig löschen (Admin) |
| `syncCustomerStatusFromContracts` | Status aus Verträgen sync |
| `aiCustomerInsights` | KI-Kundenanalyse |

### 3.10 Portal (Kunden-Self-Service)
| Function | Zweck |
|----------|-------|
| `inviteCustomerToPortal` | Portal-Zugang einrichten |
| `guardPortalLogin` | Portal-Auth |
| `guardPortalAccess` | Zugriffsschutz |
| `getPortalData` | Portal-Daten laden |
| `updatePortalCustomer` | Kundendaten aktualisieren |
| `uploadPortalDocument` | Dokument hochladen |
| `managePortalPassword` | Passwort verwalten |
| `mutatePolicy` | Mutations-Antrag |

### 3.11 Notifications & Email
| Function | Zweck |
|----------|-------|
| `birthdayEmailReminder` | Scheduler: Geburtstags-Emails |
| `mandatePendingReminder` | Scheduler: offene Mandate |
| `taskReminderNotifications` | Scheduler: Aufgaben-Reminder |
| `sendRenewalReminders` | Renewal-Erinnerungen |
| `notifyExpiringContracts` | Ablauf-Benachrichtigung |
| `notifyBrokerOnDocument` | Broker bei neuem Dokument |
| `sendEmailCampaign` | E-Mail Kampagne senden |
| `sendScheduledCampaigns` | Scheduler: geplante Kampagnen |
| `dailyOperationsDigest` | Tages-Zusammenfassung |

### 3.12 System & Backup
| Function | Zweck |
|----------|-------|
| `systemHealthCheck` | System-Status prüfen |
| `enterpriseSystemCheck` | Vollständiger Enterprise-Check |
| `createFullBackup` | Vollständiges Backup |
| `createIncrementalBackup` | Inkrementelles Backup |
| `createLongTermBackup` | Langzeit-Archiv |
| `restoreFromBackup` | Wiederherstellung |
| `validateSystemIntegrity` | System-Integrität prüfen |
| `checkDataConsistency` | Daten-Konsistenz |

---

## 4. FRONTEND PAGES & ROUTES

```
App.jsx → Router
├── /                          → Dashboard
├── /kunden                    → CustomerIntelligenceWorkspace
├── /kunden/:id                → CustomerDetail
├── /kunden/:id/360            → Customer360
├── /neukunden                 → NewCustomers
├── /vertraege                 → Contracts
├── /antraege                  → Applications
├── /aufgaben                  → Tasks
├── /dokumente                 → Documents
├── /dokument-extraktor        → DocumentExtractor
├── /krankenkassen-vergleich   → KrankenkassenVergleich
├── /bag-daten                 → BAGDatenVerwaltung
├── /admin/bag-daten           → BAGDatenAdmin (Admin only)
├── /ausschreibungen           → Ausschreibungen
├── /ausschreibungen/:id       → AusschreibungDetail
├── /ausschreibungen/versicherer → VersichererDBPage
├── /leads                     → Leads
├── /verkaufschancen           → Verkaufschancen
├── /vertragsablaeufe          → Vertragsablaeufe
├── /beratungsdossier          → AdvisoryDossier
├── /provisionen-courtagen     → CommissionsAndCourtage
├── /finanz-dashboard          → FinanceDashboard
├── /ceo-cockpit               → CEOCockpit
├── /sales-autopilot           → SalesAutopilot
├── /execution-mode            → ExecutionMode
├── /reporting                 → BrokerReporting
├── /coverage-intelligence     → CoverageIntelligence
├── /email-templates           → EmailTemplates
├── /email-kampagnen           → EmailCampaigns
├── /status-verwaltung         → StatusVerwaltung
├── /berater-organisation      → BeratungOrganisation
├── /partner                   → Partners
├── /partner/:id               → PartnerDetail
├── /compliance-schreiben      → ComplianceSchreiben
├── /admin/enterprise-control-center → AdminEnterpriseControlCenter
├── /admin/enterprise-audit    → EnterpriseAudit
├── /admin/team-zugriffsrechte → AdminTeamAccess
├── /admin/insurance-learning  → InsuranceLearningCenter
├── /system-logs               → SystemLogs
├── /admin-logs                → AdminLogs
│
└── /portal/*                  → Portal (PUBLIC — kein Base44 Auth)
    ├── /portal                → PortalDashboard
    ├── /portal/vertraege      → PortalContracts
    ├── /portal/antraege       → PortalApplications
    ├── /portal/dokumente      → PortalDocuments
    ├── /portal/profil         → PortalProfile
    ├── /portal/setup          → PortalSetup
    └── /portal/reset-password → PortalResetPassword
```

---

## 5. AUTOMATIONS (Scheduled & Entity Triggers)

### Scheduled (täglich/wöchentlich)
| Name | Interval | Function |
|------|----------|----------|
| Renewal Check | täglich | `checkPoliciesRenewal` |
| Expiry Check | täglich | `checkPoliciesExpiry` |
| Birthday Reminders | täglich | `birthdayEmailReminder` |
| Task Reminders | täglich | `taskReminderNotifications` |
| Mandate Reminders | wöchentlich | `mandatePendingReminder` |
| Governance Score | täglich | `snapshotGovernanceScore` |
| Daily Digest | täglich 07:00 | `dailyOperationsDigest` |
| SLA Check | stündlich | `checkIncidentSLAs` |
| Scheduled Campaigns | täglich | `sendScheduledCampaigns` |

### Entity Triggers
| Entity | Event | Function |
|--------|-------|----------|
| Contract | create/update | `guardContractLifecycle` |
| Contract | create | `calculateCommissionAuto` |
| Contract | update | `syncCommissionOnPolicyChange` |
| Application | update | `onApplicationUpdate` |
| Application | update (approved) | `applicationToContractAuto` |
| Document | create | `onDocumentUpload` |
| Lead | create | `automateLeadScoringOnCreation` |
| Verkaufschance | create | `automateOpportunityScoringOnCreation` |
| Customer | update | `syncApplicationOnCustomerChange` |

---

## 6. DESIGN SYSTEM

### Tokens (index.css)
```css
--background: 214 60% 97%       /* #F0F6FF soft blue-white */
--primary: 217 91% 60%          /* #3B82F6 blue */
--sidebar-background: 220 36% 19% /* dark navy */
--radius: 0.55rem
--font-inter: 'Inter', system-ui
```

### Key Components
- `AppLayout` — Sidebar + Outlet
- `Sidebar` — Navigation mit Rollen-basierter Anzeige
- `CustomerCard` — Kunden-Übersichtskarte
- `ContractForm` — Vertragsformular (alle Sparten)
- `BAGDatenImport` — Excel-Upload Dialog (26 Kantone)
- `DossierBuilder` — Beratungsdossier Builder
- `KrankenkassenCockpit` — Vergleichs-Dashboard
- `MessageBubble` — Chat-Nachricht mit Tool-Calls

---

## 7. AUTH & RLS

### Rollen
| Rolle | Berechtigungen |
|-------|----------------|
| `admin` | Vollzugriff auf alles |
| `broker` | Eigene Kunden, Verträge, Anträge |
| `assistenz` | Lesen + begrenzte Schreibrechte |
| `user` | Nur eigene Daten (Portal-Kunden) |

### RLS-Pattern (Base44)
```json
{
  "read": {
    "$or": [
      { "user_condition": { "role": "admin" } },
      { "data.primary_broker_id": "{{user.id}}" },
      { "data.assigned_brokers": { "$in": ["{{user.id}}"] } },
      { "data.customer_id": "{{user.id}}" }
    ]
  }
}
```

---

## 8. KEY PATTERNS

### Frontend → Backend
```javascript
// Entities direkt
const data = await base44.entities.Customer.filter({ organization_id: org.id });

// Backend Function
const result = await base44.functions.invoke('analyzeKrankenkassenVergleich', {
  kanton: 'ZH', franchise: 300, modell: 'standard'
});

// File Upload
const { file_url } = await base44.integrations.Core.UploadFile({ file });

// AI
const analysis = await base44.integrations.Core.InvokeLLM({
  prompt: '...', response_json_schema: { type: 'object', properties: {...} }
});
```

### Backend Function Template
```javascript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { param1, param2 } = await req.json();

    // User-scoped
    const items = await base44.entities.Customer.list();

    // Service-role (admin)
    const allItems = await base44.asServiceRole.entities.Customer.list();

    return Response.json({ success: true, items });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

### BAG Import Pattern (Frontend-seitig optimal)
```javascript
// 1. Upload Datei
const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });

// 2. Sequenziell alle 26 Kantone
const KANTONE = ['ZH','BE','LU','UR','SZ','OW','NW','GL','ZG','FR','SO','BS',
                 'BL','SH','AR','AI','SG','GR','AG','TG','TI','VD','VS','NE','GE','JU'];

for (const kanton of KANTONE) {
  const response = await base44.functions.invoke('importBAGDatenFromURL', {
    file_url, jahr: 2026, kanton
  });
  await new Promise(r => setTimeout(r, 100)); // Pause zwischen Kantonen
}
```

---

## 9. EXTERNAL DEPENDENCIES

| Package | Version | Verwendung |
|---------|---------|------------|
| `@base44/sdk` | ^0.8.31 | Platform SDK |
| `xlsx` | ^0.18.5 | Excel Parsing |
| `jspdf` | ^4.0.0 | PDF Generierung |
| `recharts` | ^2.15.4 | Charts & Grafiken |
| `framer-motion` | ^11.16.4 | Animationen |
| `@tanstack/react-query` | ^5.84.1 | Data Fetching |
| `react-router-dom` | ^6.26.0 | Routing |
| `react-hook-form` | ^7.54.2 | Formulare |
| `date-fns` | ^3.6.0 | Datum-Utilities |
| `lodash` | ^4.17.21 | Utilities |
| `react-markdown` | ^9.0.1 | Markdown Rendering |
| `@hello-pangea/dnd` | ^17.0.0 | Drag & Drop |
| `react-leaflet` | ^4.2.1 | Karten |
| `three` | ^0.171.0 | 3D (falls benötigt) |

---

## 10. REBUILD CHECKLIST

```
[ ] 1. Base44 App erstellen (React + Vite)
[ ] 2. Alle 19+ Entities anlegen (JSON Schemas)
[ ] 3. RLS-Regeln pro Entity konfigurieren
[ ] 4. Rollen definieren: admin, broker, assistenz
[ ] 5. index.css Design Tokens einfügen
[ ] 6. tailwind.config.js konfigurieren
[ ] 7. AppLayout + Sidebar erstellen
[ ] 8. App.jsx Router mit allen Routes
[ ] 9. Alle Pages erstellen (~40 Pages)
[ ] 10. Alle Components erstellen (~100+ Components)
[ ] 11. Backend Functions deployen (~150 Functions)
[ ] 12. Automations konfigurieren (Scheduled + Entity)
[ ] 13. BAG-Daten importieren (Excel von bag.admin.ch)
[ ] 14. Test-Daten einfügen
[ ] 15. Portal konfigurieren (/portal/* Routes)
[ ] 16. Email Templates erstellen
[ ] 17. Governance Rules aktivieren
[ ] 18. Admin-User einladen
``