# Kundennummern-System – Dokumentation

## Überblick

Das System vergibt eindeutige, sichtbare Kundennummern im Format `K-500`, `K-501`, etc. für alle Personen:
- Hauptkontakte
- Ehepartner
- Kinder
- Familienmitglieder
- Neu erfasste Kunden
- KI-importierte Kunden

**Wichtig:** Jede Person erhält ihre eigene Kundennummer, unabhängig von Familienzugehörigkeit.

---

## Nummernlogik

### Startwert
- Erste Kundennummer: **K-500**
- Fortlaufend: K-501, K-502, K-503, ...

### Format
```
K-500   (Hauptkontakt Albertin)
K-501   (Partner Albertin)
K-502   (Kind 1 Albertin)
K-503   (Kind 2 Albertin)
...
```

### Eigenschaften
✓ Eindeutig pro Kunde  
✓ Sichtbar im System  
✓ Einfach zu merken  
✓ Keine Duplikate  
✓ Keine UUIDs  
✓ Systemweit konsistent  

---

## Automatische Vergabe

Kundennummern werden **automatisch** generiert bei:

1. **Manuelle Kundenerfassung**
   - Formular: Neue Privatkunde / Neue Firma

2. **Familienmitglied-Erstellung**
   - Dialog: "Familienmitglied hinzufügen"

3. **KI-Import**
   - FastImportWizard

4. **Dokumenten-/Police-Import**
   - Document Upload

5. **Datenmigration**
   - Migration bestehender Kunden

---

## Sichtbarkeit im System

Die Kundennummer wird angezeigt in:

| Bereich | Position |
|---------|----------|
| **Kundenliste** | Neben Name (blau Badge) |
| **Familienübersicht** | Neben Name (amber Badge) |
| **Kundendetail** | Große Badge neben Kundenname |
| **PDF-Export** | Header + Hauptkontakt-Sektion |
| **CSV-Export** | 1. Spalte (Kundennummer) |
| **Suchfunktion** | Suche nach "K-500" oder "500" |
| **Verträge** | Optional (bei Bedarf) |
| **Dokumente** | Optional (bei Bedarf) |

---

## Backend-Funktionen

### 1. generateCustomerNumber()
Gibt die nächste verfügbare Kundennummer zurück.

**Aufruf:**
```javascript
const result = await base44.functions.invoke('generateCustomerNumber', {});
// Result: { success: true, customer_number: 'K-500', next_number: 500 }
```

**Verwendung:**
- Vor dem Speichern eines neuen Kunden aufrufen
- Automatisch in CustomerForm / CompanyForm

### 2. migrateCustomerNumbers()
Migriert alle bestehenden Kunden ohne `customer_number`.

**Aufruf (nur Admin):**
```javascript
const result = await base44.functions.invoke('migrateCustomerNumbers', {});
// Result: { success: true, migrated: 42, customers: [...] }
```

**Was passiert:**
- Findet alle Kunden ohne `customer_number`
- Sortiert nach `created_date` (älteste zuerst)
- Vergibt fortlaufend ab K-500
- Aktualisiert Datenbank

**Wann aufrufen:**
- Nach Entity-Update (erstmals)
- Bei Admin-Dashboard > Migration

---

## Migration bestehender Daten

### Phase 1: Datenmodell Update
✓ Customer-Entity um `customer_number` erweitert

### Phase 2: Automatische Migration
1. Admin öffnet Dashboard
2. Klick auf "Kundennummern migrieren"
3. System verarbeitet alle Kunden
4. Fortschritt wird angezeigt

### Garantien
- ✓ Keine Duplikate
- ✓ Älteste Kunden zuerst (K-500, K-501, ...)
- ✓ Atomare Transaktionen
- ✓ Keine Daten verloren

---

## Suchfunktion

### Fuzzy-Search erweitert
```
Suche nach:
- "K-500"         → Findet Kundennummer exakt
- "500"           → Findet K-500
- "albertin"      → Findet Familie Albertin
- "K-5"           → Findet K-500 bis K-599 (Prefix)
- "alba 500"      → Findet Albertin mit K-500
```

**Algorihmus:**
1. Exakte Übereinstimmung Kundennummer = 100 Punkte
2. Starts-with = 80 Punkte
3. Contains = 60 Punkte
4. Fuzzy-Match = bis 50 Punkte

---

## Sichtbarkeit im PDF

### Header
```
Familienübersicht – Albertin
Erstellt: 12.05.2026
Kundennummer: K-500
Berater: Hans Müller
```

### Hauptkontakt-Sektion
```
Samanta Albertin
Telefon: 044 123 4567
E-Mail: samanta@example.com
Geburtsdatum: 15.06.1975
Kundennummer: K-500
```

### Familienmitglieder
```
Damiano René Albertin (K-501)
Joana Albertin (K-502)
Kylian Adolf Albertin (K-503)
```

---

## Technische Sicherheit

### Race Condition Prevention
- Sequenzielle Nummernvergabe
- Atomare DB-Updates
- Kein paralleles Generieren derselben Nummer

### Integritätschecks
```javascript
// Vor Speicherung
if (!customer.customer_number) {
  const { customer_number } = await generateCustomerNumber();
  customer.customer_number = customer_number;
}

// Keine Duplikate
const existing = await base44.entities.Customer.filter({
  customer_number: customer.customer_number
});
if (existing.length > 1) throw new Error('Duplicate customer number');
```

---

## Best Practices

### Für Broker
1. Kundennummern merken (z.B. "Albertin ist K-500")
2. Schnellzugriff per Nummer in Suche
3. Nummern in PDFs konsistent
4. Keine manuellen Nummernzuweisungen

### Für Admin
1. Migration nur einmal durchführen
2. Backup vor Migration (optional)
3. Nach Migration validieren
4. Alte IDs nicht verwenden

### Für Entwickler
1. `customer_number` immer mit speichern
2. Beim Import automatisch generieren
3. PDF-Export mit echten Nummern
4. Keine UUIDs in PDF anzeigen

---

## Troubleshooting

### Problem: Kundennummer fehlt
**Lösung:**
```javascript
// Admin-Function aufrufen
await base44.functions.invoke('migrateCustomerNumbers', {});
```

### Problem: Duplikate (sollte nicht vorkommen)
**Lösung:**
1. Duplikat-Alert öffnen
2. Einen Kunden löschen oder mergen
3. Fehlende Nummer neu vergeben

### Problem: Suche findet Kundennummer nicht
**Lösung:**
1. Genaue Schreibweise prüfen (K-500, nicht k-500)
2. Fuzzy-Search versuchen: nur "500"
3. Kundennummer aktualisieren

---

## Erfolgskriterium

Ein Broker kann:

✓ Kunden nach Nummer suchen ("K-500")  
✓ Nummern im PDF sehen  
✓ Nummern im CRM sehen  
✓ Familienmitglieder eindeutig identifizieren  
✓ Keine versteckten IDs mehr  
✓ Keine Inkonsistenzen  
✓ Keine doppelten Nummern  

Dann ist das System professionell umgesetzt.

---

## Changelog

### v1.0 (2026-05-12)
- Entity `customer_number` hinzugefügt
- Backend-Funktionen: generateCustomerNumber, migrateCustomerNumbers
- UI-Integration: Kundenliste, Detail, PDF
- Suchfunktion erweitert
- CSV-Export aktualisiert