# VSVV CRM - Supabase Sicherheitskonzept & Konfiguration

**Version:** 1.0  
**Datum:** 2026-06-09  
**Status:** Phase 1 - Zur Prüfung

---

## 1. Supabase-Projekt Konfiguration

### 1.1 Projekt-Setup

**Entscheidung:** Neues, dediziertes Supabase-Projekt für VSVV CRM

**Projekt-Details:**

| Eigenschaft | Wert | Begründung |
|---|---|---|
| **Projekt-Name** | `vsvv-crm-production` | Eindeutige Identifikation |
| **Organisation** | `vsvv-schweiz` | Organisatorische Trennung |
| **Region** | `eu-central-1` (Frankfurt) | ✅ DSG-konform (Schweizer Nähe) |
| **Plan** | **Pro** ($25/Monat) | Für Production-Features |
| **Database Version** | PostgreSQL 15 | Latest LTS |

**Alternative Regionen:**

| Region | Standort | Latenz CH | DSG-Konform |
|---|---|---|---|
| `eu-central-1` | Frankfurt, DE | ~15ms | ✅ Ja |
| `eu-west-1` | Dublin, IE | ~25ms | ✅ Ja |
| `eu-west-2` | London, UK | ~30ms | ⚠️ Nach Brexit |

**Empfehlung:** `eu-central-1` (Frankfurt)
- Beste Performance für Schweiz
- EU-DSG konform
- Niedrigste Latenz

---

### 1.2 Projekt-Erstellung

**Schritt-für-Schritt:**

```
1. Login unter https://supabase.com
2. "New Project" klicken
3. Organisation wählen: "vsvv-schweiz"
4. Projekt-Name: "vsvv-crm-production"
5. Database Password: [Sicheres Passwort generieren]
6. Region: "Europe Central (Frankfurt)"
7. Pricing Plan: "Pro" ($25/Monat)
8. "Create new project" bestätigen
```

**Wartezeit:** 5-10 Minuten bis Projekt bereit

**Nach Erstellung verfügbar:**

```
Project Settings → API
├─ Project URL: https://xxxxx.supabase.co
├─ Anon/Public Key: eyJhbGc... (für Frontend)
└─ Service Role Key: eyJhbGc... (NUR für Backend!)
```

---

## 2. Secrets-Konzept

### 2.1 Secret-Speicherung

**Speicherort:** Base44 Dashboard → Settings → Secrets

**Base44 Secrets:**

```
Base44 Dashboard → Settings → Secrets
├─ SUPABASE_URL
├─ SUPABASE_ANON_KEY
└─ SUPABASE_SERVICE_ROLE_KEY
```

**Sicherheitseigenschaften:**

| Eigenschaft | Implementierung |
|---|---|
| **Verschlüsselung** | AES-256 bei Speicherung |
| **Übertragung** | TLS 1.3 (End-to-End) |
| **Zugriff** | Nur für Admin-Rolle sichtbar |
| **Logging** | Kein Secret-Wert in Logs |
| **Rotation** | Manuell bei Kompromittierung |

---

### 2.2 Secret-Definitionen

#### **SUPABASE_URL**

```yaml
Name: SUPABASE_URL
Wert: https://xxxxx.supabase.co
Sichtbarkeit: Public (in Frontend verwendbar)
Verwendung: Base URL für alle API-Calls
Beispiel: https://vsvvcrmproduction.supabase.co
```

**Verwendung im Code:**

```javascript
// Frontend (sicher)
const SUPABASE_URL = process.env.SUPABASE_URL;
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Backend (sicher)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
```

---

#### **SUPABASE_ANON_KEY**

```yaml
Name: SUPABASE_ANON_KEY
Wert: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Sichtbarkeit: Public (in Frontend verwendbar)
Verwendung: Frontend Read-Operations
Einschränkung: Nur RLS-geschützte Operationen
```

**Security-Eigenschaften:**

- ✅ Darf im Frontend verwendet werden
- ✅ Unterliegt RLS-Policies
- ✅ Kann nur öffentliche/endnutzer-freigegebene Daten lesen
- ❌ Kann keine Admin-Operationen durchführen
- ❌ Kann keine RLS-Policies umgehen

**Verwendung:**

```javascript
// Frontend (sicher)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY // ✅ Sicher für Frontend
);

// Read-Operation (RLS-geschützt)
const { data } = await supabase
  .from('kunden')
  .select('*')
  .eq('advisor_id', userId);
```

---

#### **SUPABASE_SERVICE_ROLE_KEY**

