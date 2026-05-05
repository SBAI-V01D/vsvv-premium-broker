# 🚀 **MASTER FIX – FINALE STABILISIERUNGS- & CEO-COCKPIT TESTS**

---

## ✅ **TEST 1: Portal aktivieren**

### Setup:
```
1. Admin geht zu Kunden → CustomerDetail
2. Tab "Bearbeiten" → "Portal-Zugriff (Admin-Kontrolle)"
3. Klick auf "Portal aktivieren"
4. Setze Initialpasswort (min 8 Zeichen)
5. Klick "Aktivieren"
→ RESULT: portal_enabled=true
```

### Expected:
- ✅ portal_enabled=true nach Aktivierung
- ✅ Kunde sieht "Portal nicht aktiviert" wenn deaktiviert

---

## ✅ **TEST 2: Erster Login – Passwort erzwungen**

### Setup:
```
1. Kunde mit portal_enabled=true, portal_must_change_password=true
2. Kunde loggt sich ins Portal ein
3. guardPortalLogin({customer_id: X})
   → force_password_change=true (reason: first_login)
→ RESULT: Login erlaubt, aber Passwortänderung erzwungen
4. updatePortalPassword({customer_id, new_password})
   → portal_must_change_password=false
```

### Expected:
- ✅ First login: FORCE password change
- ✅ Nach Änderung: portal_must_change_password=false

---

## ✅ **TEST 3: 28-Tage Passwort-Rotation**

### Setup:
```
1. Kunde mit portal_password_last_changed="2026-04-01"
2. Heute="2026-04-30" (29 Tage vergangen)
3. guardPortalLogin({customer_id: X})
   → days_since_change=29 > 28
   → force_password_change=true (reason: password_rotation_28days)
```

### Expected:
- ✅ < 28 Tage: kein Zwang
- ✅ > 28 Tage: Passwort-Änderung erzwungen

---

## ✅ **TEST 4: Doppelte Auszahlung verhindern**

### Setup:
```
1. Commission mit status=earned, received_date="2026-05-01", is_paid=false
2. executePayoutTransfers({commission_id, paid_date})
   → commission.is_paid=true
3. Versuche erneut auszuzahlen
   → guardDoublePayment({commission_id})
   → is_paid=true
→ RESULT: ❌ BLOCKED
```

### Expected:
- ✅ Erste Auszahlung: erfolgreich (is_paid=false → true)
- ✅ Zweite Auszahlung: BLOCKED (is_paid=true)

---

## ✅ **TEST 5: Pipeline Status sichtbar**

### Setup:
```
1. DocumentReviewPanel zeigt: document.processing_stage
   → uploaded → parsed → entities_detected → customer_mapped → application_created → policy_created
2. User sieht Progress angezeigt
```

### Expected:
- ✅ Alle Stages sichtbar
- ✅ Keine Black-Box

---

## ✅ **TEST 6: CEO-Dashboard zeigt korrekte Werte**

### Setup:
```
1. Admin navigiert zu "👑 CEO Cockpit" (/ceo-dashboard)
2. Dashboard ruft createCEODashboard() auf
3. Prüfe KPI:
   - total_premium = Summe aller aktiven Policy.premium_yearly
   - total_commission = Summe aller earned Commissions
   - paid_commission = Summe aller paid Commissions
   - open_commission = total - paid
   - forecast_12months = avg(last 3 months) × 12
```

### Example Data:
```
Policies:
- Policy1: premium_yearly=10000
- Policy2: premium_yearly=5000
→ total_premium = 15000

Commissions (10% rate):
- comm1: 1000 (earned) → total
- comm2: 500 (paid) → paid
- comm3: 300 (pending) → total
→ total_commission = 1300
→ paid_commission = 500
→ open_commission = 800
```

