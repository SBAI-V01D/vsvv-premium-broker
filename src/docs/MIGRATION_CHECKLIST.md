# Kundennummern-Migration – Schritt-für-Schritt Anleitung

## ✓ Vorbereitung

- [x] Customer-Entity um `customer_number` erweitert
- [x] Backend-Funktionen erstellt:
  - `generateCustomerNumber()` – Nächste Nummer generieren
  - `migrateCustomerNumbers()` – Alle bestehenden Kunden migrieren
- [x] UI aktualisiert:
  - Kundenliste zeigt Kundennummern
  - Kundendetail zeigt Kundennummer
  - PDF-Export integriert Kundennummern
  - Suchfunktion durchsucht Kundennummern
  - CSV-Export enthält Kundennummern-Spalte
- [x] Automatische Nummernvergabe bei neuen Kunden

---

## Phase 1: Migration durchführen (Admin-only)

### Schritt 1: Migration starten

```bash
# Im Browser-Konsole oder via API-Client:
const result = await base44.functions.invoke('migrateCustomerNumbers', {});
console.log(result);
```

**Erwartetes Ergebnis:**
```json
{
  "success": true,
  "migrated": 42,
  "customers": [
    {
      "id": "uuid-1",
      "name": "Max Mustermann",
      "customer_number": "K-500"
    },
    ...
  ]
}
```

### Schritt 2: Migration validieren

- ✓ Konsole zeigt erfolgreiche Migration
- ✓ Alle Kunden haben `customer_number`
- ✓ Nummern beginnen bei K-500
- ✓ Keine Duplikate

### Schritt 3: Fehlerfälle prüfen

Falls Migration fehlschlägt:

1. **Fehler: "Forbidden"**
   - Admin-Rolle erforderlich
   - Mit Admin-Konto anmelden

2. **Fehler: "No customers to migrate"**
   - Alle Kunden haben bereits Nummern
   - OK – Migration ist abgeschlossen

3. **Fehler: "Connection timeout"**
   - Erneut versuchen
   - Ggf. Nachtzeitraum nutzen

---

## Phase 2: Bestätigung in UI

Nach erfolgreicher Migration:

### Kundenübersicht (/kunden)
- ✓ Alle Hauptkunden zeigen Kundennummer (blaues Badge)
- ✓ Familienmitglieder zeigen Kundennummer (amber Badge)
- ✓ Suche funktioniert mit Nummern (z.B. "K-500")

### Kundendetail (/kunden/{id})
- ✓ Kundennummer neben Name sichtbar
- ✓ Bank-/Postkontoverbindung angezeigt
- ✓ Alle Daten konsistent

### PDF-Export (Haushaltsübersicht)
- ✓ Kundennummer im Header
- ✓ Kundennummer beim Hauptkontakt
- ✓ Kundennummern bei Familienmitgliedern

### CSV-Export
- ✓ Erste Spalte = Kundennummer
- ✓ Alle Zeilen ausgefüllt
- ✓ Format: K-500, K-501, ...

---

## Phase 3: Neue Kunden

### Neue Privatkunden
1. Klick "Neuer Kunde" → Privatkunde
2. Formular ausfüllen
3. Speichern
4. **Automatisch:** Kundennummer vergeben (z.B. K-543)

### Neue Familienmitglieder
1. Kundendetail öffnen
2. Klick "Familienmitglied"
3. Dialog ausfüllen
4. Speichern
5. **Automatisch:** Kundennummer vergeben

### KI-Import
1. Import starten
2. Kunden importieren
3. **Automatisch:** Nummern vergeben

---

## Phase 4: Operativer Betrieb

### Best Practice für Broker

- **Suchen:** "K-500" oder "500" eingeben
- **Listen:** Nummern merken für häufige Kunden
- **Verträge:** Kundennummer zur Referenzierung
- **PDF:** Nummern weitergeben an Kunden

### Best Practice für Admin

- **Backup:** Optional vor Migration (empfohlen)
- **Logs:** Migrationsergebnis im System protokollieren
- **Monitoring:** Regelmäßig Duplikate prüfen
- **Training:** Team auf neue Nummern hinweisen

---

## Checkliste – Migration erfolgreich?

- [ ] Admin-Funktion `migrateCustomerNumbers()` aufgerufen
- [ ] Konsole zeigt erfolgreiche Migration (migrated > 0)
- [ ] Kundenübersicht zeigt alle Kundennummern
- [ ] Suche findet Kunden per Kundennummer
- [ ] PDF-Export zeigt Kundennummern
- [ ] CSV-Export hat Kundennummern-Spalte
- [ ] Neue Kunden erhalten automatisch Nummern
- [ ] Keine Fehler in Browser-Konsole
- [ ] Team wurde informiert

---

## Rollback (Falls erforderlich)

Falls Migration rückgängig gemacht werden muss:

```sql
-- Alle customer_number löschen
UPDATE customers SET customer_number = NULL;
```

Danach erneut `migrateCustomerNumbers()` ausführen.

---

## Support & Troubleshooting

### Problem: "Kundennummer fehlt bei Customer X"

**Lösung:**
1. Kundendetail öffnen
2. Bearbeiten klicken
3. Speichern (triggert auto-generate)
4. Fertig

### Problem: "Duplikate erkannt"

**Lösung:**
1. Admin-Konsole öffnen
2. Fehlerhafte Kunden prüfen
3. Eine ID manuell löschen
4. Migration erneut ausführen

### Problem: "Suche findet Kundennummer nicht"

**Lösung:**
- Genaue Schreibweise: "K-500" (nicht "k-500")
- Oder nur: "500"
- Fuzzy-Suche: "5" findet K-500 bis K-599

---

## Dokumentation

- **Benutzer-Docs:** [CUSTOMER_NUMBERS.md](./CUSTOMER_NUMBERS.md)
- **Technisches Handbuch:** Backend-Funktionen + Entity-Schema
- **Suchlogik:** [customerSearch.js](../lib/customerSearch.js)

---

## Zeitrahmen

- **Migration:** < 1 Minute (bis 5000 Kunden)
- **Validierung:** < 5 Minuten
- **Schulung Team:** < 10 Minuten

**Empfohlener Zeitpunkt:** Nach Betriebsschluss oder Wochenende

---

## Erfolgskriterium

✓ Alle Kunden haben sichtbare, eindeutige Kundennummern  
✓ Broker können nach Kundennummern suchen  
✓ Nummern sind systemweit konsistent  
✓ Keine versteckten IDs mehr  
✓ PDF und CSV zeigen echte Kundennummern  

**Dann ist die Migration erfolgreich abgeschlossen!**