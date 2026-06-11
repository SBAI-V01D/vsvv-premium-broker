import React, { useState, useMemo, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ExternalLink, CheckCircle2, Save, Info, Building2, User, Calendar, MapPin, Search, X
} from 'lucide-react';
import CustomerSelector from '@/components/krankenkassen/CustomerSelector';

// Vollständige Liste aller zugelassenen OKP-Krankenversicherer Schweiz (Stand 2025, Quelle: BAG/Santésuisse)
const ALLE_KRANKENKASSEN = [
  'Agrisano',
  'AMB Assurance (Groupe Mutuel)',
  'Aquilana',
  'Assura',
  'Atupri',
  'Avenir (Groupe Mutuel)',
  'Caisse-maladie Vallée d\'Entremont (CMVEO)',
  'Concordia',
  'CSS',
  'Curaulta (Lumneziana)',
  'EGK',
  'Einsiedler Krankenkasse',
  'Galenos (Visana)',
  'Glarner Krankenversicherung',
  'Helsana',
  'KPT',
  'Krankenkasse Birchmeier',
  'Krankenkasse Luzerner Hinterland',
  'Krankenkasse Steffisburg',
  'Krankenkasse Wädenswil',
  'SLKK',
  'Mutuel (Groupe Mutuel)',
  'ÖKK',
  'Philos (Groupe Mutuel)',
  'rhenusana',
  'sana24 (Visana)',
  'Sanitas',
  'sodalis',
  'Sumiswalder Krankenkasse',
  'SWICA',
  'Visana',
  'Vivao Sympany',
  'easy sana (Groupe Mutuel)',
].sort();

const MODELL_OPTIONS = ['Standard', 'Telmed', 'Hausarzt', 'HMO'];

// Franchisen: Erwachsene CHF 300–2500, Kinder CHF 0–600
const FRANCHISE_ERWACHSENE = [300, 500, 1000, 1500, 2000, 2500];
const FRANCHISE_KINDER = [0, 100, 200, 300, 400, 500, 600];

