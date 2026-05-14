# 🚀 PRODUCTION HARDENING ROADMAP

**Projekt:** Enterprise CRM/Sales/Courtage Platform Go-Live  
**Zieldatum:** 2026-05-28 (2 Wochen)  
**Status:** IN PLANNING  

---

## 🎯 MISSION

**System von „Advanced Prototype" zu „Enterprise-Production-Ready"**

```
Kriterium                Status      Ziel        Impact
─────────────────────────────────────────────────────────
Financial Accuracy       🟡 95%      ✅ 100%     Revenue-Critical
Lead Management          🔴 Basic    ✅ Pro      Sales-Critical
Opportunities            🔴 Simple   ✅ Pro      Sales-Critical
RLS & Security           🟡 Partial  ✅ 100%     Compliance
Performance              ❌ Unknown  ✅ Tested   Scalability
Audit & Compliance       🟡 Partial  ✅ 100%     Legal
API Security             ❌ Unknown  ✅ Tested   Security
Testing                  ❌ None     ✅ Full     Quality
```

---

## 📅 TIMELINE (2 WOCHEN)

### WOCHE 1 (Mai 14-20): TIER 1 – KRITISCHE BASICS

**Sprint 1.1: Financial Period & KPI (2 Tage)**
```
Montag-Dienstag (Mai 14-15)

✅ DONE:
- Financial Period Engine (lib/financialPeriod.js)
- calcMonthlyTrend() Korrektur
- PeriodSelector Update

🔴 TODO:
- calcKPIs() korrigieren (alle KPI-Funktionen)
- BI-Queries überprüfen
- Alle KPI-Tests schreiben
- Reconciliation Report erstellen

Deliverable: Financial Period Engine 100% korrekt
```

**Sprint 1.2: RLS & Security Audit (2 Tage)**
```
Mittwoch-Donnerstag (Mai 16-17)

📋 TASKS:
1. [ ] RLS Audit durchführen
   - [ ] Customer Entity RLS
   - [ ] Contract Entity RLS
   - [ ] Lead Entity RLS
   - [ ] Opportunity Entity RLS
   - [ ] Application Entity RLS
   - [ ] Document Entity RLS
   - [ ] Commission Entity RLS
   
2. [ ] Alle Backend-Funktionen validieren
   - [ ] guardDataAccess() überprüfen
   - [ ] Alle CRUD-Funktionen
   - [ ] Alle BI-Funktionen
   - [ ] Alle Export-Funktionen

3. [ ] API Security
   - [ ] Error Handling (keine Datenlecks)
   - [ ] Input Validation
   - [ ] Rate Limiting Check
   - [ ] CORS Config

Deliverable: RLS Security Audit Report + Fixes
```

**Sprint 1.3: Lead Management v2.0 (3 Tage)**
```
Freitag + Montag-Dienstag (Mai 17 + 20-21)

📋 REQUIREMENTS:
1. [ ] Lead Entity erweitern
   - [ ] lead_score
   - [ ] status_history
   - [ ] stage_entered_at
   - [ ] assigned_to
   - [ ] sla_target_contact_date
   - [ ] next_followup_date

2. [ ] Automationen
   - [ ] Lead-Aging (wenn nicht kontaktiert: Alert)
   - [ ] SLA-Verletzung (wenn Stage nicht bis Termin erledigt: Alert)
   - [ ] Auto-Followup Reminder
   - [ ] Inaktivitäts-Eskalation

3. [ ] UI Updates
   - [ ] Leads.jsx erweitern
   - [ ] Lead Status Workflow korrekt
   - [ ] KPI für Leads

4. [ ] Tests
   - [ ] Lead Status Transitions
   - [ ] SLA Logic
   - [ ] Auto-Reminders

Deliverable: Professionelle Lead Pipeline
```

---

### WOCHE 2 (Mai 21-28): TIER 2 – VERTRIEBSOPTIMIERUNG

