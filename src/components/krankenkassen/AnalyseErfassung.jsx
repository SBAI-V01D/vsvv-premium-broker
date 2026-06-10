import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  FileText,
  Sparkles
} from 'lucide-react';

export default function AnalyseErfassung({ formData, ergebnisse, kiAnalyse, onSave, onCancel }) {
  const [speichern, setSpeichern] = useState(false);
  
  const besteEmpfehlung = ergebnisse.find(e => e.ist_empfohlen) || ergebnisse[0];
  const aktuelleKasse = ergebnisse.find(e => e.ist_aktuell);

  const [beratungsergebnis, setBeratungsergebnis] = useState({
    kunde_folgt_empfehlung: false,
    kunde_moechte_ueberpruefen: false,
    kunde_lehnt_ab: false,
    abweichenung_begruendung: ''
  });

  const [notizen, setNotizen] = useState('');

  const handleSave = () => {
    setSpeichern(true);
    
    const analyseData = {
      customer_id: formData.customer_id,
      customer_name: `${formData.vorname} ${formData.nachname}`,
      organisation_id: formData.organization_id,
      analyse_datum: new Date().toISOString(),
      persoenliche_daten: {
        vorname: formData.vorname,
        nachname: formData.nachname,
        geburtsdatum: formData.geburtsdatum,
        plz: formData.plz,
        kanton: formData.kanton,
        geschlecht: formData.geschlecht
      },
      ausgangslage: {
        krankenkasse: formData.aktuelle_krankenkasse,
        modell: formData.aktuelles_modell,
        franchise: formData.aktuelle_franchise,
        unfall: formData.aktuelle_unfall,
        praemie_aktuell: aktuelleKasse?.praemie_netto || 0
      },
      empfehlung: {
        empfohlene_krankenkasse: besteEmpfehlung?.krankenkasse,
        empfohlenes_modell: besteEmpfehlung?.modell,
        empfohlene_franchise: besteEmpfehlung?.franchise,
        praemie_empfohlen: besteEmpfehlung?.praemie_netto || 0,
        ersparnis_jaehrlich: besteEmpfehlung?.ersparnis_jaehrlich || 0,
        ersparnis_prozent: besteEmpfehlung?.ersparnis_prozent || 0
      },
      beratungsergebnis,
      notizen,
      generate_pdf: true
    };

    onSave(analyseData);
  };

  const openPrimInfo = () => {
    const plz = formData.plz;
    const yob = new Date(formData.geburtsdatum).getFullYear();
    const deductible = formData.aktuelle_franchise;
    const accident = formData.aktuelle_unfall;
    
    const url = `https://www.priminfo.admin.ch/de/praemien?plz=${plz}&yob=${yob}&deductible=${deductible}&accident=${accident}`;
    window.open(url, '_blank');
  };

  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Beratungs-Analyse erfassen
          </CardTitle>
          <Badge variant="outline" className="badge-info">
            {formData.vorname} {formData.nachname}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* BAG-Rechner Button */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-blue-900">Offizieller BAG-Rechner</p>
              <p className="text-xs text-blue-700 mt-1">
                Öffne priminfo.admin.ch mit vorausgefüllten Kundendaten
              </p>
            </div>
            <Button onClick={openPrimInfo} size="sm" className="bg-blue-600 hover:bg-blue-700">
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              BAG-Rechner öffnen
            </Button>
          </div>
        </div>

        {/* Empfehlung anzeigen */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="p-3 rounded-lg border bg-slate-50">
            <p className="text-xs text-muted-foreground mb-1">Aktuelle Versicherung</p>
            <p className="font-semibold text-sm">{aktuelleKasse?.krankenkasse}</p>
            <p className="text-xs text-muted-foreground">
              {aktuelleKasse?.modell} · Fr. {aktuelleKasse?.franchise}
            </p>
            <p className="font-bold text-sm mt-2">CHF {aktuelleKasse?.praemie_netto?.toFixed(2)}</p>
          </div>

          <div className="p-3 rounded-lg border bg-emerald-50 border-emerald-200">
            <p className="text-xs text-emerald-700 mb-1">Empfehlung</p>
            <p className="font-semibold text-sm">{besteEmpfehlung?.krankenkasse}</p>
            <p className="text-xs text-emerald-700">
              {besteEmpfehlung?.modell} · Fr. {besteEmpfehlung?.franchise}
            </p>
            <p className="font-bold text-sm mt-2">CHF {besteEmpfehlung?.praemie_netto?.toFixed(2)}</p>
            {besteEmpfehlung?.ersparnis_jaehrlich > 0 && (
              <p className="text-xs text-emerald-600 font-medium mt-1">
                CHF {besteEmpfehlung.ersparnis_jaehrlich.toFixed(0)}/Jahr sparen
              </p>
            )}
          </div>
        </div>

        {/* Beratungsergebnis */}
        <div className="space-y-2">
          <Label>Beratungsergebnis</Label>
          <div className="grid gap-2">
            <Button
              variant={beratungsergebnis.kunde_folgt_empfehlung ? 'default' : 'outline'}
              className="justify-start"
              onClick={() => setBeratungsergebnis({
                kunde_folgt_empfehlung: true,
                kunde_moechte_ueberpruefen: false,
                kunde_lehnt_ab: false,
                abweichenung_begruendung: ''
              })}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Kunde folgt Empfehlung
            </Button>
            <Button
              variant={beratungsergebnis.kunde_moechte_ueberpruefen ? 'default' : 'outline'}
              className="justify-start"
              onClick={() => setBeratungsergebnis({
                kunde_folgt_empfehlung: false,
                kunde_moechte_ueberpruefen: true,
                kunde_lehnt_ab: false,
                abweichenung_begruendung: ''
              })}
            >
              <Clock className="w-4 h-4 mr-2" />
              Kunde möchte überprüfen
            </Button>
            <Button
              variant={beratungsergebnis.kunde_lehnt_ab ? 'default' : 'outline'}
              className="justify-start"
              onClick={() => setBeratungsergebnis({
                kunde_folgt_empfehlung: false,
                kunde_moechte_ueberpruefen: false,
                kunde_lehnt_ab: true,
                abweichenung_begruendung: ''
              })}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Kunde lehnt ab
            </Button>
          </div>
        </div>

        {/* Abweichung Begründung */}
        {(beratungsergebnis.kunde_moechte_ueberpruefen || beratungsergebnis.kunde_lehnt_ab) && (
          <div className="space-y-2">
            <Label>Begründung (optional)</Label>
            <Textarea
              value={beratungsergebnis.abweichenung_begruendung}
              onChange={(e) => setBeratungsergebnis({ ...beratungsergebnis, abweichenung_begruendung: e.target.value })}
              placeholder="Warum lehnt der Kunde ab oder möchte überprüfen?"
              className="h-20"
            />
          </div>
        )}

        {/* Berater-Notizen */}
        <div className="space-y-2">
          <Label>Berater-Notizen</Label>
          <Textarea
            value={notizen}
            onChange={(e) => setNotizen(e.target.value)}
            placeholder="Zusätzliche Notizen zum Gespräch..."
            className="h-20"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!beratungsergebnis.kunde_folgt_empfehlung && !beratungsergebnis.kunde_moechte_ueberpruefen && !beratungsergebnis.kunde_lehnt_ab}
            className="bg-primary hover:bg-primary/90"
          >
            {speichern ? 'Speichere...' : 'Analyse speichern & PDF erstellen'}
            {!speichern && <Sparkles className="w-3.5 h-3.5 ml-2" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}