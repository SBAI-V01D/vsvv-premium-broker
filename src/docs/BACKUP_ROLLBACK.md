# VSVV CRM - Backup & Rollback Konzept

**Version:** 1.0  
**Datum:** 2026-06-09  
**Status:** Phase 1 - Zur Implementierung bereit

---

## Übersicht

Dieses Dokument beschreibt die Backup- und Rollback-Strategie für die VSVV CRM-Migration zu Supabase.

---

## 1. Backup-Strategie

### 1.1 Supabase Native Backups

**Automatische Backups:**

| Typ | Frequenz | Aufbewahrung | Kosten |
|---|---|---|---|
| **Daily Backup** | Täglich (02:00 UTC) | 7 Tage | Inklusive (Free/Pro) |
| **Point-in-Time Recovery** | Kontinuierlich | 7 Tage | Inklusive (Pro) |
| **Weekly Backup** | Wöchentlich (Sonntag 03:00 UTC) | 30 Tage | Pro-Plan |
| **Monthly Backup** | Monatlich (1. des Monats) | 1 Jahr | Pro-Plan |

**Konfiguration:**

```
Supabase Dashboard → Database → Backups
├─ Enable PITR: ✅ Aktiv
├─ Backup Retention: 7 Tage (Free) / 30+ Tage (Pro)
└─ Backup Schedule: Daily 02:00 UTC
```

### 1.2 Manuelle Backups (vor Migrationen)

**Pre-Migration Backup:**

```sql
-- 1. Full Backup via Supabase Dashboard
-- Dashboard → Database → Backups → Create Backup

-- 2. Export aller Tabellen
pg_dump -h db.xxx.supabase.co -U postgres \
  --schema-only --file=schema_backup.sql

pg_dump -h db.xxx.supabase.co -U postgres \
  --data-only --file=data_backup.sql
```

**Base44 Entity-Backup:**

```javascript
// Function: createFullBackup
const backup = await base44.functions.invoke('createFullBackup', {
  entities: ['BAGPraemienDaten', 'Kunde', 'Vertrag'],
  format: 'json',
  storage: 'supabase' // oder 's3', 'local'
});

// Ergebnis:
{
  backup_id: 'backup-uuid',
  timestamp: '2026-06-09T10:00:00Z',
  entities: {
    BAGPraemienDaten: { count: 217472, url: 's3://backups/bag_20260609.json' },
    Kunde: { count: 5000, url: 's3://backups/kunden_20260609.json' },
    Vertrag: { count: 20000, url: 's3://backups/vertraege_20260609.json' }
  },
  size_mb: 456.7,
  duration_ms: 123456
}
```

### 1.3 Backup-Speicherorte

**Multi-Tier Storage:**

```
Tier 1: Supabase Storage (Primary)
├─ Bucket: backups
├─ Region: EU (Frankfurt)
└─ Retention: 30 Tage

Tier 2: Base44 File Storage (Secondary)
├─ Location: Base44 Cloud
└─ Retention: 90 Tage

Tier 3: Externer S3-Bucket (Tertiary, optional)
├─ Provider: AWS S3 / Cloudflare R2
├─ Region: EU
└─ Retention: 1 Jahr
```

---

## 2. Rollback-Szenarien

### 2.1 Szenario 1: Import-Fehler (BAG-Daten)

**Beschreibung:** BAG-Import fehlgeschlagen oder fehlerhafte Daten importiert.

**Schweregrad:** Mittel

**Rollback-Prozedur:**

```sql
-- 1. Import-Version als rolled_back markieren
UPDATE bag_import_versions
SET status = 'rolled_back',
    rollback_version_id = 'import-version-uuid',
    rollback_am = NOW()
WHERE id = 'import-version-uuid';

-- 2. Alle Records der Version löschen
DELETE FROM bag_praemien
WHERE import_version_id = 'import-version-uuid';

-- 3. Fehlerjournal aktualisieren
UPDATE bag_import_errors
SET manuell_korrigiert = true,
    manuell_korrigiert_von = 'admin@vsvv.ch',
    manuell_korrigiert_am = NOW()
WHERE import_version_id = 'import-version-uuid';

-- 4. Audit-Log
INSERT INTO audit_logs (entity_type, entity_id, action, details, user_email)
VALUES (
  'bag_import',
  'import-version-uuid',
  'rollback',
  jsonb_build_object(
    'reason', 'Fehlerhafte Daten',
    'timestamp', NOW(),
    'previous_status', 'completed'
  ),
  'admin@vsvv.ch'
);

-- 5. Bestätigung
SELECT 'Rollback erfolgreich' AS status,
       COUNT(*) AS records_deleted
FROM bag_praemien
WHERE import_version_id = 'import-version-uuid';
```

**Dauer:** 2-5 Minuten

**Risiko:** Niedrig (nur BAG-Daten betroffen)

