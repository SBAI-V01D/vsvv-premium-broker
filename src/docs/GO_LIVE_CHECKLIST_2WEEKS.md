# ✅ GO-LIVE CHECKLIST: 2-WOCHEN PRODUCTION HARDENING

**Project:** Enterprise CRM/Sales/Courtage Platform  
**Timeline:** 2026-05-14 bis 2026-05-28  
**Status:** LAUNCH READY  

---

## 🔴 TIER 1 – RELEASE BLOCKERS (Diese Woche)

### ✅ Financial Period – Completed This Sprint

- [x] `lib/financialPeriod.js` – Zentrale Financial Period Engine
- [x] `calcMonthlyTrend()` – Korrigiert (nutzt courtage_received_date)
- [x] `CommissionsAndCourtage.jsx` – Period Filtering korrigiert
- [x] Dokumentation erstellt

**Status:** ✅ DONE – Monatliche KPI jetzt korrekt!

**Proof:**
```
Szenario: Commission erfasst am Mai 14, aber courtage_received_date = Feb 28
ALT (FALSCH): Erscheint in Mai-KPI ✗
NEU (RICHTIG): Erscheint in Feb-KPI ✓
```

---

### 🔴 PRIORITY 1.2: calcKPIs() Korrigieren – SOFORT

**Problem:** `calcKPIs()` nutzt immer noch `entry_date`, nicht `courtage_received_date`!

**Status:** ❌ TODO (heute)

**Aufwand:** 1-2 Stunden

**Aktion:**
```javascript
// DATEI: lib/commissionEngine.js
// FUNKTION: calcKPIs()
// ZEILEN: 167-259

// PATTERN (wie calcMonthlyTrend):
// Nutze: courtage_received_date > courtage_invoiced_date > entry_date
// NICHT: entry_date direkt!

// Alle Zeitraum-Filter müssen angepasst werden
```

**Checklist:**
- [ ] Alle `entry_date` Filter durch `courtage_received_date` ersetzen
- [ ] Tests schreiben (vgl. FINANCIAL_PERIOD_CORRECTION.md)
- [ ] Reconciliation Report erstellen
- [ ] KPI-Bar Update testen

**Sign-off:** Wenn alle KPI-Berechnungen auf Finanzdatum basieren.

---

### 🔴 PRIORITY 1.3: RLS Security Audit – SOFORT

**Problem:** System hat Partial RLS, aber kritische Entities nicht gehärtet.

**Status:** ❌ TODO (heute + morgen)

**Risikoanalyse:**
```
🔴 RISK: Cross-Access möglich auf:
  - Customer (Advisor A könnte Advisor B's Customers sehen?)
  - Contract (Cross-Advisor Access?)
  - Lead (Cross-Tenant possible?)
  - Opportunity (visibility leak?)
  
IMPACT: Data Breach, Compliance Failure, Go-Live Blocker
```

**Entities zu härten (Priorisierung):**

| Entity | Risk | Action | Effort |
|--------|------|--------|--------|
| CommissionEntry | 🟢 Low | ✅ Already done | - |
| Customer | 🔴 CRITICAL | [ ] Audit + Fix | 1h |
| Contract | 🔴 CRITICAL | [ ] Audit + Fix | 1h |
| Lead | 🟡 HIGH | [ ] Audit + Fix | 1h |
| Opportunity | 🟡 HIGH | [ ] Audit + Fix | 1h |
| Application | 🟡 HIGH | [ ] Audit + Fix | 1h |
| Document | 🟡 MEDIUM | [ ] Audit + Check | 30m |

**Prüfliste pro Entity:**

```javascript
// PATTERN: Alle Backend-Funktionen MÜSSEN folgendes prüfen:

1. [ ] AUTHENTICATE: user = await base44.auth.me()
   if (!user) return 403

2. [ ] AUTHORIZE: canAccessEntity(user, record)
   if (!canAccessEntity) return 403

3. [ ] FILTER: Nur Daten zurückgeben, die user sehen darf
   // Advisor sieht nur eigene Customers
   // Team Lead sieht Team-Customers
   // Admin sieht alle

4. [ ] VALIDATE INPUT: Keine Rechte-Eskalation
   // Advisor darf nicht access_level auf "public_admin_only" setzen
   // User darf nicht assigned_advisors ändern

5. [ ] AUDIT: Log die Operation
   // await auditLogWrite()

6. [ ] RETURN: Nur gefilterte Daten
   // Nicht alle Felder zurückgeben (z.B. bank_account gehört nicht zur List)
```

**Konkrete Audits:**

**Entity: Customer**
```
[ ] Customer.list() – Advisor sieht nur eigene Customers?
[ ] Customer.get() – Advisor kann fremde Customer lesen?
[ ] Customer.update() – Advisor kann fremde Customer updaten?
[ ] Customer.delete() – Advisor kann fremde Customer löschen?
```