```yaml
Name: SUPABASE_SERVICE_ROLE_KEY
Wert: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Sichtbarkeit: SECRET (NIEMALS im Frontend!)
Verwendung: Backend Functions mit Admin-Rechten
Einschränkung: Ausschliesslich server-side
```

**⚠️ KRITISCHE SICHERHEITSREGELN:**

```
✅ DO: In Backend-Functions verwenden
✅ DO: In Base44 Secrets speichern
✅ DO: Nur für Admin-Operationen nutzen
✅ DO: RLS explizit deaktivieren wenn nötig

❌ DON'T: Im Frontend-Code verwenden
❌ DON'T: In Client-side Code exponieren
❌ DON'T: In Console.log ausgeben
❌ DON'T: In Git commiten
❌ DON'T: An Endnutzer weitergeben
```

**Sicherheitsmassnahmen:**

| Massnahme | Implementierung |
|---|---|
| **Frontend-Block** | Code-Review prüft auf Service Role im Frontend |
| **Linting** | ESLint-Regel verbietet `SERVICE_ROLE_KEY` in Frontend-Dateien |
| **Build-Check** | CI/CD prüft auf geleakte Secrets |
| **Access-Log** | Alle Service-Role-Operationen werden geloggt |
| **Rotation** | Bei Verdacht sofort rotieren |

---

### 2.3 Secret-Zugriff

**Zugriffsmatrix:**

| Rolle | SUPABASE_URL | SUPABASE_ANON_KEY | SUPABASE_SERVICE_ROLE_KEY |
|---|---|---|---|
| **Admin (Peter Adam)** | ✅ Voll | ✅ Voll | ✅ Voll |
| **Developer** | ✅ Voll | ✅ Voll | ❌ Kein Zugriff |
| **Endnutzer (Frontend)** | ✅ Indirekt | ✅ Indirekt | ❌ Niemals |
| **Backend Function** | ✅ Voll | ✅ Voll | ✅ Voll (server-side) |

**Zugriffsschutz:**

```
Base44 Dashboard → Settings → Secrets
├─ Nur Admin-Rolle kann Secrets sehen/bearbeiten
├─ Secrets sind verschlüsselt gespeichert
├─ Kein Secret-Export möglich
└─ Audit-Log bei Änderungen
```

---

## 3. Sicherheitsarchitektur

### 3.1 Mehrschichtige Sicherheit

```
┌─────────────────────────────────────────────────────────┐
│                    Sicherheitsschichten                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Layer 1: Frontend (Browser)                            │
│  ─────────────────────────────                          │
│  ✅ Nur ANON_KEY (RLS-geschützt)                        │
│  ✅ Keine Admin-Operationen möglich                     │
│  ✅ RLS filtert Daten automatisch                       │
│                                                         │
│  Layer 2: Backend Functions (Deno)                      │
│  ─────────────────────────────                          │
│  ✅ Service Role Key (server-side)                      │
│  ✅ Admin-Operationen möglich                           │
│  ✅ Auth-Check vor Function-Aufruf                      │
│                                                         │
│  Layer 3: Database (PostgreSQL)                         │
│  ─────────────────────────────                          │
│  ✅ RLS-Policies auf allen Tabellen                     │
│  ✅ Row-Level Security erzwingt Zugriffsschutz          │
│  ✅ Audit-Logs für alle Änderungen                      │
│                                                         │
│  Layer 4: Network (HTTPS/TLS)                           │
│  ─────────────────────────────                          │
│  ✅ TLS 1.3 für alle Verbindungen                       │
│  ✅ Certificate Pinning                                 │
│  ✅ Rate Limiting                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### 3.2 RLS-Policies (Row Level Security)

**Grundprinzip:**

```sql
-- Jede Tabelle hat RLS aktiviert
ALTER TABLE kunden ENABLE ROW LEVEL SECURITY;

-- Policy: User sieht nur eigene Kunden
CREATE POLICY "User kann eigene Kunden sehen"
ON kunden FOR SELECT
USING (
  advisor_id = current_setting('app.current_user_id')::uuid
  OR 
  current_setting('app.current_user_role') = 'admin'
);
```

**Policy-Typen:**

| Policy | Beschreibung | Beispiel |
|---|---|---|
| **SELECT** | Wer darf lesen? | Advisor sieht nur eigene Kunden |
| **INSERT** | Wer darf erstellen? | Nur Admins und Advisors |
| **UPDATE** | Wer darf ändern? | Owner oder Admin |
| **DELETE** | Wer darf löschen? | Nur Admins |

**RLS-Implementierung für VSVV CRM:**

```sql
-- 1. Kunden-Tabelle
CREATE POLICY "advisor_own_customers"
ON kunden FOR SELECT
USING (
  advisor_id = current_user_id() 
  OR user_role() = 'admin'
  OR organization_id = current_user_org()
);