**Sprint 2.1: Opportunities v2.0 (3 Tage)**
```
Mittwoch-Freitag (Mai 21-23)

📋 REQUIREMENTS:
1. [ ] Opportunity Entity Update
   - [ ] probability % (0-100)
   - [ ] stage_history (mit Daten)
   - [ ] expected_close_date
   - [ ] Ergebnis Fields (won_reason, lost_category, etc.)
   - [ ] estimated_courtage/provision

2. [ ] Pipeline Stages korrekt
   - Stage 0: initial_contact
   - Stage 1: needs_analysis
   - Stage 2: proposal
   - Stage 3: negotiation
   - Stage 4: likely_to_win
   - Stage 5: won
   - Stage 6: lost

3. [ ] UI Update
   - [ ] Verkaufschancen.jsx
   - [ ] Kanban Board mit aktuellen Stages
   - [ ] Stage Transition Logik

4. [ ] Tests
   - [ ] Pipeline Stages
   - [ ] Probability Calculation
   - [ ] Win/Loss Tracking

Deliverable: Vertriebsorientierte Opportunity Pipeline
```

**Sprint 2.2: Sales KPI & Forecast (2 Tage)**
```
Montag-Dienstag (Mai 24-25)

📋 KPI zu implementieren:
- Lead Conversion Rate (%)
- Opportunity Win Rate (%)
- Average Deal Size (CHF)
- Sales Cycle Duration (Tage)
- Pipeline Value (CHF)
- Forecast Accuracy
- Lead Source ROI
- Advisor Performance Rank

Deliverable: Sales Dashboard mit Forecast
```

**Sprint 2.3: Performance Testing & Validation (2 Tage)**
```
Mittwoch-Donnerstag (Mai 26-27)

📋 LOAD TEST:
- [ ] 100'000+ Customer Records
- [ ] 50'000+ Contract Records
- [ ] 10'000+ Lead Records
- [ ] 5'000+ Opportunity Records
- [ ] 100+ parallele Benutzer

📋 PERFORMANCE CHECKS:
- [ ] Tabellen-Rendering (<1s)
- [ ] Filter-Operations (<500ms)
- [ ] KPI-Berechnung (<2s)
- [ ] Export (<5s für 10k Records)
- [ ] BI-Queries (<3s)

Deliverable: Performance Test Report + Optimierungen
```

---

## 🔧 PHASE 1: FINANCIAL PERIOD & KPI (SOFORT)

### 1.1 calcKPIs() Korrigieren

**Datei:** `lib/commissionEngine.js`

```javascript
// PROBLEM: Nutzt wahrscheinlich noch entry_date
// LÖSUNG: Nutze getFinancialPeriodDate() wie in calcMonthlyTrend()

// VORHER (FALSCH):
export function calcKPIs(entries) {
  const active = entries.filter(e => e.status === 'paid')
  const entries_by_month = {}
  active.forEach(e => {
    const month = new Date(e.entry_date).toISOString().substring(0, 7)
    if (!entries_by_month[month]) entries_by_month[month] = []
    entries_by_month[month].push(e)
  })
  // ... weitere Berechnungen
}

// NACHHER (RICHTIG):
export function calcKPIs(entries) {
  const normalized = entries.map(normalizeLegacyEntry)
  const active = normalized.filter(e => 
    (e.courtage_status === 'paid' || e.provision_status === 'paid') && 
    !e.archived
  )
  
  const entries_by_month = {}
  active.forEach(e => {
    const courtageDate = getFinancialPeriodDate(e, 'courtage')
    const provisionDate = getFinancialPeriodDate(e, 'provision')
    const key = (courtageDate || provisionDate).toISOString().substring(0, 7)
    
    if (!entries_by_month[key]) entries_by_month[key] = []
    entries_by_month[key].push(e)
  })
  // ... weitere Berechnungen
}
```

**Checklist:**
- [ ] Alle KPI-Funktionen überprüfen
- [ ] getFinancialPeriodDate() verwenden
- [ ] Tests für Financial Period schreiben
- [ ] Reconciliation Report erstellen

---

## 🔒 PHASE 2: RLS & SECURITY (SOFORT)

### 2.1 RLS Audit Checklist

**Zu überprüfende Entities:**

