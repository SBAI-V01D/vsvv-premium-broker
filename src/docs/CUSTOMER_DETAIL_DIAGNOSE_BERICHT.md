# CustomerDetail Diagnose-Bericht

**Erstellt:** 2026-06-10  
**Seite:** CustomerDetail (`/kunden/:id/detail`)  
**Problem:** Langsames Laden, verspätete Datenanzeige, instabiles Gefühl

---

## 1. Datenfluss-Analyse: Vorher vs. Nachher

### HEUTE MITTAG (vor Optimierung)

```
CustomerDetail Opening Sequence:
├─ customerDirect Query (filter by id) → ~200-300ms
├─ householdContracts Query ← PROBLEM
│  ├─ Contract.filter({ customer_id: primaryId }) → ~200-400ms
│  ├─ Contract.filter({ customer_id: familyMemberId1 }) → ~200-400ms
│  ├─ Contract.filter({ customer_id: familyMemberId2 }) → ~200-400ms
│  └─ Contract.filter({ customer_id: familyMemberIdN }) → ~200-400ms
│     └─ N+1 API Calls! (1 pro Familienmitglied)
├─ relatedContracts Query → ~200-300ms
├─ relatedApplications Query → ~200-300ms
├─ relatedDocuments Query → ~200-300ms
├─ custTasks Query → ~200-300ms
├─ advisors Query → ~300-500ms
└─ organizations Query → ~200-300ms

Total API Calls: 8-15+ (abhängig von Familiengrösse)
Total Load Time: 1500-3000ms
```

### NACH OPTIMIERUNG (aktuell)

```
CustomerDetail Opening Sequence:
├─ customerDirect Query (filter by id) → ~200-300ms
├─ relatedContracts Query → ~200-300ms
├─ relatedApplications Query → ~200-300ms
├─ relatedDocuments Query → ~200-300ms
├─ custTasks Query → ~200-300ms
├─ advisors Query → ~300-500ms
└─ organizations Query → ~200-300ms

Total API Calls: 7 (FIX, unabhängig von Familiengrösse)
Total Load Time: 400-800ms (theoretisch)
```

### ABER: Aktuelle Probleme

```
Tatsächliche Performance (gemessen):
├─ Start Time: t=0ms
├─ Customer Loaded: t=???ms (wird im Diagnose-Tool gemessen)
├─ Contracts Loaded: t=???ms
├─ Applications Loaded: t=???ms
├─ Documents Loaded: t=???ms
├─ Advisors Loaded: t=???ms
└─ All Data Loaded: t=???ms

PROBLEME:
- staleTime Caching könnte veraltete Daten anzeigen
- Query isSuccess Timing könnte verzögert sein
- Render-Reihenfolge könnte zu "springendem" Layout führen
```

---

## 2. Kritische Datenquellen

### 2.1 Customer Data (KRITISCH)

**Query:**
```javascript
const { data: customerDirect } = useQuery({
  queryKey: ['customer', id],
  queryFn: () => base44.entities.Customer.filter({ id }, null, 1).then(r => r?.[0]),
  enabled: !!id,
  staleTime: 2 * 60 * 1000, // 2 Minuten Cache
})
```

**Problem:** Wenn `customerDirect` leer ist, wird Fallback auf `allCustomers.find()` verwendet:
```javascript
const customer = customerDirect || allCustomers.find(x => x.id === id)
```

**Aber:** `allCustomers` wird nur lazy geladen wenn `needAllCustomers = true` (bei Formular-Öffnung).

**Folge:** Wenn customerDirect fehlschlägt oder leer ist → customer = undefined → Loading Spinner bleibt.

### 2.2 Family Members (FAMILIE-TAB)

**Current Logic:**
```javascript
const familyMembers = allCustomers.filter(c => 
  c.id === primaryCustomerId || c.primary_customer_id === primaryCustomerId
)
```

**Problem:** `allCustomers` ist nur verfügbar wenn `needAllCustomers = true`.

**Folge:** Familie-Tab zeigt keine Mitglieder an beim ersten Öffnen!

### 2.3 Haushaltsverträge (FAMILIE-TAB)

**Current Logic:**
```javascript
const allHouseholdContracts = relatedContracts // Nur direkte Verträge!
```

