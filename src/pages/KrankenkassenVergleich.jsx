import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  ArrowRight, 
  Calculator, 
  CheckCircle2, 
  TrendingDown, 
  User, 
  MapPin,
  Building2,
  Shield,
  Sparkles,
  Download,
  Save,
  X,
  ChevronRight,
  Award,
  Info
} from 'lucide-react';
import { generateKrankenkassenVergleichPDF } from '@/components/krankenkassen/generateKrankenkassenPDF';
import CustomerSelector from '@/components/krankenkassen/CustomerSelector';

const KANTONE = [
  'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL', 'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU'
];

const KRANKENKASSEN = [
  'CSS', 'Helsana', 'Sanitas', 'Swica', 'ÖKK', 'Visana', 'KPT', 'Groupe Mutuel', 'Concordia', 'Atupri',
  'Klara', 'Assura', 'Intras', 'Remedica', 'Sympany', 'Hospitass', 'Agrisano', 'Santésuisse', 'bkk mobilise', 'Galenus'
];

const MODELLE = {
  standard: 'Standardmodell (Freie Arztwahl)',
  telmed: 'Telmed (Telefonische Erstberatung)',
  hausarzt: 'Hausarztmodell',
  hmo: 'HMO-Modell (Health Maintenance Organization)'
};

const FRANCHISEN = [300, 500, 1000, 1500, 2000, 2500];