```
CUSTOMER:
- [ ] Nur Advisor sieht eigene Kunden
- [ ] Team Lead sieht Team-Kunden
- [ ] Admin sieht alle

CONTRACT:
- [ ] Nur Advisor sieht eig. Verträge
- [ ] Team Lead sieht Team-Verträge
- [ ] Admin sieht alle

LEAD:
- [ ] Nur Advisor sieht eig. Leads
- [ ] Team Lead sieht Team-Leads
- [ ] Kein Cross-Access

OPPORTUNITY:
- [ ] Nur Advisor sieht eig. Opportunities
- [ ] Kein Visibility-Leak zu anderen Advisors

COMMISSION:
- [ ] Advisor sieht nur eig. Commissions
- [ ] Admin sieht alle
- [ ] ✅ Bereits gehärtet?

DOCUMENT:
- [ ] Zugriff kontrolliert nach Besitzer/Team
- [ ] Keine öffentlichen Dokumente ohne Autorisierung
```

### 2.2 API Security Härtung

```javascript
// PATTERN: Alle Backend-Funktionen müssen validieren

export async function myFunction(req) {
  const base44 = createClientFromRequest(req)
  const user = await base44.auth.me()
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Validiere Zugriff
  if (!canAccessEntity(user, requestedEntity)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. Validiere Input
  const errors = validateInput(data)
  if (errors.length > 0) {
    return Response.json({ error: 'Validation Error', details: errors }, { status: 400 })
  }

  // 3. Führe Operation durch
  const result = await base44.entities.Entity.update(id, data)

  // 4. Audit Log
  await auditLogWrite(user.email, 'update', 'Entity', id, result)

  return Response.json(result)
}
```

---

## 👥 PHASE 3: LEAD MANAGEMENT V2.0

### 3.1 Lead Entity Upgrade

**Zu ergänzen in `entities/Lead.json`:**

```json
{
  "name": "Lead",
  "properties": {
    // BESTEHEND (nicht ändern)
    "first_name": {"type": "string"},
    "last_name": {"type": "string"},
    "email": {"type": "string"},
    "source": {"type": "string"},
    
    // NEU: PIPELINE & SCORING
    "status": {
      "type": "string",
      "enum": ["new", "contacted", "qualified", "consulted", "offer", "negotiation", "won", "lost", "archived"],
      "default": "new"
    },
    "lead_score": {
      "type": "number",
      "minimum": 0,
      "maximum": 100,
      "default": 0,
      "description": "Lead scoring 0-100 (auto calculated)"
    },
    "stage_entered_at": {
      "type": "string",
      "format": "date-time",
      "description": "When entered current stage"
    },
    "assigned_to": {
      "type": "string",
      "description": "User/Advisor email"
    },
    "assigned_at": {
      "type": "string",
      "format": "date-time"
    },
    
    // NEU: SLA & TIMING
    "sla_target_contact_date": {
      "type": "string",
      "format": "date",
      "description": "Lead muss bis dahin kontaktiert sein"
    },
    "next_followup_date": {
      "type": "string",
      "format": "date",
      "description": "Nächstes Followup geplant"
    },
    "last_activity_date": {
      "type": "string",
      "format": "date-time"
    },
    "first_contact_date": {
      "type": "string",
      "format": "date-time"
    },
    "conversion_date": {
      "type": "string",
      "format": "date-time",
      "description": "Wann zu Customer konvertiert"
    },
    
    // NEU: VERLAUF
    "status_history": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "status": {"type": "string"},
          "changed_at": {"type": "string"},
          "changed_by": {"type": "string"}
        }
      }
    }
  }
}
```

### 3.2 Lead Automationen

**Neue Automationen in `functions/`:**

```
leadAging.js
├─ Trigger: Daily, 09:00
├─ Logic: Find Leads > 7 days uncontacted
└─ Action: Create Alert Task

slaViolationCheck.js
├─ Trigger: Daily, 08:00
├─ Logic: Find Leads mit überschrittenem SLA
└─ Action: Email Alert to Advisor + Escalate

leadFollowupReminder.js
├─ Trigger: Daily, 10:00
├─ Logic: Find Leads mit kommenden Followup
└─ Action: Email Reminder
```

---

## 💰 PHASE 4: OPPORTUNITIES V2.0

### 4.1 Opportunity Entity Update

**Erweitern in `entities/Verkaufschance.json`:**