---

### 2.2 Szenario 2: Datenbank-Problem (Supabase)

**Beschreibung:** Supabase-Datenbank nicht erreichbar oder korrupte Daten.

**Schweregrad:** Hoch

**Rollback-Prozedur:**

```
Stufe 1: Point-in-Time Recovery (PITR)
──────────────────────────────────────
1. Supabase Dashboard → Database → Backups
2. "Restore to Point in Time" wählen
3. Zeitpunkt vor Problem auswählen (z.B. vor 1 Stunde)
4. "Restore" bestätigen
5. Wartezeit: 5-15 Minuten

Stufe 2: Full Backup Restore (falls PITR nicht möglich)
────────────────────────────────────────────────────────
1. Supabase Dashboard → Database → Backups
2. Letztes erfolgreiches Daily Backup wählen
3. "Restore Backup" ausführen
4. Wartezeit: 15-60 Minuten (abhängig von Datenmenge)

Stufe 3: Base44 Entity-Fallback (falls Supabase komplett ausfällt)
──────────────────────────────────────────────────────────────────
1. Base44 Entities bleiben parallel aktiv (Woche 1-2)
2. Feature-Flag umschalten auf Entity-Mode
3. User arbeiten weiter mit Base44 Entities
4. Supabase-Problem beheben
5. Erneuter Migrationsversuch
```

**Dauer:** 5-60 Minuten (abhängig von Stufe)

**Risiko:** Mittel (Downtime während Restore)

---

### 2.3 Szenario 3: Datenkorruption (CRM-Daten)

**Beschreibung:** CRM-Daten (Kunden, Verträge) korrumpiert oder inkonsistent.

**Schweregrad:** Kritisch

**Rollback-Prozedur:**

```sql
-- 1. Korruption identifizieren
SELECT 
  entity_type,
  COUNT(*) AS affected_records,
  MAX(updated_at) AS last_change
FROM audit_logs
WHERE action = 'update'
  AND updated_at > NOW() - INTERVAL '1 hour'
GROUP BY entity_type;

-- 2. Betroffene Records finden
SELECT k.id, k.email, k.updated_at
FROM kunden k
WHERE k.updated_at > NOW() - INTERVAL '1 hour'
  AND k.updated_by = 'problematic-user@vsvv.ch';

-- 3. Backup-Stand finden
SELECT 
  backup_id,
  timestamp,
  entities
FROM backups
WHERE timestamp < NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC
LIMIT 1;

-- 4. Restore für betroffene Tabelle
-- ACHTUNG: Nur in Absprache mit Admin-Team!

-- Option A: Einzelne Records wiederherstellen
UPDATE kunden k
SET 
  vorname = b.vorname,
  nachname = b.nachname,
  email = b.email,
  updated_at = b.updated_at
FROM backup_kunden b
WHERE k.id = b.id
  AND k.id IN ('affected-id-1', 'affected-id-2');

-- Option B: Komplette Tabelle wiederherstellen
-- (nur ausserhalb Geschäftszeiten!)
TRUNCATE kunden CASCADE;
COPY kunden FROM 'backup_kunden_20260609.csv' CSV HEADER;

-- 5. Audit-Trail dokumentieren
INSERT INTO audit_logs (entity_type, action, details, user_email)
VALUES (
  'rollback',
  'restore',
  jsonb_build_object(
    'reason', 'Datenkorruption',
    'affected_records', 15,
    'restore_source', 'backup_kunden_20260609.csv'
  ),
  'admin@vsvv.ch'
);
```

**Dauer:** 30-120 Minuten

**Risiko:** Hoch (Datenverlust möglich)

---

### 2.4 Szenario 4: Komplette Migration fehlgeschlagen

**Beschreibung:** Vollständige Migration zu Supabase fehlgeschlagen, System instabil.

**Schweregrad:** Kritisch

**Rollback-Prozedur:**

```
Phase 1: Sofort-Massnahmen (0-15 Minuten)
─────────────────────────────────────────
1. Feature-Flag auf "Entity-Mode" umschalten
2. User-Communication versenden ("Wartungsmodus")
3. Supabase-Connector deaktivieren
4. Base44 Entities aktivieren (Fallback)

Phase 2: Datenwiederherstellung (15-60 Minuten)
───────────────────────────────────────────────
1. Letztes vollständiges Backup laden
2. Datenintegrität prüfen
   - COUNT aller Tabellen
   - Random-Samples prüfen
   - Foreign-Key-Integrität testen

Phase 3: System-Validierung (60-120 Minuten)
────────────────────────────────────────────
1. Smoke-Tests durchführen
   - Login ✅
   - Kundesuche ✅
   - Vergleich erstellen ✅
   - Import testen ✅

2. User-Acceptance-Test (kleine User-Gruppe)
   - 3-5 Tester auswählen
   - Kritische Workflows testen
   - Feedback einholen

Phase 4: Go/No-Go Entscheidung (120+ Minuten)
─────────────────────────────────────────────
1. Incident-Review mit Stakeholdern
2. Root-Cause-Analyse
3. Entscheidung:
   - ✅ Retry mit Fixes (nächster Versuch in 1 Woche)
   - ❌ Migration auf Eis legen (Base44 Entities bleiben)

4. Communication an alle User
```

