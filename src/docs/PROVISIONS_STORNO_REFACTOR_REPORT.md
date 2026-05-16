# Abschlussbericht: Provisions- und Stornoabrechnung Refactor
**Datum:** 2026-05-16  
**Umfang:** Provisions- und Stornobereich (CommissionEntry, CommissionFormDialog, commissionEngine)

---

## 1. Geänderte Komponenten

| Datei | Art | Beschreibung |
|---|---|---|
| `entities/CommissionEntry.json` | Erweitert | 12 neue Felder für Storno-Audit und Abschlussprovision |
| `lib/commissionEngine.js` | Erweitert | 2 neue Funktionen: `calcStornoSaveData`, `calcStornoPreview` |
| `components/commissions/CommissionFormDialog` | Refactored | Neues Storno-Formular mit 3 Bereichen + Live-Summary |
| `pages/CommissionsAndCourtage` | Angepasst | `handleSave` nutzt `calcStornoSaveData` statt manuelle Negation |

---

## 2. Neue Entity-Felder (CommissionEntry)

### Abschlussprovision (fachliche Trennung)
- `abschlussprovision_courtage` – Abschlussprovision Courtage-Teil
- `abschlussprovision_provision` – Abschlussprovision Provisions-Teil  
- `bruttoentschaedigung_courtage` – = Abschlussprovision + Courtage
- `bruttoentschaedigung_provision` – = Abschlussprovision + Provision

### Storno Audit-Felder
- `storno_datum` – Datum der Storno-Buchung
- `storno_reference_id` – Referenz auf Ursprungs-Abrechnung (ID)
- `storno_ursprung_courtage_brutto` – Ursprüngliche Courtage Brutto
- `storno_ursprung_provision_brutto` – Ursprüngliche Provision Brutto
- `storno_ursprung_courtage_netto` – Ursprüngliche Courtage Netto
- `storno_ursprung_provision_netto` – Ursprüngliche Provision Netto
- `storno_war_ausbezahlt` – War bereits ausbezahlt (Boolean)
- `storno_rueckforderungsbetrag` – Rückforderungsbetrag (wenn ausbezahlt)
- `storno_grund` – Freitext Stornogrund

---

## 3. Berechnungslogik

### Standard (nicht Storno)
```
Beratercourtage (Brutto)  = Gesellschaftscourtage  × Beratercourtage-%  / 100
Courtage Reserve          = Beratercourtage × Storno-%  / 100
Courtage Netto            = Beratercourtage - Reserve

Beraterprovision (Brutto) = Gesellschaftsprovision × Beraterprovision-% / 100
Provision Reserve         = Beraterprovision × Storno-% / 100
Provision Netto           = Beraterprovision - Reserve
```

### Storno (NEU – fachlich korrekt)
```
Bruttoentschädigung Courtage   = Abschlussprovision + Gesellschaftscourtage
Courtage Reserve               = Bruttoentschädigung × Storno-% / 100
Courtage Netto (Storno)        = -(Bruttoentschädigung - Reserve)

Bruttoentschädigung Provision  = Abschlussprovision + Gesellschaftsprovision
Provision Reserve              = Bruttoentschädigung × Storno-% / 100
Provision Netto (Storno)       = -(Bruttoentschädigung - Reserve)

Rückforderungsbetrag           = Courtage Netto + Provision Netto  (wenn war_ausbezahlt=true)
```

---

## 4. Formular UI-Struktur

### Standard-Buchung
- **Sektion A**: Vertragsgrundlagen (Datum, Kunde, Berater, Gesellschaft, Sparte, Prämie)
- **Sektion B**: Courtage (Gesellschaftscourtage, %, Stornoabzug %) + Live-Berechnung
- **Sektion C**: Provision (Gesellschaftsprovision, %, Stornoabzug %) + Live-Berechnung

### Storno-Buchung (NEU)
- **Sektion B**: Abschlussprovision Courtage + Gesellschaftscourtage + Storno-% + Datum + Referenz-ID + War ausbezahlt
- **Sektion C**: Abschlussprovision Provision + Gesellschaftsprovision + Storno-% + Stornogrund
- **Live-Summary**: Strukturierter Block mit Brutto / Reserve / Netto je Courtage + Provision + Gesamt-Stornobetrag

---

## 5. Persistierung

Alle Storno-Buchungen speichern vollständig:
- Alle Einzel-Berechnungsfelder (Brutto, Reserve, Netto)
- Audit-Felder (Ursprungswerte, Datum, Referenz, War ausbezahlt, Rückforderungsbetrag)
- Keine reine Laufzeitberechnung ohne Speicherung

---

## 6. Getestete Szenarien

| Szenario | Status |
|---|---|
| Standard Courtage-Buchung (Ges. × %) | ✅ Unverändert funktional |
| Standard Provision-Buchung | ✅ Unverändert funktional |
| Storno mit nur Courtage | ✅ Neues Formular + vollständige Persistierung |
| Storno mit Courtage + Provision | ✅ Beide Typen getrennt berechnet |
| Storno mit «War ausbezahlt» | ✅ Rückforderungsbetrag berechnet |
| Live-Berechnung (ohne Speichern) | ✅ StornoLiveSummary zeigt Echtzeit-Werte |
| Validation Storno-Modus | ✅ Neue Felder (abschlussprovision_*) werden geprüft |

---

## 7. Offene Risiken / Empfehlungen

| Risiko | Empfehlung |
|---|---|
| Legacy-Daten ohne neue Storno-Felder | `normalizeLegacyEntry` gibt sinnvolle Defaults zurück (0) |
| `storno_reference_id` manuell erfasst | Zukünftig: Dropdown mit bestehenden Abrechnungen |
| Rückforderungsprozess | Aktuell nur als Datenpunkt gespeichert – kein automatischer Workflow |
| Konsistenzprüfung für Storno | `checkEntryConsistency` prüft Storno-Felder noch nicht explizit |

---

## 8. Nicht geändert (Stabilitätsvorgaben eingehalten)

- Kunden-/Vertragsrelationen: **keine Änderungen**
- PDF-Logik: **keine Änderungen**
- Backup/Integrity-System: **keine Änderungen**
- CommissionTablePaginated: **keine Änderungen**
- KPI-Engine, Trend-Engine: **keine Änderungen**