**Entity: Contract**
```
[ ] Contract.list() – Cross-Access?
[ ] Advisor sieht nur eigene Contracts?
[ ] Filter: „meine Verträge" funktioniert korrekt?
```

**Entity: Lead**
```
[ ] Leads sind Advisor-spezifisch?
[ ] Cross-Access möglich?
[ ] Leads können reassigned werden (mit Validierung)?
```

**API Security:**
```
[ ] Alle API-Responses validieren (kein Datenleak in Error Messages)
[ ] Sensitive Fields nicht exposed (password_hash, etc.)
[ ] Rate Limiting aktiv?
[ ] CORS korrekt konfiguriert?
```

---

### 🔴 PRIORITY 1.4: API Security Härtung

**Status:** ❌ TODO

**Checklist:**
- [ ] Input Validation in allen Backend-Funktionen
- [ ] Error Messages – no sensitive data leaks
- [ ] SQL Injection Protection (Base44 SDK?)
- [ ] CORS Policy Review
- [ ] Rate Limiting Check

---

## 🟡 TIER 2 – HOCH (Nächste 3 Tage)

### Lead Management v2.0

**Status:** ⚠️ IN PROGRESS

**Anforderungen:**
- [x] Entity `Lead` erstellen (vorhanden)
- [ ] Erweitern: lead_score, status_history, assigned_to, sla_target_contact_date
- [ ] UI: Leads.jsx erweitern (Pipeline-Ansicht)
- [ ] Automationen: Lead-Aging, SLA-Violations, Reminders
- [ ] Tests: Lead Status Transitions

**Entity Update:**
```json
// entities/Lead.json – zu erweitern:
{
  "lead_score": {"type": "number", "default": 0},
  "stage_entered_at": {"type": "string", "format": "date-time"},
  "assigned_to": {"type": "string"},
  "assigned_at": {"type": "string", "format": "date-time"},
  "sla_target_contact_date": {"type": "string", "format": "date"},
  "next_followup_date": {"type": "string", "format": "date"},
  "status_history": {"type": "array", "items": {...}}
}
```

---

### Opportunities v2.0

**Status:** ⚠️ TODO (nach Lead)

**Anforderungen:**
- [ ] Entity `Verkaufschance` erweitern
- [ ] Stages: initial → needs → proposal → negotiation → likely → won/lost
- [ ] probability % (0-100)
- [ ] expected_close_date, close_date
- [ ] win/loss tracking with reasons
- [ ] UI: Kanban Board aktualisieren
- [ ] Tests: Pipeline Stages, Probability

---

### Sales KPI & Forecast

**Status:** ⚠️ TODO

**KPI zu implementieren:**
```javascript
// lib/salesKPI.js (neue Datei)

calcLeadConversionRate()      // %
calcOpportunityWinRate()      // %
calcAverageDealSize()         // CHF
calcSalesCycleDuration()      // Tage
calcPipelineValue()           // CHF
calcForecast()                // CHF by Monat
calcLeadSourceROI()           // % by source
calcAdvisorPerformance()      // Ranking
```

---

## 🟢 TIER 3 – NORMAL (Nächste Woche)

### Performance Testing

- [ ] Load Test: 100'000+ Records
- [ ] Pagination: Alle großen Tabellen
- [ ] Query Caching: React Query
- [ ] KPI Aggregation: Nicht per-Record
- [ ] Export: <5s für 10k Records

---

### Automated Testing

- [ ] Unit Tests: Financial Period, KPI, RLS
- [ ] Integration Tests: Sales Pipeline, Commission Workflow
- [ ] E2E Tests: Komplette Szenarien
- [ ] Security Tests: RLS Durchbruch-Versuche

---

### Documentation

- [ ] ENTERPRISE_SYSTEM_ANALYSIS.md – ✅ Done
- [ ] PRODUCTION_HARDENING_ROADMAP.md – ✅ Done
- [ ] Financial Period – ✅ Done
- [ ] RLS & Security Guide
- [ ] API Documentation
- [ ] Operations Manual

---

## 📊 DAILY STATUS BOARD

### Woche 1 (Mai 14-20)

```
Montag-Dienstag (Mai 14-15):
├─ ✅ Financial Period Engine (DONE)
├─ 🔴 calcKPIs() fixieren (IN PROGRESS)
└─ 🔴 RLS Audit starten (BLOCKED on calcKPIs)

Mittwoch-Donnerstag (Mai 16-17):
├─ 🔴 RLS Audit: Customer, Contract, Lead
├─ 🔴 API Security Härtung
└─ 🟡 Lead Management Entity Design

Freitag (Mai 17) + nächste Woche:
├─ 🟡 Lead Management Implementation
├─ 🟡 Opportunities v2.0
└─ 🟡 Sales KPI
```