**Dauer:** 2-4 Stunden

**Risiko:** Sehr Hoch (kompletter Migrations-Fehlschlag)

---

## 3. Recovery Time Objectives (RTO)

| Szenario | RTO | RPO |
|---|---|---|
| **Import-Fehler (BAG)** | 5 Min. | 0 (kein Datenverlust) |
| **DB-Problem (Supabase)** | 15 Min. | 1 Stunde (PITR) |
| **Datenkorruption (CRM)** | 60 Min. | 1 Stunde (Backup) |
| **Komplette Migration** | 4 Stunden | 0 (Base44 Fallback) |

**Definitionen:**
- **RTO (Recovery Time Objective):** Maximale akzeptable Downtime
- **RPO (Recovery Point Objective):** Maximaler Datenverlust (Zeit)

---

## 4. Backup-Validierung

### 4.1 Tägliche Checks

```sql
-- 1. Backup-Status prüfen
SELECT 
  backup_id,
  timestamp,
  status,
  size_mb
FROM backups
WHERE timestamp > NOW() - INTERVAL '1 day';

-- Erwartet: 1 erfolgreiches Backup pro Tag

-- 2. PITR-Funktionalität testen
-- (Einmal pro Woche)
SELECT pg_is_in_recovery();
-- Erwartet: false (Primary ist verfügbar)
```

### 4.2 Wöchentliche Restore-Tests

```bash
# 1. Test-Restore in isolierter Umgebung
supabase db restore \
  --backup-id backup-uuid \
  --target test-environment

# 2. Datenintegrität prüfen
psql -h test-db.supabase.co -c "
  SELECT 
    'kunden' AS table_name, COUNT(*) AS record_count FROM kunden
  UNION ALL
  SELECT 'vertraege', COUNT(*) FROM vertraege
  UNION ALL
  SELECT 'bag_praemien', COUNT(*) FROM bag_praemien;
"

# Erwartet: Counts stimmen mit Production überein (±5%)
```

### 4.3 Monatliche Disaster-Recovery-Tests

**Test-Szenario:**

```
1. Production-Backup erstellen (08:00)
2. Restore in Staging-Umgebung (09:00)
3. Vollständige Validierung (10:00-12:00)
   - Alle Tabellen prüfen
   - Foreign-Key-Integrität testen
   - Sample-Daten manuell prüfen
4. Report erstellen (13:00)
5. Lessons Learned dokumentieren (14:00)
```

**Checkliste:**

- [ ] Backup erfolgreich erstellt
- [ ] Restore abgeschlossen (< 60 Min.)
- [ ] Alle Tabellen vorhanden
- [ ] Record-Counts korrekt
- [ ] Foreign-Key-Integrität gegeben
- [ ] Sample-Daten validiert
- [ ] RTO eingehalten (< 60 Min.)
- [ ] RPO eingehalten (< 1 Stunde)
- [ ] Report erstellt
- [ ] Team informiert

---

## 5. Monitoring & Alerting

### 5.1 Backup-Monitoring

**Automated Checks:**

```javascript
// Daily Backup Check (Scheduled Function)
const checkDailyBackup = async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const backups = await getBackups({
    date_from: yesterday,
    status: 'completed'
  });
  
  if (backups.length === 0) {
    await sendAlert({
      type: 'critical',
      category: 'backup',
      message: 'Kein Daily Backup gefunden',
      details: `Erwartet: Backup für ${yesterday.toISOString()}`
    });
  }
};
```

### 5.2 Alert-Kategorien

| Kategorie | Schwere | Aktion |
|---|---|---|
| `backup_failed` | Critical | Sofortige Benachrichtigung an Admin |
| `backup_size_anomaly` | Warning | Review erforderlich |
| `pitr_not_available` | High | Supabase Support kontaktieren |
| `restore_failed` | Critical | Escalation an Admin-Team |

### 5.3 Alert-Kanäle

```
Critical Alerts:
├─ Email: admin@vsvv.ch
├─ SMS: +41 79 XXX XX XX
└─ Slack: #vsvv-alerts

Warning Alerts:
├─ Email: admin@vsvv.ch
└─ Slack: #vsvv-alerts

Info Alerts:
└─ Slack: #vsvv-monitoring
```

---

## 6. Dokumentation

### 6.1 Backup-Logs

**Speicherort:** `docs/backups/`