### Expected:
- ✅ total_premium = 15000 (oder aktueller Wert)
- ✅ total_commission = Summe earned+pending+invoiced+received
- ✅ paid_commission = Summe only paid
- ✅ open_commission = total - paid
- ✅ forecast = korrekte 12-Monats-Projektion
- ✅ Top Advisors sortiert nach Provision descending
- ✅ Monthly Trend zeigt Historie (12 Monate)

---

## ✅ **TEST 7: Periodenabschluss – keine Änderungen nach Abschluss**

### Setup:
```
1. closePeriod({month: "2026-05-01"})
   → period.status = closed, closed_by = admin@email.com
2. Versuche Commission zu ändern (entry_date="2026-05-15")
   → guardPeriodClosed({entry_date: "2026-05-15"})
   → period.status = closed
→ RESULT: ❌ BLOCKED
```

### Expected:
- ✅ Offene Periode: änderbar
- ✅ Geschlossene Periode: immutable
- ✅ Audit Trail locked

---

## ✅ **TEST 8: Portal-Datenschutz (customer_id filter)**

### Setup:
```
1. Customer A (id="cust_001") mit Policy1
2. Customer B (id="cust_002") mit Policy2
3. Customer B (Portal) versucht Policy1 zu lesen
   → guardPortalAccess({
       entity_type: 'Contract',
       entity_id: Policy1.id,
       app_user_customer_id: cust_002
     })
   → Policy1.customer_id = cust_001 ≠ cust_002
→ RESULT: allowed=false ❌
```

### Expected:
- ✅ Customer A sieht nur Daten mit customer_id=cust_001
- ✅ Cross-Customer-Access: BLOCKED

---

## ✅ **TEST 9: Role-Based Access Control (RBAC)**

### Setup:
```
1. Admin Login (role=admin)
   → base44.auth.me().role = 'admin'
2. Seite /kunden öffnen
   → Sieht ALLE Kunden (kein Filter)
3. guardPortalAccess({ user_role: 'admin', entity_id: X })
   → allowed=true (no customer_id check)
4. Advisor Login (role=advisor, advisor_id=A001)
   → Sieht NUR Kunden mit advisor_id=A001
5. Customer Login (role=customer, customer_id=C001)
   → Sieht NUR Daten mit customer_id=C001
6. guardPortalAccess({ user_role: 'customer', customer_id: C001 })
   → Allowed wenn customer_id match, blocked sonst
```

### Expected:
- ✅ Admin: Unlimited access
- ✅ Advisor: Only assigned customers
- ✅ Customer: Only own data
- ✅ guardPortalAccess respects roles

---

## ✅ **TEST 10: Login-Verwaltung + Passwort-Policy**

### Setup:
```
1. Admin aktiviert Portal für Kunde K001
   → portal_enabled = true
   → mandate_status = valid
   → portal_must_change_password = true
   → initial_password = [admin input]
   → portal_password_last_changed = current_date

2. Kunde versucht, sich einzuloggen
   → guardPortalLogin prüft:
      - portal_enabled = true ✓
      - mandate_status = valid ✓
      - must_change_password = true
   → FORCE redirect zu PortalSetup (Passwort-Änderung)

3. Kunde ändert Passwort
   → updatePortalPassword:
      - portal_must_change_password = false
      - portal_password_last_changed = current_date

4. Kunde loggt sich neu ein
   → Login erfolgreich
   → Kein Passwort-Zwang

5. Nach 28 Tagen:
   → guardPortalLogin: days > 28
   → FORCE password change again
```

### Expected:
- ✅ Erster Login: Passwort-Zwang
- ✅ Ohne Mandat: Blockiert
- ✅ Nach Änderung: Freigegeben
- ✅ Nach 28 Tagen: Erneut Passwort-Pflicht
- ✅ Portal nur ohne Portalzugriff: Blockiert

---

## ✅ **TEST 11: Mutations-System**