export default function KrankenkassenVergleich() {
  const queryClient = useQueryClient();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedKunde, setSelectedKunde] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vergleichId, setVergleichId] = useState(null);
  
  const [formData, setFormData] = useState({
    vorname: '',
    nachname: '',
    geburtsdatum: '',
    wohnort: '',
    plz: '',
    kanton: '',
    geschlecht: 'm',
    aktuelle_krankenkasse: '',
    aktuelles_modell: 'standard',
    aktuelle_franchise: 300,
    aktuelle_unfall: true,
    nur_guenstigste: false,
    nur_bestehende_kasse: false,
    alle_modelle: false,
    nur_gleiche_franchise: false,
    zeige_telmed: true,
    zeige_hausarzt: true,
    zeige_hmo: true,
    zeige_standard: true,
  });
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [ergebnisse, setErgebnisse] = useState([]);
  const [kiAnalyse, setKiAnalyse] = useState(null);

  const alter = formData.geburtsdatum ? 
    Math.floor((new Date() - new Date(formData.geburtsdatum)) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  const berechnePraemie = (kk, modell, franchise, alter, kanton) => {
    const basisPraemien = {
      'CSS': 420, 'Helsana': 410, 'Sanitas': 430, 'Swica': 400, 'ÖKK': 440,
      'Visana': 415, 'KPT': 390, 'Groupe Mutuel': 405, 'Concordia': 425, 'Atupri': 435
    };
    
    let praemie = basisPraemien[kk] || 400;
    const franchiseAbzug = (2500 - franchise) * 0.08;
    praemie -= franchiseAbzug;
    
    const modellAbzug = { standard: 0, telmed: 40, hausarzt: 50, hmo: 60 };
    praemie -= modellAbzug[modell] || 0;
    
    if (alter > 65) praemie *= 1.15;
    if (alter > 80) praemie *= 1.25;
    
    const kantonFaktoren = { 'ZH': 1.1, 'GE': 1.15, 'BS': 1.08, 'BE': 0.95, 'TI': 1.05 };
    praemie *= kantonFaktoren[kanton] || 1.0;
    
    return Math.round(praemie * 100) / 100;
  };

  const handleVergleich = async () => {
    setLoading(true);
    
    const aktuellePraemie = berechnePraemie(
      formData.aktuelle_krankenkasse,
      formData.aktuelles_modell,
      formData.aktuelle_franchise,
      alter,
      formData.kanton
    );

    const vergleiche = KRANKENKASSEN.flatMap(kk => {
      if (formData.nur_bestehende_kasse && kk !== formData.aktuelle_krankenkasse) return [];
      
      const modelle = [];
      if (formData.zeige_standard || formData.alle_modelle) modelle.push('standard');
      if (formData.zeige_telmed || formData.alle_modelle) modelle.push('telmed');
      if (formData.zeige_hausarzt || formData.alle_modelle) modelle.push('hausarzt');
      if (formData.zeige_hmo || formData.alle_modelle) modelle.push('hmo');

      return modelle.map(modell => {
        const franschen = formData.nur_gleiche_franchise 
          ? [formData.aktuelle_franchise] 
          : FRANCHISEN;

        return franschen.map(franchise => {
          const praemie = berechnePraemie(kk, modell, franchise, alter, formData.kanton);
          const ersparnisMonat = aktuellePraemie - praemie;
          const ersparnisJahr = ersparnisMonat * 12;
          
          return {
            krankenkasse: kk,
            modell,
            franchise,
            praemie_monatlich: praemie,
            praemie_jaehrlich: praemie * 12,
            ersparnis_monatlich: ersparnisMonat,
            ersparnis_jaehrlich: ersparnisJahr,
            ersparnis_prozent: aktuellePraemie > 0 ? ((ersparnisMonat / aktuellePraemie) * 100) : 0,
            ist_aktuell: kk === formData.aktuelle_krankenkasse && 
                        modell === formData.aktuelles_modell && 
                        franchise === formData.aktuelle_franchise,
          };
        });
      }).flat();
    }).flat();

    const sortiert = vergleiche
      .filter(e => e.praemie_monatlich > 0)
      .sort((a, b) => b.ersparnis_jaehrlich - a.ersparnis_jaehrlich)
      .map((e, idx) => ({
        ...e,
        rang: idx + 1,
        ist_guenstigste: idx === 0,
        ist_empfohlen: idx === 0 && e.ersparnis_jaehrlich > 100
      }));

    setErgebnisse(sortiert);

    const besteOption = sortiert[0];
    if (besteOption && besteOption.ersparnis_jaehrlich > 0) {
      setKiAnalyse({
        sparpotenzial: besteOption.ersparnis_jaehrlich,
        wechsel_empfohlen: besteOption.ersparnis_jaehrlich > 500,
        franschise_optimierung: formData.aktuelle_franchise > 1000 
          ? 'Eine tiefere Franchise könnte sinnvoll sein' 
          : 'Franchise ist optimal gewählt',
        modell_optimierung: formData.aktuelles_modell === 'standard'
          ? 'Ein Telmed- oder Hausarztmodell könnte Prämien sparen'
          : 'Modell ist gut gewählt',
        empfehlung_text: `Durch einen Wechsel von ${formData.aktuelle_krankenkasse} ${MODELLE[formData.aktuelles_modell]} zu ${besteOption.krankenkasse} ${MODELLE[besteOption.modell]} können Sie CHF ${besteOption.ersparnis_jaehrlich.toLocaleString('de-CH')} pro Jahr sparen. Das entspricht einer monatlichen Ersparnis von CHF ${besteOption.ersparnis_monatlich.toFixed(2)}.`,
        empfohlene_krankenkasse: besteOption.krankenkasse,
        empfohlenes_modell: besteOption.modell
      });
    }

    setLoading(false);
  };

  const saveVergleich = async () => {
    const user = await base44.auth.me();
    
    let customerId = selectedCustomer?.id;
    if (!customerId && formData.vorname && formData.nachname) {
      const kundeResult = await base44.entities.Customer.filter({ 
        first_name: formData.vorname,
        last_name: formData.nachname
      });
      customerId = kundeResult[0]?.id;
      
      if (!customerId) {
        const newCustomer = await base44.entities.Customer.create({
          first_name: formData.vorname,
          last_name: formData.nachname,
          email: '',
          zip_code: formData.plz,
          city: formData.wohnort,
          canton: formData.kanton,
          birthdate: formData.geburtsdatum,
          organization_id: '69f9ece91b7c06b90471a6b1'
        });
        customerId = newCustomer.id;
      }
    }
    
    const newVergleich = await base44.entities.KrankenkassenVergleich.create({
      customer_id: customerId,
      customer_name: `${formData.vorname} ${formData.nachname}`,
      advisor_id: user.id,
      advisor_name: user.full_name || user.email,
      organization_id: '69f9ece91b7c06b90471a6b1',
      vergleichsdatum: new Date().toISOString(),
      persoenliche_daten: {
        vorname: formData.vorname,
        nachname: formData.nachname,
        geburtsdatum: formData.geburtsdatum,
        wohnort: formData.wohnort,
        plz: formData.plz,
        kanton: formData.kanton,
        geschlecht: formData.geschlecht
      },
      aktuelle_versicherung: {
        krankenkasse: formData.aktuelle_krankenkasse,
        modell: formData.aktuelles_modell,
        franchise: formData.aktuelle_franchise,
        unfall: formData.aktuelle_unfall
      },
      vergleichsoptionen: {
        nur_guenstigste: formData.nur_guenstigste,
        nur_bestehende_kasse: formData.nur_bestehende_kasse,
        alle_modelle: formData.alle_modelle,
        nur_gleiche_franchise: formData.nur_gleiche_franchise,
        zeige_telmed: formData.zeige_telmed,
        zeige_hausarzt: formData.zeige_hausarzt,
        zeige_hmo: formData.zeige_hmo,
        zeige_standard: formData.zeige_standard
      },
      vergleichsergebnisse: ergebnisse,
      ki_analyse: kiAnalyse,
      status: 'durchgefuehrt'
    });

    setVergleichId(newVergleich.id);
    setShowSaveDialog(false);
    queryClient.invalidateQueries({ queryKey: ['krankenkassen-vergleiche'] });
  };

  const exportPDF = () => {
    const vergleich = {
      vergleichsdatum: new Date().toISOString(),
      advisor_name: 'Aktueller Berater',
      persoenliche_daten: formData,
      aktuelle_versicherung: {
        krankenkasse: formData.aktuelle_krankenkasse,
        modell: formData.aktuelles_modell,
        franchise: formData.aktuelle_franchise,
        unfall: formData.aktuelle_unfall
      },
      vergleichsoptionen: formData,
      vergleichsergebnisse: ergebnisse,
      ki_analyse: kiAnalyse,
      customer_name: `${formData.vorname} ${formData.nachname}`
    };
    generateKrankenkassenVergleichPDF(vergleich);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Krankenkassenvergleich Schweiz
          </h1>
          <p className="text-muted-foreground mt-1">
            Professioneller Vergleich der Grundversicherungs-Prämien (KVG)
          </p>
        </div>
        <Badge variant="outline" className="badge-info">
          BAG-Datenbasis 2026
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Linke Spalte: Eingabe */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Persönliche Daten
              </CardTitle>
              <CardDescription>
                Wählen Sie einen bestehenden Kunden oder erfassen Sie neue Daten
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <CustomerSelector formData={formData} setFormData={setFormData} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Geburtsdatum</Label>
                  <Input type="date" value={formData.geburtsdatum} onChange={e => setFormData({...formData, geburtsdatum: e.target.value})} />
                  {alter && <p className="text-xs text-muted-foreground mt-1">Alter: {alter} Jahre</p>}
                </div>
                <div>
                  <Label>Geschlecht</Label>
                  <Select value={formData.geschlecht} onValueChange={v => setFormData({...formData, geschlecht: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="m">Männlich</SelectItem>
                      <SelectItem value="w">Weiblich</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Aktuelle Krankenversicherung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Aktuelle Krankenkasse</Label>
                <Select value={formData.aktuelle_krankenkasse} onValueChange={v => setFormData({...formData, aktuelle_krankenkasse: v})}>
                  <SelectTrigger><SelectValue placeholder="Krankenkasse wählen" /></SelectTrigger>
                  <SelectContent>
                    {KRANKENKASSEN.map(kk => <SelectItem key={kk} value={kk}>{kk}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Aktuelles Modell</Label>
                  <Select value={formData.aktuelles_modell} onValueChange={v => setFormData({...formData, aktuelles_modell: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MODELLE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Aktuelle Franchise</Label>
                  <Select value={formData.aktuelle_franchise} onValueChange={v => setFormData({...formData, aktuelle_franchise: parseInt(v)})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FRANCHISEN.map(f => <SelectItem key={f} value={f.toString()}>CHF {f.toLocaleString('de-CH')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={formData.aktuelle_unfall} onCheckedChange={v => setFormData({...formData, aktuelle_unfall: !!v})} />
                <Label>Unfallversicherung eingeschlossen (NBU)</Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                Vergleichsoptionen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.zeige_telmed} onCheckedChange={v => setFormData({...formData, zeige_telmed: !!v})} />
                  <span className="text-sm">Telmed-Modelle</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.zeige_hausarzt} onCheckedChange={v => setFormData({...formData, zeige_hausarzt: !!v})} />
                  <span className="text-sm">Hausarztmodelle</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.zeige_hmo} onCheckedChange={v => setFormData({...formData, zeige_hmo: !!v})} />
                  <span className="text-sm">HMO-Modelle</span>
                </label>
                <label className="flex items-center gap-2">
                  <Checkbox checked={formData.zeige_standard} onCheckedChange={v => setFormData({...formData, zeige_standard: !!v})} />
                  <span className="text-sm">Standardmodelle</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={formData.nur_gleiche_franchise} onCheckedChange={v => setFormData({...formData, nur_gleiche_franchise: !!v})} />
                <Label className="text-sm">Nur gleiche Franchise vergleichen</Label>
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full" 
            size="lg"
            onClick={handleVergleich}
            disabled={loading || !formData.kanton || !formData.aktuelle_krankenkasse}
          >
            {loading ? 'Berechne...' : 'Vergleich durchführen'}
            {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>

        {/* Rechte Spalte: Ergebnisse */}
        <div className="space-y-4">
          {ergebnisse.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-emerald-600" />
                      Vergleichsergebnisse
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportPDF}>
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
                        <Save className="w-3.5 h-3.5" />
                        Speichern
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {ergebnisse.slice(0, 15).map((e, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          e.ist_empfohlen ? 'bg-emerald-50 border-emerald-200' :
                          e.ist_aktuell ? 'bg-blue-50 border-blue-200' :
                          'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center w-8">
                            {e.ist_empfohlen ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            ) : e.ist_aktuell ? (
                              <Badge variant="outline" className="text-xs">Aktuell</Badge>
                            ) : (
                              <span className="text-sm font-medium text-muted-foreground">#{e.rang}</span>
                            )}
                          </div>
                          <div>
                            <p className={`font-semibold ${e.ist_empfohlen ? 'text-emerald-900' : ''}`}>
                              {e.krankenkasse}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {MODELLE[e.modell]} · CHF {e.franchise}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">CHF {e.praemie_monatlich.toFixed(2)}/Monat</p>
                          {e.ersparnis_jaehrlich > 0 ? (
                            <p className="text-sm text-emerald-600 font-medium">
                              +CHF {e.ersparnis_jaehrlich.toLocaleString('de-CH')}/Jahr
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">—</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {kiAnalyse && (
                <Card className="border-l-4 border-l-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      KI-Beratungsempfehlung
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-slate-700">{kiAnalyse.empfehlung_text}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-emerald-50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Jährliche Ersparnis</p>
                        <p className="text-lg font-bold text-emerald-700">CHF {kiAnalyse.sparpotenzial.toLocaleString('de-CH')}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Wechsel empfohlen</p>
                        <p className={`text-lg font-bold ${kiAnalyse.wechsel_empfohlen ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {kiAnalyse.wechsel_empfohlen ? 'Ja' : 'Nein'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="flex flex-col items-center justify-center p-12 text-center">
              <Calculator className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Noch keine Vergleichsergebnisse</h3>
              <p className="text-muted-foreground max-w-md">
                Füllen Sie die persönlichen Daten und aktuelle Versicherung aus, um einen Vergleich durchzuführen.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vergleich speichern</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Möchten Sie diesen Vergleich im Kundendossier speichern?
            </p>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium">{formData.vorname} {formData.nachname}</p>
              <p className="text-xs text-muted-foreground">
                {kiAnalyse ? `Ersparnis: CHF ${kiAnalyse.sparpotenzial.toLocaleString('de-CH')}/Jahr` : ''}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Abbrechen</Button>
            <Button onClick={saveVergleich}>
              <Save className="w-3.5 h-3.5 mr-2" />
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}