# Sicherheits- und Compliance-Anfrage für Versicherungsdaten (Schweiz)

**Absender:** VSV ManaGE  
**Datum:** 2026-06-08  
**Betreff:** Compliance-Anfrage für CRM-System im Versicherungsbereich (FINMA-relevant)

---

Sehr geehrtes Base44-Team

Wir beabsichtigen, über Base44 ein CRM-System für die Verwaltung von Kundendaten im Versicherungsbereich zu betreiben.

Da wir **Personendaten** und **besonders schützenswerte Daten** verarbeiten (Gesundheitsdaten, Versicherungsdeckungen, Policen, Schadendaten, Krankenkassen-Daten), benötigen wir eine schriftliche Bestätigung zu folgenden Punkten:

## 1. Datenstandort (KRITISCH für FINMA/revDSG)

* In welchem Land werden unsere Daten gespeichert?
* In welchen Rechenzentren werden die Daten gehostet? (Bitte konkrete Standorte nennen)
* Werden Kundendaten ausschliesslich in den USA oder auch in Europa gespeichert?
* Können wir den Speicherort der Daten frei wählen?
* Gibt es eine Möglichkeit für ausschliessliche **EU- oder Schweiz-Datenhaltung**?
* Falls nein: Welche Massnahmen gewährleisten die Einhaltung von revDSG und FINMA-Anforderungen?

## 2. Datenzugriff und Zugriffskontrolle

* Wer hat Zugriff auf unsere Kundendaten?
* Haben Base44-Mitarbeiter Zugriff auf Kundendaten?
* Falls ja, unter welchen Voraussetzungen? (Support, Wartung, etc.)
* Werden sämtliche Zugriffe protokolliert (Audit Log)?
* Können wir auf diese Audit-Logs zugreifen?
* Wie lange werden Audit-Logs aufbewahrt?
* Unterstützt Base44 **Row-Level Security** für mandantenfähige Datentrennung?
* Können Benutzerrechte granular gesteuert werden (RBAC)?

## 3. Verschlüsselung

* Werden Daten im Ruhezustand (**at rest**) verschlüsselt?
* Werden Daten während der Übertragung (**in transit**) verschlüsselt?
* Welche Verschlüsselungsstandards werden eingesetzt? (z.B. AES-256, TLS 1.3)
* Wer verwaltet die Verschlüsselungsschlüssel?
* Gibt es eine Möglichkeit für **Customer-Managed Keys**?

## 4. Compliance-Zertifizierungen

Bitte bestätigen Sie **schriftlich** und stellen Sie aktuelle Dokumente zur Verfügung:

### Zertifizierungen:
* [ ] **SOC 2 Type II** Zertifizierung (Bitte aktuellen Report zur Verfügung stellen)
* [ ] **ISO 27001** Zertifizierung (Bitte Zertifikat zur Verfügung stellen)
* [ ] **DSGVO/GDPR**-Konformität
* [ ] **Schweizer Datenschutzgesetz (revDSG)** Unterstützung
* [ ] **CCPA** Konformität (falls relevant)

### Dokumente:
* [ ] Aktueller **SOC 2 Type II Report**
* [ ] **ISO 27001 Zertifikat**
* [ ] **Data Processing Agreement (DPA)**
* [ ] **Subprocessor-Liste** (vollständig und aktuell)
* [ ] **Security Whitepaper** oder Security Documentation

## 5. KI-Modelle und Datenverarbeitung (KRITISCH für Kundendaten)

* Werden unsere Daten für das **Training von KI-Modellen** verwendet?
* Werden Kundendaten an **OpenAI, Anthropic** oder andere KI-Anbieter weitergeleitet?
* Falls ja, welche Daten? (Nur Prompts oder auch Entity-Daten?)
* Kann das **KI-Training vollständig deaktiviert** werden?
* Gibt es eine **Zero Data Retention**-Option für KI-API-Aufrufe?
* Werden KI-Prompts und -Antworten protokolliert? Wenn ja, wo und wie lange?
* Können wir sicherstellen, dass **besonders schützenswerte Daten** (Gesundheitsdaten) nicht an KI-Anbieter fliessen?

## 6. Datentrennung und Mandantenfähigkeit

* Sind unsere Daten **logisch oder physisch** von anderen Kunden getrennt?
* Wird **Row-Level Security** unterstützt?
* Können Benutzerrechte granular gesteuert werden?
* Gibt es eine **Single-Tenant**-Option für erhöhte Isolation?
* Wie wird sichergestellt, dass keine Datenlecks zwischen Mandanten auftreten?

