import React, { useState, useEffect } from 'react';
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

// Prämienregionen nach PLZ (für BAG-Daten)
const PRAEMIENREGIONEN = {
  // Region 1 (städtisch/teuer)
  '8000': '1', '8001': '1', '8002': '1', '8003': '1', '8004': '1', '8005': '1', '8006': '1', '8008': '1',
  '3000': '1', '3011': '1', '3012': '1', '3013': '1', '3014': '1', '3015': '1',
  '4000': '1', '4051': '1', '4052': '1', '4053': '1', '4054': '1', '4055': '1', '4056': '1', '4057': '1', '4058': '1',
  '1200': '1', '1201': '1', '1202': '1', '1203': '1', '1204': '1', '1205': '1', '1206': '1', '1207': '1', '1208': '1',
  // Region 2 (mittlere Agglomeration)
  '4300': '2', '4302': '2', '4303': '2', '4304': '2', '4305': '2', '4306': '2', '4310': '2', '4312': '2',
  '4100': '2', '4101': '2', '4102': '2', '4103': '2', '4104': '2', '4105': '2', '4123': '2', '4125': '2',
  '3000': '2', '3001': '2', '3003': '2', '3004': '2', '3006': '2', '3007': '2', '3008': '2', '3010': '2',
  '8000': '2', '8001': '2', '8032': '2', '8037': '2', '8038': '2', '8041': '2', '8044': '2', '8045': '2', '8046': '2', '8047': '2', '8048': '2', '8049': '2', '8050': '2', '8051': '2', '8052': '2', '8053': '2', '8055': '2', '8057': '2', '8063': '2', '8064': '2',
  // Region 3 (ländlich/günstig)
  'default': '3'
};

const getPraemienregion = (plz) => {
  if (!plz) return '3';
  const plzStr = plz.toString().padStart(4, '0');
  return PRAEMIENREGIONEN[plzStr] || PRAEMIENREGIONEN[plzStr.substring(0, 2) + '00'] || '3';
};

// Alle 34 offiziellen BAG-Krankenkassen 2026
const KRANKENKASSEN = [
  'Assura', 'KPT', 'Atupri', 'Sympany', 'Aquilana', 'Sanitas', 'ÖKK', 'CSS', 'EGK',
  'Concordia', 'Visana', 'Sana24', 'SLKK', 'Agrisano', 'Swica', 'Avenir', 'AMB',
  'Sodalis', 'Sumiswalder', 'Groupe Mutuel', 'Philos', 'Mutuel', 'Helsana', 'Galenos',
  'Glarner', 'Rhenusana', 'Steffisburg', 'Birchmeier', 'Einsiedeln',
  'Luzerner Hinterland', 'Visperterminen', 'Vita Surselva', "d'Entremont", 'Wädenswil'
];

// Groupe Mutuel Marken-Aliases (Sanatel, Mutuel Assurance, Philos etc. → alle Groupe Mutuel in BAG)
const KASSEN_ALIAS = {
  'Sanatel': 'Groupe Mutuel',
  'Mutuel Assurance': 'Groupe Mutuel',
  'Philos': 'Groupe Mutuel',
  'Avenir': 'Groupe Mutuel',
  'Easy Sana': 'Groupe Mutuel',
  'Mutuel': 'Groupe Mutuel',
};

// BAG Franchise-Index → CHF (für bereits importierte Daten mit falschem Mapping)
const FRANCHISE_INDEX_MAP = { 3: 300, 4: 500, 5: 1000, 6: 1500, 7: 2000, 8: 2500 };

const MODELLE = {
  standard: 'Standardmodell (Freie Arztwahl)',
  telmed: 'Telmed (Telefonische Erstberatung)',
  hausarzt: 'Hausarztmodell',
  hmo: 'HMO-Modell (Health Maintenance Organization)'
};

const FRANCHISEN_ERWACHSEN = [300, 500, 1000, 1500, 2000, 2500];
const FRANCHISEN_KIND = [0, 100, 200, 300, 400, 500, 600];