```
docs/backups/
├── backup_2026_06_09_0200.md
├── backup_2026_06_08_0200.md
├── restore_test_2026_06_01.md
└── disaster_recovery_test_2026_05_01.md
```

### 6.2 Backup-Report (Vorlage)

```markdown
# Daily Backup Report

**Datum:** 2026-06-09
**Uhrzeit:** 02:00 UTC
**Status:** ✅ Erfolgreich

## Details

- Backup-ID: backup-uuid-1234
- Start: 02:00:00 UTC
- Ende: 02:15:23 UTC
- Dauer: 15:23 Min.
- Grösse: 456.7 MB

## Tabellen

| Tabelle | Records | Grösse (MB) |
|---|---|---|
| bag_praemien | 217,472 | 234.5 |
| kunden | 5,000 | 12.3 |
| vertraege | 20,000 | 45.6 |
| ... | ... | ... |

## Validierung

✅ Backup erfolgreich abgeschlossen
✅ Alle Tabellen gesichert
✅ Checksummen validiert
✅ Storage: Supabase EU (Frankfurt)

## Nächster Backup

**Geplant:** 2026-06-10 02:00 UTC
```

### 6.3 Incident-Report (Vorlage)

```markdown
# Rollback Incident Report

**Datum:** 2026-06-09
**Incident-Typ:** Import-Fehler (BAG-Daten)
**Schweregrad:** Mittel

## Timeline

- **10:30:** Import gestartet
- **10:39:** Import abgeschlossen (217'470 Records)
- **10:45:** Validierung fehlgeschlagen (2 Fehler)
- **10:50:** Rollback entschieden
- **10:55:** Rollback abgeschlossen

## Root Cause

2 fehlerhafte Records:
1. Row 12345: Unbekannte Versicherer-ID 9999
2. Row 67890: Ungültige Prämie -50.00

## Actions Taken

1. ✅ Import-Version als rolled_back markiert
2. ✅ Alle Records gelöscht (217'470)
3. ✅ Fehlerjournal aktualisiert
4. ✅ Audit-Log erstellt

## Lessons Learned

- Mapping-Tabelle um unbekannte IDs erweitern
- Validierung vor Import verschärfen
- Plausibilitäts-Checks hinzufügen

## Prevention

- [ ] Mapping-Table automatisch aktualisieren
- [ ] Pre-Import-Validation verschärfen
- [ ] Alert bei Prämie < 0

**Report erstellt von:** admin@vsvv.ch
**Datum:** 2026-06-09
```

---

## 7. Kontakt & Escalation

### 7.1 On-Call Plan

| Woche | Primary | Secondary |
|---|---|---|
| 24 | Peter Adam | Hans Müller |
| 25 | Hans Müller | Lisa Schmidt |
| 26 | Lisa Schmidt | Peter Adam |

### 7.2 Escalation-Matrix

| Stufe | Kontakt | Reaktionszeit |
|---|---|---|
| **Level 1** | On-Call Admin | 15 Minuten |
| **Level 2** | IT-Lead | 30 Minuten |
| **Level 3** | CTO / CEO | 1 Stunde |
| **Supabase Support** | support@supabase.com | 24 Stunden |

---

## 8. Versionierung

| Version | Datum | Änderungen |
|---|---|---|
| 1.0 | 2026-06-09 | Initiale Version für Phase 1 |

---

## Zusammenfassung

### Backup-Strategie

✅ **Supabase Native Backups:** Daily (02:00 UTC), PITR (7 Tage)
✅ **Base44 Entity-Backups:** Wöchentlich (Fallback)
✅ **Multi-Tier Storage:** Supabase → Base44 → Extern (optional)

### Rollback-Szenarien

✅ **Import-Fehler:** 5 Minuten (nur BAG-Daten)
✅ **DB-Problem:** 15-60 Minuten (PITR oder Full Restore)
✅ **Datenkorruption:** 60-120 Minuten (Backup-Restore)
✅ **Komplette Migration:** 2-4 Stunden (Base44 Fallback)

### Recovery Objectives

| Metrik | Ziel |
|---|---|
| **RTO (Recovery Time)** | 5 Min. - 4 Std. (abhängig von Szenario) |
| **RPO (Recovery Point)** | 0 - 1 Stunde (kein/minimaler Datenverlust) |

### Tests & Validierung

✅ **Täglich:** Backup-Status prüfen
✅ **Wöchentlich:** Restore-Test (Staging)
✅ **Monatlich:** Disaster-Recovery-Test (Full)

---

**Nächste Schritte:**

1. ✅ Backup-Konzept erstellt
2. ⏳ Supabase Backups konfigurieren (Phase 1)
3. ⏳ Ersten manuellen Backup erstellen (vor Migration)
4. ⏳ Wöchentliche Restore-Tests einplanen
5. ⏳ On-Call-Plan definieren