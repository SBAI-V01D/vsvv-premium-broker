# 🔒 Beraterstruktur & Kundenzuteilung – Safe Fix

**Stand:** Mai 2026  
**Ziel:** Korrekte Organisationshierarchie ohne bestehende Funktionalität zu brechen.

---

## 📋 Übersicht der Änderungen

### 1. **Entity-Felder ergänzt (NON-BREAKING)**

Alle bestehenden Felder bleiben unverändert. Es wurden nur neue Felder hinzugefügt:

#### **Customer Entity**
```json
{
  "organization_id": "string (PFLICHT)",
  "teamlead_id": "string (optional)",
  "advisor_id": "string (optional)"
}
```

#### **Application Entity**
```json
{
  "organization_id": "string (geerbt von Customer)",
  "advisor_id": "string (geerbt von Customer)"
}
```

#### **Contract Entity**
```json
{
  "organization_id": "string (geerbt von Customer)",
  "advisor_id": "string (geerbt von Customer)"
}
```

#### **Document Entity**
```json
{
  "customer_locked": "boolean (default: false - KI darf nicht überschreiben wenn true)"
}
```

---

## 🔐 Validierungsregeln (Enforcement)

### Regel 1: Organization ist PFLICHT
```javascript
if (!customer.organization_id) {
  return error('Organization ist erforderlich')
}
```

**Implementation:** `lib/advisorAssignment.js::validateOrganizationRequired()`

---

### Regel 2: Berater & Teamleiter aus gleicher Org
```javascript
if (advisor.organization_id !== customer.organization_id) {
  return error('Berater muss aus derselben Organisation sein')
}
```

**Implementation:** `lib/advisorAssignment.js::validateAdvisorAssignment()`

---

### Regel 3: Document.customer_locked blockiert KI-Überschreiben
```javascript
if (document.customer_locked === true && document.customer_id) {
  // KI darf NICHT setzen/ändern
  // User kann aber "Ändern" Button klicken um zu entsperren
}
```

**Implementation:** `components/documents/DocumentReviewPanel::runExtract()`

---

## 🧠 Auto-Zuweisung (Smart Defaults)

Wenn ein Kunde erstellt wird:

1. **Organization auswählen** (User)
2. **Teamleiter auto-finden** in dieser Org (auto, optional)
3. **Advisor optional** (User)

```javascript
const teamlead = advisors.find(a =>
  a.organization_id === customer.organization_id &&
  a.role === 'team_lead' &&
  a.status === 'active'
)
customer.teamlead_id = teamlead?.id || null
```

**Implementation:** `lib/advisorAssignment.js::autoFindTeamlead()`

---

## 📊 Datenfluss: Dokument → Antrag → Police

### Datenfluss (Safe)
```
Document.customer_id
    ↓
Application.customer_id = Document.customer_id
Application.organization_id = Customer.organization_id
Application.advisor_id = Customer.advisor_id
    ↓
Contract.customer_id = Application.customer_id
Contract.organization_id = Application.organization_id
Contract.advisor_id = Application.advisor_id
```

**WICHTIG:** Keine anderen Quellen verwenden.

---

## 🛡️ Customer-Lock Mechanismus

### Was ist Customer Lock?

Wenn ein User manuell einen Kunden einem Dokument zuordnet:

1. **Backend Speicherung:** `Document.customer_id` + `Document.customer_locked = true`
2. **KI-Schutz:** Beim nächsten Scan respektiert die KI den Lock
3. **User-Kontrolle:** "Ändern" Button entsperrt den Lock nur bei User-Aktion

### Wo wird Lock Gesetzt?

```javascript
// DocumentReviewPanel.jsx
await base44.entities.Document.update(document.id, {
  customer_id: c.id,
  customer_name: `${c.first_name} ${c.last_name}`,
  customer_locked: true  // ← CRITICAL
})
```

### Wo wird Lock Geprüft?

```javascript
// DocumentReviewPanel.jsx :: runExtract()
if (document?.customer_locked === true && document?.customer_id) {
  // KI überschreibt NICHT
  const lockedCustomer = customers.find(c => c.id === document.customer_id)
  setCustomerLocked(true)
}
```

---

## 🎯 UI-Komponenten

### OrganizationAdvisorSection
**Datei:** `components/customers/OrganizationAdvisorSection.jsx`