-- 2. Verträge-Tabelle
CREATE POLICY "advisor_own_contracts"
ON vertraege FOR SELECT
USING (
  advisor_id = current_user_id()
  OR user_role() = 'admin'
);

-- 3. BAG-Prämien (öffentlich für alle Auth-Users)
CREATE POLICY "authenticated_read_bag"
ON bag_praemien FOR SELECT
TO authenticated
USING (true);

-- 4. Audit-Logs (nur Admins)
CREATE POLICY "admin_only_audit_logs"
ON audit_logs FOR ALL
USING (user_role() = 'admin');
```

---

### 3.3 Service Role Key Sicherheit

**Verwendung ausschliesslich in Backend-Functions:**

```javascript
// ✅ KORREKT: Backend-Function (functions/importBAGDatenToSupabase.js)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  // 1. User authentifizieren
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // 2. Service Role Key aus Environment (NICHT im Code!)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  
  // 3. Supabase Client mit Service Role (server-side!)
  const { createClient } = await import('npm:@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false } // Kein Session-Persisting
  });
  
  // 4. Admin-Operation durchführen
  const { data, error } = await supabase
    .from('bag_praemien')
    .insert(records);
    
  return Response.json({ data, error });
});
```

```javascript
// ❌ FALSCH: Niemals im Frontend!
// Diese Datei würde NIE committen werden!

// components/BAGImport.jsx
const serviceRoleKey = 'eyJhbGc...'; // ❌ CRITICAL SECURITY ISSUE!
```

---

### 3.4 Security-Checks

**Pre-Deployment Checks:**

```bash
# 1. Scan auf geleakte Secrets
grep -r "SERVICE_ROLE_KEY" components/ pages/
# Erwartet: Keine Ergebnisse

# 2. Scan auf hardcoded Keys
grep -r "eyJhbG" components/ pages/
# Erwartet: Keine Ergebnisse (ausser in .env.example mit Platzhaltern)

# 3. Environment-Variablen prüfen
echo $SUPABASE_SERVICE_ROLE_KEY
# Erwartet: Wert gesetzt (in CI/CD)
```

**Code-Review Checklist:**

- [ ] Kein Service Role Key in Frontend-Dateien (components/, pages/)
- [ ] Alle Backend-Functions verwenden `Deno.env.get()`
- [ ] RLS-Policies auf allen sensiblen Tabellen aktiv
- [ ] Audit-Logging für Admin-Operationen
- [ ] Rate-Limiting für öffentliche Endpoints

---

## 4. Zugriffsschutz

### 4.1 Wer hat Zugriff?

**Supabase Dashboard:**

| Person | Zugriff | Rolle |
|---|---|---|
| **Peter Adam** | ✅ Vollzugriff (Owner) | admin |
| **Entwickler** | ❌ Kein Dashboard-Zugriff | - |
| **Endnutzer** | ❌ Kein Dashboard-Zugriff | - |

**Base44 Dashboard:**

| Person | Zugriff | Rolle |
|---|---|---|
| **Peter Adam** | ✅ Vollzugriff (Admin) | admin |
| **Entwickler** | ⚠️ Nur Code (keine Secrets) | developer |
| **Endnutzer** | ❌ Nur App-UI | user |

**Supabase Database:**

| Operation | Frontend (ANON) | Backend (SERVICE) |
|---|---|---|
| **SELECT kunden** | ✅ Nur eigene (RLS) | ✅ Alle (Admin) |
| **INSERT kunden** | ❌ Blockiert | ✅ Mit Auth-Check |
| **SELECT bag_praemien** | ✅ Alle (public) | ✅ Alle |
| **DELETE bag_praemien** | ❌ Blockiert | ✅ Mit Auth-Check |
| **ALTER TABLE** | ❌ Blockiert | ✅ Admin nur |

---

### 4.2 Zugriffskontrolle (Backend)

**Auth-Check in jeder Function:**

```javascript
// Standard-Template für alle Backend-Functions
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  // 1. Authentifizierung prüfen
  const user = await base44.auth.me();
  if (!user) {
    return Response.json(
      { error: 'Authentication required' }, 
      { status: 401 }
    );
  }
  
  // 2. Autorisierung prüfen (für Admin-Operations)
  if (requiresAdmin && user.role !== 'admin') {
    return Response.json(
      { error: 'Admin access required' }, 
      { status: 403 }
    );
  }
  
  // 3. Service Role Key laden (aus Environment, NICHT im Code!)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  // 4. Operation durchführen
  // ...
});
```

---

## 5. Monitoring & Audit

### 5.1 Audit-Logging

**Was wird geloggt?**

| Event | Details | retention |
|---|---|---|
| **Login** | User-ID, Timestamp, IP | 1 Jahr |
| **Data-Read** | Tabelle, User, Timestamp | 90 Tage |
| **Data-Write** | Tabelle, User, Alt/Neu-Wert | 10 Jahre |
| **Admin-Op** | Function, User, Parameter | 10 Jahre |
| **RLS-Violation** | User, Tabelle, Policy | 1 Jahr |

**Audit-Log Tabelle:**

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID,
  user_email TEXT,
  action TEXT, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
  table_name TEXT,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT
);

-- Index für Performance
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
```

