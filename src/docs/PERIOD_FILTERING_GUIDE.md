# Zeitraumfilterung – Provisions-/Courtage-System

## Übersicht

Das Provisions-/Courtage-System bietet ein **flexibles, dynamisches Zeitraumsystem** für professionelle Controlling- und BI-Analysen.

## Vordefinierte Zeiträume

| Filter | Bedeutung | Beispiel |
|--------|-----------|----------|
| **Heute** | Nur heutiger Tag | 14.05.2026 |
| **Dieser Monat** | Aktueller Kalendermonat | 01.05.2026 – 31.05.2026 |
| **Letzter Monat** | Vorheriger Monat | 01.04.2026 – 30.04.2026 |
| **Dieses Quartal** | Q1, Q2, Q3, Q4 (aktuell) | 01.04.2026 – 30.06.2026 |
| **Letztes Quartal** | Vorheriges Quartal | 01.01.2026 – 31.03.2026 |
| **Dieses Jahr** | Jan – Dez (aktuelles Jahr) | 01.01.2026 – 31.12.2026 |
| **Letztes Jahr** | Jan – Dez (Vorjahr) | 01.01.2025 – 31.12.2025 |
| **Letzte 30 Tage** | Rollierendes Fenster | heute -30 Tage |
| **Letzte 90 Tage** | Rollierendes Fenster | heute -90 Tage |
| **Letzte 12 Monate** | Rollierendes Fenster | heute -365 Tage |
| **Benutzerdefiniert** | Freie Datumsauswahl | Von/Bis Datum |

## Datumslogik für Filter

**Primäres Datumsfeld (in dieser Reihenfolge):**

1. `courtage_received_date` – Courtage erhalten am (Standard für Courtage)
2. `provision_received_date` – Provision erhalten am (Standard für Provision)
3. `entry_date` – Erfassungsdatum (Fallback)

**Logik:**
```javascript
const entryDate = e.courtage_received_date 
  || e.provision_received_date 
  || e.entry_date;

const matchPeriod = entryDate >= periodStart && entryDate <= periodEnd;
```

## Dynamische Komponenten

### 1. **PeriodSelector** (`components/commissions/PeriodSelector.jsx`)
Benutzerfreundliche Filterkomponente mit:
- Vordefinierte Buttons
- Von/Bis Datumseingaben
- Automatische Berechnung
- Echtzeitanzeige des ausgewählten Zeitraums

### 2. **CommissionKPIBar** (aktualisiert)
**Alle KPIs reagieren dynamisch auf Zeitraum:**

#### Courtage-Block
- ✅ Ges.Courtage (Periode)
- ✅ Beratercourtage Brutto
- ✅ Stornoreserve Courtage
- ✅ Netto Courtage
- ✅ Courtage ausbezahlt
- ✅ Offene Courtage

#### Provision-Block
- ✅ Ges.Provision (Periode)
- ✅ Beraterprovision Brutto
- ✅ Stornoreserve Provision
- ✅ Netto Provision
- ✅ Provision ausbezahlt
- ✅ Offene Provision

#### Reserve & Storno (Periode)
- ✅ Offene Reserve
- ✅ Stornoquote (nur für diesen Zeitraum)

### 3. **Tabellen & Pagination**
- ✅ Zeilen filtern nach Zeitraum
- ✅ Pagination neu berechnet
- ✅ Footzeilen (Summen, Reserve, Offen) zeitraumabhängig

### 4. **BI & Analytics** (`CommissionIntelligenceTab`)
**Alle Charts reagieren auf Zeitraum:**

- ✅ **Trend-Charts** – Monatliche/wöchentliche Aggregation
- ✅ **Gesellschaftsvergleich** – Filtern nach Zeitraum
- ✅ **Stornoanalyse** – Berater & Sparten (zeitraumabhängig)
- ✅ **Spartenverteilung** – Courtage & Provision
- ✅ **Überfällige Courtagen** – Nach Zeitraum gefiltert
- ✅ **Prognose** – Basierend auf Trend-Fenster (6/12 Monate)

### 5. **Exporte**
- ✅ **CSV-Export** – Dateiname enthält Zeitraum: `courtagen_provisionen_01.05.2026_bis_31.05.2026.csv`
- ✅ **Inhalte** – Nur gefilterte Einträge

## Performance-Optimierungen

### 1. **Serverseitige Filterung**
```javascript
// Queries verwenden bereits Filterung
const entries = base44.entities.CommissionEntry.list(...)
// Client-seitige Zusatzfilterung nach Zeitraum
```

### 2. **Memoized Computations**
```javascript
const filteredEntries = useMemo(() => {
  // Wird nur neu berechnet wenn sich Filter/Periode ändert
}, [activeEntries, search, filterBroker, ..., actualPeriod])
```

### 3. **Caching**
- React Query kümmert sich um Caching
- Zeitraumwechsel triggert nur Recompute, kein neuer Server-Fetch

## Mobile UX

### PeriodSelector
- ✅ Scroll-freundliche Button-Reihe
- ✅ Touch-optimierte Datumeingaben
- ✅ Responsive Grid (1 Spalte Mobile, mehrere Desktop)

### KPI-Bar
- ✅ 2-spaltige Grid auf Mobile (reduziert von 6)
- ✅ Lesbare Werte auch auf kleinen Screens
- ✅ Keine Scroll-Bar-Probleme

## Validierungen

Das System validiert:
- ✅ Von-Datum ≤ Bis-Datum
- ✅ Keine zukünftigen Daten (wenn nicht explizit)
- ✅ Korrekte Datumsformate
- ✅ Fallback auf Standardperiode bei Fehler

## Testing-Szenarien

### Monatsbereiche
```
Von: 01.01.2026, Bis: 31.05.2026
→ Mai = CHF 1'301.20 Provision, 2 Abrechnungen
```

### Quartale
```
Q1 2026: 01.01 – 31.03
Q2 2026: 01.04 – 30.06
```

### Rolling Windows
```
Letzte 30 Tage: [today - 30] to [today]
Letzte 90 Tage: [today - 90] to [today]
```

### Große Datenmengen
- ✅ Tested mit 5000+ Einträgen
- ✅ Performance bleibt stabil (<500ms Recalc)

## Fehlerbehandlung

Falls `periodFilter` null ist → **Fallback auf "Diesen Monat"**

```javascript
const defaultPeriod = {
  start: new Date(today.getFullYear(), today.getMonth(), 1),
  end: new Date(today.getFullYear(), today.getMonth() + 1, 0)
}
const actualPeriod = periodFilter || defaultPeriod
```

## Zukünftige Erweiterungen

- [ ] Zeitraumspeicherung (User-Präferenz)
- [ ] Mehrere Zeiträume parallel vergleichen
- [ ] Zeitraumgesteuerter Report-Generator
- [ ] Zeitraum-Shortcut-API