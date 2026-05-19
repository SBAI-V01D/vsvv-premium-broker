# AdvisoryDossierEngine — Strategische Entwicklungsrichtlinien

> **Status:** Verbindlich · Gültig ab: 2026-05-19  
> **Zweck:** Leitplanken für alle zukünftigen Erweiterungen der AdvisoryDossierEngine.  
> **Priorität:** Stabilität, Konsistenz und Datenqualität vor neuen Features.

---

## 1. Architekturdisziplin

Keine Schnelllösungen. Keine Logik-Duplikationen. Keine versteckte Businesslogik in UI-Komponenten. Keine direkten Seiteneffekte. Keine unkontrollierten State-Mutationen.

**Businesslogik ausschliesslich in:**
- `/lib/` — pure functions, deterministische Berechnungen
- isolierten Services
- nie direkt in React-Komponenten

---

## 2. CRM-Kernsystem bleibt unberührt

Die AdvisoryDossierEngine bleibt vollständig modular und additiv.

**NICHT verändern:**
- Leads, Verkaufschancen, Verträge, Provisionen
- Merge-System, bestehende Customer-Flows
- bestehende Kern-Relations

**Nur additive Erweiterungen innerhalb:**
- `/components/dossier/`
- `/pages/advisory-dossier/`
- `/lib/`
- isolierte neue Entities (z.B. `ComparisonEntry`, `AdvisoryDossier`, `DossierSnapshot`)

---

## 3. KI bleibt assistierend — niemals autonom

**KI darf:**
- analysieren, strukturieren, vorschlagen, markieren

**KI darf NICHT:**
- ungeprüft speichern
- automatisch überschreiben
- Verträge verändern, Policen mutieren
- Empfehlungen autonom freigeben

**Immer:** KI-Vorschlag → Review → Benutzerbestätigung → Persistierung

---

## 4. Datenqualität vor neuen Features

**Priorisieren:**
- Datenkonsistenz, Confidence-Monitoring, Fehlertracking
- Qualitätsmetriken, Korrekturlogging, Reproduzierbarkeit
- deterministische Berechnungen

**Zurückstellen (bis nach Stabilisierung):**
- neue Automationen, neue KI-Features, neue UI-Spielereien

---

## 5. UX-Prinzipien

**Ziel: Beratergeschwindigkeit maximieren.**

- Weniger Klicks, weniger Scrollen
- Bessere Tastaturbedienung (Alt+← / Alt+→)
- Schnellere Review-Prozesse, klare visuelle Prioritäten
- Keine Modal-Überladung, konsistente Navigation
- Keine Reload-Zwänge, keine stale states, keine doppelten Bestätigungen

---

## 6. Performance & Skalierung

**Frühzeitig berücksichtigen:**
- Grosse Familien, viele Vergleichsvarianten, grosse PDFs, viele Snapshots
- KI-Analysevolumen, parallele Sessions

**Massnahmen:**
- Lazy Rendering, Query-Optimierung, Memoization
- Pagination, Rate-Limits, Upload-Limits

---

## 7. Observability & Debugging

**Weiter ausbauen:**
- Quality Dashboards (`AiExtractionQualityDashboard`)
- Fehlerprotokolle (`SystemLog`, `AuditLog`)
- KI-Korrekturtracking (`aiCorrectionLogger`)
- Session-Metriken, Performance-Monitoring, Auditierbarkeit

---

## 8. Release-Reihenfolge

**Vor neuen Grossfeatures zuerst:**
1. Reale Beratungstests + Beraterfeedback
2. UX-Hardening + Datenqualitätsprüfung
3. Lasttests + Browser-/Printtests

**Erst danach:**
- Kundenportal, Mailautomationen, digitale Signaturen
- Weitergehende KI-Assistenz, Multi-Sparten-Ausbau

---

## 9. Langfristiges Ziel

Das Ziel ist nicht nur ein CRM-Modul.

> **Eine intelligente, strukturierte und KI-unterstützte Beratungsplattform für Versicherungs- und Finanzlösungen — stabil, nachvollziehbar und enterprise-tauglich.**

---

*Dieses Dokument ist bindend für alle Entwicklungsentscheidungen innerhalb der AdvisoryDossierEngine.*