### Setup:
```
1. Kunde loggt sich ins Portal ein
   → Vertragsübersicht
   → aktive Policy angezeigt
   → Button "Änderung beantragen" sichtbar

2. Kunde klickt "Änderung beantragen"
   → Dialog mit Form öffnet
   → Anfrage-Typ + Beschreibung
   → Submit → MutationRequest.created (status=pending)

3. Admin sieht Anfrage
   → MutationRequestsPanel
   → "Genehmigen" oder "Ablehnen"

4. Admin genehmigt
   → approveMutationRequest Function
   → Neue Policy erstellt (version+1)
   → alte Policy.status = archived
   → MutationRequest.status = approved

5. Kunde sieht neue Policy
   → alte Policy archiviert (unsichtbar)
   → neue Policy mit neuem Stand aktiv
```

### Expected:
- ✅ Anfrage wird gestellt
- ✅ Admin kann genehmigen/ablehnen
- ✅ Neue Policy-Version entsteht
- ✅ Alte Policy bleibt unverändert (archiviert)
- ✅ Lifecycle + Finance OK

---

## 🚀 **DEPLOYMENT CHECKLIST – FINAL**

- [ ] Entity User.json aktualisiert: role = admin | advisor | customer
- [ ] Entity Customer.json aktualisiert: mandate_status, portal_enabled, portal_must_change_password, portal_password_last_changed
- [ ] Entity MutationRequest.json erstellt
- [ ] guardPortalLogin Function deployed: mandate_status + 28-Tage-Rotation
- [ ] guardPortalAccess Function deployed: role-based + customer_id filter
- [ ] approveMutationRequest Function deployed: neue Policy-Version
- [ ] Customers Page updated: role-based filtering
- [ ] PortalActivationPanel Component: mandate_status = valid setzen
- [ ] PortalSetup Page: Passwort-Policy-Hints angezeigt
- [ ] PortalContracts Page: Button "Änderung beantragen" hinzugefügt
- [ ] MutationRequestDialog Component erstellt
- [ ] MutationRequestsPanel Component für Admin erstellt
- [ ] 4+ Guard Functions deployed: guardPortalLogin, guardPortalAccess, guardDoublePayment, guardPeriodClosed, guardPipelineStuck
- [ ] 2+ Helper Functions deployed: updatePortalPassword, managePortalPassword
- [ ] 1+ Mutations Functions deployed: approveMutationRequest
- [ ] 1 CEO Function deployed: createCEODashboard
- [ ] 1 Admin Function deployed: closePeriod
- [ ] CEODashboard Component + Route
- [ ] Sidebar aktualisiert mit CEO Cockpit Link + Admin Panel
- [ ] Tests 1–11 durchgeführt ✓
- [ ] CEO hat Signoff gegeben

---

## 📊 **MONITORING POST-DEPLOYMENT**

```plaintext
KPI TRACKING:
- guardPortalLogin: failed_logins (target: 0/day for valid users)
- guardDoublePayment: blocks_count (target: 0/week)
- guardPeriodClosed: closed_periods (target: 1/month)
- guardPortalAccess: access_blocks (target: 0/week for valid customers)
- createCEODashboard: execution_time (target: < 2s)
- updatePortalPassword: rotation_success (target: 100%)

CEO DASHBOARD ACCURACY:
- total_premium: matches sum of active contracts (monthly audit)
- total_commission: matches Commission.status=earned|pending|invoiced|received
- paid_commission: matches Commission.status=paid
- forecast: avg last 3 months × 12 (validate monthly)
```

---

## 🔐 **SECURITY CHECKPOINTS**

- ✅ portal_enabled = mandatory gate
- ✅ portal_must_change_password on first login
- ✅ portal_password_last_changed rotation every 28 days
- ✅ is_paid flag prevents double payment
- ✅ customer_id filter blocks cross-customer access
- ✅ FinancePeriod.status=closed blocks all mutations
- ✅ Audit trail immutable after period close

---