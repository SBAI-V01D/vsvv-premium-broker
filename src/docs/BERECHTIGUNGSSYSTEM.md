# Berechtigungssystem für Makler

## Architektur

Das System basiert auf einfachen Entity-Zuordnungen ohne komplexe RBAC-Regeln:

- **User.role** = Benutzerrolle (admin, broker, assistenz, partner)
- **CustomerAdvisor** = Verbindung zwischen Kunde und Berater(n)
- **ContractAdvisor** = Verbindung zwischen Vertrag und Berater(n)

## Rollen

### ADMIN
- Vollzugriff auf alle Kunden, Verträge, Dokumente
- Benutzerverwaltung
- Rechteverwaltung

### BROKER / BERATER
- Zugriff nur auf zugeordnete Kunden
- Zugriff nur auf zugeordnete Verträge
- Sieht nur eigene Aufgaben
- Dashboard gefiltert nach Zuordnungen

### ASSISTENZ / INNENDIENST
- Zugriff auf zugeordnete Kunden
- Vertragsbearbeitung
- Dokumentenverwaltung
- Kein Zugriff auf sensible Finanzdaten

### PARTNER / EXTERNER BERATER
- Nur explizit freigegebene Kunden/Verträge
- Eingeschränkter Zugriff

## Mehrfach-Berater pro Kunde

Jeder Kunde kann mehrere Berater haben:
- **primary** = Hauptberater (1 pro Kunde)
- **co_advisor** = Co-Berater
- **assistant** = Assistenz
- **specialist** = Spezialist

## Mehrfach-Berater pro Vertrag

Jeder Vertrag kann eigene Zuständigkeiten haben:
- Unterschiedlich von Kundenberater
- Z.B. BVG-Spezialist für Vorsorge-Vertrag
- Ermöglicht spezialisierte Betreuung

## Implementation

### 1. Kundenzuordnung (CustomerDetail)
```jsx
import AdvisorAssignmentPanel from '@/components/advisors/AdvisorAssignmentPanel'

<AdvisorAssignmentPanel customerId={id} />
```

### 2. Vertragszuordnung (ContractDetail)
```jsx
import ContractAdvisorAssignment from '@/components/advisors/ContractAdvisorAssignment'

<ContractAdvisorAssignment contractId={id} contractName={policyNumber} />
```

### 3. Sichtbarkeitslogik (Hook)
```jsx
import { useAccessControl } from '@/hooks/useAccessControl'

const { canViewCustomer, canViewContract, isAdmin } = useAccessControl()

if (!canViewCustomer(customerId)) {
  return <AccessDenied />
}
```

### 4. Backend-Filterung
```jsx
const response = await base44.functions.invoke('getVisibleData', {
  entity: 'Customer',
  entityId: id,
})
```

## Sicherheit

- Admin sieht immer alles
- Broker sieht nur zugeordnete Daten
- Assistenz hat eingeschränkte Rechte
- Partner sieht nur freigegebene Daten

## Performance

- CustomerAdvisor/ContractAdvisor Queries sind schnell
- Keine komplexen RLS-Rules
- Caching via useQuery staleTime
- Dashboard bleibt performant

## Zukunft

Wenn nötig:
- Feinere Rollenkontrolle
- Abteilungs-Zuordnung (team_id)
- Audit-Logging für Zugriffe
- Abgelaufene Zuordnungen (end_date)