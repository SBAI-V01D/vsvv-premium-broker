# Zürich-Test Protokoll (Kanton ZH)

## Test-Durchführung

### 1. Import
- [ ] BAG Excel-Datei laden (Prämien 2026)
- [ ] Kanton **ZH** auswählen
- [ ] "Analysieren" klicken
- [ ] Diagnose prüfen (unbekannte IDs, Tariftypen)
- [ ] "Importieren" klicken
- [ ] Auf Validierung warten

### 2. Erwartete Resultate

```
STATUS: PASS / FAIL

Quelle:      [Wert eintragen]
Importiert:  [Wert eintragen]
Differenz:   [Wert eintragen]

Importdauer: [Wert eintragen] Min.

Versicherer:  [Wert eintragen]
Kantone:      [Wert eintragen]
Regionen:     [Wert eintragen]
Modelle:      [Wert eintragen]
Altersklassen: [Wert eintragen]
Franchisen:   [Wert eintragen]
```

### 3. Diagnose-Checks (müssen 0 sein)
- [ ] Unbekannte Tariftypen: ____
- [ ] Unbekannte Altersklassen: ____
- [ ] Unbekannte Franchisen: ____
- [ ] Leere Pflichtfelder: ____
- [ ] Unbekannte Versicherer-IDs: ____

---

## Stichproben-Prüfung gegen Priminfo

### Prüfkriterien
- Kanton: **Zürich (ZH)**
- Prämienjahr: **2026**
- Unfall: **OHNE** Unfall

### Testfälle

#### 1. CSS Versicherung
| Alter | Franchise | Modell | Priminfo (CHF) | System (CHF) | Match |
|-------|-----------|--------|----------------|--------------|-------|
| Kind (0-18) | 300 | Standard | | | ☐ |
| Kind (0-18) | 2500 | Standard | | | ☐ |
| Jugend (19-25) | 300 | Standard | | | ☐ |
| Jugend (19-25) | 2500 | Standard | | | ☐ |
| Erwachsen (26+) | 300 | Standard | | | ☐ |
| Erwachsen (26+) | 2500 | Standard | | | ☐ |
| Erwachsen (26+) | 300 | Hausarzt | | | ☐ |
| Erwachsen (26+) | 300 | Telmed | | | ☐ |
| Erwachsen (26+) | 300 | HMO | | | ☐ |

#### 2. Helsana
| Alter | Franchise | Modell | Priminfo (CHF) | System (CHF) | Match |
|-------|-----------|--------|----------------|--------------|-------|
| Kind (0-18) | 300 | Standard | | | ☐ |
| Erwachsen (26+) | 300 | Standard | | | ☐ |
| Erwachsen (26+) | 2500 | Standard | | | ☐ |

#### 3. Sanitas
| Alter | Franchise | Modell | Priminfo (CHF) | System (CHF) | Match |
|-------|-----------|--------|----------------|--------------|-------|
| Kind (0-18) | 300 | Standard | | | ☐ |
| Erwachsen (26+) | 300 | Standard | | | ☐ |
| Erwachsen (26+) | 2500 | Standard | | | ☐ |

#### 4. Concordia
| Alter | Franchise | Modell | Priminfo (CHF) | System (CHF) | Match |
|-------|-----------|--------|----------------|--------------|-------|
| Kind (0-18) | 300 | Standard | | | ☐ |
| Erwachsen (26+) | 300 | Standard | | | ☐ |
| Erwachsen (26+) | 2500 | Standard | | | ☐ |

#### 5. SWICA
| Alter | Franchise | Modell | Priminfo (CHF) | System (CHF) | Match |
|-------|-----------|--------|----------------|--------------|-------|
| Kind (0-18) | 300 | Standard | | | ☐ |
| Erwachsen (26+) | 300 | Standard | | | ☐ |
| Erwachsen (26+) | 2500 | Standard | | | ☐ |

---

## Abnahmekriterien

### Import (alle müssen erfüllt sein)
- [ ] STATUS: **PASS**
- [ ] Differenz: **0**
- [ ] Unbekannte Tariftypen: **0**
- [ ] Unbekannte Altersklassen: **0**
- [ ] Unbekannte Franchisen: **0**
- [ ] Leere Pflichtfelder: **0**

### Datenqualität (alle müssen erfüllt sein)
- [ ] ≥ 40 Versicherer importiert
- [ ] 26 Kantone vorhanden (für Vollimport)
- [ ] 4 Modelle: standard, telmed, hausarzt, hmo
- [ ] 3 Altersklassen: kind, jugend, erwachsen
- [ ] Franchisen: 0, 100, 200, 300, 400, 500, 600, 1000, 1500, 2000, 2500

### Fachlicher Test (alle müssen erfüllt sein)
- [ ] Alle 5 Versicherer vorhanden (CSS, Helsana, Sanitas, Concordia, SWICA)
- [ ] ≥ 80% der Stichproben matchen mit Priminfo (±5 CHF Toleranz)
- [ ] Alle Modelle verfügbar (Standard, Hausarzt, Telmed, HMO)
- [ ] Alle Franchisen verfügbar (300, 2500)
- [ ] Alle Altersklassen verfügbar (Kind, Jugend, Erwachsen)

### Performance
- [ ] Importdauer < 15 Minuten für ZH
- [ ] Vergleichsabfrage < 1 Sekunde

---

## Test-Ergebnis

**Import bestanden:** ☐ JA / ☐ NEIN

**Stichproben bestanden:** ☐ JA / ☐ NEIN

**Vollimport (26 Kantone) freigegeben:** ☐ JA / ☐ NEIN

**Tester:** ________________

**Datum:** ________________

**Unterschrift:** ________________

---

## Priminfo Link

[https://www.priminfo.admin.ch/de/preise/praemienvergleich](https://www.priminfo.admin.ch/de/preise/praemienvergleich)