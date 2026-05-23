# AI Review Center — Truth Layer & Data Integrity

## KRITISCHE SYSTEMPRINZIPIEN

### 1. KEINE autonomen Änderungen
- **NIEMALS** selbständig Daten ändern
- **NIEMALS** Prozesse anpassen
- **NIEMALS** Status verändern
- **NIEMALS** Beziehungen reparieren
- **IMMER** vorher explizite Admin-Freigabe einholen

### 2. AI ist beratend, nicht autoritativ
Die KI darf:
- ✅ analysieren
- ✅ prüfen
- ✅ Risiken erkennen
- ✅ Verbesserungsvorschläge machen
- ✅ Datenprobleme identifizieren

Die KI darf NICHT:
- ❌ selbständig produktive Änderungen ausführen
- ❌ stille Optimierungen durchführen
- ❌ implizite Anpassungen vornehmen

---

## TRUTH LAYER — Jede Statistik muss nachvollziehbar sein

### Dokumentationspflicht für JEDE Zahl

Für jede Statistik muss ersichtlich sein:

```json
{
  "truth_layer": {
    "query_source": "Customer.filter({ archived: false })",
    "filter_applied": "mandate_status IN [pending, expired, invalid]",
    "exclusion_rules": ["archived = true"],
    "data_timestamp": "2026-05-23T10:30:00.000Z",
    "total_records_scanned": 234,
    "matching_records": 18
  }
}
```

### Felder des Truth Layer

| Feld | Beschreibung |
|------|-------------|
| `query_source` | Welche Query wurde ausgeführt? |
| `filter_applied` | Welche Filter wurden angewendet? |
| `exclusion_rules` | Welche Datensätze wurden ausgeschlossen? |
| `data_timestamp` | Wann wurden die Daten geladen? |
| `total_records_scanned` | Wie viele Datensätze wurden geprüft? |
| `matching_records` | Wie viele Datensätze matchen die Kriterien? |

---

## ENTITY LINEAGE — Vollständige Rückverfolgbarkeit

### Jede betroffene Entität muss dokumentieren:

```json
{
  "type": "customer",
  "id": "cust_123",
  "name": "Max Mustermann",
  "detail": "Mandat: expired · Status: active · Typ: private",
  "link": "/kunden/cust_123",
  "process_status": "task_in_progress",
  "has_open_task": true,
  "data_validity": "verified",
  "validation_reason": "Mandat-Status 'expired' ist in [pending, expired, invalid]"
}
```

### Pflichtfelder für Entity Lineage

| Feld | Beschreibung |
|------|-------------|
| `type` | Entitätstyp (customer, contract, task, etc.) |
| `id` | Eindeutige ID der Entität |
| `name` | Lesbarer Name |
| `detail` | Kontext-Information (Status, Werte, etc.) |
| `link` | Direktlink zur Entität |
| `process_status` | Läuft bereits ein Prozess? |
| `has_open_task` | Existiert eine offene Aufgabe? |
| `data_validity` | `verified` | `partially_verified` | `incomplete` |
| `validation_reason` | Warum erscheint diese Entität hier? |

---

## PROCESS AWARENESS — Kontext vor Finding

### Prozess-Status Prüfung

BEVOR ein Finding erstellt wird, muss geprüft werden:

1. **Laufende Prozesse**
   - Existiert eine offene Task?
   - Läuft eine Opportunity?
   - Existiert ein Dossier?
   - Wurde bereits ein Dokument angefordert?

2. **Prozess-Historie**
   - Wurde das Problem bereits bearbeitet?
   - Gibt es eine abgeschlossene Task?
   - Existiert eine Notiz?

3. **Status-Konsistenz**
   - Ist der Kunde aktiv?
   - Ist der Vertrag gültig?
   - Ist der Datensatz vollständig?

### Process Status Werte

```typescript
type ProcessStatus =
  | 'multiple_processes_running'  // Task + Opportunity aktiv
  | 'task_in_progress'            // Task offen
  | 'opportunity_in_progress'     // Opportunity offen
  | 'dossier_in_progress'         // Dossier wird bearbeitet
  | 'documented'                  // Dokumente vorhanden
  | 'no_process_running';         // Kein Prozess aktiv
```

---

## DATA VALIDATION — Validierung jeder Datenquelle

### Validierungsstufen

| Stufe | Beschreibung | Aktion |
|-------|-------------|--------|
| `verified` | Alle Daten vollständig und konsistent | Finding kann erstellt werden |
| `partially_verified` | Einige Daten fehlen, aber Kern-Information ist da | Finding mit Warnung |
| `incomplete` | Kritische Daten fehlen | Kein Finding, manuelle Prüfung erforderlich |

### Validierungs-Checkliste

Für JEDES Finding muss geprüft werden:

- [ ] Welche konkreten Kunden sind betroffen?
- [ ] Welche Verträge sind involviert?
- [ ] Welche Dokumente existieren?
- [ ] Welche Haushalte sind betroffen?
- [ ] Welche Aufgaben laufen bereits?
- [ ] Welche Opportunities existieren?
- [ ] Welche Relationen sind relevant?
- [ ] Welche Datenquelle wurde verwendet?
- [ ] Welche Statuslogik wurde angewendet?
- [ ] Welche Ausschlussregeln gelten?
- [ ] Welche Prozesse laufen bereits?
- [ ] Ist der Kunde aktiv?
- [ ] Ist der Vertrag gültig?
- [ ] Ist der Datensatz vollständig?
- [ ] Ist die Verknüpfung korrekt?

---

## FINDING QUALITÄTSSTANDARDS

### Jedes Finding MUSS enthalten:

1. **Betroffene Entitäten** (mit Entity Lineage)
   - Kunde, Vertrag, Dokument, Household, Opportunity, Aufgabe

2. **Prozessstatus** (mit Process Awareness)
   - offen, in Bearbeitung, Renewal läuft, bereits erledigt

3. **Datenvalidität** (mit Data Validation)
   - verifiziert, teilweise verifiziert, unvollständige Datenbasis

4. **Business Impact**
   - Umsatzrisiko, Compliance-Risiko, Renewal-Risiko

5. **QuickActions**
   - öffnen, bearbeiten, Aufgabe erstellen, etc.

6. **Truth Layer**
   - Query, Filter, Relationen, Ausschlusslogik

7. **Why This Number**
   - Vollständige Erklärung der Statistik

### Beispiel: Komplettes Finding

```json
{
  "id": "COMP-001",
  "area": "operative_risiken",
  "severity": "critical",
  "title": "Kunden ohne gültiges Mandat (18 Fälle)",
  "explanation": "18 Kunden haben Mandat-Status 'pending', 'expired' oder 'invalid'",
  "business_impact": "Beratungen ohne gültiges Mandat sind rechtlich nicht abgesichert.",
  
  "truth_layer": {
    "query_source": "Customer.filter({ archived: false })",
    "filter_applied": "mandate_status IN [pending, expired, invalid]",
    "exclusion_rules": ["archived = true"],
    "data_timestamp": "2026-05-23T10:30:00.000Z",
    "total_records_scanned": 234,
    "matching_records": 18
  },
  
  "affected_entities": [
    {
      "type": "customer",
      "id": "cust_123",
      "name": "Max Mustermann",
      "detail": "Mandat: expired · Status: active",
      "link": "/kunden/cust_123",
      "process_status": "no_process_running",
      "data_validity": "verified",
      "validation_reason": "Mandat-Status 'expired' ist in [pending, expired, invalid]"
    }
  ],
  
  "recommendation": "Mandate für alle betroffenen Kunden umgehend prüfen.",
  "quick_actions": [
    { "type": "open_customer", "label": "Kunde öffnen", "link": "/kunden/cust_123" },
    { "type": "create_task", "label": "Task erstellen", "link": "/aufgaben" }
  ],
  
  "why_this_number": "Von 234 Kunden (ohne Archivierte) haben 18 ein Mandat-Problem.",
  "why_ai_suggests": "Mandat-Status ist 'expired' — Compliance-kritisches Risiko."
}
```

---

## ADMIN KONTROLLE

### Jede Änderung benötigt:

1. **Analyse** — Was ist das Problem?
2. **Erklärung** — Warum ist es ein Problem?
3. **Risikoabschätzung** — Was sind die Konsequenzen?
4. **Rückfrage** — Admin-Freigabe einholen
5. **Explizite Freigabe** — Admin bestätigt Änderung

### Protokollierung

Jede Analyse wird protokolliert in `AiReview` Entity mit:
- `reviewed_at` — Zeitpunkt der Analyse
- `reviewed_by` — Name des Admins
- `level` — Review-Level (quick, operational, enterprise)
- `findings` — Alle Findings mit Truth Layer
- `finding_count` — Gesamtzahl Findings
- `critical_count` — Kritische Findings
- `warning_count` — Warnungen
- `opportunity_count` — Potenziale

---

## ZUSAMMENFASSUNG

Das AI Review Center ist:

✅ **Ein intelligenter Broker-Operations-Prüfer**

NICHT:

❌ Ein Statistikgenerator  
❌ Ein Management-Dashboard  
❌ Ein AI-Showcase  
❌ Ein Chatbot  

MIT:

✅ Vollständiger Datenintegrität  
✅ Nachvollziehbarer AI  
✅ Kontrollierten Prozessen  
✅ Revisionsfähiger Entscheidungslogik  
✅ **Vollständiger Kontrolle durch den Admin**