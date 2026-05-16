# Setup: Automationen für Auto-Provision Workflow

**Datum:** 2026-05-16  
**Status:** Deployment-ready

---

## 🔄 Automation 1: Auto-Provision bei Vertragsaktivierung

**Bestehend - AKTIV**

| Feld | Wert |
|------|------|
| Name | Auto Provision on Active Contract |
| Type | entity (Contract) |
| Event | update |
| Trigger Condition | `data.status = "active"` AND `changed_fields contains "status"` |
| Function | `createAutomaticProvisionOnActiveContract` |
| Status | ✅ Aktiv |

**Trigger-Flow:**
```
Contract-Update
  ↓
changed_fields hat "status"?
  ↓
old_status != "active" && new_status = "active"?
  ↓
customer_id + organization_id vorhanden?
  ↓
Kunde nicht archived?
  ↓
cancel_date NOT gesetzt?
  ↓
Keine offene Provision für policy_id existiert?
  ↓
✅ Provision erstellen
```

---

## 🔄 Automation 2: Storno bei Vertragsauflösung

**NEU - MUSS HINZUGEFÜGT WERDEN**

```json
{
  "automation_type": "entity",
  "name": "Auto Storno on Contract Cancellation",
  "function_name": "handleStornoOfAutomaticProvision",
  "entity_name": "Contract",
  "event_types": ["update"],
  "trigger_conditions": {
    "logic": "and",
    "conditions": [
      {
        "field": "changed_fields",
        "operator": "contains",
        "value": "cancel_date"
      },
      {
        "field": "old_data.cancel_date",
        "operator": "is_empty"
      },
      {
        "field": "data.cancel_date",
        "operator": "is_not_empty"
      }
    ]
  },
  "description": "Erstellt automatisch Storno-Provisionen wenn Vertrag mit offener Auto-Provision storniert wird"
}
```

**Trigger-Flow:**
```
Contract-Update
  ↓
changed_fields hat "cancel_date"?
  ↓
old cancel_date war leer, new cancel_date nicht?
  ↓
Finde alle offenen Auto-Provisionen für policy_id
  ↓
Für jede Provision:
  ↓
  Erstelle Storno-Eintrag mit:
  - is_storno = true
  - storno_reference_id = original_id
  - provision_status = 'cancelled'
  - storno_grund = "Automatische Storno: Vertrag storniert"
  ↓
✅ Storno-Provision erstellt + Audit-Log
```

---

## 🔄 Automation 3: Guard gegen Vertragsänderungen

**OPTIONAL - FÜR ZUKÜNFTIGE IMPLEMENTIERUNG**

```json
{
  "automation_type": "entity",
  "name": "Audit Contract Changes with Open Provisions",
  "function_name": "auditContractChangesWithOpenProvisions",
  "entity_name": "Contract",
  "event_types": ["update"],
  "trigger_conditions": {
    "logic": "and",
    "conditions": [
      {
        "field": "changed_fields",
        "operator": "contains",
        "value": "insurer"
      },
      {
        "field": "changed_fields",
        "operator": "contains",
        "value": "sparte"
      }
    ]
  },
  "description": "Warnt wenn Gesellschaft/Produkt geändert wird, während offene Provision existiert"
}
```

**Logik (zukünftig):**
```
Contract-Update (insurer ODER sparte geändert)
  ↓
Existiert offene Provision für policy_id?
  ↓
JA: Audit-Log + Notiz auf Provision
  → "Vertrag geändert: Allianz→AXA, KVG→VVG (Provision: ...)"
  ↓
NEIN: Kein Action
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] `handleStornoOfAutomaticProvision` Function deployed
- [ ] Duplikat-schutz in `createAutomaticProvisionOnActiveContract` aktualisiert (✅ done)
- [ ] Test-Cases aus `AUTO_PROVISION_EDGE_CASE_TESTS.md` durchlaufen

### Deployment
- [ ] Automation 2 erstellen (Storno bei cancel_date)
- [ ] Automation 1 prüfen (sollte aktiv sein)
- [ ] Audit-Logs konfigurieren
- [ ] CSV-Export Template aktualisieren (Auto-Badge anzeigen)

### Post-Deployment (Monitoring)
- [ ] Audit-Log auf Fehler monitoren
- [ ] KPI-Berechnungen prüfen (keine Duplikate in expected_income)
- [ ] 5 Verträge manuell testen: activate → storno → reactivate
- [ ] Dashboard-KPI auf Korrektheit prüfen

---

## 🚨 Fehlerszenarien & Fallback

### Szenario 1: Storno-Funktion fehlgeschlagen
**Fehler:** `handleStornoOfAutomaticProvision` lässt Exception werfen

**Fallback:** 
```
1. Automation wird disabled (platform standard)
2. Audit-Log zeigt Fehler
3. Storno wird NICHT erstellt
4. Provision bleibt "offen" 

