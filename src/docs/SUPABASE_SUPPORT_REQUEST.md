# Supabase Support-Anfrage: Krankenkassenvergleich API-Integration Problem

## Projekt-Kontext
Wir entwickeln ein Schweizer Versicherungs-CRM (VSVV CRM) auf Base44 mit Supabase Backend.

**Architektur:**
- Frontend: Base44 (React)
- Backend: Supabase (eu-central-1)
- Externe API: PrimAI BAG-Prämiendaten (api.primai.ch)

## Problem Beschreibung

### Ziel
Ein funktionierender Krankenkassenvergleich, der:
1. Alle 34 offiziellen BAG-Krankenkassen anzeigt
2. Alle Versicherungsmodelle korrekt filtert (Standard, Telmed, Hausarzt, HMO)
3. Korrekte Prämien aus der PrimAI API anzeigt
4. Die aktuelle Versicherung des Kunden markiert

### Aktueller Stand
- Backend-Funktion `queryBAGLive` ruft PrimAI API korrekt auf
- API liefert Daten (getestet: 200+ Angebote für PLZ 4304, Jahrgang 1968)
- ABER: Frontend filtert falsch – viele Kassen werden nicht angezeigt

### Konkrete Fehler
1. **Mutuel (SanaTel)** erscheint nicht im Vergleich, obwohl in API-Daten enthalten
2. **Telmed-Modelle** werden nicht korrekt erkannt (Agrisano AGRIsmart, ÖKK Select, KPT KPTwin.smart, Visana Combi Care)
3. **Prämien** stimmen nicht mit API-Werten überein
4. **Filterlogik** im Frontend ist fehlerhaft

## Technische Details

### PrimAI API Response (Beispiel)
```json
{
  "insurer": "Mutuel",
  "model": "SanaTel",
  "deductible": 300,
  "accident": false,
  "price": {
    "total": 381.30,
    "currency": "CHF"
  }
}
```

### Erwartetes Verhalten
- MODEL_MAP_FROM_API("SanaTel") → "telmed"
- MODEL_MAP_FROM_API("AGRIsmart") → "telmed"
- MODEL_MAP_FROM_API("KPTwin.smart") → "telmed"
- MODEL_MAP_FROM_API("Select") → "telmed"
- MODEL_MAP_FROM_API("Combi Care") → "telmed"

### Ist-Zustand
Die Filterlogik im Frontend (`pages/KrankenkassenVergleich`) schließt diese Modelle fälschlicherweise aus.

## Bitte um Unterstützung

Wir benötigen Hilfe bei:

1. **Code Review** der Filterlogik in `pages/KrankenkassenVergleich` (Zeilen ~200-280)
2. **Korrektur** der MODEL_MAP_FROM_API Funktion
3. **Debugging** warum bestimmte Kassen trotz korrekter API-Daten nicht angezeigt werden
4. **Validierung** dass alle 34 BAG-Krankenkassen im Vergleich erscheinen

## Dateien zur Prüfung

- `pages/KrankenkassenVergleich` (Frontend, Filterlogik)
- `functions/queryBAGLive` (Backend, API-Proxy)

## Testdaten für Validierung

```
PLZ: 4304 (Giebenach)
Geburtsdatum: 1968-10-07
Aktuelle Kasse: Mutuel
Aktuelles Modell: Telmed (SanaTel)
Franchise: 300
Unfall: false
```

## Erwartete Kassen im Vergleich (Telmed-Modelle)

- Agrisano (AGRIsmart, AGRIcontact)
- ÖKK (Select, Telemedizin)
- KPT (KPTwin.smart)
- Visana (Combi Care)
- Mutuel (SanaTel)
- Helsana (various Telmed)
- Sanitas (various Telmed)
- Swica (various Telmed)
- Alle anderen der 34 BAG-Krankenkassen

## Kontakt

Bitte um Rückmeldung innerhalb von 48 Stunden. Projekt ist kritisch für Geschäftsbetrieb.

---

**Erstellt:** 2026-06-10
**Priorität:** Hoch
**Status:** Blockiert