## 7. FINMA und Versicherungsbranche (SPEZIFISCH)

Bitte bestätigen Sie **schriftlich**:

* Ob Base44 für **FINMA-regulierte Unternehmen** eingesetzt werden kann.
* Welche Kunden aus dem **Finanz- oder Versicherungssektor** Base44 bereits nutzen. (Referenzen)
* Welche organisatorischen und technischen Massnahmen zur Erfüllung der Anforderungen gemäss **FINMA-Rundschreiben** und **Schweizer Datenschutzgesetz** vorhanden sind.
* Ob Base44 die Anforderungen an **Auslagerung von Geschäftstätigkeiten** (FINMA RS 2018/3) erfüllt.
* Ob ein **Notfallplan** und **Business Continuity Plan** vorhanden sind.
* Wie die **Datenverfügbarkeit** gewährleistet wird (SLA, Uptime-Garantien).
* Ob **regelmässige Penetrationstests** durchgeführt werden und Ergebnisse verfügbar sind.

## 8. Datenexport und Löschung

* Können sämtliche Daten jederzeit exportiert werden?
* In welchem Format? (JSON, CSV, SQL, etc.)
* Gibt es eine API für den vollständigen Export?
* Wie erfolgt die vollständige Löschung nach Vertragsende?
* Wie lange verbleiben Backups nach Löschauftrag?
* Gibt es eine **automatische Löschfunktion** für Daten nach Ablauf der Aufbewahrungsfrist?

## 9. Datensicherheit und Incident Management

* Gibt es ein **Incident Response**-Verfahren?
* Wie werden Sicherheitsvorfälle gemeldet?
* Innerhalb welcher Frist werden Kunden über Datenpannen informiert? (DSGVO: 72h)
* Gibt es eine **24/7-Security-Überwachung**?
* Werden **regelmässige Security-Audits** durchgeführt?

## 10. Vertragliche und rechtliche Aspekte

* Wo ist Base44 rechtlich domiziliert? (USA, Schweiz, anderes Land?)
* Welches Recht findet Anwendung?
* Gibt es eine **Haftungsbeschränkung** bei Datenpannen?
* Ist eine **Cyber-Versicherung** vorhanden?
* Gibt es eine **Vertragstrafe** bei Compliance-Verstössen?

---

## Dringlichkeit

Da wir besonders schützenswerte Personendaten verarbeiten, ist diese Information **entscheidend** für unsere Go/No-Go-Entscheidung.

Wir bitten um:
1. **Schriftliche Beantwortung** sämtlicher Punkte
2. **Zustellung** der relevanten Compliance-Dokumentation (SOC 2, ISO 27001, DPA, Subprocessor-Liste)
3. Ein **Gespräch** mit Ihrem Security/Compliance-Team für offene Fragen

**Antwortfrist:** Bitte um Rückmeldung innerhalb von 10 Werktagen.

---

Freundliche Grüsse

[Dein Name]  
[Deine Position]  
[Firma]  
[Kontakt]
pETER mARTIN aDAM, gESCHÄFTSFÜHRER
---

## Anlage: Geplante Datenkategorien

Zur besseren Einschätzung unserer Anforderungen:

**Verarbeitete Datenkategorien:**
- Personenstammdaten (Namen, Adressen, Geburten, AHV-Nummern)
- Gesundheitsdaten (Krankenkassen-Prämien, Franchisen, Modellwahl)
- Vertragsdaten (Policen, Deckungen, Prämien, Laufzeiten)
- Finanzdaten (Kommissionen, Zahlungen, Bankverbindungen)
- Kommunikationsdaten (E-Mails, Telefonate, Beratungsvermerke)
- Schadendaten (Claim-Informationen)

**Besonders schützenswert nach revDSG:**
- Gesundheitsdaten (Krankenkassen, Versicherungsmodelle)
- Biometrische Daten (Geburtsdaten, Alter)
- Administrative Straftaten (Betreibungen, Schulden)

**Regulatorische Anforderungen:**
- FINMA-Rundschreiben 2018/3 (Auslagerung)
- Schweizer Datenschutzgesetz (revDSG)
- Geldwäschereigesetz (GwG)
- Versicherungsvertragsgesetz (VVG)