ACTION: Admin prüft Error + ReactiveContractChanges
```

**Lösung:**
- Die Provision wird **nicht gelöscht**, bleibt als Audit-Trail
- Manuelle Storno kann später erstellt werden
- **Keine Datenverluste**

---

### Szenario 2: Duplikat trotz Guard
**Fehler:** 2 Provisionen für gleiche policy_id + provision_status

**Ursache:** 
- Gleichzeitige Aktivierungen? (Race Condition)
- Filter-Bug?

**Fallback:**
```
1. CommissionKPIBar erkennt Duplikat
2. CSV-Export zeigt beide
3. User manuell auf "Archivieren" klicken
```

**Prevention:**
```
OPTION A: Database Unique Constraint
  UNIQUE(policy_id, provision_status, created_automatically)
  
OPTION B: Application-Level Lock
  redis.lock("provision:${policy_id}")
```

---

## 🎯 Success Metrics (Post-Deployment)

| Metrik | Baseline | Ziel | Messung |
|--------|----------|------|---------|
| Auto-Provisionen pro Woche | 0 | 5–15 | count(created_automatically=true) |
| Fehlerrate | 0 | <1% | count(automation errors) / total triggers |
| Storno-Abdeckung | 0 | >95% | stornos_created / stornos_expected |
| Audit-Trail Vollständigkeit | N/A | 100% | count(audit logs) / count(provisions) |
| User-Klarheit (Auto-Badge) | N/A | 100% | Survey: "Erkennen Sie Auto-Provisionen?" |

---

## 📞 Support Runbook

### Frage: "Warum wurde diese Provision automatisch erstellt?"
**Antwort:**
> Der zugehörige Vertrag wurde aktiviert. Zur Vermeidung manueller Fehler erstellt das System automatisch eine offene Provisionsbuchung, damit Sie diese ergänzen können. Sie erkennen Auto-Provisionen am grünen **⚡ Auto**-Badge.

### Frage: "Kann ich die Auto-Provision ändern?"
**Antwort:**
> Ja, vollständig. Sie können Beträge, Berater-%, Status ändern wie bei manuellen Provisionen. Das System blockiert nichts.

### Frage: "Was passiert wenn ich den Vertrag storniere?"
**Antwort:**
> Das System erstellt automatisch eine Storno-Provision zur Audit-Sicherheit. Beide (Original + Storno) bleiben sichtbar mit eindeutiger Referenz.

### Frage: "Zählen Auto-Provisionen zu meinem Advisor-KPI?"
**Antwort:**
> Nein. Sie sehen offene Provisionen im Dashboard, aber die finalen KPIs basieren auf **erteilten Provisionen**, nicht erwarteten.

---

## 🔐 Security & Compliance

### Data Integrity
- ✅ Duplikatschutz: policy_id + is_storno Filter
- ✅ Storno-Audit: storno_reference_id + audit_log
- ✅ Customer-Lock: Wird nicht geändert nach Erstellung

### Audit Trail
- ✅ Jede Auto-Provision: `created_automatically = true`
- ✅ Jede Storno: `storno_reference_id` → Original
- ✅ Jede Aktion: AuditLog.entity_type = 'commission'

### Rollback
- ✅ Automation off: Keine neuen Auto-Provisionen
- ✅ Bestehendes: Bleibt als-ist mit Markierung
- ✅ Restore: Full backup verfügbar