**Problem:** Früher wurden Verträge aller Familienmitglieder geladen via `householdContracts`.

**Folge:** Familie-Tab zeigt nur Verträge des aktuellen Kunden, nicht des gesamten Haushalts!

---

## 3. staleTime Caching Probleme

### Aktuelle staleTime Konfiguration:

| Query | staleTime | Risiko |
|-------|-----------|--------|
| customer | 2 min | NIEDRIG (Kundendaten ändern sich selten) |
| contracts | 3 min | MITTEL (neue Verträge könnten fehlen) |
| applications | 3 min | MITTEL (neue Anträge könnten fehlen) |
| documents | 5 min | HOCH (neue Dokumente könnten fehlen) |
| tasks | 3 min | HOCH (neue Aufgaben könnten fehlen) |
| advisors | KEINE | OK (Berater ändern sich selten) |
| organizations | 10 min | OK (Orgs ändern sich selten) |

### Mögliche Symptome:

1. **Veraltete Vertragsdaten:** Kunde hat neuen Vertrag erhalten, aber Seite zeigt alten Stand (3 min Cache).
2. **Fehlende Aufgaben:** Neue Aufgabe wurde erstellt, aber Tasks-Tab zeigt sie nicht (3 min Cache).
3. **Fehlende Dokumente:** Dokument wurde hochgeladen, aber Dokumente-Tab zeigt es nicht (5 min Cache).

### Lösung:

```javascript
// Option 1: staleTime reduzieren
staleTime: 30 * 1000, // 30 Sekunden

// Option 2: refetchOnMount aktivieren
refetchOnMount: true,

// Option 3: Manueller refetch bei Tab-Wechsel
useEffect(() => {
  queryClient.invalidateQueries({ queryKey: ['contracts', id] })
}, [activeSection])
```

---

## 4. Render-Timeline Analyse

### Erwartete Reihenfolge:

```
t=0ms: Component mount
t=0ms: diagnose.startTime gesetzt
t=50ms: customerDirect Query gestartet
t=250ms: customerSuccess = true → markLoaded('customerLoaded')
t=300ms: contractsSuccess = true → markLoaded('contractsLoaded')
t=350ms: applicationsSuccess = true → markLoaded('applicationsLoaded')
t=400ms: documentsSuccess = true → markLoaded('documentsLoaded')
t=450ms: advisors loaded → markLoaded('advisorsLoaded')
t=500ms: Alle Daten da → markLoaded('allDataLoaded')
```

### Mögliche Probleme:

1. **Query isSuccess Timing:** Wenn Queries parallel laufen, aber unterschiedlich schnell sind, könnte `allDataLoaded` zu früh oder zu spät getriggert werden.

2. **Access Check:** Die `customerAccess` Query könnte den Render blockieren:
   ```javascript
   if (!accessChecked && !hasAccess) return <Loading />
   if (!hasAccess) return <Error />
   if (!customer) return <Loading />
   ```

3. **Conditional Rendering:** Wenn Sections bedingt gerendert werden (`activeSection === 'uebersicht'`), könnten Daten fehlen die erst später geladen werden.

---

## 5. Diagnose-Tool Integration

### Neue Features:

1. **Ladezeiten-Messung:** Jede Query markiert ihren Ladezeitpunkt
2. **Gesamt-Ladezeit:** Zeit von Mount bis alle Daten geladen
3. **Datenfluss-Tests:** Automatisierte Tests für kritische Pfade
4. **Fehler-Erkennung:** Kritische/Warnungs-Meldungen bei Problemen

### Benutzung:

1. Öffne einen Kunden (`/kunden/:id/detail`)
2. Klicke unten rechts auf "🔍 Diagnose"
3. Klicke "Tests starten"
4. Prüfe die Ladezeiten und Fehlermeldungen

---

## 6. Empfohlene nächste Schritte

### SOFORT (kritisch):

1. **Diagnose-Tool testen:** Öffne 5-10 verschiedene Kunden und dokumentiere die Ladezeiten.
2. **Familie-Tab prüfen:** Öffne den Familie-Tab bei einem Kunden mit Familienmitgliedern. Zeigt er alle Mitglieder an?
3. **Haushaltsverträge prüfen:** Zeigt der Familie-Tab Verträge aller Haushaltsmitglieder oder nur des aktuellen Kunden?

