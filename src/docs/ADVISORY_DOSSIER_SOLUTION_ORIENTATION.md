# AdvisoryDossierEngine — Lösungsorientierte Umstrukturierung

> **Datum:** 2026-05-19  
> **Zweck:** Dokumentation der Umstellung von technischer Policenverwaltung zur lösungsorientierten Beratungssicht.

---

## Ausgangslage

Die bisherige Rubrik "Policen" war als technische Verwaltungsoberfläche konzipiert:
- Manuelle Erfassung von Grundversicherungen und Zusatzversicherungen
- Separate Buttons pro Versicherungsart
- Fokus auf CRM-Contract-Entity-Darstellung

## Problem

Mit der neuen KI-basierten Architektur (Phase B+C) entsteht eine modernere Struktur:
- KI extrahiert **automatisch** die gesamte Versicherungslösung aus Dokumenten
- Grund- + Zusatzversicherungen werden **gemeinsam** erkannt
- Vergleichslogik arbeitet mit **Gesamtlösungen pro Person**

Die manuelle Policenverwaltung wurde dadurch redundant.

---

## Lösung

### 1. Tab-Umbenennung

**Alt:** `Policen`  
**Neu:** `Aktuelle Lösung`

Der Tab-Name im `DossierBuilder` wurde entsprechend angepasst.

### 2. UI-Fokusänderung

**Neue KPIs:**
- "Gesamtlösung: ✓ vorhanden" statt "Verträge total"
- "Aktive Verträge" (Anzahl)
- "Prämie/Monat" (CHF)

**Neue Sprache:**
- "Aktuelle Versicherungslösung pro Person" (statt "Policen")
- "nur relevante" / "alle" (statt "Filter aktiv" / "Alle anzeigen")
- Hinweis: "Dokument per KI analysieren im Vergleich-Tab"

### 3. Button-Hierarchie im Vergleich-Tab

**Primär (gross, zentral):**
```
[Dokument per KI analysieren (empfohlen)]
Extrahiert automatisch KVG + VVG für alle Personen
```

**Sekundär (dezent, nur für Sonderfälle):**
```
Manuell ergänzen (nur bei Sonderfällen)
[GV · Person A] [GV · Person B] [VV · Person A] ...
```

### 4. Datenfluss bleibt erhalten

**Read-only aus CRM:**
- Contracts, Dokumente, Kundenstammdaten
- Werden nicht verändert

**Additiv im Dossier:**
- `ComparisonEntry`-Entity (isoliert)
- KI-extrahierte Daten nach Review
- Manuelle Korrekturen mit Audit-Trail

---

## UX-Verbesserungen

| Aspekt | Vorher | Nachher |
|--------|--------|---------|
| **Fokus** | Technische Policenliste | Beratungslösung |
| **Erfassung** | Manuell pro Versicherungsart | KI-basiert gesamt |
| **Button-Hierarchie** | Alle gleichwertig | KI primär, manuell sekundär |
| **Sprache** | "Policen", "Verträge" | "Aktuelle Lösung", "Gesamtlösung" |
| **KPIs** | Anzahl Verträge | Lösung vorhanden? |

---

## Technische Änderungen

### Betroffene Komponenten

1. **`components/dossier/tabs/DossierPolicenTab.jsx`**
   - Kommentare aktualisiert (Phase B+C)
   - Info-Bar-Text angepasst
   - KPI-Labels geändert
   - Empty-State mit KI-Hinweis
   - Section-Header "Aktuelle Versicherungslösung pro Person"

2. **`components/dossier/DossierBuilder.jsx`**
   - Tab-Label: `Policen` → `Aktuelle Lösung`

3. **`components/dossier/tabs/DossierVergleichTab.jsx`**
   - Button-Hierarchie überarbeitet
   - KI-Upload als primärer Action-Button
   - Manuelle Buttons dezentriert ("nur für Sonderfälle")

### Unverändert (Schutz des CRM-Kerns)

- Contract-Entity (read-only)
- Customer-Entity (read-only)
- Dokumenten-Pipeline
- Bestehende CRM-Relations

---

## Zukünftige Entwicklung

Gemäss **Strategic Guidelines** (docs/ADVISORY_DOSSIER_STRATEGIC_GUIDELINES.md):

1. **Keine manuelle Policenerfassung** als Hauptweg
2. **KI-Extraktion + Review** als Standard-Workflow
3. **Manuelle Ergänzung** nur für Sonderfälle (z.B. historische Daten ohne Dokument)
4. **Datenqualität** vor neuen Features

---

## Migration bestehender Daten

**Keine Migration erforderlich:**
- Bestehende Contracts bleiben im CRM unverändert
- Dossier-Imports funktionieren weiterhin
- ComparisonEntry-Entity ist additiv

**Empfehlung für Berater:**
1. Bestehende Kunden: Dokument hochladen → KI analysiert → Review → Speichern
2. Neue Kunden: Direkt im Dossier mit KI-Start

---

*Dieses Dokument ist Teil der AdvisoryDossierEngine-Architektur und dient als Referenz für zukünftige Erweiterungen.*