---

### 5.2 Security-Monitoring

**Automated Alerts:**

```javascript
// Function: monitorSecurityEvents
const alerts = [
  {
    name: 'Service_Role_Leak',
    condition: 'service_role_used_in_frontend',
    severity: 'CRITICAL',
    action: 'Sofortige Benachrichtigung + Key-Rotation'
  },
  {
    name: 'Massendownload',
    condition: 'select_count > 10000 in 1 hour',
    severity: 'HIGH',
    action: 'Benachrichtigung + Review'
  },
  {
    name: 'RLS_Violations',
    condition: 'rls_violation_count > 100 in 1 hour',
    severity: 'MEDIUM',
    action: 'Benachrichtigung + Investigation'
  },
  {
    name: 'Failed_Logins',
    condition: 'failed_logins > 10 in 5 minutes',
    severity: 'MEDIUM',
    action: 'Benachrichtigung + IP-Block'
  }
];
```

---

## 6. Secret-Rotation

### 6.1 Rotation-Szenarien

**Geplante Rotation:**

| Secret | Intervall | Grund |
|---|---|---|
| ANON_KEY | 12 Monate | Best Practice |
| SERVICE_ROLE_KEY | 12 Monate | Best Practice |
| Database Password | 12 Monate | Compliance |

**Ausserplanmässige Rotation:**

| Szenario | Aktion | Frist |
|---|---|---|
| **Verdacht auf Leak** | Sofort rotieren | < 1 Stunde |
| **Mitarbeiter verlässt** | Rotieren wenn Zugriff | < 24 Stunden |
| **Security-Incident** | Sofort rotieren + Audit | < 30 Minuten |

---

### 6.2 Rotation-Prozess

**Schritt-für-Schritt:**

```
1. Neue Keys generieren
   ─────────────────────
   Supabase Dashboard → Settings → API
   → "Regenerate Keys" bestätigen
   
2. Neue Keys in Base44 Secrets aktualisieren
   ───────────────────────────────────────
   Base44 Dashboard → Settings → Secrets
   → SUPABASE_ANON_KEY updaten
   → SUPABASE_SERVICE_ROLE_KEY updaten
   
3. Backend-Functions neu deployen
   ─────────────────────────────
   Base44 Dashboard → Code → Functions
   → Alle Functions neu deployen (lädt neue Secrets)
   
4. Testen
   ─────
   → Frontend: Vergleich erstellen ✅
   → Backend: Import testen ✅
   → RLS: Zugriffstests ✅
   
5. Alte Keys invalidieren (optional)
   ────────────────────────────────
   Supabase Dashboard → Settings → API
   → Alte Keys manuell invalidieren
```

**Dauer:** 10-15 Minuten

**Risiko:** Niedrig (kein Downtime, rollierendes Update)

---

## 7. Notfallplan

### 7.1 Kompromittierte Secrets

**Sofortmassnahmen:**

```
Stufe 1: Service Role Key kompromittiert (0-15 Minuten)
────────────────────────────────────────────────────
1. Service Role Key sofort rotieren
   Supabase Dashboard → Regenerate Service Role Key

2. Neue Keys in Base44 Secrets aktualisieren
   Base44 Dashboard → Settings → Secrets

3. Alle Backend-Functions neu deployen
   Base44 Dashboard → Code → Functions → Redeploy

4. Audit-Logs prüfen
   Wer hat Key verwendet? Wann? Welche Operationen?

5. Incident-Report erstellen
   Dokumentation für Compliance

Stufe 2: Anon Key kompromittiert (0-30 Minuten)
────────────────────────────────────────────
1. Anon Key rotieren
   Supabase Dashboard → Regenerate Anon Key

2. Frontend neu deployen (lädt neuen Key)
   Base44 Dashboard → Deploy → Redeploy

3. RLS-Policies prüfen
   Wurden Daten unrechtmässig gelesen?

4. User-Benachrichtigung (falls Daten betroffen)
   Information an betroffene Kunden

Stufe 3: Database Password kompromittiert (0-60 Minuten)
──────────────────────────────────────────────────────
1. Database Password ändern
   Supabase Dashboard → Settings → Database

2. Connection-Strings updaten
   Alle Services updaten

3. Access-Logs prüfen
   Wer hatte Zugriff?

4. Ggf. Database migrieren (falls kompromittiert)
```