```json
{
  "properties": {
    // EXISTING (keep)
    "title": {"type": "string"},
    "customer_id": {"type": "string"},
    
    // NEW: PIPELINE STAGES
    "stage": {
      "type": "string",
      "enum": ["initial|needs|proposal|negotiation|likely|won|lost"],
      "default": "initial"
    },
    "stage_entered_at": {
      "type": "string",
      "format": "date-time"
    },
    "stage_history": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "stage": {"type": "string"},
          "entered_at": {"type": "string"},
          "probability": {"type": "number"}
        }
      }
    },
    
    // NEW: PROBABILITY & FORECAST
    "probability": {
      "type": "number",
      "minimum": 0,
      "maximum": 100,
      "default": 10,
      "description": "Win probability (%)"
    },
    "expected_close_date": {
      "type": "string",
      "format": "date"
    },
    "close_date": {
      "type": "string",
      "format": "date",
      "description": "When actually closed (if won/lost)"
    },
    
    // NEW: OUTCOME
    "outcome": {
      "type": "string",
      "enum": ["won", "lost", "cancelled"],
      "description": "Final outcome"
    },
    "won_reason": {"type": "string"},
    "lost_reason": {"type": "string"},
    "lost_category": {
      "type": "string",
      "enum": ["price", "competitor", "no_decision", "budget", "other"]
    },
    
    // NEW: FINANCIAL ESTIMATE
    "estimated_courtage": {"type": "number"},
    "estimated_provision": {"type": "number"}
  }
}
```

---

## 📊 PHASE 5: SALES KPI & FORECAST

**Neue KPI-Funktionen in `lib/commissionEngine.js` oder neue Datei `lib/salesKPI.js`:**

```javascript
export function calcLeadConversionRate(leads, period) {
  const inPeriod = leads.filter(l => 
    filterByFinancialPeriod(l, period.start, period.end, 'lead')
  )
  const converted = inPeriod.filter(l => l.status === 'won' || l.converted_to_customer)
  return inPeriod.length > 0 ? (converted.length / inPeriod.length) * 100 : 0
}

export function calcOpportunityWinRate(opportunities, period) {
  const inPeriod = opportunities.filter(o => 
    filterByFinancialPeriod(o, period.start, period.end, 'opportunity')
  )
  const won = inPeriod.filter(o => o.outcome === 'won')
  return inPeriod.length > 0 ? (won.length / inPeriod.length) * 100 : 0
}

export function calcPipelineValue(opportunities) {
  const active = opportunities.filter(o => 
    ['initial', 'needs', 'proposal', 'negotiation', 'likely'].includes(o.stage)
  )
  return active.reduce((sum, o) => 
    sum + ((o.estimated_premium_yearly || 0) * (o.probability || 0) / 100), 0
  )
}

export function calcForecast(opportunities, months = 3) {
  const forecast = {}
  opportunities.forEach(o => {
    if (o.outcome === 'won' || ['likely'].includes(o.stage)) {
      const month = new Date(o.expected_close_date).toISOString().substring(0, 7)
      if (!forecast[month]) forecast[month] = 0
      forecast[month] += (o.estimated_courtage || 0) + (o.estimated_provision || 0)
    }
  })
  return forecast
}
```

---

## ✅ DELIVERY CHECKLIST

### Vor Go-Live:

```
TIER 1 – RELEASE BLOCKER:
- [ ] Financial Period 100% korrekt
- [ ] RLS vollständig gehärtet
- [ ] Keine Cross-Tenant-Leaks
- [ ] Lead Management funktioniert
- [ ] Opportunities funktionieren

TIER 2 – WICHTIG:
- [ ] Performance getestet (100k+ Records)
- [ ] Alle KPI korrekt
- [ ] Alle Automationen getestet
- [ ] Audit Trail vollständig

TIER 3 – NICE-TO-HAVE:
- [ ] Test Suite 80%+
- [ ] Documentation aktuell
- [ ] Mobile UX validiert
```

### Signoff Requirements:

```
✅ Technischer Lead: [Name]
   - Alle Tests grün
   - Performance OK
   - Sicherheit gehärtet

✅ Business Owner: [Name]
   - Lead Management OK
   - Opportunities OK
   - KPI korrekt

✅ Compliance: [Name]
   - RLS vollständig
   - Audit Trail OK
   - DSGVO konform
```

---

**Status:** ROADMAP FINAL  
**Start:** 2026-05-14  
**Ende:** 2026-05-28  
**Commitment:** Full Team