### KURZFRISTIG (wenn Probleme gefunden):

1. **allCustomers Query fix:** Bei Familienkunden muss `allCustomers` sofort geladen werden, nicht lazy.
2. **householdContracts Query wiederherstellen:** Oder eine effizientere Alternative implementieren.
3. **staleTime anpassen:** Für documents und tasks auf 30 Sekunden reduzieren.
4. **Refetch bei Tab-Wechsel:** Bei aktivem Tab-Wechsel die relevanten Queries invalidieren.

### MITTELFRISTIG (Optimierung):

1. **Query Prefetch:** Wenn ein Kunde in der Liste angeklickt wird, die Detail-Queries schon vorladen.
2. **Optimistic Updates:** Bei Formular-Saves die Queries sofort updaten statt auf Server-Response zu warten.
3. **Query Deduplication:** Prüfen ob gleiche Queries mehrfach ausgeführt werden.

---

## 7. Test-Szenarien

### Szenario 1: Einzelkunde (keine Familie)

```
Kunde: Max Muster (keine Familienmitglieder)
Erwartet: 
- Customer lädt in <500ms
- Verträge laden in <500ms
- Familie-Tab zeigt "Keine Familienmitglieder"
```

### Szenario 2: Hauptkunde mit 2 Familienmitgliedern

```
Kunde: Max Muster (Hauptkunde)
Familie: Frau Muster, Kind Muster
Erwartet:
- Customer lädt in <500ms
- ALL CUSTOMERS muss geladen werden (für Familie-Tab)
- Familie-Tab zeigt 3 Personen
- Haushaltsverträge zeigt Verträge aller 3 Personen
```

### Szenario 3: Familienmitglied öffnen

```
Kunde: Kind Muster (Familienmitglied)
Erwartet:
- Customer lädt in <500ms
- primaryCustomerId wird erkannt
- Hauptkunde-Daten werden mitgeladen
- Familie-Tab zeigt gesamten Haushalt
```

---

## 8. Offene Fragen

1. **Warum lädt die Seite langsamer als heute Mittag?**
   - Mögliche Ursache: Base44 Platform Latenz erhöht?
   - Mögliche Ursache: Grössere Datensätze (mehr Kunden/Verträge)?
   - Mögliche Ursache: staleTime führt zu Cache-Miss?

2. **Welche Daten fehlen beim ersten Öffnen?**
   - Kunde selbst?
   - Verträge?
   - Familienmitglieder?
   - Berater-Informationen?

3. **Ist das "instabile Gefühl" visuell oder funktional?**
   - Springen die Daten beim Laden (visuell)?
   - Fehlen Daten und kommen später (funktional)?
   - Gibt es Fehlermeldungen im Console?

---

## 9. Debugging-Checkliste

### Console Logs prüfen:

```javascript
// In CustomerDetail.jsx hinzufügen:
useEffect(() => {
  console.log('🔍 CustomerDetail Debug:', {
    id,
    customerLoaded: !!customer,
    customerDirect: !!customerDirect,
    allCustomersLoaded: allCustomers.length > 0,
    needAllCustomers,
    primaryCustomerId,
    familyMembersCount: familyMembers.length,
  })
}, [customer, customerDirect, allCustomers, needAllCustomers, primaryCustomerId])
```

### Network Tab prüfen:

1. Öffne Chrome DevTools → Network
2. Filter: `api/base44` oder `entities`
3. Öffne einen Kunden
4. Zähle die API-Calls
5. Miss die Dauer jedes Calls
6. Prüfe ob Calls wiederholt werden (Cache-Problem)

### React Query DevTools:

1. Installiere React Query DevTools Extension
2. Öffne die DevTools im Browser
3. Prüfe den Status jeder Query (loading, success, error)
4. Prüfe ob Queries stale sind oder aus Cache kommen

---

**Nächster Schritt:** Öffne mehrere Kunden, aktiviere das Diagnose-Tool unten rechts, und dokumentiere die gemessenen Ladezeiten und Fehlermeldungen.