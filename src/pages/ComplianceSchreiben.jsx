import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Copy, 
  Mail, 
  FileText, 
  CheckCircle2, 
  Shield,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const COMPLIANCE_LETTER = `# Sicherheits- und Compliance-Anfrage für Versicherungsdaten (Schweiz)

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

**Peter Martin Adam**  
Geschäftsführer  
VSV ManaGE

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
- Versicherungsvertragsgesetz (VVG)`;

export default function ComplianceSchreiben() {
  const handleCopy = () => {
    navigator.clipboard.writeText(COMPLIANCE_LETTER);
    toast.success('Schreiben in Zwischenablage kopiert');
  };

  const handleDownload = () => {
    const blob = new Blob([COMPLIANCE_LETTER], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'BASE44_Compliance_Anfrage.md';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Download gestartet');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent('Compliance-Anfrage für CRM-System im Versicherungsbereich (FINMA-relevant)');
    const body = encodeURIComponent(COMPLIANCE_LETTER);
    window.open(`mailto:support@base44.com?subject=${subject}&body=${body}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            BASE44 Compliance-Anfrage
          </h1>
          <p className="text-muted-foreground mt-1">
            Sicherheits- und Compliance-Anfrage für Versicherungsdaten (Schweiz)
          </p>
        </div>
        <Badge variant="outline" className="badge-info">
          FINMA-relevant
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Button onClick={handleCopy} variant="outline" className="justify-start">
          <Copy className="w-4 h-4 mr-2" />
          Kopieren
        </Button>
        <Button onClick={handleDownload} variant="outline" className="justify-start">
          <Download className="w-4 h-4 mr-2" />
          Download .md
        </Button>
        <Button onClick={handleEmail} className="justify-start">
          <Mail className="w-4 h-4 mr-2" />
          Per E-Mail senden
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Schreiben an Base44
          </CardTitle>
          <CardDescription>
            Vollständige Compliance-Anfrage mit allen kritischen Punkten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none bg-slate-50 p-6 rounded-lg border border-slate-200">
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">
              {COMPLIANCE_LETTER}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Nächste Schritte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Schreiben kopieren oder herunterladen</li>
            <li>Per E-Mail senden an: <strong>support@base44.com</strong></li>
            <li>Alternativ: Über Base44 Security Trust Center einreichen</li>
            <li>Auf schriftliche Antwort warten (10 Werktage)</li>
            <li>Erst nach positiver Bestätigung Kundendaten importieren</li>
          </ol>
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800 font-medium">
              ⚠️ Wichtig: Keine Kundendaten mit Gesundheitsinformationen importieren, 
              bevor die Compliance-Anfrage nicht geklärt ist.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <ExternalLink className="w-4 h-4" />
        <a 
          href="https://base44.com/security" 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline hover:text-primary"
        >
          Base44 Security Trust Center
        </a>
      </div>
    </div>
  );
}