---

## 8. Compliance

### 8.1 DSG-Konformität (Datenschutzgesetz)

**Massnahmen:**

| Anforderung | Umsetzung |
|---|---|
| **Datenlokalisierung** | ✅ EU-Region (Frankfurt) |
| **Verschlüsselung** | ✅ TLS 1.3 + AES-256 |
| **Zugriffskontrolle** | ✅ RLS + Auth-Checks |
| **Audit-Trail** | ✅ Alle Operationen geloggt |
| **Datenminimierung** | ✅ Nur notwendige Felder |
| **Löschkonzept** | ✅ Automatische Bereinigung |

### 8.2 FINMA-Konformität

**Massnahmen:**

| Anforderung | Umsetzung |
|---|---|
| **Aufbewahrungsfrist** | ✅ 10 Jahre für Verträge |
| **Revisionssicherheit** | ✅ Audit-Logs unveränderbar |
| **Zugriffsschutz** | ✅ 4-Faktor-Auth (RLS + Auth) |
| **Notfallkonzept** | ✅ Backup + Rollback definiert |
| **Dokumentation** | ✅ Vollständige Dokumentation |

---

## 9. Zusammenfassung

### 9.1 Supabase-Projekt

✅ **Neues Projekt:** `vsvv-crm-production`  
✅ **Region:** `eu-central-1` (Frankfurt, Deutschland)  
✅ **Plan:** Pro ($25/Monat)  
✅ **DSG-konform:** ✅ Ja (EU-Region)

### 9.2 Secrets

✅ **Speicherort:** Base44 Dashboard → Settings → Secrets  
✅ **Verschlüsselung:** AES-256  
✅ **Zugriff:** Nur Admin-Rolle (Peter Adam)  
✅ **Rotation:** 12 Monate oder bei Incident

### 9.3 Service Role Key Sicherheit

✅ **Verwendung:** Ausschliesslich Backend-Functions  
✅ **Frontend-Schutz:** Code-Reviews + Linting + CI/CD-Checks  
✅ **RLS:** Alle Tabellen geschützt  
✅ **Audit-Log:** Alle Operationen geloggt

### 9.4 Zugriffskontrolle

✅ **Frontend:** Nur ANON_KEY (RLS-geschützt)  
✅ **Backend:** Service Role Key (mit Auth-Check)  
✅ **Database:** RLS-Policies auf allen Tabellen  
✅ **Monitoring:** Automated Alerts

---

## 10. Nächste Schritte

**Nach Ihrer Prüfung:**

1. ⏳ Supabase-Projekt erstellen (Frankfurt)
2. ⏳ Projekt-URL und Keys notieren
3. ⏳ Secrets in Base44 Dashboard eintragen
4. ⏳ SQL-Schema implementieren
5. ⏳ RLS-Policies aktivieren
6. ⏳ Test-Import durchführen

---

**Dokument erstellt von:** Entwicklung  
**Datum:** 2026-06-09  
**Version:** 1.0  
**Status:** Zur Prüfung durch Admin

---

## Anhang: Supabase-Projekt Checkliste

**Vor der Erstellung:**

- [ ] Organisation `vsvv-schweiz` existiert
- [ ] Admin-Account (Peter Adam) hat Zugriff
- [ ] Payment-Methinterlegt (für Pro-Plan)
- [ ] Region `eu-central-1` ausgewählt

**Nach der Erstellung:**

- [ ] Project URL notiert: `https://xxxxx.supabase.co`
- [ ] Anon Key notiert: `eyJhbGc...`
- [ ] Service Role Key notiert: `eyJhbGc...` (GEHEIM!)
- [ ] Database Password gesichert
- [ ] 2FA für Admin-Account aktiviert

**In Base44 eintragen:**

- [ ] SUPABASE_URL in Secrets
- [ ] SUPABASE_ANON_KEY in Secrets
- [ ] SUPABASE_SERVICE_ROLE_KEY in Secrets
- [ ] Secrets getestet (Connection-Check)