---

## 🚨 CRITICAL PATH (Was blockiert was?)

```
calcKPIs() MUSS GEMACHT SEIN
    ↓
RLS Audit kann starten (KPI müssen korrekt sein für Audit)
    ↓
Lead Management kann beginnen
    ↓
KPI können getestet werden (mit echtem Lead Data)
    ↓
Sales Forecast kann implementiert werden
    ↓
Go-Live Tests
    ↓
🚀 LAUNCH
```

---

## ✅ GO-LIVE ACCEPTANCE CRITERIA

### Financial
- [x] Monthly KPI = Financial Period (nicht created_at)
- [ ] calcKPIs() 100% korrekt
- [ ] Alle Zeitraumberechnungen konsistent
- [ ] Reconciliation Report OK

### Security
- [ ] RLS: Alle Entities gehärtet
- [ ] API: Vollständig validiert
- [ ] Keine Cross-Tenant-Leaks
- [ ] Audit Trail: Alle kritischen Ops loggiert

### Sales
- [ ] Lead Pipeline funktioniert
- [ ] Opportunities vertriebsorientiert
- [ ] Sales KPI akkurat
- [ ] Forecast funktioniert

### Performance
- [ ] 100k+ Records getestet
- [ ] Queries <500ms
- [ ] KPI <2s
- [ ] Exporte <5s

### Compliance
- [ ] DSGVO konform
- [ ] Audit-ready
- [ ] Documentation complete
- [ ] Legal Sign-off

---

## 👥 TEAM ASSIGNMENTS

| Role | Responsibility | Status |
|------|-----------------|--------|
| **Dev Lead** | calcKPIs(), RLS Audit, Architecture | 🔴 |
| **Security** | API Hardening, RLS Validation | 🔴 |
| **Product** | Lead/Opportunity Design, KPI Spec | 🟡 |
| **QA** | Testing, Performance, Go-Live Validation | 🟡 |
| **Ops** | Documentation, Runbooks, Monitoring | 🟢 |

---

## 🎯 FINAL SIGN-OFF CHECKLIST

Before Go-Live, ALLE müssen OK sein:

```
TECH LEAD:
- [ ] calcKPIs() = 100% korrekt
- [ ] RLS = vollständig gehärtet
- [ ] Performance = getestet
- [ ] Tests = grün
- [ ] Dokumentation = aktuell

BUSINESS OWNER:
- [ ] Lead Management = funktioniert
- [ ] Opportunities = gut designed
- [ ] KPI = korrekt
- [ ] Sales Team = ready
- [ ] Training = done

COMPLIANCE:
- [ ] RLS = compliant
- [ ] Audit Trail = complete
- [ ] DSGVO = ok
- [ ] Legal = approved
- [ ] Monitoring = setup

OPERATIONS:
- [ ] Runbooks = schriftlich
- [ ] Backups = funktionieren
- [ ] Disaster Recovery = getestet
- [ ] Support = ready
- [ ] SLA = defined
```

---

## 🚀 LAUNCH DAY (2026-05-28)

```
Vor Launch:
- [ ] Final sanity checks
- [ ] Rollback plan ready
- [ ] Support team on standby
- [ ] Monitoring setup
- [ ] Customer notification ready

Launch:
- [ ] Deploy production
- [ ] Health checks
- [ ] KPI validation
- [ ] RLS spot checks
- [ ] Real user testing

Post-Launch:
- [ ] Monitor errors
- [ ] Watch KPI
- [ ] Support on call
- [ ] Weekly reviews
- [ ] Improvements backlog
```

---

## 📞 ESKALATIONS & RISKS

### Risk 1: calcKPIs() nimmt zu lange
```
Impact: RLS Audit blockiert, Timeline gefährdet
Mitigation: Parallele RLS Audit ab Mittwoch starten
Contingency: Nur 2 Entities (Customer, Contract) für v1.0
```

### Risk 2: RLS Lücke in Production
```
Impact: Data Breach, Go-Live Abort
Mitigation: Aggressiver Penetration Test
Contingency: RLS enforcement in Frontend layer
```

### Risk 3: Performance bei Last
```
Impact: System instabil, User Experience schlecht
Mitigation: Load testing vor Launch
Contingency: Query optimization, Caching
```

### Risk 4: Sales Features nicht ready
```
Impact: Go-Live blockiert
Mitigation: MVP: Lead v1.0 + Opportunities v1.0
Contingency: Phase 2 nach Launch (Juni)
```

---

**Status:** ROADMAP FINAL  
**Next Update:** Daily 09:00 Uhr  
**Escalation:** [Slack Channel]  
**Go-Live Date:** 2026-05-28 (FIRM)