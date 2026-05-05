# 📦 **ARILLA → Base44 IMPORT CHECKLISTE**

---

## 🎯 **ZIEL**
Saubere Daten ohne Chaos, ohne Duplikate, mit stabilen Verknüpfungen.

---

# **PHASE 1 – VORBEREITUNG**

## ✔️ Schritt 1: Export vorbereiten
```
1. Arilla öffnen
2. Alle Daten exportieren (CSV/Excel)
3. Struktur prüfen:
   - Kunden
   - Verträge
   - (optional) Provisionen
```

## ✔️ Schritt 2: Daten bereinigen
```
- ✓ Doppelte Kunden identifizieren
- ✓ E-Mail-Adressen validieren
- ✓ Namen standardisieren
- ✓ eindeutige IDs vergeben (z.B. customer_id)
```

## ✔️ Schritt 3: Mapping definieren
```
KUNDEN:
- Name → customer.first_name / .last_name
- Adresse → customer.street, .zip_code, .city
- E-Mail → customer.email
- Telefon → customer.phone
- Geburtsdatum → customer.birthdate

VERTRÄGE:
- Produkt → contract.product
- Jahresprämie → contract.premium_yearly
- Monatsprämie → contract.premium_monthly
- Startdatum → contract.start_date
- Ablaufdatum → contract.end_date
- Kunde-ID → contract.customer_id (KRITISCH!)
```

---

# **PHASE 2 – IMPORT REIHENFOLGE**

## 🚀 Schritt 1: Kunden importieren
```
1. Kunden-CSV bereit
2. Base44 → Kunden → Import
3. Mapping prüfen
4. Import starten
```

## 🚀 Schritt 2: Verträge importieren
```
1. Verträge-CSV bereit
2. customer_id korrekt verknüpft? ✓
3. Base44 → Verträge → Import
4. Stichprobe: 10–20 Datensätze prüfen
```

## 🚀 Schritt 3: Validierung
```
✔ Kunde angezeigt?
✔ Vertrag verknüpft?
✔ Ablaufdatum korrekt?
✔ Keine Duplikate?
```

---

# **PHASE 3 – HYBRID ERGÄNZUNG (DEIN USP)**

```
Optional:
→ Dokumente hochladen
→ KI ergänzt fehlende Felder
→ Daten verfeinern lassen
```

---

# **PHASE 4 – FEHLER VERMEIDEN**

## ❌ NICHT tun:
```
- Alles auf einmal importieren
- Ohne Mapping starten
- Ohne Testlauf arbeiten
- customer_id vergessen
```

## ✅ TUN:
```
- Schrittweise importieren
- Validieren nach jedem Schritt
- Backups machen
- Dokumentation führen
```

---

# **ERGEBNIS**

Nach dieser Checkliste hast du:
- ✓ Saubere Kundendaten
- ✓ Verknüpfte Verträge
- ✓ Stabile Basis für Automation
- ✓ Keine Duplikate oder Fehler

**Dauer: 1–2 Stunden | Aufwand: minimal | Nutzen: maximal** 💥