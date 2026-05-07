# AUSFÜHRUNGSANLEITUNG: CUSTOMER RECOVERY

**Datum:** 2026-05-07
**Status:** POST-REKONSTRUKTION — Sichtbarkeitsfixing

---

## SCHNELLSTART

Verwende `CustomerRecoveryDashboard` (Admin-Seite):

```
GET /admin/recovery
```

Oder manuelle Ausführung:

---

## SCHRITT 1: SCAN RELATIONS (bereits erledigt?)

```javascript
const report = await base44.functions.invoke(
  'reconstructCustomersFromRelations', 
  {}
);
console.log(report.data.summary);
// → Zeigt: X missing customers, Y contracts, Z applications
```

**Output speichern für Schritt 2.**

---

## SCHRITT 2: REKONSTRUIERE KUNDEN (bereits erledigt?)

```javascript
const result = await base44.functions.invoke(
  'reconstructAndRestoreCustomers',
  { reconstruction_report: report.data }
);
console.log(`✓ ${result.data.summary.successfully_created} customers restored`);
```

---

## SCHRITT 3: DIAGNOSE VISIBILITY (JETZT HIER)

```javascript
const diagnosis = await base44.functions.invoke(
  'diagnoseCustomerVisibility',
  {}
);
console.log(diagnosis.data.summary);
// → Zeigt: Wie viele Kunden sind hidden/archived?
```

**Wichtig:** Dies zeigt ob Kunden existieren aber nicht sichtbar sind.

---

## SCHRITT 4: ERZWINGE VISIBILITY (wenn Schritt 3 Probleme zeigt)

```javascript
const invisibleCustomers = diagnosis.data.visibility_issues.potentially_hidden_details;

const fix = await base44.functions.invoke(
  'forceCustomerVisibility',
  { target_customers: invisibleCustomers }
);
console.log(`✓ ${fix.data.summary.successfully_updated} customers fixed`);
```

---

## SCHRITT 5: VERIFIZIERE INTEGRITÄT

```javascript
const validation = await base44.functions.invoke(
  'validateSystemIntegrity',
  {}
);
console.log(validation.data.integrity_check);
// → "PASSED ✓" oder "FAILED ✗"
```

---

## DIAGNOSE CHECKLIST

**Führe aus, wenn Kunden immer noch nicht sichtbar sind:**

```javascript
// 1. Check ob Kunden überhaupt existieren
const customers = await base44.entities.Customer.list('-created_date', 50);
console.log(`Database: ${customers.length} customers`);

// 2. Check reconstructed pattern
const reconstructed = customers.filter(c => 
  c.email?.includes('@reconstructed.local')
);
console.log(`Reconstructed: ${reconstructed.length} customers`);

// 3. Check archived state
const archived = customers.filter(c => c.archived === true);
console.log(`Archived: ${archived.length} customers`);

// 4. Check organization assignment
const noOrg = customers.filter(c => !c.organization_id);
console.log(`Missing org: ${noOrg.length} customers`);

// 5. Check status
const inactive = customers.filter(c => c.status !== 'active');
console.log(`Inactive: ${inactive.length} customers`);
```

---

## WENN KUNDEN IMMERNOCH NICHT SICHTBAR SIND

### Option A: Frontend Cache leeren
```javascript
// Im Browser Console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Option B: Query Filter überprüfen
Überprüfen Sie `pages/Customers.jsx`:

```javascript
// Achten Sie auf Filter wie:
// .filter(c => c.archived !== true)
// .filter(c => c.status === 'active')
// .filter(c => c.organization_id)
// .filter(c => c.imported)

// Entfernen Sie restriktive Filter
```

### Option C: React Query Cache leeren
```javascript
const queryClient = useQueryClient();
queryClient.invalidateQueries({ queryKey: ['customers'] });
```

---

## HÄUFIGE PROBLEME

| Problem | Ursache | Lösung |
|---------|--------|--------|
| Kunden existieren aber nicht sichtbar | archived=true oder status!=active | forceCustomerVisibility ausführen |
| Reconstructed email (@reconstructed.local) | Temp-Email während Rekonstruktion | forceCustomerVisibility ändert zu @restored.local |
| Missing organization_id | Keine Org zugewiesen | forceCustomerVisibility weist default org zu |
| Verträge zeigen Kunden nicht an | Frontend-Filter zu restriktiv | Siehe Option B oben |
| Customer 360 lädt nicht | Relationen sind broken | validateSystemIntegrity ausführen |

---

## ERFOLGS-KRITERIEN

✅ **Recovery erfolgreich wenn:**
- [ ] `diagnoseCustomerVisibility` zeigt 0 potentially_hidden
- [ ] `validateSystemIntegrity` zeigt "PASSED ✓"
- [ ] Alle Kunden im Dashboard sichtbar
- [ ] Customer 360 funktioniert
- [ ] Verträge/Anträge korrekt verlinkt

---

## ROLLBACK-PLAN (falls alles schiefgeht)

Kontaktieren Sie Base44 Support:
- support@base44.com
- "Database restore to pre-import state required"
- Backup-Timestamp: vor 2026-05-07 20:00 UTC