function calcAge(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function calcAgeClass(age) {
  if (age === null) return null;
  if (age <= 18) return 'kind';
  if (age <= 25) return 'jugend';
  return 'erwachsen';
}

export default function KrankenkassenVergleich() {
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [kasseSearch, setKasseSearch] = useState('');
  const [showKasseDropdown, setShowKasseDropdown] = useState(false);
  const kasseRef = useRef(null);

  const [formData, setFormData] = useState({
    vorname: '', nachname: '', geburtsdatum: '',
    plz: '', wohnort: '', kanton: '',
    aktuelle_krankenkasse: '',
    aktuelles_modell: '',
    aktuelle_franchise: '',
  });
  const [resultData, setResultData] = useState({
    neue_krankenkasse: '', neues_modell: '', neue_franchise: '',
    neue_praemie: '', notizen: ''
  });

  const alter = calcAge(formData.geburtsdatum);
  const ageClass = calcAgeClass(alter);
  const isKind = ageClass === 'kind';
  const franchiseOptions = isKind ? FRANCHISE_KINDER : FRANCHISE_ERWACHSENE;

  // Krankenkassen-Dropdown schliessen bei Klick ausserhalb
  useEffect(() => {
    const handler = (e) => {
      if (kasseRef.current && !kasseRef.current.contains(e.target)) setShowKasseDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Gefilterte Kassenliste
  const filteredKassen = kasseSearch.length >= 1
    ? ALLE_KRANKENKASSEN.filter(k => k.toLowerCase().includes(kasseSearch.toLowerCase()))
    : ALLE_KRANKENKASSEN;

  const handleLoadCustomer = (customer) => {
    setSelectedCustomer(customer);
    // Franchise zurücksetzen wenn Altersklasse wechseln könnte
    setFormData(prev => ({ ...prev, aktuelle_franchise: '' }));
  };

  const openPrimInfo = () => {
    window.open('https://www.priminfo.admin.ch/de/praemien', '_blank');
    setShowResultDialog(true);
  };

  const handleSaveVergleich = async () => {
    try {
      const user = await base44.auth.me();
      const organizationId = selectedCustomer?.organization_id || user.data?.organization_id;

      await base44.entities.VergleichsAnalyse.create({
        customer_id: selectedCustomer?.id,
        customer_name: `${formData.vorname} ${formData.nachname}`,
        advisor_id: user.id,
        advisor_name: user.full_name || user.email,
        organization_id: organizationId,
        analyse_datum: new Date().toISOString(),
        persoenliche_daten: {
          vorname: formData.vorname,
          nachname: formData.nachname,
          geburtsdatum: formData.geburtsdatum,
          plz: formData.plz,
          kanton: formData.kanton,
        },
        ausgangslage: {
          krankenkasse: formData.aktuelle_krankenkasse,
          modell: formData.aktuelles_modell,
          franchise: Number(formData.aktuelle_franchise) || 0,
        },
        empfehlung: {
          empfohlene_krankenkasse: resultData.neue_krankenkasse,
          empfohlenes_modell: resultData.neues_modell,
          empfohlene_franchise: parseFloat(resultData.neue_franchise) || 0,
          praemie_empfohlen: parseFloat(resultData.neue_praemie) || 0,
        },
        status: 'beratung_erfolgt',
        notizen: resultData.notizen,
      });

      queryClient.invalidateQueries({ queryKey: ['vergleichs-analysen'] });
      setShowResultDialog(false);
      alert('✅ Vergleich erfolgreich gespeichert!');
    } catch (error) {
      alert('❌ Fehler beim Speichern: ' + error.message);
    }
  };

  const handleTestDaten = () => {
    setFormData({
      vorname: 'Peter', nachname: 'Adam',
      geburtsdatum: '1968-10-07',
      plz: '4304', wohnort: 'Giebenach', kanton: 'BL',
      aktuelle_krankenkasse: 'Mutuel (Groupe Mutuel)',
      aktuelles_modell: 'Telmed',
      aktuelle_franchise: '300',
    });
  };

  const canOpenBAG = !!(formData.plz && formData.geburtsdatum && formData.aktuelle_krankenkasse && formData.kanton);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ExternalLink className="w-6 h-6 text-primary" />
            Krankenkassenvergleich
          </h1>
          <p className="text-muted-foreground mt-1">Gateway zum offiziellen BAG-Rechner (priminfo.admin.ch)</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleTestDaten} className="text-xs">
          🧪 Testdaten laden
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Linke Spalte */}
        <div className="space-y-4">
          {/* Kundendaten */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-5 h-5 text-primary" />
                Kundendaten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerSelector
                formData={formData}
                setFormData={setFormData}
                onSelect={handleLoadCustomer}
              />
            </CardContent>
          </Card>

          {/* Aktuelle Versicherung */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-5 h-5 text-primary" />
                Aktuelle Versicherung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">

              {/* Krankenkasse — Suchfeld mit vollständiger Liste */}
              <div>
                <Label>Krankenkasse <span className="text-destructive">*</span></Label>
                <div className="relative mt-1" ref={kasseRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                  <input
                    type="text"
                    value={formData.aktuelle_krankenkasse}
                    onChange={e => {
                      setKasseSearch(e.target.value);
                      setFormData(prev => ({ ...prev, aktuelle_krankenkasse: e.target.value }));
                      setShowKasseDropdown(true);
                    }}
                    onFocus={() => setShowKasseDropdown(true)}
                    placeholder="Krankenkasse suchen..."
                    className="flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-8 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  {formData.aktuelle_krankenkasse && (
                    <button
                      type="button"
                      onClick={() => { setFormData(prev => ({ ...prev, aktuelle_krankenkasse: '' })); setKasseSearch(''); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {showKasseDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-52 overflow-y-auto rounded-md border bg-popover shadow-lg">
                      {filteredKassen.map(k => (
                        <button
                          key={k}
                          type="button"
                          onMouseDown={() => {
                            setFormData(prev => ({ ...prev, aktuelle_krankenkasse: k }));
                            setKasseSearch('');
                            setShowKasseDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                        >
                          {k}
                        </button>
                      ))}
                      {filteredKassen.length === 0 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">Keine Kasse gefunden</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Modell */}
              <div>
                <Label>Modell</Label>
                <Select value={formData.aktuelles_modell} onValueChange={v => setFormData(prev => ({ ...prev, aktuelles_modell: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Modell wählen" /></SelectTrigger>
                  <SelectContent>
                    {MODELL_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Franchise — je nach Altersklasse */}
              <div>
                <Label>
                  Franchise
                  {ageClass === 'kind' && <span className="ml-1.5 text-xs text-blue-600">(Kinder CHF 0–600)</span>}
                  {ageClass === 'erwachsen' && <span className="ml-1.5 text-xs text-muted-foreground">(Erwachsene CHF 300–2500)</span>}
                  {ageClass === 'jugend' && <span className="ml-1.5 text-xs text-muted-foreground">(Jugend CHF 0–600)</span>}
                  {!ageClass && <span className="ml-1.5 text-xs text-amber-600">(Geburtsdatum nötig)</span>}
                </Label>
                <Select
                  value={String(formData.aktuelle_franchise)}
                  onValueChange={v => setFormData(prev => ({ ...prev, aktuelle_franchise: v }))}
                  disabled={!formData.geburtsdatum}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={formData.geburtsdatum ? 'Franchise wählen' : 'Geburtsdatum eingeben'} />
                  </SelectTrigger>
                  <SelectContent>
                    {franchiseOptions.map(f => (
                      <SelectItem key={f} value={String(f)}>CHF {f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={openPrimInfo}
            disabled={!canOpenBAG}
          >
            BAG-Rechner öffnen
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
          {!canOpenBAG && (
            <p className="text-xs text-amber-600 text-center -mt-1">
              Bitte Geburtsdatum, PLZ, Kanton und Krankenkasse ausfüllen
            </p>
          )}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <Info className="w-4 h-4 inline mr-1.5" />
            Der offizielle BAG-Rechner öffnet sich in einem neuen Tab mit allen aktuellen Prämien. Nach dem Vergleich Ergebnis hier speichern.
          </div>
        </div>

        {/* Rechte Spalte — Zusammenfassung */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-5 h-5 text-primary" />
                Zusammenfassung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                ['Name', `${formData.vorname} ${formData.nachname}`.trim() || '–'],
                ['Geburtsdatum', formData.geburtsdatum ? new Date(formData.geburtsdatum).toLocaleDateString('de-CH') : '–'],
                ['Alter / Klasse', alter !== null
                  ? `${alter} Jahre · ${ageClass === 'kind' ? 'Kind' : ageClass === 'jugend' ? 'Jugend' : 'Erwachsen'}`
                  : '–'],
                ['PLZ / Ort', [formData.plz, formData.wohnort].filter(Boolean).join(' ') || '–'],
                ['Kanton', formData.kanton || '–'],
                ['Krankenkasse', formData.aktuelle_krankenkasse || '–'],
                ['Modell', formData.aktuelles_modell || '–'],
                ['Franchise', formData.aktuelle_franchise ? `CHF ${formData.aktuelle_franchise}` : '–'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-1 border-b border-border/30 last:border-0">
                  <span className="text-xs text-muted-foreground">{label}:</span>
                  <span className={`text-sm font-medium ${value === '–' ? 'text-muted-foreground' : ''}`}>{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="w-5 h-5 text-primary" />
                Ablauf
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Kunden suchen oder Daten manuell eingeben', !!formData.vorname],
                ['Geburtsdatum, Kanton und Krankenkasse wählen', canOpenBAG],
                ['BAG-Rechner öffnen (neuer Tab) — Prämien vergleichen', false],
                ['Ergebnis hier erfassen und speichern', false],
              ].map(([step, done], i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground'}`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <p className="text-sm text-muted-foreground">{step}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog: Ergebnis erfassen */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Vergleichsergebnis erfassen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg text-sm">
              <p className="font-medium">{formData.vorname} {formData.nachname}</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Aktuell: {formData.aktuelle_krankenkasse || '–'}
                {formData.aktuelles_modell && ` · ${formData.aktuelles_modell}`}
                {formData.aktuelle_franchise && ` · Franchise CHF ${formData.aktuelle_franchise}`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Neue Krankenkasse</Label>
                <Input value={resultData.neue_krankenkasse} onChange={e => setResultData(p => ({ ...p, neue_krankenkasse: e.target.value }))} placeholder="z.B. CSS, Helsana" className="mt-1" />
              </div>
              <div>
                <Label>Neues Modell</Label>
                <Select value={resultData.neues_modell} onValueChange={v => setResultData(p => ({ ...p, neues_modell: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Modell wählen" /></SelectTrigger>
                  <SelectContent>{MODELL_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Neue Franchise</Label>
                <Select value={String(resultData.neue_franchise)} onValueChange={v => setResultData(p => ({ ...p, neue_franchise: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Franchise" /></SelectTrigger>
                  <SelectContent>
                    {franchiseOptions.map(f => <SelectItem key={f} value={String(f)}>CHF {f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Neue Prämie (mtl. CHF)</Label>
                <Input type="number" step="0.01" value={resultData.neue_praemie} onChange={e => setResultData(p => ({ ...p, neue_praemie: e.target.value }))} placeholder="aus BAG-Rechner" className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Berater-Notizen</Label>
              <Input value={resultData.notizen} onChange={e => setResultData(p => ({ ...p, notizen: e.target.value }))} placeholder="Optionale Notizen..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResultDialog(false)}>Abbrechen</Button>
            <Button onClick={handleSaveVergleich} disabled={!resultData.neue_krankenkasse}>
              <Save className="w-4 h-4 mr-2" />
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}