const getAltersklasse = (alter) => {
  if (alter === null || alter === undefined) return 'erwachsen';
  if (alter <= 18) return 'kind';
  if (alter <= 25) return 'jugend';
  return 'erwachsen';
};

const getFranchisen = (altersklasse) => {
  return altersklasse === 'kind' ? FRANCHISEN_KIND : FRANCHISEN_ERWACHSEN;
};

export default function KrankenkassenVergleich() {
  const queryClient = useQueryClient();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vergleichId, setVergleichId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  const [formData, setFormData] = useState(() => {
    // Testdaten via URL-Parameter ?test=1 laden
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('test') === '1') {
      return {
        vorname: 'Peter',
        nachname: 'Adam',
        geburtsdatum: '1968-10-07',
        wohnort: 'Giebenach',
        plz: '4304',
        kanton: 'BL',
        geschlecht: 'm',
        aktuelle_krankenkasse: '',
        aktuelles_modell: 'standard',
        aktuelle_franchise: 300,
        aktuelle_unfall: true,
        altersklasse_override: '',
        nur_guenstigste: false,
        nur_bestehende_kasse: false,
        alle_modelle: false,
        nur_gleiche_franchise: false,
        zeige_telmed: true,
        zeige_hausarzt: true,
        zeige_hmo: true,
        zeige_standard: true,
        };
        }
        return {
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
      altersklasse_override: '',
      nur_guenstigste: false,
      nur_bestehende_kasse: false,
      alle_modelle: false,
      nur_gleiche_franchise: false,
      zeige_telmed: true,
      zeige_hausarzt: true,
      zeige_hmo: true,
      zeige_standard: true,
    };
  });

  const [ergebnisse, setErgebnisse] = useState([]);
  const [kiAnalyse, setKiAnalyse] = useState(null);
  const [bagDaten, setBagDaten] = useState(null);
  const [loadingDaten, setLoadingDaten] = useState(false);
  const [vergleichFehler, setVergleichFehler] = useState(null);

  const alter = formData.geburtsdatum ? 
    Math.floor((new Date() - new Date(formData.geburtsdatum)) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  // Altersklasse: override hat Vorrang, sonst auto aus Geburtsdatum
  const altersklasse = formData.altersklasse_override || getAltersklasse(alter);

  // BAG-Daten werden beim Vergleich live geladen — kein Pre-Load mehr nötig
  useEffect(() => {
    setBagDaten([]);
  }, [formData.plz, formData.geburtsdatum]);
  const franchisen = getFranchisen(altersklasse);

  // Franchise-Reset wenn nicht mehr gültig für neue Altersklasse
  React.useEffect(() => {
    if (!franchisen.includes(formData.aktuelle_franchise)) {
      setFormData(f => ({ ...f, aktuelle_franchise: franchisen[0] }));
    }
  }, [altersklasse]);

  const berechnePraemie = (kk, modell, franchise, kanton, bagDaten) => {
    if (!bagDaten || bagDaten.length === 0) return null;
    
    const kkNorm = KASSEN_ALIAS[kk] || kk;
    const franchiseNorm = (franchise <= 8 && FRANCHISE_INDEX_MAP[franchise]) 
      ? FRANCHISE_INDEX_MAP[franchise] 
      : franchise;

    const matchFn = (d) => {
      const dbKasse = KASSEN_ALIAS[d.krankenkasse] || d.krankenkasse;
      const dbFranchise = (d.franchise <= 8 && FRANCHISE_INDEX_MAP[d.franchise])
        ? FRANCHISE_INDEX_MAP[d.franchise]
        : d.franchise;
      // Altersklasse berücksichtigen
      const dbAlter = d.altersklasse || 'erwachsen';
      return dbKasse === kkNorm && d.modell === modell && dbFranchise === franchiseNorm && dbAlter === altersklasse;
    };

    // 1. Exakter Kanton-Match
    const match = bagDaten.find(d => matchFn(d) && d.kanton === kanton);
    const praemieField = altersklasse === 'kind' ? 'praemie_kinder' : 'praemie_erwachsene';
    if (match?.[praemieField] > 0) {
      return Math.round(match[praemieField] * 100) / 100;
    }
    
    // 2. Fallback: anderer Kanton
    const fallback = bagDaten.find(d => matchFn(d));
    if (fallback?.[praemieField] > 0) {
      const kantonFaktor = { 'ZH': 1.02, 'GE': 1.05, 'BS': 1.03, 'TI': 1.02, 'BE': 0.98 }[kanton] || 1.0;
      return Math.round(fallback[praemieField] * kantonFaktor * 100) / 100;
    }
    
    return null;
  };

  // BAG API gibt direkt "Standard", "Hausarzt", "HMO", "Telemedizin" etc. zurück
  // Wir mappen auf unsere 4 internen Kategorien
  const MODEL_MAP_FROM_API = (modelLabel) => {
    if (!modelLabel) return 'standard';
    const l = modelLabel.toLowerCase();
    if (l === 'standard' || l === 'freie arztwahl') return 'standard';
    if (l.includes('hmo')) return 'hmo';
    if (l === 'hausarzt' || l.includes('hausarzt') || l.includes('medbase')) return 'hausarzt';
    // Alles andere (Telemedizin, Telmed, CallMed, SanaTel, PrimaFlex, FlexHelp, BeneFit PLUS Telmed, etc.)
    return 'telmed';
  };

  const handleVergleich = async () => {
    if (!formData.plz || !formData.geburtsdatum) {
      alert('Bitte PLZ und Geburtsdatum eingeben.');
      return;
    }

    setLoading(true);
    setVergleichFehler(null);
    setErgebnisse([]);
    setKiAnalyse(null);

    // Geburtsjahr aus Geburtsdatum
    const yob = new Date(formData.geburtsdatum).getFullYear();

    // Live-Daten von PrimAI/BAG holen (alle Angebote für diese PLZ, Alter, Franchise)
    const res = await base44.functions.invoke('queryBAGLive', {
      plz: formData.plz,
      yob,
      deductible: formData.aktuelle_franchise,
      accident: formData.aktuelle_unfall,
      limit: 500
    });

    const offers = res.data?.data || [];
    if (offers.length === 0) {
      setVergleichFehler('Keine BAG-Daten für diese PLZ/Franchise gefunden.');
      setLoading(false);
      return;
    }

    setBagDaten(offers);

    // BAG-Subvention: CHF 5.15/Monat wird von der Nettoprämie abgezogen
    const SUBVENTION = 5.15;

    // Aktuelle Prämie finden — zuerst exakter Kassenname-Match, dann Fuzzy
    // Die API gibt z.B. "Mutuel" zurück, Formular hat "CSS"/"Mutuel" etc.
    // Wir suchen: gleicher Kassenname (case-insensitive) + gleicher normalisierter Modell-Typ
    const normalizeKasse = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const aktuellKasseNorm = normalizeKasse(formData.aktuelle_krankenkasse);

    const aktuellAngebot = offers.find(o => {
      const modellNorm = MODEL_MAP_FROM_API(o.model);
      const kasseMatch = normalizeKasse(o.insurer) === aktuellKasseNorm;
      const modellMatch = modellNorm === formData.aktuelles_modell;
      return kasseMatch && modellMatch;
    }) || offers.find(o => normalizeKasse(o.insurer) === aktuellKasseNorm); // Fallback: gleiche Kasse, beliebiges Modell

    const aktuelleBrutto = aktuellAngebot?.price?.total || null;
    const aktuellePraemie = aktuelleBrutto; // Brutto für Differenzberechnung

    const vergleiche = offers
      .filter(o => {
        // Kassenfilter
        if (formData.nur_bestehende_kasse && normalizeKasse(o.insurer) !== aktuellKasseNorm) return false;
        // Franchise-Filter
        if (formData.nur_gleiche_franchise && o.deductible !== formData.aktuelle_franchise) return false;
        // Modell-Filter
        const modellNorm = MODEL_MAP_FROM_API(o.model);
        if (modellNorm === 'standard' && !formData.zeige_standard) return false;
        if (modellNorm === 'telmed' && !formData.zeige_telmed) return false;
        if (modellNorm === 'hausarzt' && !formData.zeige_hausarzt) return false;
        if (modellNorm === 'hmo' && !formData.zeige_hmo) return false;
        return true;
      })
      .map(o => {
        const brutto = o.price?.total || 0;
        const netto = Math.round((brutto - SUBVENTION) * 100) / 100;
        const modellNorm = MODEL_MAP_FROM_API(o.model);
        const ersparnisMonat = aktuellePraemie ? aktuellePraemie - brutto : 0;
        const istAktuell = normalizeKasse(o.insurer) === aktuellKasseNorm &&
                           modellNorm === formData.aktuelles_modell;
        return {
          krankenkasse: o.insurer,
          modell_label: o.model,
          modell: modellNorm,
          franchise: o.deductible,
          praemie_brutto: brutto,
          praemie_netto: netto,
          praemie_monatlich: netto, // Anzeige immer Netto
          praemie_jaehrlich: netto * 12,
          ersparnis_monatlich: ersparnisMonat,
          ersparnis_jaehrlich: ersparnisMonat * 12,
          ersparnis_prozent: aktuellePraemie > 0 ? (ersparnisMonat / aktuellePraemie) * 100 : 0,
          ist_aktuell: istAktuell,
        };
      });

    const sortiert = vergleiche
      .sort((a, b) => b.ersparnis_jaehrlich - a.ersparnis_jaehrlich)
      .map((e, idx) => ({
        ...e,
        rang: idx + 1,
        ist_guenstigste: idx === 0 && !e.ist_aktuell,
        ist_empfohlen: idx === 0 && e.ersparnis_jaehrlich > 100 && !e.ist_aktuell
      }));

    setErgebnisse(sortiert);

    const besteOption = sortiert.find(e => !e.ist_aktuell);
    if (besteOption && besteOption.ersparnis_jaehrlich > 0) {
      setKiAnalyse({
        sparpotenzial: Math.round(besteOption.ersparnis_jaehrlich),
        wechsel_empfohlen: besteOption.ersparnis_jaehrlich > 500,
        franschise_optimierung: formData.aktuelle_franchise > 1000
          ? 'Eine tiefere Franchise könnte sinnvoll sein'
          : 'Franchise ist optimal gewählt',
        modell_optimierung: formData.aktuelles_modell === 'standard'
          ? 'Ein Telmed- oder Hausarztmodell könnte Prämien sparen'
          : 'Modell ist gut gewählt',
        empfehlung_text: `Durch einen Wechsel zu ${besteOption.krankenkasse} (${besteOption.modell_label || besteOption.modell}) können Sie CHF ${Math.round(besteOption.ersparnis_jaehrlich).toLocaleString('de-CH')} pro Jahr sparen (Nettoprämie nach Subventionsabzug).`,
        empfohlene_krankenkasse: besteOption.krankenkasse,
        empfohlenes_modell: besteOption.modell
      });
    }

    setLoading(false);
  };

  const saveVergleich = async () => {
    const user = await base44.auth.me();
    
    const customerId = selectedCustomer?.id;
    const organizationId = selectedCustomer?.organization_id || user.data?.organization_id;
    
    const newVergleich = await base44.entities.KrankenkassenVergleich.create({
      customer_id: customerId,
      customer_name: `${formData.vorname} ${formData.nachname}`,
      advisor_id: user.id,
      advisor_name: user.full_name || user.email,
      organization_id: organizationId,
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFormData({
              vorname: 'Peter',
              nachname: 'Adam',
              geburtsdatum: '1968-10-07',
              wohnort: 'Giebenach',
              plz: '4304',
              kanton: 'BL',
              geschlecht: 'm',
              aktuelle_krankenkasse: '',
              aktuelles_modell: 'standard',
              aktuelle_franchise: 300,
              aktuelle_unfall: true,
              altersklasse_override: '',
              nur_guenstigste: false,
              nur_bestehende_kasse: false,
              alle_modelle: false,
              nur_gleiche_franchise: false,
              zeige_telmed: true,
              zeige_hausarzt: true,
              zeige_hmo: true,
              zeige_standard: true,
            })}
            className="text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            🧪 Testdaten: Peter Adam
          </Button>
          {bagDaten && bagDaten.length > 0 ? (
            <Badge variant="outline" className="badge-success">
              {bagDaten.length} Angebote (BAG Live)
            </Badge>
          ) : null}
        </div>
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
                  {alter !== null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Alter: {alter} Jahre · 
                      <span className={`ml-1 font-medium ${altersklasse === 'kind' ? 'text-blue-600' : altersklasse === 'jugend' ? 'text-violet-600' : 'text-slate-600'}`}>
                        {altersklasse === 'kind' ? '👶 Kind (0–18)' : altersklasse === 'jugend' ? '🧑 Jugend (19–25)' : '🧑‍💼 Erwachsen (26+)'}
                      </span>
                    </p>
                  )}
                </div>
                <div>
                  <Label>Altersklasse</Label>
                  <Select value={formData.altersklasse_override || (alter !== null ? altersklasse : '')} onValueChange={v => setFormData({...formData, altersklasse_override: v})}>
                    <SelectTrigger><SelectValue placeholder={alter !== null ? `Auto: ${altersklasse}` : 'Auto'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Auto (aus Geburtsdatum)</SelectItem>
                      <SelectItem value="kind">Kind (0–18)</SelectItem>
                      <SelectItem value="jugend">Jugend (19–25)</SelectItem>
                      <SelectItem value="erwachsen">Erwachsen (26+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  <Select value={formData.aktuelle_franchise.toString()} onValueChange={v => setFormData({...formData, aktuelle_franchise: parseInt(v, 10)})}>
                    <SelectTrigger><SelectValue placeholder="Franchise wählen" /></SelectTrigger>
                    <SelectContent>
                      {franchisen.map(f => <SelectItem key={f} value={f.toString()}>CHF {f.toLocaleString('de-CH')}</SelectItem>)}
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
            disabled={loading || !formData.plz || !formData.geburtsdatum || !formData.aktuelle_krankenkasse}
          >
            {loadingDaten ? 'Lade BAG-Daten...' : loading ? 'Berechne...' : 'Vergleich durchführen'}
            {!loading && !loadingDaten && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>

        {/* Rechte Spalte: Ergebnisse */}
        <div className="space-y-4">
          {vergleichFehler && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <Info className="w-4 h-4 inline mr-1.5" />
              {vergleichFehler}
            </div>
          )}
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
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_auto] gap-2 px-3 pb-1 border-b">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kasse / Modell</span>
                    <div className="text-right">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Netto/Monat</span>
                      <span className="text-[10px] text-muted-foreground block">(nach CHF 5.15 Subv.)</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-[580px] overflow-y-auto">
                    {ergebnisse.map((e, idx) => (
                      <div 
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          e.ist_aktuell ? 'bg-blue-50 border-blue-300' :
                          e.ist_empfohlen ? 'bg-emerald-50 border-emerald-200' :
                          'bg-white border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center w-10 shrink-0">
                            {e.ist_aktuell ? (
                              <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200 px-1 py-0">Aktuell</Badge>
                            ) : e.ist_empfohlen ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                            ) : (
                              <span className="text-sm font-medium text-muted-foreground">#{e.rang}</span>
                            )}
                          </div>
                          <div>
                            <p className={`font-semibold text-sm ${e.ist_aktuell ? 'text-blue-900' : e.ist_empfohlen ? 'text-emerald-900' : ''}`}>
                              {e.krankenkasse}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {e.modell_label || MODELLE[e.modell] || e.modell} · Fr. {e.franchise}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">CHF {e.praemie_netto.toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">Brutto: {e.praemie_brutto.toFixed(2)}</p>
                          {!e.ist_aktuell && e.ersparnis_monatlich !== 0 ? (
                            <p className={`text-xs font-medium ${e.ersparnis_monatlich > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {e.ersparnis_monatlich > 0 ? '−' : '+'}CHF {Math.abs(e.ersparnis_monatlich).toFixed(2)}/Mt
                            </p>
                          ) : null}
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