Neue Komponente für Customer Form:
- **Organization Dropdown** (PFLICHT, mit Validierung)
- **Teamlead Dropdown** (optional, nur aus gleicher Org)
- **Advisor Dropdown** (optional, nur aus gleicher Org)
- **Fehler-Badges** wenn Zuordnung nicht passt

**Verwendung:**
```jsx
<OrganizationAdvisorSection
  formData={form}
  onFormChange={setForm}
  organizations={organizations}
  advisors={advisors}
/>
```

---

## 📚 Lib-Funktionen

**Datei:** `lib/advisorAssignment.js`

### `validateOrganizationRequired(organizationId)`
Validiert dass Organization gesetzt ist.
```javascript
const result = validateOrganizationRequired(customer.organization_id)
if (!result.valid) console.error(result.error)
```

### `validateAdvisorAssignment(customerId, advisorId, organizationId, advisors)`
Validiert dass Advisor zur gleichen Org gehört.
```javascript
const result = await validateAdvisorAssignment(
  customer.id,
  advisor.id,
  customer.organization_id,
  allAdvisors
)
if (!result.valid) return error(result.error)
```

### `autoFindTeamlead(organizationId, advisors)`
Findet automatisch Teamleiter in Org.
```javascript
const teamleadId = autoFindTeamlead(customer.organization_id, allAdvisors)
customer.teamlead_id = teamleadId
```

### `validateSameOrganization(org1Id, org2Id)`
Validiert dass zwei Advisors aus gleicher Org sind.
```javascript
const result = validateSameOrganization(
  advisor.organization_id,
  teamlead.organization_id
)
```

---

## 🧪 Test-Szenarien

### ✅ Scenario 1: Customer mit korrekter Org erstellen
```javascript
// User wählt Organization "VSV Management"
// System auto-setzt Teamlead aus dieser Org
// ✓ Validierung passt
```

### ✅ Scenario 2: Manuell Kunden einem Dokument zuordnen
```javascript
// User öffnet Dokument
// User klickt "Kunde ändern"
// User wählt Kunde aus Liste
// System setzt Document.customer_locked = true
// Beim nächsten Scan: KI respektiert Lock
// ✓ Kunde wird nicht überschrieben
```

### ✅ Scenario 3: Antrag erben Organization vom Kunde
```javascript
// Customer hat organization_id = "org-123"
// User erstellt Application
// System setzt Application.organization_id = "org-123" (geerbt)
// System setzt Application.advisor_id = customer.advisor_id (geerbt)
// ✓ Hierarchie stimmt
```

### ❌ Scenario 4: Advisor aus falscher Org zuordnen
```javascript
// Customer.organization_id = "org-123" (VSV)
// User versucht Advisor aus "org-456" (Andere Org) zuordnen
// Validierung schlägt fehl:
// "Berater gehört zu Organization org-456, aber Kunde zu org-123"
// ✓ System blockiert ungültige Zuordnung
```

---

## 🚀 Deployment-Checkliste

- [x] Entity Schemas aktualisiert (Customer, Application, Contract, Document)
- [x] `lib/advisorAssignment.js` erstellt (Validierungs-Logik)
- [x] `components/customers/OrganizationAdvisorSection.jsx` erstellt (UI)
- [x] `DocumentReviewPanel` aktualisiert (customer_locked respektieren)
- [ ] CustomerForm aktualisiert (OrganizationAdvisorSection einbinden)
- [ ] ApplicationForm aktualisiert (Organization-Validierung)
- [ ] Benutzer-Kommunikation: "Organization ist jetzt erforderlich"

---

## ⚠️ WICHTIG: Bestehende Daten

### Was passiert mit Kunden ohne organization_id?

**Empfehlung:** Data Migration Script
```javascript
// Alle Kunden ohne organization_id erhalten Default-Org
const defaultOrg = organizations.find(o => o.name === 'Default')
const customersWithoutOrg = customers.filter(c => !c.organization_id)
customersWithoutOrg.forEach(c => {
  c.organization_id = defaultOrg.id
  // save
})
```

---

## 📞 Fragen & Support

Bei Fragen zu dieser Safe-Fix Implementation:
- Lese diese Dokumentation
- Prüfe `lib/advisorAssignment.js` für Validierungs-Logic
- Prüfe `components/customers/OrganizationAdvisorSection.jsx` für UI-Patterns