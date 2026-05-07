# DATENWIEDERHERSTELLUNGSPROTOKOLL

## NOTFALL-DATENWIEDERHERSTELLUNG

**Status:** KRITISCH - Nach fehlgeschlagenem Import
**Datum:** 2026-05-07
**Betroffene Kunden:** ~75 aktive Kunden mit Verträgen/Anträgen gelöscht

---

## ⭐ EMPFOHLENER WEG: RELATIONEN-REKONSTRUKTION

Statt Rollback — Kunden aus existierenden Verträgen/Anträgen wiederherstellen:

```
SCHRITT 1: reconstructCustomersFromRelations
├─ Scannt Verträge, Anträge, Aufgaben, Dokumente
├─ Findet alle customer_id Referenzen
└─ Report: Welche Kunden fehlen

SCHRITT 2: reconstructAndRestoreCustomers
├─ Erstellt fehlende Kunden-Entities
├─ Preservert alle bestehenden Relationen
└─ ~5 Minuten Verarbeitung

SCHRITT 3: validateSystemIntegrity
├─ Prüft alle Relationen
├─ Bestätigt Datenintegrität
└─ Zeigt verbleibende Probleme
```

**VORTEIL:** Keine Produktion-Ausfallzeit, schnelle Wiederherstellung

---

## SOFORTMASSNAHMEN

### 1. SCAN RELATION-REFERENCES (PRIORITÄT 1)

**Aktion:** Starten Sie `reconstructCustomersFromRelations`

```javascript
const report = await base44.functions.invoke('reconstructCustomersFromRelations', {});
console.log(report.data.summary);
// Zeigt: Wie viele Kunden fehlen, wo sie referenziert sind
```

**Output:**
- Total unique customer_id references found
- Existing customer records (should be < references)
- Missing customer records (need reconstruction)
- Source counts (contracts, applications, tasks, documents)

---

### 2. REKONSTRUIERE FEHLENDE KUNDEN (PRIORITÄT 2)

**Aktion:** Verwende den Report aus Schritt 1

```javascript
const reconstructionReport = reportFromStep1.data;
const result = await base44.functions.invoke('reconstructAndRestoreCustomers', {
  reconstruction_report: reconstructionReport
});
console.log(`✓ Created: ${result.data.summary.successfully_created} customers`);
```

**Was passiert:**
- Erstellt fehlende Kunden-Entities
- Preservert ALLE bestehenden Relationen (Verträge, Anträge)
- Setzt `archived = false` für Sichtbarkeit
- Keine Production-Downtime

---

### 3. VERIFIZIERE SYSTEM-INTEGRITÄT (PRIORITÄT 3)

**Aktion:** Prüfe alle Relationen

```javascript
const validation = await base44.functions.invoke('validateSystemIntegrity', {});
console.log(validation.data.integrity_check);
// Zeigt: Alle Relationen intakt?
```

**Prüft:**
- Keine verwaisten Verträge (contract ohne customer)
- Keine verwaisten Anträge
- Alle Dokumente verknüpft
- Keine archived customers mit aktiven Relationen

---

## TIMELINE

| Phase | Aktion | Dauer | Ausfallzeit |
|-------|--------|-------|------------|
| 1 | reconstructCustomersFromRelations | 2-3 min | KEINE |
| 2 | reconstructAndRestoreCustomers | 5-10 min | KEINE |
| 3 | validateSystemIntegrity | 1-2 min | KEINE |
| 4 | Kunden 360 Verification | 2 min | KEINE |
| **TOTAL** | **Relationen-Rekonstruktion** | **10-20 min** | **KEINE** |

Vs. Database Rollback: 1-2 Stunden, Risiko, Komplexität

---

## WENN RELATIONEN-REKONSTRUKTION NICHT REICHT

**Fallback:** Dann Database-Backup-Restore

Koordinieren Sie mit Base44-Support:
- support@base44.com
- "Database restore required - backup timestamp needed"

---

## ZUKÜNFTIGE SCHUTZMASSNAMEN

### A. IMPORT-BATCH-ISOLIERUNG

Alle Importe müssen verwenden:
```javascript
{
  import_batch_id: "import_20260507_001",
  imported_at: "2026-05-07T...",
  imported_by: "admin@company.com"
}
```

### B. PREVIEW-MODE (SANDBOX)

Importe laufen in 5 Schritten:
1. CSV hochladen
2. Daten validieren
3. Duplikate erkennen
4. Betroffene Kunden anzeigen
5. Manuelle Bestätigung

### C. SOFT DELETE ONLY

- Kunden werden NIE hart gelöscht
- Stattdessen: `archived = true`
- Vollständig wiederherstellbar

### D. SCHUTZ AKTIVER KUNDEN

Kunden mit Verträgen/Anträgen/Dokumenten:
- ❌ Keine Batch-Deletion
- ❌ Keine Cleanup-Automationen
- ✅ Nur manuelle Löschung mit Bestätigung

---

## IMPLEMENTIERTE SICHERHEITSFUNKTIONEN

| Feature | Status | Datei |
|---------|--------|-------|
| Batch-Tracking | ✅ | `safeImportWithBatchTracking.js` |
| Safe Cleanup | ✅ | `safeBatchCleanup.js` |
| Soft Delete | ✅ | `Customer.json` (archived flag) |
| Audit-Trail | ✅ | `import_batch_id`, `archived_by` |
| Restore-Koordination | ✅ | `restoreFromBackup.js` |

---

## KONTAKT

**Base44 Support:** support@base44.com
**Notfall:** Backup-Team koordinieren
**Dauer:** Typisch 1-2 Stunden für Restore + Verifizierung

---

## LESSONS LEARNED

1. ❌ Globale Customer-Queries für Deletion = UNSICHER
2. ❌ Keine Batch-Isolierung = KRITISCH
3. ❌ Hard Delete aktiver Kunden = FATAL
4. ✅ Import-Batch-IDs verhindern Unfälle
5. ✅ Soft Delete ermöglicht Wiederherstellung
6. ✅ Preview-Mode vor Commit ist essentiell